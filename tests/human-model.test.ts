import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const asset = JSON.parse(
  readFileSync("public/models/human/athletic-human.json", "utf8"),
);

test("continuous human mesh preserves body-only topology and excludes helper faces", () => {
  assert.equal(asset.version, 1);
  assert.equal(asset.positions.length / 3, 13380);
  assert.equal(asset.indices.length / 3, 26756);
  assert.equal(asset.validation.helperFacesIncluded, false);
  assert.ok(asset.positions.every(Number.isFinite));
  assert.ok(
    asset.indices.every(
      (i: number) => Number.isInteger(i) && i >= 0 && i < 13380,
    ),
  );
  const heights = asset.positions.filter((_: number, i: number) => i % 3 === 1);
  assert.ok(Math.abs(Math.min(...heights)) < 0.00001);
  assert.ok(Math.abs(Math.max(...heights) - 1.85) < 0.00001);
  // Every triangle originates from the same connected body surface.
  const neighbors = Array.from({ length: 13380 }, () => new Set<number>());
  for (let i = 0; i < asset.indices.length; i += 3) {
    const triangle = asset.indices.slice(i, i + 3);
    for (const a of triangle) for (const b of triangle) neighbors[a].add(b);
  }
  const seen = new Set<number>([0]),
    queue = [0];
  for (let i = 0; i < queue.length; i++)
    for (const n of neighbors[queue[i]])
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  assert.equal(
    seen.size,
    13380,
    "face, fingers, feet and torso form a connected mesh",
  );
});

test("nineteen flat skinning bones retain normalized MakeHuman weights", () => {
  assert.equal(asset.bones.length, 19);
  assert.equal(
    new Set(asset.bones.map((b: { name: string }) => b.name)).size,
    19,
  );
  assert.equal(asset.skinIndices.length, 13380 * 4);
  assert.equal(asset.skinWeights.length, 13380 * 4);
  for (let i = 0; i < asset.skinWeights.length; i += 4) {
    assert.ok(
      Math.abs(
        asset.skinWeights
          .slice(i, i + 4)
          .reduce((a: number, b: number) => a + b, 0) - 1,
      ) < 0.000001,
    );
  }
  assert.ok(asset.skinWeights.every((w: number) => w >= 0 && w <= 1));
  assert.ok(
    asset.skinIndices.every(
      (i: number) => Number.isInteger(i) && i >= 0 && i < 19,
    ),
  );
  assert.ok(asset.validation.maxDiscardedInfluence <= 0.031);
  for (const b of asset.bones)
    assert.ok(
      Math.hypot(...b.to.map((v: number, i: number) => v - b.from[i])) > 0.01,
    );
  assert.ok(
    asset.restPose.leftShoulder[0] < 0 && asset.restPose.rightShoulder[0] > 0,
  );
  assert.ok(asset.restPose.head[1] > asset.restPose.neck[1]);
});

test("garment regions and provenance remain explicit and commercially reusable", () => {
  assert.equal(asset.regions.length, 13380);
  assert.ok(asset.regions.includes(asset.garmentRegions.shorts));
  assert.ok(asset.regions.includes(asset.garmentRegions.hair));
  assert.equal(asset.source.license, "CC0-1.0");
  assert.equal(
    asset.source.revision,
    "a8bc2d54ff0ac92e78ff71431b1023eda42bf482",
  );
  assert.equal(asset.source.makeHumanCodeIncluded, false);
  assert.equal(asset.source.assetsOnly, true);
  assert.equal(asset.source.morphs.length, 4);
  const license = readFileSync("public/models/human/CC0-1.0.txt", "utf8");
  assert.equal(
    createHash("sha256").update(license).digest("hex"),
    asset.source.sha256["LICENSE.ASSETS.md"],
  );
  assert.match(license, /including without limitation commercial/);
  assert.equal(asset.validation.anatomicalClinicalValidation, false);
});

test("illustrative muscle regions remain separate from hair and opaque shorts", () => {
  assert.equal(asset.anatomicalRegions.length, 13380);
  assert.equal(asset.anatomicalRegions.includes(11), false);
  assert.equal(asset.anatomicalRegions.includes(13), false);
  const glutes = asset.anatomicalRegions.flatMap((region: number, i: number) =>
    region === 9 ? [i] : [],
  );
  assert.ok(
    glutes.length > 50,
    "posterior hip contains a usable illustrative glute region",
  );
  for (const index of glutes) {
    const [x, y, z] = asset.positions.slice(index * 3, index * 3 + 3);
    assert.ok(
      Math.abs(x) < 0.25 &&
        y > asset.restPose.hip[1] - 0.121 &&
        y < asset.restPose.hip[1] + 0.041,
    );
    assert.ok(
      z < asset.restPose.hip[2] - 0.039,
      "no anterior-short vertex is labeled as gluteal",
    );
    assert.equal(
      asset.regions[index],
      asset.garmentRegions.shorts,
      "the opaque garment remains present over the map",
    );
  }
  assert.match(asset.regionClassification, /Editorial illustration only/);
});

test("relaxed grip folds fingers while preserving the wrist, face and body", () => {
  assert.equal(asset.gripPositions.length, asset.positions.length);
  assert.ok(asset.gripPositions.every(Number.isFinite));
  assert.equal(asset.gripMorph.kind, "relaxed-cylindrical-grip");
  let changed = 0;
  for (let i = 0; i < asset.positions.length / 3; i++) {
    const moved = asset.positions
      .slice(i * 3, i * 3 + 3)
      .some((v: number, j: number) => v !== asset.gripPositions[i * 3 + j]);
    if (!moved) continue;
    changed++;
    assert.ok(
      asset.skinIndices
        .slice(i * 4, i * 4 + 4)
        .some(
          (bone: number, j: number) =>
            asset.bones[bone].name.startsWith("hand") &&
            asset.skinWeights[i * 4 + j] > 0,
        ),
      "vertices without hand influence remain identical",
    );
    assert.ok(
      Math.hypot(
        ...asset.positions
          .slice(i * 3, i * 3 + 3)
          .map((v: number, j: number) => v - asset.gripPositions[i * 3 + j]),
      ) < 0.15,
    );
  }
  assert.equal(changed, asset.gripMorph.affectedVertices);
  assert.ok(changed > 2000 && changed < 4000);
  for (const name of ["handLeft", "handRight"]) {
    const boneIndex = asset.bones.findIndex(
        (bone: { name: string }) => bone.name === name,
      ),
      bone = asset.bones[boneIndex];
    const axis = bone.to.map((v: number, j: number) => v - bone.from[j]),
      length = Math.hypot(...axis);
    const direction = axis.map((v: number) => v / length);
    const ids = Array.from(
      { length: asset.positions.length / 3 },
      (_, i) => i,
    ).filter((i) =>
      asset.skinIndices
        .slice(i * 4, i * 4 + 4)
        .some(
          (b: number, j: number) =>
            b === boneIndex && asset.skinWeights[i * 4 + j] > 0.5,
        ),
    );
    const extent = (key: string) =>
      Math.max(
        ...ids.map((i) =>
          direction.reduce(
            (sum: number, v: number, j: number) =>
              sum + (asset[key][i * 3 + j] - bone.from[j]) * v,
            0,
          ),
        ),
      );
    assert.ok(
      extent("gripPositions") < extent("positions") * 0.7,
      "fingertips fold back toward the palm",
    );
  }
});
