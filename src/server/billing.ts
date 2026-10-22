import Stripe from "stripe";
import { Actor, scoped, one, admin } from "./db";
import { AppError, config, requireEnv } from "./config";
function stripe() {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    timeout: 15000,
    maxNetworkRetries: 1,
  });
}
export async function checkout(a: Actor, planId: string) {
  if (a.role !== "owner")
    throw new AppError(
      403,
      "forbidden",
      "Somente o responsável pela organização gerencia a cobrança.",
    );
  const client = stripe();
  const plan = await scoped(a, (db) =>
    one(
      db,
      "select * from app.subscription_plans where id=$1 and enabled=true",
      [planId],
    ),
  );
  if (!plan.stripe_price_id)
    throw new AppError(
      503,
      "price_unconfigured",
      "O plano ainda não foi vinculado a um preço real no provedor. Nenhuma cobrança foi iniciada.",
    );
  const db = await admin.connect();
  let sub;
  try {
    await db.query("begin");
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [a.tenantId]);
    sub = await one(
      db,
      "select * from app.subscriptions where tenant_id=$1 for update",
      [a.tenantId],
    );
    if (sub.stripe_subscription_id && sub.status !== "canceled")
      throw new AppError(
        409,
        "subscription_exists",
        "Use o portal para alterar a assinatura existente.",
      );
    if (
      sub.checkout_expires_at &&
      new Date(sub.checkout_expires_at) > new Date()
    ) {
      if (sub.checkout_plan_id !== planId)
        throw new AppError(
          409,
          "checkout_pending",
          "Há um checkout pendente de outro plano. Aguarde sua expiração ou conclua-o.",
        );
    } else {
      if (sub.checkout_session_id) {
        const previous = await client.checkout.sessions.retrieve(
          sub.checkout_session_id,
        );
        if (previous.status === "complete")
          throw new AppError(
            409,
            "payment_reconciliation_pending",
            "A compra anterior precisa ser reconciliada antes de iniciar outra.",
          );
        if (previous.status === "open")
          await client.checkout.sessions.expire(previous.id);
      }
      sub = await one(
        db,
        "update app.subscriptions set checkout_key=gen_random_uuid(),checkout_plan_id=$1,checkout_session_id=null,checkout_url=null,checkout_expires_at=date_trunc('second',now())+interval '1 hour' where tenant_id=$2 returning *",
        [planId, a.tenantId],
      );
    }
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    db.release();
  }
  if (sub.checkout_url) return { url: sub.checkout_url };
  const result = await client.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      customer: sub.stripe_customer_id || undefined,
      customer_email: sub.stripe_customer_id ? undefined : a.email,
      client_reference_id: a.tenantId,
      expires_at: Math.floor(
        new Date(sub.checkout_expires_at).getTime() / 1000,
      ),
      subscription_data: { metadata: { tenantId: a.tenantId, planId } },
      success_url: `${config.url}/painel?billing=returned`,
      cancel_url: `${config.url}/painel?billing=canceled`,
      metadata: { tenantId: a.tenantId, planId },
    },
    { idempotencyKey: `checkout:${sub.checkout_key}` },
  );
  await admin.query(
    "update app.subscriptions set checkout_session_id=$1,checkout_url=$2 where tenant_id=$3 and checkout_key=$4",
    [result.id, result.url, a.tenantId, sub.checkout_key],
  );
  return { url: result.url };
}
export async function billingPortal(a: Actor) {
  if (a.role !== "owner")
    throw new AppError(403, "forbidden", "Acesso exclusivo do responsável.");
  const client = stripe(),
    sub = await scoped(a, (db) =>
      one(db, "select * from app.subscriptions where tenant_id=$1", [
        a.tenantId,
      ]),
    );
  if (!sub.stripe_customer_id)
    throw new AppError(
      409,
      "no_customer",
      "Nenhuma assinatura vinculada ao provedor.",
    );
  return client.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${config.url}/painel`,
  });
}
export async function webhook(raw: string, signature: string | null) {
  const client = stripe(),
    secret = requireEnv("STRIPE_WEBHOOK_SECRET");
  if (!signature)
    throw new AppError(400, "invalid_signature", "Assinatura ausente.");
  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(raw, signature, secret);
  } catch {
    throw new AppError(
      400,
      "invalid_signature",
      "Assinatura de webhook inválida.",
    );
  }
  const supported = [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];
  if (!supported.includes(event.type)) return { received: true, ignored: true };
  const object = event.data.object as Stripe.Subscription;
  // Re-read canonical state, so delivery order does not resurrect a canceled plan.
  const tenantId = object.metadata.tenantId;
  if (!tenantId)
    throw new AppError(
      422,
      "missing_metadata",
      "Assinatura sem vínculo com organização.",
    );
  const db = await admin.connect();
  try {
    await db.query("begin");
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [tenantId]);
    if (
      (
        await db.query("select id from app.payment_events where id=$1", [
          event.id,
        ])
      ).rowCount
    ) {
      await db.query("commit");
      return { received: true, duplicate: true };
    }
    const current = await client.subscriptions.retrieve(object.id);
    if (current.metadata.tenantId !== tenantId)
      throw new AppError(
        422,
        "tenant_mismatch",
        "O vínculo canônico da assinatura diverge do evento.",
      );
    const plan = (
      await db.query(
        "select id,stripe_price_id from app.subscription_plans where stripe_price_id=$1",
        [current.items.data[0]?.price.id || ""],
      )
    ).rows[0];
    if (!plan || current.items.data.length !== 1)
      throw new AppError(
        422,
        "price_mismatch",
        "Preço da assinatura não corresponde ao plano cadastrado.",
      );
    await db.query(
      "update app.subscriptions set plan_id=$1,status=$2,stripe_customer_id=$3,stripe_subscription_id=$4,updated_at=now() where tenant_id=$5",
      [
        plan.id,
        current.status,
        typeof current.customer === "string"
          ? current.customer
          : current.customer.id,
        current.id,
        tenantId,
      ],
    );
    await db.query(
      "insert into app.payment_events(id,type,tenant_id) values($1,$2,$3)",
      [event.id, event.type, tenantId],
    );
    await db.query("commit");
    return { received: true };
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    db.release();
  }
}
