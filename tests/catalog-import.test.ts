import test from "node:test";
import assert from "node:assert/strict";
import { catalogImportInput, exerciseInput } from "../src/domain/contracts";
import {
  exerciseCatalog,
  getCatalogExercise,
} from "../src/domain/exercise-catalog";

test("catalog import accepts only existing exact identifiers", () => {
  for (const exercise of exerciseCatalog) {
    const parsed = catalogImportInput.parse({ catalogId: exercise.id });
    assert.equal(getCatalogExercise(parsed.catalogId)?.name, exercise.name);
  }
  for (const catalogId of [
    "",
    "unknown-exercise",
    "SUPINO-RETO-COM-BARRA",
    "../supino-reto-com-barra",
  ])
    assert.equal(catalogImportInput.safeParse({ catalogId }).success, false);
});

test("clients cannot forge catalog metadata or attach animations to custom exercises", () => {
  const catalogId = exerciseCatalog[0].id;
  assert.equal(
    catalogImportInput.safeParse({ catalogId, name: "Another exercise" })
      .success,
    false,
  );
  assert.equal(
    catalogImportInput.safeParse({ catalogId, tenantId: "another-tenant" })
      .success,
    false,
  );
  assert.equal(
    exerciseInput.safeParse({
      name: "Custom exercise",
      muscle: "peito",
      equipment: "halteres",
      instructions: "Instruções próprias do profissional.",
      catalogId,
    }).success,
    false,
  );
  assert.equal(
    exerciseInput.safeParse({
      name: "Custom exercise",
      muscle: "peito",
      equipment: "halteres",
      instructions: "Instruções próprias do profissional.",
      catalog_id: catalogId,
    }).success,
    false,
  );
});
