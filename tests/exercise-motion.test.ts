import test from "node:test";
import assert from "node:assert/strict";
import { exerciseCatalog } from "../src/domain/exercise-catalog";
import {
  getExerciseMotion,
  motionIds,
  motionPresentation,
  getTimedExerciseMotion,
  getMotionTiming,
  type MotionPresentation,
} from "../src/domain/exercise-motion";

test("all 38 catalog exercises have an original animation and no orphan motion", () => {
  assert.equal(motionIds.length, 38);
  assert.deepEqual(
    [...motionIds].sort(),
    exerciseCatalog.map((ex) => ex.animationId).sort(),
  );
});
test("every animation is finite, continuous, closes its loop and has contextual cues", () => {
  for (const id of motionIds) {
    assert.deepEqual(getExerciseMotion(id, 0), getExerciseMotion(id, 1), id);
    let previous = getExerciseMotion(id, 0);
    for (let i = 0; i <= 100; i++) {
      const frame = getExerciseMotion(id, i / 100);
      assert.ok(frame.cue.length > 15, id);
      assert.ok(frame.phase.length > 5, id);
      for (const [joint, point] of Object.entries(frame.body)) {
        assert.equal(point.length, 3, `${id}: ${joint}`);
        assert.ok(point.every(Number.isFinite), `${id}: ${joint}`);
        assert.ok(
          point.every((n) => Math.abs(n) < 3),
          `${id}: scene bounds ${joint}`,
        );
        if (i > 0) {
          const old = previous.body[joint as keyof typeof frame.body];
          assert.ok(
            Math.hypot(...point.map((n, k) => n - old[k])) < 0.12,
            `${id}: discontinuity at ${i} ${joint}`,
          );
        }
      }
      for (const item of frame.equipment) {
        if (item.kind === "line")
          assert.ok(
            [...item.from, ...item.to, item.width].every(Number.isFinite),
            id,
          );
        if (item.kind === "box")
          assert.ok([...item.center, ...item.size].every(Number.isFinite), id);
        if (item.kind === "weight")
          assert.ok(
            [...item.center, item.radius, item.length].every(Number.isFinite),
            id,
          );
      }
      previous = frame;
    }
  }
});
test("distinct exercises are not a shared generic animation", () => {
  const signatures = motionIds.map(
    (id) =>
      JSON.stringify(getExerciseMotion(id, 0.25).body) +
      JSON.stringify(getExerciseMotion(id, 0.25).equipment),
  );
  assert.equal(new Set(signatures).size, 38);
});
test("unavailable animations fail explicitly and invalid progress remains safe", () => {
  assert.throws(() => getExerciseMotion("not-an-exercise", 0.5), RangeError);
  assert.deepEqual(
    getExerciseMotion(motionIds[0], NaN),
    getExerciseMotion(motionIds[0], 0),
  );
  assert.deepEqual(
    getExerciseMotion(motionIds[0], -1),
    getExerciseMotion(motionIds[0], 0),
  );
});

test("illustrated limb segments stay inside the mannequin proportions", () => {
  const distance = (a: number[], b: number[]) =>
    Math.hypot(...a.map((n, i) => n - b[i]));
  for (const id of motionIds)
    for (let i = 0; i <= 100; i++) {
      const b = getExerciseMotion(id, i / 100).body;
      for (const side of ["left", "right"] as const) {
        assert.ok(
          distance(b[`${side}Shoulder`], b[`${side}Elbow`]) < 0.39,
          `${id}: upper arm stretch`,
        );
        assert.ok(
          distance(b[`${side}Elbow`], b[`${side}Hand`]) < 0.36,
          `${id}: forearm stretch`,
        );
        assert.ok(
          distance(b[`${side}Hip`], b[`${side}Knee`]) < 0.52,
          `${id}: thigh stretch`,
        );
        assert.ok(
          distance(b[`${side}Knee`], b[`${side}Ankle`]) < 0.52,
          `${id}: lower leg stretch`,
        );
      }
    }
});

