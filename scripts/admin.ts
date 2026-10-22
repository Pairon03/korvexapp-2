import "dotenv/config";
import { admin, app } from "../src/server/db";
import { z } from "zod";
try {
  const [command, ...args] = process.argv.slice(2);
  if (command === "metrics") {
    const result = await admin.query(
      `select (select count(*) from app.tenants) organizations,(select count(*) from app.subscriptions where status='active') active_subscriptions,(select count(*) from app.training_cycles where status='failed') failed_cycles,(select coalesce(sum(reserved_tokens),0) from app.ai_runs where created_at>=date_trunc('month',now())) reserved_tokens`,
    );
    console.log(JSON.stringify(result.rows[0], null, 2));
  } else if (command === "plan") {
    const [id, price, students, tokens, providerPrice] = args;
    const value = z
      .object({
        id: z.string().min(1).max(50),
        price: z.coerce.number().int().nonnegative(),
        students: z.coerce.number().int().positive(),
        tokens: z.coerce.number().int().positive(),
        providerPrice: z.string().startsWith("price_").optional(),
      })
      .parse({ id, price, students, tokens, providerPrice });
    const db = await admin.connect();
    try {
      await db.query("begin");
      const r = await db.query(
        "update app.subscription_plans set price_cents=$1,student_limit=$2,monthly_token_limit=$3,stripe_price_id=coalesce($4,stripe_price_id) where id=$5 returning id,name,price_cents,student_limit",
        [
          value.price,
          value.students,
          value.tokens,
          value.providerPrice || null,
          value.id,
        ],
      );
      if (!r.rowCount) throw Error("Unknown plan");
      await db.query(
        "insert into identity.operations(action,metadata) values('plan.updated',$1)",
        [
          {
            planId: value.id,
            priceCents: value.price,
            studentLimit: value.students,
          },
        ],
      );
      await db.query("commit");
      console.log(r.rows[0]);
    } catch (e) {
      await db.query("rollback");
      throw e;
    } finally {
      db.release();
    }
  } else
    throw Error(
      "Usage: npm run admin -- metrics | plan <id> <cents> <student_limit> <monthly_tokens> [stripe_price_id]",
    );
} finally {
  await Promise.all([admin.end(), app.end()]);
}
