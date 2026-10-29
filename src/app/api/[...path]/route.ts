import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { actor, issueToken, withIdentity, rateLimit } from "@/server/auth";
import { authAction } from "@/server/auth-actions";
import { admin, scoped, staff, one, audit } from "@/server/db";
import { importCatalogExercise } from "@/server/exercise-catalog";
import { previewPlans } from "@/server/preview-plans";
import { AppError, config } from "@/server/config";
import {
  assessmentInput,
  studentInput,
  exerciseInput,
  agentInput,
  id,
  programSchema,
} from "@/domain/contracts";
import {
  ensureStudentActivation,
  manualProposal,
  entitlement,
  publish,
} from "@/server/training";
import { generate } from "@/server/ai";
import { processCycle } from "@/server/cycles";
import { consent, photoLink, view, removePhoto } from "@/server/photos";
import { billingPortal, checkout, webhook } from "@/server/billing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function read(req: NextRequest, max = 65536) {
  let size = 0;
  const parts: Uint8Array[] = [];
  const reader = req.body?.getReader();
  if (!reader) return "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "body_too_large", "Requisição excede o limite.");
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString("utf8");
}
async function handle(req: NextRequest, ctx: Context) {
  const trace = randomUUID();
  try {
    const path = (await ctx.params).path.join("/"),
      method = req.method;
    if (config.preview) {
      if (method === "GET" && path === "plans")
        return NextResponse.json(previewPlans);
      if (method === "GET" && path === "health")
        return NextResponse.json({
          status: "preview",
          database: "not_configured",
          accounts: false,
        });
      throw new AppError(
        503,
        "preview_only",
        "Esta publicação é uma prévia visual. Operações de conta e dados não estão habilitadas.",
      );
    }
    if (path === "billing/webhook" && method === "POST")
      return NextResponse.json(
        await webhook(
          await read(req, 1048576),
          req.headers.get("stripe-signature"),
        ),
      );
    if (
      method !== "GET" &&
      req.headers.get("origin") !== new URL(config.url).origin
    )
      throw new AppError(403, "invalid_origin", "Origem não autorizada.");
    const raw = method === "GET" ? "" : await read(req);
    let body: unknown = {};
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        throw new AppError(400, "invalid_json", "JSON inválido.");
      }
    }
    if (path.startsWith("auth/")) {
      if (method === "GET" && path === "auth/me")
        return NextResponse.json(
          await actor(
            req.headers.get("x-tenant-id")
              ? id.parse(req.headers.get("x-tenant-id"))
              : undefined,
          ),
        );
      if (method !== "POST")
        throw new AppError(405, "method_not_allowed", "Método não permitido.");
      return NextResponse.json(await authAction(path.slice(5), body));
    }
    if (path === "health" && method === "GET") {
      await admin.query("select 1");
      return NextResponse.json({ status: "ok" });
    }
    if (path === "plans" && method === "GET")
      return NextResponse.json(
        (
          await admin.query(
            "select id,name,price_cents,currency,student_limit,monthly_token_limit from app.subscription_plans where enabled=true order by price_cents",
          )
        ).rows,
      );
    const requestedTenant =
      req.headers.get("x-tenant-id") ||
      (["export", "photos/view"].includes(path)
        ? req.nextUrl.searchParams.get("tenant")
        : null);
    const a = await actor(
      requestedTenant ? id.parse(requestedTenant) : undefined,
    );
    if (method !== "GET") await rateLimit(`mutations:${a.userId}`, 100);
    if (path === "dashboard" && method === "GET")
      return NextResponse.json(
        await scoped(a, async (db) => {
          const students = (
            await db.query(
              "select id,name,email,goal,experience,days_per_week,equipment,limitations,automation_enabled,status,revision,user_id from app.students order by created_at desc limit 100",
            )
          ).rows;
          const exercises = (
            await db.query("select * from app.exercises order by name")
          ).rows;
          const agents =
            a.role === "student"
              ? []
              : (
                  await db.query(
                    "select a.id,a.name,a.current_version,v.id version_id,v.rules from app.ai_agents a join app.ai_agent_versions v on v.agent_id=a.id and v.version=a.current_version order by a.name",
                  )
                ).rows;
          const versions = (
            await db.query(
              "select v.*,s.name student_name from app.workout_plan_versions v join app.students s on s.id=v.student_id order by published_at desc limit 100",
            )
          ).rows;
          const assessments = (
            await db.query(
              "select *,measured_on::text from app.assessments order by app.assessments.measured_on desc,app.assessments.created_at desc limit 100",
            )
          ).rows;
          const cycles = (
            await db.query(
              "select * from app.training_cycles order by due_at desc limit 100",
            )
          ).rows;
          const proposals =
            a.role === "student"
              ? []
              : (
                  await db.query(
                    "select * from app.proposals where status!='published' order by created_at desc limit 50",
                  )
                ).rows;
          const notifications = (
            await db.query(
              "select * from app.notifications order by created_at desc limit 30",
            )
          ).rows;
          const logs = (
            await db.query(
              "select * from app.workout_logs order by created_at desc limit 100",
            )
          ).rows;
          const subscription =
            a.role === "student"
              ? null
              : (
                  await db.query(
                    "select s.*,p.name,p.price_cents,p.student_limit,p.monthly_token_limit from app.subscriptions s join app.subscription_plans p on p.id=s.plan_id",
                  )
                ).rows[0];
          const tenant = await one(
            db,
            "select * from app.tenants where id=$1",
            [a.tenantId],
          );
          const organizations = (
            await admin.query(
              "select t.id,t.name,m.role from identity.tenant_members m join app.tenants t on t.id=m.tenant_id where m.user_id=$1 order by t.name",
              [a.userId],
            )
          ).rows;
          const members =
            a.role === "owner"
              ? (
                  await admin.query(
                    "select u.id,u.name,u.email,m.role from identity.tenant_members m join identity.users u on u.id=m.user_id where m.tenant_id=$1 order by u.name",
                    [a.tenantId],
                  )
                ).rows
              : [];
          return {
            actor: a,
            tenant,
            organizations,
            members,
            students,
            exercises,
            agents,
            versions,
            assessments,
            cycles,
            proposals,
            notifications,
            logs,
            subscription,
            integrations: {
              ai: !!process.env.AI_API_KEY && !!process.env.AI_MODEL,
              payments: !!process.env.STRIPE_SECRET_KEY,
              email:
                process.env.MAIL_MODE === "outbox"
                  ? "Caixa de saída local"
                  : "Provedor de e-mail",
            },
          };
        }),
      );
    if (path === "photos" && method === "GET")
      return NextResponse.json(
        await scoped(a, async (db) => ({
          photos: (
            await db.query(
              "select id,student_id,category,measured_on::text,created_at from app.progress_photos order by created_at desc limit 100",
            )
          ).rows,
          consents: (
            await db.query(
              "select distinct on(student_id) student_id,granted from app.student_consents where purpose='progress_photos' order by student_id,created_at desc,id desc",
            )
          ).rows,
        })),
      );
    if (path === "photos/consent" && method === "POST") {
      const v = z.object({ studentId: id, granted: z.boolean() }).parse(body);
      return NextResponse.json(await consent(a, v.studentId, v.granted));
    }
    if (path === "photos/link" && method === "POST") {
      const v = z.object({ photoId: id }).parse(body);
      return NextResponse.json(await photoLink(a, v.photoId));
    }
    if (path === "photos/view" && method === "GET") {
      const token = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(req.nextUrl.searchParams.get("token"));
      return new NextResponse(Uint8Array.from(await view(a, token)), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": "inline; filename=progress.jpg",
        },
      });
    }
    if (path === "photos/delete" && method === "POST") {
      const v = z.object({ photoId: id }).parse(body);
      return NextResponse.json(await removePhoto(a, v.photoId));
    }
    if (path === "organization/settings" && method === "POST") {
      if (a.role !== "owner")
        throw new AppError(
          403,
          "forbidden",
          "Apenas o responsável pode alterar a organização.",
        );
      const v = z
        .object({
          name: z.string().trim().min(2).max(100),
          timezone: z
            .string()
            .max(80)
            .refine((s) => {
              try {
                new Intl.DateTimeFormat("pt-BR", { timeZone: s });
                return true;
              } catch {
                return false;
              }
            }),
        })
        .parse(body);
      return NextResponse.json(
        await scoped(a, async (db) => {
          const row = await one(
            db,
            "update app.tenants set name=$1,timezone=$2 where id=$3 returning *",
            [v.name, v.timezone, a.tenantId],
          );
          await audit(db, a, "organization.updated", a.tenantId);
          return row;
        }),
      );
    }
    if (path === "organization/invite" && method === "POST") {
      if (a.role !== "owner")
        throw new AppError(
          403,
          "forbidden",
          "Somente o responsável convida profissionais.",
        );
      const v = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.email().transform((v) => v.toLowerCase()),
        })
        .parse(body);
      await withIdentity((db) =>
        issueToken(db, null, "staff_invite", v.email, {
          tenantId: a.tenantId,
          name: v.name,
          role: "trainer",
        }),
      );
      await scoped(a, (db) =>
        audit(db, a, "organization.trainer_invited", null, { role: "trainer" }),
      );
      return NextResponse.json({
        message: "Convite profissional encaminhado ao e-mail configurado.",
      });
    }
    if (path === "students" && method === "POST") {
      staff(a);
      const v = studentInput.parse(body);
      return NextResponse.json(
        await scoped(a, async (db) => {
          await db.query("select pg_advisory_xact_lock(hashtext($1))", [
            a.tenantId,
          ]);
          const sub = await entitlement(db, a.tenantId),
            count = await one(
              db,
              "select count(*)::int n from app.students where status='active'",
            );
          if (count.n >= sub.student_limit)
            throw new AppError(
              409,
              "student_limit",
              "Limite de alunos do plano atingido.",
            );
          const row = await one(
            db,
            "insert into app.students(tenant_id,name,email,goal,experience,days_per_week,equipment,limitations) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
            [
              a.tenantId,
              v.name,
              v.email,
              v.goal,
              v.experience,
              v.daysPerWeek,
              v.equipment,
              v.limitations,
            ],
          );
          await audit(db, a, "student.created", row.id);
          return row;
        }),
        { status: 201 },
      );
    }
    if (path === "students/invite" && method === "POST") {
      staff(a);
      const { studentId } = z.object({ studentId: id }).parse(body);
      const student = await scoped(a, (db) =>
        one(db, "select * from app.students where id=$1 and status='active'", [
          studentId,
        ]),
      );
      await withIdentity((db) =>
        issueToken(db, null, "invite", student.email, {
          tenantId: a.tenantId,
          studentId,
        }),
      );
      await scoped(a, (db) => audit(db, a, "student.invited", studentId));
      return NextResponse.json({
        message: "Convite encaminhado ao serviço de e-mail configurado.",
      });
    }
    if (path === "students/settings" && method === "POST") {
      staff(a);
      const v = z
        .object({
          studentId: id,
          automationEnabled: z.boolean(),
          status: z.enum(["active", "archived"]).default("active"),
        })
        .parse(body);
      return NextResponse.json(
        await scoped(a, async (db) => {
          await ensureStudentActivation(
            db,
            a,
            v.studentId,
            v.status,
            v.automationEnabled,
          );
          const row = await one(
            db,
            "update app.students set automation_enabled=$1,status=$2,revision=revision+1 where id=$3 returning *",
            [v.automationEnabled, v.status, v.studentId],
          );
          if (!v.automationEnabled || v.status === "archived")
            await db.query(
              "update app.training_cycles set status='suspended',reason='Automação pausada pelo profissional' where student_id=$1 and status not in ('published','canceled')",
              [v.studentId],
            );
          await audit(db, a, "student.settings_updated", row.id);
          return row;
        }),
      );
    }
    if (path === "assessments" && method === "POST") {
      const v = assessmentInput.parse(body);
      if (a.role === "student" && a.studentId !== v.studentId)
        throw new AppError(
          403,
          "forbidden",
          "Avaliação de outro aluno não permitida.",
        );
      if (v.measuredOn > new Date().toISOString().slice(0, 10))
        throw new AppError(
          422,
          "future_date",
          "A data da avaliação não pode estar no futuro.",
        );
      return NextResponse.json(
        await scoped(a, async (db) => {
          await one(db, "select id from app.students where id=$1 for update", [
            v.studentId,
          ]);
          const row = await one(
            db,
            "insert into app.assessments(tenant_id,student_id,author_id,measured_on,weight_kg,height_cm,waist_cm,new_pain,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
            [
              a.tenantId,
              v.studentId,
              a.userId,
              v.measuredOn,
              v.weightKg,
              v.heightCm,
              v.waistCm || null,
              v.newPain,
              v.notes,
            ],
          );
          await db.query(
            "update app.students set revision=revision+1 where id=$1",
            [v.studentId],
          );
          if (a.role !== "student") {
            await db.query(
              "update app.training_cycles set status=$1,reason=$2,next_attempt_at=now() where student_id=$3 and status in ('awaiting_assessment','incomplete','scheduled')",
              [
                v.newPain ? "suspended" : "scheduled",
                v.newPain ? "Dor nova relatada" : null,
                v.studentId,
              ],
            );
            await audit(db, a, "assessment.created", row.id);
          }
          return row;
        }),
        { status: 201 },
      );
    }
    if (path === "exercises/import" && method === "POST") {
      const result = await scoped(a, (db) =>
        importCatalogExercise(db, a, body),
      );
      return NextResponse.json(
        {
          ...result.exercise,
          message: result.created
            ? "Exercício e animação adicionados à sua biblioteca."
            : "Este exercício já está na sua biblioteca.",
        },
        { status: result.created ? 201 : 200 },
      );
    }
    if (path === "exercises" && method === "POST") {
      staff(a);
      const v = exerciseInput.parse(body);
      return NextResponse.json(
        await scoped(a, async (db) => {
          await entitlement(db, a.tenantId);
          return one(
            db,
            "insert into app.exercises(tenant_id,name,muscle,equipment,instructions) values($1,$2,$3,$4,$5) returning *",
            [a.tenantId, v.name, v.muscle, v.equipment, v.instructions],
          );
        }),
        { status: 201 },
      );
    }
    if (path === "agents" && method === "POST") {
      staff(a);
      const v = agentInput.parse(body);
      return NextResponse.json(
        await scoped(a, async (db) => {
          await entitlement(db, a.tenantId);
          const agent = await one(
            db,
            "insert into app.ai_agents(tenant_id,name) values($1,$2) returning *",
            [a.tenantId, v.name],
          );
          await db.query(
            "insert into app.ai_agent_versions(tenant_id,agent_id,version,rules,author_id) values($1,$2,1,$3,$4)",
            [a.tenantId, agent.id, v.rules, a.userId],
          );
          await audit(db, a, "agent.created", agent.id);
          return agent;
        }),
        { status: 201 },
      );
    }
    if (path === "agents/version" && method === "POST") {
      staff(a);
      const v = agentInput.extend({ agentId: id }).parse(body);
      return NextResponse.json(
        await scoped(a, async (db) => {
          const agent = await one(
            db,
            "select * from app.ai_agents where id=$1 for update",
            [v.agentId],
          );
          await db.query(
            "insert into app.ai_agent_versions(tenant_id,agent_id,version,rules,author_id) values($1,$2,$3,$4,$5)",
            [
              a.tenantId,
              agent.id,
              agent.current_version + 1,
              v.rules,
              a.userId,
            ],
          );
          await db.query(
            "update app.ai_agents set name=$1,current_version=current_version+1 where id=$2",
            [v.name, agent.id],
          );
          await audit(db, a, "agent.versioned", agent.id, {
            version: agent.current_version + 1,
          });
          return { version: agent.current_version + 1 };
        }),
      );
    }
    if (path === "proposals" && method === "POST") {
      const v = z
        .object({
          studentId: id,
          agentVersionId: id.optional(),
          content: programSchema,
        })
        .strict()
        .parse(body);
      return NextResponse.json(
        await manualProposal(a, v.studentId, v.content, v.agentVersionId),
        { status: 201 },
      );
    }
    if (path === "proposals/generate" && method === "POST") {
      const v = z.object({ studentId: id, agentVersionId: id }).parse(body);
      return NextResponse.json(
        await generate(a, v.studentId, v.agentVersionId),
        { status: 201 },
      );
    }
    if (path === "proposals/publish" && method === "POST") {
      const { proposalId } = z.object({ proposalId: id }).parse(body);
      staff(a);
      return NextResponse.json(
        await scoped(a, (db) => publish(db, a, proposalId)),
      );
    }
    if (path === "cycles/process" && method === "POST") {
      const { cycleId } = z.object({ cycleId: id }).parse(body);
      return NextResponse.json(await processCycle(a, cycleId));
    }
    if (path === "cycles/status" && method === "POST") {
      staff(a);
      const v = z
        .object({
          cycleId: id,
          status: z.enum(["scheduled", "suspended", "canceled"]),
        })
        .parse(body);
      return NextResponse.json(
        await scoped(a, async (db) => {
          const row = await one(
            db,
            "update app.training_cycles set status=$1,reason=$2,next_attempt_at=now() where id=$3 and status not in ('published','canceled') returning *",
            [
              v.status,
              v.status === "scheduled" ? null : "Alterado pelo profissional",
              v.cycleId,
            ],
          );
          await audit(db, a, "cycle.status_changed", row.id, {
            status: v.status,
          });
          return row;
        }),
      );
    }
    if (path === "logs" && method === "POST") {
      const v = z
        .object({
          studentId: id,
          versionId: id,
          requestId: id,
          sets: z
            .array(
              z
                .object({
                  exerciseId: id,
                  reps: z.number().int().min(1).max(200),
                  kg: z.number().min(0).max(1000),
                  rpe: z.number().min(1).max(10),
                })
                .strict(),
            )
            .min(1)
            .max(100),
          discomfort: z.boolean(),
          notes: z.string().max(2000).default(""),
        })
        .strict()
        .parse(body);
      if (a.role === "student" && v.studentId !== a.studentId)
        throw new AppError(
          403,
          "forbidden",
          "Registro de outro aluno não permitido.",
        );
      return NextResponse.json(
        await scoped(a, async (db) => {
          const version = await one(
            db,
            "select * from app.workout_plan_versions where id=$1 and student_id=$2",
            [v.versionId, v.studentId],
          );
          const allowed = new Set(
            (version.content as z.infer<typeof programSchema>).days.flatMap(
              (d) => d.exercises.map((e) => e.exerciseId),
            ),
          );
          if (v.sets.some((s) => !allowed.has(s.exerciseId)))
            throw new AppError(
              422,
              "invalid_exercise",
              "Exercício não pertence ao programa.",
            );
          const row = await one(
            db,
            "insert into app.workout_logs(tenant_id,student_id,version_id,request_id,sets,discomfort,notes,author_id) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(student_id,request_id) do update set request_id=excluded.request_id returning *",
            [
              a.tenantId,
              v.studentId,
              v.versionId,
              v.requestId,
              JSON.stringify(v.sets),
              v.discomfort,
              v.notes,
              a.userId,
            ],
          );
          return row;
        }),
        { status: 201 },
      );
    }
    if (path === "export" && method === "GET") {
      return NextResponse.json(
        await scoped(a, async (db) => ({
          students: (await db.query("select * from app.students")).rows,
          assessments: (await db.query("select * from app.assessments")).rows,
          versions: (await db.query("select * from app.workout_plan_versions"))
            .rows,
          logs: (await db.query("select * from app.workout_logs")).rows,
          exportedAt: new Date().toISOString(),
        })),
        {
          headers: {
            "Content-Disposition": 'attachment; filename="fitcore-export.json"',
          },
        },
      );
    }
    if (path === "privacy/deletion" && method === "POST") {
      await admin.query(
        "insert into app.deletion_requests(tenant_id,user_id) values($1,$2)",
        [a.tenantId, a.userId],
      );
      return NextResponse.json({
        message:
          "Solicitação registrada para análise. A exclusão ainda não foi executada.",
      });
    }
    if (path === "billing/checkout" && method === "POST") {
      const { planId } = z.object({ planId: z.string().max(50) }).parse(body);
      return NextResponse.json(await checkout(a, planId));
    }
    if (path === "billing/portal" && method === "POST")
      return NextResponse.json(await billingPortal(a));
    throw new AppError(404, "not_found", "Endpoint não encontrado.");
  } catch (e) {
    let status = 500,
      code = "internal_error",
      message =
        "Falha interna. Tente novamente e informe o identificador ao suporte.";
    if (e instanceof AppError) {
      status = e.status;
      code = e.code;
      message = e.message;
    } else if (e instanceof z.ZodError) {
      status = 422;
      code = "invalid_input";
      message = "Confira os campos e seus limites.";
    } else if (
      typeof e === "object" &&
      e &&
      "code" in e &&
      e.code === "23505"
    ) {
      status = 409;
      code = "already_exists";
      message = "Registro já existente.";
    }
    if (status >= 500)
      console.error(JSON.stringify({ event: "api_error", trace, code }));
    return NextResponse.json(
      { error: code, message, trace },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
async function secure(req: NextRequest, ctx: Context) {
  const r = await handle(req, ctx);
  r.headers.set("Cache-Control", "private, no-store");
  return r;
}
export const GET = secure;
export const POST = secure;
