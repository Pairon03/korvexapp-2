import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Quaternion, Vector3, Matrix4 } from "three";
import {
  getHumanBoneTarget,
  getHumanBoneRotation,
  getHumanGrip,
  type HumanAsset,
} from "../src/domain/human-rig";
import { exerciseCatalog } from "../src/domain/exercise-catalog";
import { getTimedExerciseMotion } from "../src/domain/exercise-motion";
const asset = JSON.parse(
  readFileSync(
    new URL("../public/models/human/athletic-human.json", import.meta.url),
    "utf8",
  ),
) as HumanAsset;
const y = new Vector3(0, 1, 0),
  one = new Vector3(1, 1, 1);
const restMatrices = asset.bones.map((b) =>
  new Matrix4().compose(
    new Vector3(...b.from),
    new Quaternion().setFromUnitVectors(
      y,
      new Vector3(...b.to).sub(new Vector3(...b.from)).normalize(),
    ),
    one,
  ),
);
const inverse = restMatrices.map((m) => m.clone().invert());
test("human bind pose preserves every original vertex and bone roll", () => {
  asset.bones.forEach((bone, i) => {
    const t = getHumanBoneTarget(bone, asset.restPose, asset.restPose);
    assert.ok(
      new Vector3(...t.from).distanceTo(new Vector3(...bone.from)) < 1e-6,
    );
    assert.ok(new Vector3(...t.to).distanceTo(new Vector3(...bone.to)) < 1e-6);
    const matrix = new Matrix4()
      .compose(
        new Vector3(...t.from),
        new Quaternion(...getHumanBoneRotation(bone, t)),
        one,
      )
      .multiply(inverse[i]);
    matrix.elements.forEach((v, j) =>
      assert.ok(Math.abs(v - (j % 5 === 0 ? 1 : 0)) < 1e-6),
    );
  });
});
test("all 38 exercises deform the continuous human skin with finite bounded vertices", () => {
  const source = new Vector3(),
    p = new Vector3(),
    result = new Vector3();
  for (const ex of exerciseCatalog)
    for (const progress of [0, 0.2, 0.5, 0.8]) {
      const pose = getTimedExerciseMotion(ex.id, progress).body;
      const transforms = asset.bones.map((bone, i) => {
        const t = getHumanBoneTarget(bone, asset.restPose, pose),
          ratio =
            new Vector3(...t.to).distanceTo(new Vector3(...t.from)) /
            new Vector3(...bone.to).distanceTo(new Vector3(...bone.from));
        assert.ok(
          Number.isFinite(ratio) && ratio > 0.05 && ratio < 3,
          `${ex.id}:${bone.name} plausible graphical scale`,
        );
        return new Matrix4()
          .compose(
            new Vector3(...t.from),
            new Quaternion(...getHumanBoneRotation(bone, t)),
            new Vector3(1, ratio, 1),
          )
          .multiply(inverse[i]);
      });
      for (let i = 0; i < asset.positions.length / 3; i++) {
        source.fromArray(asset.positions, i * 3);
        if (asset.gripPositions)
          source.lerp(
            p.fromArray(asset.gripPositions, i * 3),
            getHumanGrip(ex.id),
          );
        result.set(0, 0, 0);
        for (let j = 0; j < 4; j++)
          result.addScaledVector(
            p
              .copy(source)
              .applyMatrix4(transforms[asset.skinIndices[i * 4 + j]]),
            asset.skinWeights[i * 4 + j],
          );
        assert.ok(
          result.toArray().every((v) => Number.isFinite(v) && Math.abs(v) < 4),
          `${ex.id} vertex ${i} valid`,
        );
      }
    }
});
