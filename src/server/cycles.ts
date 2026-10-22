import { admin, Actor, scoped, one, audit, staff } from "./db";
import { context, entitlement, publish } from "./training";
import { AppError } from "./config";
import { generate } from "./ai";

export async function processCycle(a: Actor, id: string) {
  staff(a);
  const claim = await scoped(a, async (db) => {
    const c = await one(
      db,
      "select * from app.training_cycles where id=$1 for update",
      [id],
    );
    if (["published", "canceled", "suspended"].includes(c.status))
      return { skip: true };
    const {
      rows: [clock],
    } = await db.query("select now() clock");
    if (new Date(c.due_at) > new Date(clock.clock))
      throw new AppError(
        409,
        "not_due",
        "O ciclo ainda não chegou à data prevista.",
      );
    if (
      c.status === "processing" &&
      new Date(c.lease_until) > new Date(clock.clock)
    )
      return { skip: true };
    if (c.attempts >= 3)
      throw new AppError(
        409,
        "attempts_exhausted",
        "Tentativas esgotadas. Revise o erro antes de retomar.",
      );
    const ctx = await context(db, a, c.student_id, c.agent_version_id);
    let status: string | null = null,
      reason = "";
    if (!ctx.agent) {
      status = "incomplete";
      reason = "Associe uma versão válida do agente.";
    } else if (
      !ctx.assessment ||
      new Date(ctx.assessment.created_at) <= new Date(c.created_at)
    ) {
      status = "awaiting_assessment";
      reason =
        "Uma nova avaliação do ciclo é necessária; fotos não são obrigatórias.";
    } else if (
      ctx.assessment.new_pain ||
      ctx.student.limitations.trim() ||
      ctx.recentDiscomfort
    ) {
      status = "suspended";
      reason = "Dor ou limitação relatada exige revisão profissional.";
    } else if (!ctx.student.automation_enabled) {
      status = "suspended";
      reason = "Automação desativada para este aluno.";
    } else if (
      c.source_version_id !==
      (
        await one(
          db,
          "select current_version_id from app.workout_plans where id=$1",
          [c.plan_id],
        )
      ).current_version_id
    ) {
      status = "canceled";
      reason = "Programa de origem foi substituído.";
    }
    try {
      await entitlement(db, a.tenantId);
    } catch (e) {
      status = "suspended";
      reason = e instanceof Error ? e.message : "Assinatura indisponível";
    }
    if (status) {
      await db.query(
        "update app.training_cycles set status=$1,reason=$2,lease_until=null,next_attempt_at=now()+interval '1 hour' where id=$3",
        [status, reason, c.id],
      );
      await audit(db, a, "cycle.blocked", c.id, { status, reason });
      return { skip: true, status, reason };
    }
    await db.query(
      "update app.training_cycles set status='processing',attempts=attempts+1,lease_until=now()+interval '5 minutes',reason=null where id=$1",
      [id],
    );
    await audit(db, a, "cycle.started", id);
    return { skip: false, cycle: c };
  });
  if (claim.skip) return claim;
  const c = claim.cycle!;
  try {
    const proposal = await generate(a, c.student_id, c.agent_version_id, id);
    return await scoped(a, async (db) => {
      const current = await one(
        db,
        "select * from app.training_cycles where id=$1",
        [id],
      );
      if (["canceled", "suspended"].includes(current.status))
        return { status: current.status };
      if (proposal.status !== "valid") {
        await db.query(
          "update app.training_cycles set status='incomplete',reason=$1,proposal_id=$2,lease_until=null where id=$3",
          [proposal.validation.reasons.join(" "), proposal.id, id],
        );
        return { status: "incomplete" };
      }
      const ctx = await context(db, a, c.student_id, c.agent_version_id);
      if (!ctx.rules.autoPublish) {
        await db.query(
          "update app.training_cycles set status='review',proposal_id=$1,lease_until=null where id=$2",
          [proposal.id, id],
        );
        return { status: "review" };
      }
      return {
        status: "published",
        version: await publish(db, a, proposal.id, true),
      };
    });
  } catch (e) {
    const code = e instanceof AppError ? e.code : "worker_error";
    await scoped(a, async (db) => {
      await db.query(
        "update app.training_cycles set status='failed',reason=$1,lease_until=null,next_attempt_at=now()+interval '15 minutes' where id=$2 and status='processing'",
        [code, id],
      );
      await audit(db, a, "cycle.failed", id, { code });
    });
    return { status: "failed", reason: code };
  }
}
export async function tick() {
  // Worker is a privileged server process. Each tenant operation is re-scoped
  // through the same restricted role used by the HTTP backend.
  const result = await admin.query(
    `select c.id,c.tenant_id,u.id user_id,u.name,u.email from app.training_cycles c join lateral(select user_id from identity.tenant_members where tenant_id=c.tenant_id and role='owner' order by user_id limit 1)m on true join identity.users u on u.id=m.user_id where c.due_at<=now() and c.next_attempt_at<=now() and c.attempts<3 and (c.status in ('scheduled','awaiting_assessment','failed') or (c.status='processing' and c.lease_until<now())) order by c.due_at limit 20`,
  );
  for (const row of result.rows) {
    const a: Actor = {
      userId: row.user_id,
      tenantId: row.tenant_id,
      role: "owner",
      studentId: null,
      name: row.name,
      email: row.email,
    };
    await processCycle(a, row.id).catch((e) =>
      console.error(
        JSON.stringify({
          event: "worker_cycle_error",
          cycleId: row.id,
          code: e instanceof AppError ? e.code : "unknown",
        }),
      ),
    );
  }
  return result.rowCount;
}
