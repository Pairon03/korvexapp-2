import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { admin, app, scoped, Actor } from "../src/server/db";
import {
  ensureStudentActivation,
  manualProposal,
  publish,
} from "../src/server/training";
import { defaultRules } from "../src/domain/validation";
import { processCycle } from "../src/server/cycles";
import { Program } from "../src/domain/contracts";
const prefix = `test-${randomUUID()}`;
let a: Actor,
  b: Actor,
  studentId: string,
  exerciseId: string,
  agentVersionId: string,
  assessmentId: string;
const ids: string[] = [];
async function account(label: string) {
  const userId = randomUUID(),
    tenantId = randomUUID();
  await admin.query(
    "insert into identity.users(id,email,name,password_hash,verified_at) values($1,$2,$3,$4,now())",
    [
      userId,
      `${label}-${prefix}@example.test`,
      label,
      "test-only-not-a-login-hash",
    ],
  );
  await admin.query("insert into app.tenants(id,name) values($1,$2)", [
    tenantId,
    prefix,
  ]);
  await admin.query(
    "insert into identity.tenant_members values($1,$2,'owner')",
    [tenantId, userId],
  );
  await admin.query(
    "insert into app.subscriptions(tenant_id,plan_id,status,trial_ends_at) values($1,'essential','trialing',now()+interval '7 days')",
    [tenantId],
  );
  ids.push(tenantId);
  return {
    userId,
    tenantId,
    role: "owner" as const,
    studentId: null,
    name: label,
    email: `${label}-${prefix}@example.test`,
  };
}
const content = (): Program => ({
  name: "Teste de publicação",
  reason: "Programa sintético de integração",
  days: [
    {
      name: "A",
      exercises: [
        {
          exerciseId,
          sets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 60,
          rpe: 7,
          notes: "",
        },
      ],
    },
  ],
  alerts: [],
  missingData: [],
  requiresReview: false,
});
test("database workflow, RLS, publication idempotency and cycle blocks", async (t) => {
  a = await account("A");
  b = await account("B");
  await scoped(a, async (db) => {
    studentId = (
      await db.query(
        "insert into app.students(tenant_id,name,email,goal,experience,days_per_week,equipment,automation_enabled) values($1,'Aluno sintético',$2,'hypertrophy','beginner',3,array['halteres'],true) returning id",
        [a.tenantId, `${prefix}@example.test`],
      )
    ).rows[0].id;
    exerciseId = (
      await db.query(
        "insert into app.exercises(tenant_id,name,muscle,equipment,instructions) values($1,'Exercício sintético','peito','halteres','Instruções próprias de teste') returning id",
        [a.tenantId],
      )
    ).rows[0].id;
    const agent = (
      await db.query(
        "insert into app.ai_agents(tenant_id,name) values($1,'Agente de teste') returning id",
        [a.tenantId],
      )
    ).rows[0];
    agentVersionId = (
      await db.query(
        "insert into app.ai_agent_versions(tenant_id,agent_id,version,rules,author_id) values($1,$2,1,$3,$4) returning id",
        [a.tenantId, agent.id, defaultRules, a.userId],
      )
    ).rows[0].id;
    assessmentId = (
      await db.query(
        "insert into app.assessments(tenant_id,student_id,author_id,measured_on,weight_kg,height_cm) values($1,$2,$3,current_date,70,170) returning id",
        [a.tenantId, studentId, a.userId],
      )
    ).rows[0].id;
  });
  await t.test(
    "cross-tenant reads and writes denied by PostgreSQL",
    async () => {
      await scoped(b, async (db) => {
        assert.equal(
          (
            await db.query("select * from app.students where id=$1", [
              studentId,
            ])
          ).rowCount,
          0,
        );
        assert.equal(
          (
            await db.query("update app.students set name=$1 where id=$2", [
              "forbidden",
              studentId,
            ])
          ).rowCount,
          0,
        );
      });
      await assert.rejects(
        scoped(b, (db) =>
          db.query(
            "insert into app.students(tenant_id,name,email,goal,experience,days_per_week) values($1,'Forbidden','bad@example.test','hypertrophy','beginner',3)",
            [a.tenantId],
          ),
        ),
        /row-level security/,
      );
    },
  );
  await t.test("invalid exercise blocks real publication", async () => {
    const p = await manualProposal(a, studentId, content(), agentVersionId);
    assert.equal(p.status, "valid");
    const altered = {
      ...content(),
      days: [
        {
          name: "A",
          exercises: [
            { ...content().days[0].exercises[0], exerciseId: randomUUID() },
          ],
        },
      ],
    };
    const blocked = await manualProposal(a, studentId, altered, agentVersionId);
    assert.equal(blocked.status, "blocked");
    await assert.rejects(
      scoped(a, (db) => publish(db, a, blocked.id)),
      /Exercício/,
    );
  });
  let versionId: string, cycleId: string;
  await t.test(
    "concurrent publication creates exactly one immutable version",
    async () => {
      const p = await manualProposal(a, studentId, content(), agentVersionId);
      const [v1, v2] = await Promise.all([
        scoped(a, (db) => publish(db, a, p.id)),
        scoped(a, (db) => publish(db, a, p.id)),
      ]);
      assert.equal(v1.id, v2.id);
      versionId = v1.id;
      await scoped(a, async (db) => {
        assert.equal(
          (
            await db.query(
              "select * from app.workout_plan_versions where student_id=$1",
              [studentId],
            )
          ).rowCount,
          1,
        );
        cycleId = (
          await db.query(
            "select id from app.training_cycles where source_version_id=$1",
            [versionId],
          )
        ).rows[0].id;
      });
      await assert.rejects(
        scoped(a, (db) =>
          db.query(
            "update app.workout_plan_versions set reason='overwrite' where id=$1",
            [versionId],
          ),
        ),
        /permission denied|immutable/,
      );
    },
  );
  await t.test(
    "student cannot read another student or publish a version",
    async () => {
      const studentActor = { ...a, role: "student" as const, studentId };
      await scoped(studentActor, async (db) => {
        assert.equal(
          (await db.query("select id from app.students")).rowCount,
          1,
        );
        assert.equal(
          (await db.query("select id from app.exercises")).rowCount,
          1,
        );
      });
      await assert.rejects(
        scoped(studentActor, (db) => publish(db, studentActor, randomUUID())),
        /profissional/,
      );
      await scoped({ ...studentActor, studentId: randomUUID() }, async (db) => {
        assert.equal(
          (await db.query("select * from app.workout_plan_versions")).rowCount,
          0,
        );
      });
    },
  );
  await t.test(
    "server clock rejects early processing and missing new assessment blocks due cycle",
    async () => {
      await assert.rejects(processCycle(a, cycleId), /data prevista/);
      await admin.query(
        "update app.training_cycles set due_at=now()-interval '1 day' where id=$1",
        [cycleId],
      );
      const r = await processCycle(a, cycleId);
      assert.equal(r.status, "awaiting_assessment");
      assert.equal(
        (
          await admin.query(
            "select count(*)::int n from app.workout_plan_versions where student_id=$1",
            [studentId],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "stale proposals do not overwrite updated student context",
    async () => {
      const p = await manualProposal(a, studentId, content(), agentVersionId);
      await scoped(a, (db) =>
        db.query("update app.students set revision=revision+1 where id=$1", [
          studentId,
        ]),
      );
      await assert.rejects(
        scoped(a, (db) => publish(db, a, p.id)),
        /mudou/,
      );
    },
  );
  await t.test(
    "duplicate workout request does not duplicate safety events",
    async () => {
      const requestId = randomUUID(),
        set = JSON.stringify([{ exerciseId, kg: 20, reps: 10, rpe: 7 }]);
      await scoped(a, async (db) => {
        for (let i = 0; i < 2; i++)
          await db.query(
            "insert into app.workout_logs(tenant_id,student_id,version_id,request_id,sets,discomfort,author_id) values($1,$2,$3,$4,$5,true,$6) on conflict(student_id,request_id) do update set request_id=excluded.request_id",
            [a.tenantId, studentId, versionId, requestId, set, a.userId],
          );
        assert.equal(
          (
            await db.query(
              "select * from app.audit_logs where action='workout.discomfort_reported'",
            )
          ).rowCount,
          1,
        );
        const c = (
          await db.query("select status from app.training_cycles where id=$1", [
            cycleId,
          ])
        ).rows[0];
        assert.equal(c.status, "suspended");
      });
    },
  );
  await t.test(
    "reactivation cannot bypass the subscription student limit",
    async () => {
      const planId = `quota-${randomUUID()}`;
      await admin.query(
        "insert into app.subscription_plans(id,name,price_cents,currency,student_limit,monthly_token_limit,enabled) values($1,'Test quota',0,'BRL',1,100000,false)",
        [planId],
      );
      await admin.query(
        "update app.subscriptions set plan_id=$1 where tenant_id=$2",
        [planId, a.tenantId],
      );
      try {
        const archived = await scoped(
          a,
          async (db) =>
            (
              await db.query(
                "insert into app.students(tenant_id,name,email,goal,experience,days_per_week,status) values($1,'Archived test',$2,'maintenance','beginner',1,'archived') returning id",
                [a.tenantId, `${randomUUID()}@example.test`],
              )
            ).rows[0],
        );
        await assert.rejects(
          scoped(a, (db) =>
            ensureStudentActivation(db, a, archived.id, "active", false),
          ),
          /Limite de alunos/,
        );
      } finally {
        await admin.query(
          "update app.subscriptions set plan_id='essential' where tenant_id=$1",
          [a.tenantId],
        );
      }
    },
  );
  assert.ok(assessmentId);
});
after(async () => {
  console.log(
    `Integration fixtures retained in isolated test tenants: ${ids.length}. No real user data modified.`,
  );
  await Promise.all([admin.end(), app.end()]);
});
