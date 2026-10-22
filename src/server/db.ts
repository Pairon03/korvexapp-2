import pg, { PoolClient } from "pg";
import { config, AppError } from "./config";
export const admin = new pg.Pool({ connectionString: config.database, max: 8 });
export const app = new pg.Pool({
  connectionString: config.appDatabase,
  max: 8,
});
export type Actor = {
  userId: string;
  tenantId: string;
  role: "owner" | "trainer" | "student";
  studentId: string | null;
  name: string;
  email: string;
};
export async function scoped<T>(
  actor: Actor,
  fn: (db: PoolClient) => Promise<T>,
) {
  const db = await app.connect();
  try {
    await db.query("begin");
    await db.query(
      "select set_config('app.tenant_id',$1,true),set_config('app.role',$2,true),set_config('app.student_id',$3,true)",
      [actor.tenantId, actor.role, actor.studentId || ""],
    );
    const value = await fn(db);
    await db.query("commit");
    return value;
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    db.release();
  }
}
export async function one(db: PoolClient, sql: string, params: unknown[] = []) {
  const result = await db.query(sql, params);
  if (!result.rows[0])
    throw new AppError(404, "not_found", "Registro não encontrado.");
  return result.rows[0];
}
export async function audit(
  db: PoolClient,
  actor: Actor,
  action: string,
  resource: string | null,
  metadata: Record<string, unknown> = {},
) {
  await db.query(
    "insert into app.audit_logs(tenant_id,actor_id,action,resource_id,metadata) values($1,$2,$3,$4,$5)",
    [actor.tenantId, actor.userId, action, resource, metadata],
  );
}
export function staff(actor: Actor) {
  if (actor.role === "student")
    throw new AppError(403, "forbidden", "Ação exclusiva do profissional.");
}
