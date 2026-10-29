import type { PoolClient } from "pg";
import { catalogImportInput } from "../domain/contracts";
import { getCatalogExercise } from "../domain/exercise-catalog";
import { audit, one, staff, type Actor } from "./db";
import { entitlement } from "./training";

/** Import inside the caller's scoped transaction, never using an elevated pool. */
export async function importCatalogExercise(
  db: PoolClient,
  actor: Actor,
  value: unknown,
) {
  staff(actor);
  const input = catalogImportInput.parse(value);
  const canonical = getCatalogExercise(input.catalogId)!;
  await entitlement(db, actor.tenantId);
  // A client cannot attach a standard animation to a different name,
  // instruction or piece of equipment: metadata comes from the server catalog.
  const inserted = await db.query(
    "insert into app.exercises(tenant_id,catalog_id,name,muscle,equipment,instructions) values($1,$2,$3,$4,$5,$6) on conflict(tenant_id,catalog_id) where catalog_id is not null do nothing returning *",
    [
      actor.tenantId,
      canonical.id,
      canonical.name,
      canonical.group,
      canonical.equipment[0].toLocaleLowerCase("pt-BR"),
      canonical.instruction,
    ],
  );
  // Read Committed sees the committed winner if a concurrent import won the
  // unique constraint. A retry returns the original UUID and doesn't re-audit.
  const exercise =
    inserted.rows[0] ||
    (await one(
      db,
      "select * from app.exercises where tenant_id=$1 and catalog_id=$2",
      [actor.tenantId, canonical.id],
    ));
  if (inserted.rows[0])
    await audit(db, actor, "exercise.imported", exercise.id, {
      catalogId: canonical.id,
    });
  return { exercise, created: !!inserted.rows[0] };
}
