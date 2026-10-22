import { PoolClient } from "pg";
import { Actor, scoped, one, audit, staff } from "./db";
import { AppError } from "./config";
import {
  Program,
  Rules,
  Student,
  Assessment,
  Exercise,
  programSchema,
} from "../domain/contracts";
import { cycleDue, defaultRules, validateProgram } from "../domain/validation";

export async function entitlement(db: PoolClient, tenantId: string) {
  const sub = await one(
    db,
    "select s.*,p.student_limit,p.monthly_token_limit from app.subscriptions s join app.subscription_plans p on p.id=s.plan_id where s.tenant_id=$1",
    [tenantId],
  );
  if (
    sub.status !== "active" &&
    !(sub.status === "trialing" && new Date(sub.trial_ends_at) > new Date())
  )
    throw new AppError(
      402,
      "subscription_required",
      "A demonstração expirou ou a assinatura não permite esta operação. Seus dados foram preservados.",
    );
  return sub;
}
export async function context(
  db: PoolClient,
  a: Actor,
  studentId: string,
  agentVersionId?: string | null,
) {
  const student = (await one(db, "select * from app.students where id=$1", [
    studentId,
  ])) as Student & Record<string, unknown>;
  const assessment = (
    await db.query(
      "select *,measured_on::text from app.assessments where student_id=$1 order by app.assessments.measured_on desc,app.assessments.created_at desc limit 1",
      [studentId],
    )
  ).rows[0] as Assessment | undefined;
  const exercises = (
    await db.query("select * from app.exercises where enabled=true")
  ).rows as Exercise[];
  const tenant = await one(db, "select * from app.tenants where id=$1", [
    a.tenantId,
  ]);
  const recentDiscomfort = !!(
    await one(
      db,
      "select exists(select 1 from app.workout_logs where student_id=$1 and discomfort=true and created_at>coalesce($2::timestamptz,'epoch'::timestamptz)) found",
      [studentId, assessment?.created_at || null],
    )
  ).found;
  const agent = agentVersionId
    ? await one(db, "select * from app.ai_agent_versions where id=$1", [
        agentVersionId,
      ])
    : null;
  return {
    student,
    assessment: assessment || null,
    exercises,
    rules: (agent?.rules || defaultRules) as Rules,
    recentDiscomfort,
    now: new Date(),
    timezone: tenant.timezone as string,
    agent,
  };
}
export async function publish(
  db: PoolClient,
  a: Actor,
  proposalId: string,
  automatic = false,
) {
  staff(a);
  await entitlement(db, a.tenantId);
  const p = await one(
    db,
    "select * from app.proposals where id=$1 for update",
    [proposalId],
  );
  // Retry returns exactly the already-published immutable version.
  if (p.status === "published")
    return one(db, "select * from app.workout_plan_versions where id=$1", [
      p.published_version_id,
    ]);
  await db.query("select id from app.students where id=$1 for update", [
    p.student_id,
  ]);
  const ctx = await context(db, a, p.student_id, p.agent_version_id);
  const validation = validateProgram(p.content, ctx);
  if (!validation.valid)
    throw new AppError(422, "validation_blocked", validation.reasons.join(" "));
  if (
    ctx.student.revision !== p.student_revision ||
    ctx.assessment?.id !== p.assessment_id
  )
    throw new AppError(
      409,
      "stale_context",
      "O perfil ou avaliação mudou. Crie uma nova proposta.",
    );
  if (
    automatic &&
    (!ctx.student.automation_enabled || !ctx.rules.autoPublish || !p.cycle_id)
  )
    throw new AppError(
      409,
      "automation_disabled",
      "Publicação automática não autorizada.",
    );
  await db.query(
    "insert into app.workout_plans(tenant_id,student_id) values($1,$2) on conflict(student_id,tenant_id) do nothing",
    [a.tenantId, p.student_id],
  );
  const plan = await one(
    db,
    "select * from app.workout_plans where student_id=$1 for update",
    [p.student_id],
  );
  if (plan.current_version_id !== p.base_version_id)
    throw new AppError(
      409,
      "stale_version",
      "O programa vigente mudou. Gere outra proposta.",
    );
  if (p.cycle_id) {
    const c = await one(
      db,
      "select * from app.training_cycles where id=$1 for update",
      [p.cycle_id],
    );
    if (["canceled", "suspended"].includes(c.status))
      throw new AppError(
        409,
        "cycle_inactive",
        "O ciclo foi pausado ou cancelado.",
      );
  }
  const version = await one(
    db,
    "insert into app.workout_plan_versions(tenant_id,plan_id,student_id,version,content,source,cycle_id,agent_version_id,author_id,reason) values($1,$2,$3,(select coalesce(max(version),0)+1 from app.workout_plan_versions where plan_id=$2),$4,$5,$6,$7,$8,$9) returning *",
    [
      a.tenantId,
      plan.id,
      p.student_id,
      p.content,
      p.ai_run_id ? "ai" : "manual",
      p.cycle_id,
      p.agent_version_id,
      a.userId,
      (p.content as Program).reason,
    ],
  );
  await db.query(
    "update app.workout_plans set current_version_id=$1 where id=$2",
    [version.id, plan.id],
  );
  await db.query(
    "update app.proposals set status='published',published_version_id=$2 where id=$1",
    [p.id, version.id],
  );
  if (p.cycle_id)
    await db.query(
      "update app.training_cycles set status='published',reason=null,lease_until=null where id=$1",
      [p.cycle_id],
    );
  // Retire competing old cycles. New version pins the immutable agent version.
  await db.query(
    "update app.training_cycles set status='canceled',reason='Programa substituído por nova versão' where plan_id=$1 and status not in ('published','canceled')",
    [plan.id],
  );
  if (p.agent_version_id) {
    await db.query(
      "insert into app.training_cycles(tenant_id,student_id,plan_id,source_version_id,agent_version_id,interval_days,timezone,due_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(source_version_id) do nothing",
      [
        a.tenantId,
        p.student_id,
        plan.id,
        version.id,
        p.agent_version_id,
        ctx.rules.cycleDays,
        ctx.timezone,
        cycleDue(version.published_at, ctx.rules.cycleDays, ctx.timezone),
      ],
    );
  }
  await db.query(
    "insert into app.notifications(tenant_id,student_id,kind,message) values($1,$2,'program_published','Uma nova versão do seu programa está disponível.')",
    [a.tenantId, p.student_id],
  );
  await audit(
    db,
    a,
    automatic ? "program.auto_published" : "program.published",
    version.id,
    { version: version.version },
  );
  return version;
}
export async function manualProposal(
  a: Actor,
  studentId: string,
  content: Program,
  agentVersionId?: string,
) {
  staff(a);
  return scoped(a, async (db) => {
    await entitlement(db, a.tenantId);
    const ctx = await context(db, a, studentId, agentVersionId);
    const validation = validateProgram(content, ctx);
    const plan = (
      await db.query(
        "select current_version_id from app.workout_plans where student_id=$1",
        [studentId],
      )
    ).rows[0];
    const p = await one(
      db,
      "insert into app.proposals(tenant_id,student_id,agent_version_id,content,validation,status,student_revision,assessment_id,base_version_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
      [
        a.tenantId,
        studentId,
        agentVersionId || null,
        programSchema.parse(content),
        validation,
        validation.valid ? "valid" : "blocked",
        ctx.student.revision,
        ctx.assessment?.id || null,
        plan?.current_version_id || null,
      ],
    );
    await audit(db, a, "proposal.created", p.id, { valid: validation.valid });
    return p;
  });
}

export async function ensureStudentActivation(
  db: PoolClient,
  a: Actor,
  studentId: string,
  status: "active" | "archived",
  automationEnabled: boolean,
) {
  await db.query("select pg_advisory_xact_lock(hashtext($1))", [a.tenantId]);
  const current = await one(
    db,
    "select * from app.students where id=$1 for update",
    [studentId],
  );
  const activating = status === "active" && current.status !== "active";
  if (activating || (automationEnabled && !current.automation_enabled)) {
    const sub = await entitlement(db, a.tenantId);
    if (activating) {
      const count = await one(
        db,
        "select count(*)::int n from app.students where status='active'",
      );
      if (count.n >= sub.student_limit)
        throw new AppError(
          409,
          "student_limit",
          "Limite de alunos do plano atingido.",
        );
    }
  }
}