test("production presentation covers all 38 IDs with explicit cameras, heatmaps and durations", () => {
  assert.deepEqual(
    Object.keys(motionPresentation).sort(),
    [...motionIds].sort(),
  );
  const cameras = new Set(["perspective", "front", "side", "back", "upper"]);
  for (const id of motionIds) {
    const spec: MotionPresentation = motionPresentation[id];
    assert.ok(cameras.has(spec.camera), id);
    assert.ok(spec.cameraDescription.length > 8, id);
    assert.ok(spec.primaryMuscles.length > 0, id);
    assert.ok(
      [...spec.primaryMuscles, ...spec.secondaryMuscles].every(
        (name) => name.trim().length > 2,
      ),
      id,
    );
    assert.ok(spec.durationSeconds >= 3 && spec.durationSeconds <= 6, id);
    if (spec.firstPhase === "eccentric" || spec.firstPhase === "concentric") {
      assert.ok(spec.eccentricSeconds! > 0, id);
      assert.ok(spec.concentricSeconds! > 0, id);
      assert.ok(spec.isometricSeconds! > 0, id);
      assert.ok(
        Math.abs(
          spec.eccentricSeconds! +
            spec.isometricSeconds! +
            spec.concentricSeconds! -
            spec.durationSeconds,
        ) < 1e-10,
        `${id}: cadence sum`,
      );
      assert.equal(spec.durationSource, "production-guide", id);
    }
  }
  assert.equal(
    motionPresentation.prancha.durationSource,
    "editorial-breathing-cycle",
  );
  assert.equal(motionPresentation["dead-bug"].durationSeconds, 4.2);
  assert.deepEqual(
    motionPresentation["cadeira-extensora"].secondaryMuscles,
    [],
  );
  assert.deepEqual(motionPresentation["rosca-martelo"].primaryMuscles, [
    "Braquial",
    "Braquiorradial",
  ]);
  assert.deepEqual(motionPresentation["prancha"].primaryMuscles, [
    "Reto abdominal",
    "Transverso do abdômen",
  ]);
});

test("timed loops apply the supplied first phase, isometric pause and reverse phase", () => {
  for (const id of motionIds) {
    const spec: MotionPresentation = motionPresentation[id];
    assert.deepEqual(
      getTimedExerciseMotion(id, 0),
      getTimedExerciseMotion(id, 1),
      `${id}: closed timed loop`,
    );
    if (spec.firstPhase === "eccentric" || spec.firstPhase === "concentric") {
      const first =
        spec.firstPhase === "eccentric"
          ? spec.eccentricSeconds!
          : spec.concentricSeconds!;
      const second =
        spec.firstPhase === "eccentric"
          ? spec.concentricSeconds!
          : spec.eccentricSeconds!;
      const firstMid = (first * 0.5) / spec.durationSeconds;
      const holdStart =
        (first + spec.isometricSeconds! * 0.2) / spec.durationSeconds;
      const holdEnd =
        (first + spec.isometricSeconds! * 0.8) / spec.durationSeconds;
      const reverseMid =
        (first + spec.isometricSeconds! + second * 0.5) / spec.durationSeconds;
      assert.equal(
        getMotionTiming(id, firstMid).phaseKind,
        spec.firstPhase,
        id,
      );
      assert.equal(getMotionTiming(id, holdStart).phaseKind, "isometric", id);
      assert.equal(getMotionTiming(id, holdEnd).phaseKind, "isometric", id);
      assert.equal(
        getMotionTiming(id, reverseMid).phaseKind,
        spec.firstPhase === "eccentric" ? "concentric" : "eccentric",
        id,
      );
      assert.deepEqual(
        getTimedExerciseMotion(id, holdStart).body,
        getTimedExerciseMotion(id, holdEnd).body,
        `${id}: real isometric hold`,
      );
      assert.deepEqual(
        getTimedExerciseMotion(id, holdStart).equipment,
        getTimedExerciseMotion(id, holdEnd).equipment,
        `${id}: equipment also holds`,
      );
    } else {
      assert.equal(getMotionTiming(id, 0.37).phaseKind, spec.firstPhase, id);
    }
  }
});

test("eccentric-first presses begin extended; squat and hinge retain their original initial pose", () => {
  for (const id of [
    "supino-reto-com-barra",
    "supino-reto-com-halteres",
    "supino-na-maquina",
    "flexao-de-bracos",
    "crucifixo-na-polia",
    "crucifixo-com-halteres",
    "leg-press-45",
  ]) {
    assert.deepEqual(
      getTimedExerciseMotion(id, 0).body,
      getExerciseMotion(id, 0.5).body,
      id,
    );
  }
  for (const id of [
    "mergulho-no-banco",
    "agachamento-livre-com-barra",
    "agachamento-goblet",
    "afundo-com-halteres",
    "levantamento-terra-romeno",
  ]) {
    assert.deepEqual(
      getTimedExerciseMotion(id, 0).body,
      getExerciseMotion(id, 0).body,
      id,
    );
  }
});

test("goblet keeps one vertical dumbbell gripped close to the chest throughout the loop", () => {
  for (let i = 0; i <= 100; i++) {
    const { body, equipment } = getTimedExerciseMotion(
      "agachamento-goblet",
      i / 100,
    );
    const weights = equipment.filter((item) => item.kind === "weight");
    assert.equal(weights.length, 1);
    const load = weights[0];
    assert.equal(load.axis, "y");
    assert.deepEqual(
      load.center,
      body.leftHand.map((n, k) => (n + body.rightHand[k]) / 2),
    );
    assert.ok(Math.abs(load.center[0] - body.chest[0]) < 0.001);
    assert.ok(Math.abs(load.center[1] - body.chest[1]) < 0.1);
    assert.ok(load.center[2] > body.chest[2]);
    assert.ok(load.center[2] - body.chest[2] < 0.25);
  }
});
