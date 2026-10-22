import { z } from "zod";
import { credentials, registration } from "../domain/contracts";
import { admin } from "./db";
import { AppError } from "./config";
import {
  actor,
  digest,
  hashPassword,
  identity,
  issueToken,
  logout,
  passwordMatches,
  rateLimit,
  session,
  withIdentity,
} from "./auth";
export async function authAction(path: string, body: unknown) {
  if (path === "register") {
    const v = registration.parse(body);
    await rateLimit(`register:${v.email}`, 3);
    const hash = await hashPassword(v.password);
    await withIdentity(async (db) => {
      const {
        rows: [user],
      } = await db.query(
        "insert into identity.users(email,name,password_hash) values($1,$2,$3) returning id",
        [v.email, v.name, hash],
      );
      const {
        rows: [tenant],
      } = await db.query(
        "insert into app.tenants(name) values($1) returning id",
        [v.organization],
      );
      await db.query(
        "insert into identity.tenant_members values($1,$2,'owner')",
        [tenant.id, user.id],
      );
      await db.query(
        "insert into app.subscriptions(tenant_id,plan_id,status,trial_ends_at) values($1,'essential','trialing',now()+interval '7 days')",
        [tenant.id],
      );
      await issueToken(db, user.id, "verify", v.email);
    });
    return {
      message:
        "Conta criada. Confirme seu e-mail antes de entrar. A demonstração dura 7 dias.",
    };
  }
  if (path === "login") {
    const v = credentials.parse(body);
    await rateLimit(`login:${v.email}`);
    const user = (
      await admin.query("select * from identity.users where email=$1", [
        v.email,
      ])
    ).rows[0];
    const fallback = "0123456789abcdef0123456789abcdef:" + "0".repeat(128);
    const valid = await passwordMatches(
      v.password,
      user?.password_hash || fallback,
    );
    if (!user || !valid || !user.verified_at)
      throw new AppError(
        401,
        "invalid_login",
        "E-mail, senha ou confirmação de conta inválidos.",
      );
    await session(user.id);
    return { message: "Sessão iniciada." };
  }
  if (path === "logout") {
    await logout();
    return { message: "Sessão encerrada." };
  }
  if (path === "verify") {
    const { token } = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(body);
    await withIdentity(async (db) => {
      const t = (
        await db.query(
          "select * from identity.tokens where token_hash=$1 and purpose='verify' and used_at is null and expires_at>now() for update",
          [digest(token)],
        )
      ).rows[0];
      if (!t)
        throw new AppError(400, "invalid_token", "Link inválido ou expirado.");
      await db.query(
        "update identity.users set verified_at=now() where id=$1",
        [t.user_id],
      );
      await db.query(
        "update identity.tokens set used_at=now() where token_hash=$1",
        [digest(token)],
      );
    });
    return { message: "E-mail confirmado. Você já pode entrar." };
  }
  if (path === "request-reset") {
    const { email } = z
      .object({ email: z.email().transform((v) => v.toLowerCase()) })
      .parse(body);
    await rateLimit(`reset:${email}`, 3);
    const user = (
      await admin.query("select id from identity.users where email=$1", [email])
    ).rows[0];
    if (user)
      await withIdentity((db) => issueToken(db, user.id, "reset", email));
    return {
      message:
        "Se houver uma conta, enviaremos as instruções para o e-mail informado.",
    };
  }
  if (path === "reset") {
    const { token, password } = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: credentials.shape.password,
      })
      .parse(body);
    const hash = await hashPassword(password);
    await withIdentity(async (db) => {
      const t = (
        await db.query(
          "select * from identity.tokens where token_hash=$1 and purpose='reset' and used_at is null and expires_at>now() for update",
          [digest(token)],
        )
      ).rows[0];
      if (!t)
        throw new AppError(400, "invalid_token", "Link inválido ou expirado.");
      await db.query("update identity.users set password_hash=$1 where id=$2", [
        hash,
        t.user_id,
      ]);
      await db.query("delete from identity.sessions where user_id=$1", [
        t.user_id,
      ]);
      await db.query(
        "update identity.tokens set used_at=now() where user_id=$1 and purpose='reset'",
        [t.user_id],
      );
    });
    await logout();
    return { message: "Senha alterada. Entre novamente." };
  }
  if (path === "accept-invite") {
    const v = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: credentials.shape.password.optional(),
      })
      .parse(body);
    const current = await identity();
    const userId = await withIdentity(async (db) => {
      const t = (
        await db.query(
          "select * from identity.tokens where token_hash=$1 and purpose in ('invite','staff_invite') and used_at is null and expires_at>now() for update",
          [digest(v.token)],
        )
      ).rows[0];
      if (!t)
        throw new AppError(
          400,
          "invalid_token",
          "Convite inválido ou expirado.",
        );
      const isStaff = t.purpose === "staff_invite";
      const student = isStaff
        ? {
            email: t.payload.email,
            name: t.payload.name,
            tenant_id: t.payload.tenantId,
            id: null,
          }
        : (
            await db.query(
              "select * from app.students where id=$1 and tenant_id=$2 and status='active' for update",
              [t.payload.studentId, t.payload.tenantId],
            )
          ).rows[0];
      if (!student)
        throw new AppError(400, "invalid_invite", "Vínculo indisponível.");
      const role = isStaff ? "trainer" : "student";
      let user = (
        await db.query("select * from identity.users where email=$1", [
          student.email,
        ])
      ).rows[0];
      if (user) {
        if (current?.id !== user.id)
          throw new AppError(
            409,
            "login_required",
            "Este e-mail já tem conta. Entre nela e abra o convite novamente.",
          );
      } else {
        if (!v.password)
          throw new AppError(
            422,
            "password_required",
            "Defina uma senha de pelo menos 12 caracteres.",
          );
        user = (
          await db.query(
            "insert into identity.users(email,name,password_hash,verified_at) values($1,$2,$3,now()) returning id",
            [student.email, student.name, await hashPassword(v.password)],
          )
        ).rows[0];
      }
      const existing = (
        await db.query(
          "select role from identity.tenant_members where tenant_id=$1 and user_id=$2",
          [student.tenant_id, user.id],
        )
      ).rows[0];
      if (existing && existing.role !== role)
        throw new AppError(
          409,
          "role_conflict",
          "Conta já vinculada como profissional nesta organização.",
        );
      await db.query(
        "insert into identity.tenant_members values($1,$2,$3) on conflict do nothing",
        [student.tenant_id, user.id, role],
      );
      if (!isStaff)
        await db.query("update app.students set user_id=$1 where id=$2", [
          user.id,
          student.id,
        ]);
      await db.query(
        "update identity.tokens set used_at=now() where token_hash=$1",
        [digest(v.token)],
      );
      return user.id as string;
    });
    await session(userId);
    return { message: "Convite aceito. Seu treino estará na área do aluno." };
  }
  if (path === "me") return actor();
  throw new AppError(404, "not_found", "Operação não encontrada.");
}
