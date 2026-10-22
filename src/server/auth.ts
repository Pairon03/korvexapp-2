import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { PoolClient } from "pg";
import { admin, Actor } from "./db";
import { AppError, config } from "./config";
import { sendMail } from "./mail";
const scrypt = promisify(scryptCallback);
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${((await scrypt(value, salt, 64)) as Buffer).toString("hex")}`;
}
export async function passwordMatches(value: string, hash: string) {
  const [salt, hex] = hash.split(":");
  const expected = Buffer.from(hex, "hex");
  const actual = (await scrypt(value, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function rateLimit(key: string, limit = 10) {
  const result = await admin.query(
    `insert into identity.rate_limits(key,hits) values($1,1) on conflict(key) do update set hits=case when identity.rate_limits.window_at<now()-interval '15 minutes' then 1 else identity.rate_limits.hits+1 end,window_at=case when identity.rate_limits.window_at<now()-interval '15 minutes' then now() else identity.rate_limits.window_at end returning hits`,
    [digest(key)],
  );
  if (result.rows[0].hits > limit)
    throw new AppError(
      429,
      "rate_limit",
      "Muitas tentativas. Aguarde 15 minutos.",
    );
}
export async function identity() {
  const token = (await cookies()).get("fitcore_session")?.value;
  if (!token) return null;
  const r = await admin.query(
    "select u.id,u.name,u.email from identity.sessions s join identity.users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now() and u.verified_at is not null",
    [digest(token)],
  );
  return r.rows[0] as { id: string; name: string; email: string } | undefined;
}
export async function actor(tenantId?: string): Promise<Actor> {
  const user = await identity();
  if (!user) throw new AppError(401, "unauthenticated", "Entre na sua conta.");
  const memberships = await admin.query(
    "select m.tenant_id,m.role,s.id student_id from identity.tenant_members m left join app.students s on s.tenant_id=m.tenant_id and s.user_id=m.user_id and s.status='active' where m.user_id=$1 and ($2::uuid is null or m.tenant_id=$2::uuid) order by m.tenant_id limit 1",
    [user.id, tenantId || null],
  );
  const member = memberships.rows[0];
  if (!member)
    throw new AppError(
      403,
      "forbidden",
      "Você não tem acesso a esta organização.",
    );
  if (member.role === "student" && !member.student_id)
    throw new AppError(
      403,
      "student_inactive",
      "O vínculo do aluno está inativo.",
    );
  return {
    userId: user.id,
    tenantId: member.tenant_id,
    role: member.role,
    studentId: member.student_id,
    name: user.name,
    email: user.email,
  };
}
export async function session(userId: string) {
  const raw = randomBytes(32).toString("hex");
  await admin.query(
    "insert into identity.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '7 days')",
    [digest(raw), userId],
  );
  (await cookies()).set("fitcore_session", raw, {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
}
export async function logout() {
  const token = (await cookies()).get("fitcore_session")?.value;
  if (token)
    await admin.query("delete from identity.sessions where token_hash=$1", [
      digest(token),
    ]);
  (await cookies()).delete("fitcore_session");
}
export async function issueToken(
  db: PoolClient,
  userId: string | null,
  purpose: "verify" | "reset" | "invite" | "staff_invite",
  email: string,
  payload: Record<string, unknown> = {},
) {
  const raw = randomBytes(32).toString("hex");
  await db.query(
    `insert into identity.tokens(token_hash,user_id,purpose,payload,expires_at) values($1,$2,$3,$4,now()+$5::interval)`,
    [
      digest(raw),
      userId,
      purpose,
      { ...payload, email },
      purpose === "reset"
        ? "1 hour"
        : ["invite", "staff_invite"].includes(purpose)
          ? "7 days"
          : "24 hours",
    ],
  );
  const route =
    purpose === "verify"
      ? "confirmar"
      : purpose === "reset"
        ? "recuperar"
        : "convite";
  await sendMail(
    email,
    purpose === "staff_invite"
      ? "Convite profissional FitCore"
      : purpose === "invite"
        ? "Convite FitCore"
        : purpose === "verify"
          ? "Confirme sua conta FitCore"
          : "Redefinir senha FitCore",
    `Acesse ${config.url}/${route}?token=${raw}\nSe você não solicitou, ignore este e-mail. Não compartilhe este link.`,
  );
}
export async function withIdentity<T>(fn: (db: PoolClient) => Promise<T>) {
  const db = await admin.connect();
  try {
    await db.query("begin");
    const r = await fn(db);
    await db.query("commit");
    return r;
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    db.release();
  }
}
