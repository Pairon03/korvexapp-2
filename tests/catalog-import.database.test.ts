import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { admin, app, type Actor } from "../src/server/db";
import { importCatalogExercise } from "../src/server/exercise-catalog";
import { exerciseCatalog } from "../src/domain/exercise-catalog";

test("real catalog import preserves canonical data, idempotency, tenant scope and staff access", async (t) => {
  const db = await admin.connect();
  const tenantIds: string[] = [];
  await db.query("begin");
  try {
    async function fixture(label: string, active = true): Promise<Actor> {
      const userId = randomUUID(),
        tenantId = randomUUID();
      await db.query(
        "insert into identity.users(id,email,name,password_hash,verified_at) values($1,$2,$3,'test-only-not-a-login-hash',now())",
        [userId, `catalog-${userId}@example.test`, label],
      );
      await db.query("insert into app.tenants(id,name) values($1,$2)", [
        tenantId,
        `Catalog test ${label}`,
      ]);
      await db.query(
        "insert into identity.tenant_members values($1,$2,'owner')",
        [tenantId, userId],
      );
      await db.query(
        "insert into app.subscriptions(tenant_id,plan_id,status,trial_ends_at) values($1,'essential',$2,now()+interval '7 days')",
        [tenantId, active ? "trialing" : "canceled"],
      );
      tenantIds.push(tenantId);
      return {
        userId,
        tenantId,
        role: "owner",
        studentId: null,
        name: label,
        email: `catalog-${userId}@example.test`,
      };
    }
    const a = await fixture("A"),
      b = await fixture("B"),
      expired = await fixture("Expired", false);
    await db.query("set local role fitcore_app");
    async function scope(actor: Actor) {
      await db.query(
        "select set_config('app.tenant_id',$1,true),set_config('app.role',$2,true),set_config('app.student_id',$3,true)",
        [actor.tenantId, actor.role, actor.studentId || ""],
      );
    }
    const canonical = exerciseCatalog[0];
    let aExerciseId: string;
    await t.test(
      "canonical server fields and animation identifier persist exactly once",
      async () => {
        await scope(a);
        const first = await importCatalogExercise(db, a, {
          catalogId: canonical.id,
        });
        assert.equal(first.created, true);
        assert.equal(first.exercise.tenant_id, a.tenantId);
        assert.equal(first.exercise.catalog_id, canonical.id);
        assert.equal(first.exercise.name, canonical.name);
        assert.equal(first.exercise.muscle, canonical.group);
        assert.equal(first.exercise.instructions, canonical.instruction);
        assert.equal(
          first.exercise.equipment,
          canonical.equipment[0].toLocaleLowerCase("pt-BR"),
        );
        aExerciseId = first.exercise.id;
        const repeated = await importCatalogExercise(db, a, {
          catalogId: canonical.id,
        });
        assert.equal(repeated.created, false);
        assert.equal(repeated.exercise.id, aExerciseId);
        assert.equal(
          (await db.query("select count(*)::int n from app.exercises")).rows[0]
            .n,
          1,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from app.audit_logs where action='exercise.imported'",
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "another tenant imports independently and cannot read the first tenant's exercise",
      async () => {
        await scope(b);
        assert.equal(
          (
            await db.query("select id from app.exercises where id=$1", [
              aExerciseId,
            ])
          ).rowCount,
          0,
        );
        const own = await importCatalogExercise(db, b, {
          catalogId: canonical.id,
        });
        assert.equal(own.created, true);
        assert.equal(own.exercise.tenant_id, b.tenantId);
        assert.notEqual(own.exercise.id, aExerciseId);
        assert.equal(
          (await db.query("select count(*)::int n from app.exercises")).rows[0]
            .n,
          1,
        );
        await assert.rejects(
          importCatalogExercise(db, a, { catalogId: canonical.id }),
          /Registro não encontrado/,
        );
      },
    );
    await t.test(
      "students cannot import even when the library item already exists",
      async () => {
        const student: Actor = {
          ...a,
          role: "student",
          studentId: randomUUID(),
        };
        await scope(student);
        await assert.rejects(
          importCatalogExercise(db, student, { catalogId: canonical.id }),
          /exclusiva do profissional/,
        );
        await scope(a);
        assert.equal(
          (await db.query("select count(*)::int n from app.exercises")).rows[0]
            .n,
          1,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from app.audit_logs where action='exercise.imported'",
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "unknown IDs, forged metadata and expired entitlements cannot import",
      async () => {
        await scope(a);
        await assert.rejects(
          importCatalogExercise(db, a, { catalogId: "not-in-the-library" }),
        );
        await assert.rejects(
          importCatalogExercise(db, a, {
            catalogId: canonical.id,
            name: "Forged",
            tenantId: b.tenantId,
          }),
        );
        assert.equal(
          (await db.query("select count(*)::int n from app.exercises")).rows[0]
            .n,
          1,
        );
        await scope(expired);
        await assert.rejects(
          importCatalogExercise(db, expired, { catalogId: canonical.id }),
          /assinatura não permite/,
        );
        assert.equal(
          (await db.query("select count(*)::int n from app.exercises")).rows[0]
            .n,
          0,
        );
      },
    );
  } finally {
    await db.query("rollback");
    db.release();
    // All fixtures, imports and audit records are rolled back together.
    assert.equal(
      (
        await admin.query(
          "select id from app.tenants where id=any($1::uuid[])",
          [tenantIds],
        )
      ).rowCount,
      0,
    );
  }
});
after(async () => {
  await Promise.all([admin.end(), app.end()]);
});
