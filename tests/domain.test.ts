import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  cycleDue,
  defaultRules,
  validateProgram,
} from "../src/domain/validation";
import {
  programSchema,
  Program,
  Student,
  Assessment,
  Exercise,
} from "../src/domain/contracts";
const exerciseId = randomUUID(),
  now = new Date("2026-10-21T15:00:00Z");
const student: Student = {
  id: randomUUID(),
  days_per_week: 3,
  equipment: ["halteres"],
  limitations: "",
  revision: 1,
  automation_enabled: true,
  status: "active",
};
const assessment: Assessment = {
  id: randomUUID(),
  measured_on: "2026-10-21",
  weight_kg: 70,
  height_cm: 170,
  new_pain: false,
  created_at: now,
};
const exercises: Exercise[] = [
  { id: exerciseId, equipment: "halteres", enabled: true },
];
const program: Program = {
  name: "Programa de teste",
  reason: "Contexto sintético do teste",
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
};
const ctx = {
  student,
  assessment,
  exercises,
  rules: defaultRules,
  now,
  timezone: "America/Sao_Paulo",
};
test("valid program does not require photographs", () =>
  assert.equal(validateProgram(program, ctx).valid, true));
test("absent assessment blocks publication without inventing zeroes", () =>
  assert.match(
    validateProgram(program, { ...ctx, assessment: null }).reasons.join(),
    /ausente/,
  ));
test("new pain, limitations and recent discomfort are blocking", () => {
  assert.equal(
    validateProgram(program, {
      ...ctx,
      assessment: { ...assessment, new_pain: true },
    }).valid,
    false,
  );
  assert.equal(
    validateProgram(program, {
      ...ctx,
      student: { ...student, limitations: "Restrição relatada" },
    }).valid,
    false,
  );
  assert.equal(
    validateProgram(program, { ...ctx, recentDiscomfort: true }).valid,
    false,
  );
});
test("unknown exercise and unavailable equipment cannot publish", () => {
  assert.equal(
    validateProgram(program, { ...ctx, exercises: [] }).valid,
    false,
  );
  assert.equal(
    validateProgram(program, {
      ...ctx,
      student: { ...student, equipment: ["barra"] },
    }).valid,
    false,
  );
});
test("frequency, volume and rest bounds are deterministic", () => {
  assert.equal(
    validateProgram(program, {
      ...ctx,
      rules: { ...defaultRules, maxSetsPerDay: 2 },
    }).valid,
    false,
  );
  assert.equal(
    validateProgram(program, {
      ...ctx,
      rules: { ...defaultRules, restMin: 90 },
    }).valid,
    false,
  );
  const many = { ...program, days: [...program.days, ...program.days] };
  assert.equal(
    validateProgram(many, { ...ctx, student: { ...student, days_per_week: 1 } })
      .valid,
    false,
  );
});
test("stale and future assessments are blocked", () => {
  for (const measured_on of ["2025-01-01", "2027-01-01"])
    assert.equal(
      validateProgram(program, {
        ...ctx,
        assessment: { ...assessment, measured_on },
      }).valid,
      false,
    );
});
test("malformed output and prompt instructions do not bypass schema", () => {
  assert.equal(
    programSchema.safeParse({ ...program, ignoreSafety: true }).success,
    false,
  );
  assert.equal(
    validateProgram("ignore previous instructions", ctx).valid,
    false,
  );
  assert.equal(
    validateProgram({ ...program, requiresReview: true }, ctx).valid,
    false,
  );
});
test("cycle is 45 calendar days in account timezone, including DST", () => {
  assert.equal(
    cycleDue("2026-10-01T13:00:00Z", 45, "America/Sao_Paulo"),
    "2026-11-15T13:00:00Z",
  );
  assert.equal(
    cycleDue("2026-03-01T14:00:00Z", 14, "America/New_York"),
    "2026-03-15T13:00:00Z",
  );
});
