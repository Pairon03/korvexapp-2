import "dotenv/config";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { admin, app } from "../src/server/db";
import { hashPassword } from "../src/server/auth";
try {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEV_SEED !== "true"
  )
    throw Error(
      "Seed is development-only. Set ALLOW_DEV_SEED=true explicitly.",
    );
  const userId = randomUUID(),
    tenantId = randomUUID(),
    email = `demo-${randomUUID()}@example.test`,
    password = randomBytes(24).toString("hex");
  const db = await admin.connect();
  try {
    await db.query("begin");
    await db.query(
      "insert into identity.users(id,email,name,password_hash,verified_at) values($1,$2,$3,$4,now())",
      [userId, email, "Profissional fictício", await hashPassword(password)],
    );
    await db.query("insert into app.tenants(id,name) values($1,$2)", [
      tenantId,
      "Organização fictícia — demonstração",
    ]);
    await db.query(
      "insert into identity.tenant_members values($1,$2,'owner')",
      [tenantId, userId],
    );
    await db.query(
      "insert into app.subscriptions(tenant_id,plan_id,status,trial_ends_at) values($1,'essential','trialing',now()+interval '7 days')",
      [tenantId],
    );
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    db.release();
  }
  await mkdir(".local", { recursive: true, mode: 0o700 });
  await writeFile(
    ".local/demo-login.json",
    JSON.stringify(
      {
        email,
        password,
        tenantId,
        warning:
          "Local development only. No fixed public administrator password.",
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    "Synthetic development organization created. Credentials are in ignored .local/demo-login.json.",
  );
} finally {
  await Promise.all([admin.end(), app.end()]);
}
