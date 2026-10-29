import test from "node:test";
import assert from "node:assert/strict";
import {
  cautionRegions,
  exerciseCatalog,
  exerciseEquipment,
  exerciseGroups,
  exerciseLevels,
  getCatalogExercise,
  movementPatterns,
} from "../src/domain/exercise-catalog";

test("catálogo mantém os 38 nomes e a distribuição do documento original", () => {
  const namesByGroup = {
    Peito: [
      "Supino reto com barra",
      "Supino reto com halteres",
      "Supino na máquina",
      "Flexão de braços",
      "Crucifixo na polia",
      "Crucifixo com halteres",
    ],
    Costas: [
      "Puxada frontal na polia",
      "Barra fixa assistida",
      "Puxada com elástico",
      "Remada curvada com barra",
      "Remada baixa na polia",
      "Remada unilateral com halter",
      "Remada com elástico",
    ],
    Ombros: [
      "Desenvolvimento com halteres",
      "Desenvolvimento na máquina",
      "Elevação lateral",
      "Face pull",
    ],
    Bíceps: ["Rosca direta", "Rosca martelo", "Rosca na polia"],
    Tríceps: [
      "Tríceps na polia",
      "Tríceps francês com halter",
      "Mergulho no banco",
    ],
    Quadríceps: [
      "Agachamento livre com barra",
      "Agachamento goblet",
      "Leg press 45°",
      "Cadeira extensora",
      "Afundo com halteres",
    ],
    "Posteriores de coxa": [
      "Levantamento terra romeno",
      "Mesa flexora",
      "Flexão de joelho com elástico",
    ],
    Glúteos: ["Elevação pélvica", "Abdução de quadril"],
    Panturrilhas: ["Panturrilha em pé", "Panturrilha sentado"],
    Abdômen: ["Prancha", "Dead bug", "Abdominal na polia"],
  };
  assert.equal(exerciseCatalog.length, 38);
  assert.equal(exerciseGroups.length, 10);
  for (const [group, names] of Object.entries(namesByGroup)) {
    assert.deepEqual(
      exerciseCatalog
        .filter((exercise) => exercise.group === group)
        .map((exercise) => exercise.name),
      names,
    );
  }
});

test("IDs são únicos, estáveis e correspondem aos IDs das animações locais", () => {
  assert.equal(
    new Set(exerciseCatalog.map((exercise) => exercise.id)).size,
    38,
  );
  assert.equal(
    new Set(exerciseCatalog.map((exercise) => exercise.name)).size,
    38,
  );
  for (const exercise of exerciseCatalog) {
    assert.match(exercise.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(exercise.animationId, exercise.id);
    assert.equal(getCatalogExercise(exercise.id), exercise);
  }
  assert.equal(getCatalogExercise("exercicio-inexistente"), undefined);
  assert.equal(getCatalogExercise("leg-press-45")?.name, "Leg press 45°");
});

test("substituições apontam para exercícios existentes e preservam escolhas do catálogo", () => {
  for (const exercise of exerciseCatalog) {
    assert.ok(exercise.substitutionIds.length > 0, exercise.id);
    assert.equal(
      new Set(exercise.substitutionIds).size,
      exercise.substitutionIds.length,
    );
    for (const substitutionId of exercise.substitutionIds) {
      assert.notEqual(substitutionId, exercise.id);
      assert.ok(
        getCatalogExercise(substitutionId),
        `${exercise.id} → ${substitutionId}`,
      );
    }
  }
  assert.deepEqual(
    getCatalogExercise("levantamento-terra-romeno")?.substitutionIds,
    ["mesa-flexora", "elevacao-pelvica"],
  );
  assert.deepEqual(getCatalogExercise("prancha")?.substitutionIds, [
    "dead-bug",
    "abdominal-na-polia",
  ]);
});

test("metadados têm valores conhecidos e instruções completas, sem links de vídeo fictícios", () => {
  for (const exercise of exerciseCatalog) {
    assert.ok(exerciseGroups.includes(exercise.group));
    assert.ok(movementPatterns.includes(exercise.pattern));
    assert.ok(exerciseLevels.includes(exercise.level));
    assert.ok(exercise.equipment.length > 0);
    exercise.equipment.forEach((item) =>
      assert.ok(exerciseEquipment.includes(item)),
    );
    exercise.cautions.forEach((item) =>
      assert.ok(cautionRegions.includes(item)),
    );
    exercise.secondaryMuscles.forEach((item) =>
      assert.ok(exerciseGroups.includes(item)),
    );
    assert.ok(exercise.instruction.trim().length > 20, exercise.id);
    assert.ok(exercise.commonMistakes.length > 0, exercise.id);
    assert.ok(
      exercise.commonMistakes.every((mistake) => mistake.trim().length > 0),
    );
    assert.equal("videoUrl" in exercise, false);
  }
});

test("cuidados múltiplos e ausência de cuidados listados mantêm o conteúdo original", () => {
  assert.deepEqual(
    getCatalogExercise("agachamento-livre-com-barra")?.cautions,
    ["Joelho", "Lombar"],
  );
  assert.deepEqual(getCatalogExercise("triceps-frances-com-halter")?.cautions, [
    "Cotovelo",
    "Ombro",
  ]);
  assert.deepEqual(getCatalogExercise("mergulho-no-banco")?.cautions, [
    "Ombro",
    "Punho",
  ]);
  assert.deepEqual(getCatalogExercise("supino-na-maquina")?.cautions, []);
  assert.deepEqual(getCatalogExercise("elevacao-pelvica")?.cautions, []);
});
