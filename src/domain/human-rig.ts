import type { Skeleton, Vec3 } from "./exercise-motion";

export type HumanBone = { name: string; from: Vec3; to: Vec3 };
export type HumanAsset = {
  version: number;
  positions: number[];
  gripPositions?: number[];
  indices: number[];
  skinIndices: number[];
  skinWeights: number[];
  regions: number[];
  anatomicalRegions: number[];
  regionNames: string[];
  bones: HumanBone[];
  restPose: Skeleton;
  restLandmarks: Record<string, Vec3>;
};

/** Illustrative hand pose: open for body support; closed around weights/handles. */
export function getHumanGrip(exerciseId: string): number {
  if (
    ["flexao-de-bracos", "mergulho-no-banco", "prancha", "dead-bug"].includes(
      exerciseId,
    )
  )
    return 0;
  return exerciseId === "agachamento-goblet" ? 0.65 : 0.9;
}
const add = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v + b[i]) as Vec3;
const sub = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v - b[i]) as Vec3;
const mul = (a: Vec3, s: number): Vec3 => a.map((v) => v * s) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec3) => Math.hypot(...a);
const unit = (a: Vec3): Vec3 => mul(a, 1 / Math.max(length(a), 1e-8));

/** Shortest rotation between directions; shared with the offline renderer. */
export function rotateHumanVector(from: Vec3, to: Vec3, value: Vec3): Vec3 {
  const a = unit(from),
    b = unit(to),
    d = dot(a, b);
  let xyz: Vec3, w: number;
  if (d < -0.999999) {
    xyz = unit(cross(a, Math.abs(a[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0]));
    w = 0;
  } else {
    xyz = cross(a, b);
    w = 1 + d;
    const n = Math.hypot(...xyz, w);
    xyz = mul(xyz, 1 / Math.max(n, 1e-8));
    w /= Math.max(n, 1e-8);
  }
  return add(
    value,
    add(mul(cross(xyz, value), 2 * w), mul(cross(xyz, cross(xyz, value)), 2)),
  );
}

/** Target endpoints preserve the continuous skin's bind pose and head/hand volume. */
export function getHumanBoneTarget(
  bone: HumanBone,
  rest: Skeleton,
  pose: Skeleton,
): HumanBone {
  const restAxis = sub(rest.chest, rest.hip),
    axis = sub(pose.chest, pose.hip);
  const rotate = (v: Vec3) => rotateHumanVector(restAxis, axis, v);
  const torsoScale = length(axis) / Math.max(length(restAxis), 1e-8);
  const trunk = (v: Vec3) =>
    add(pose.hip, mul(rotate(sub(v, rest.hip)), torsoScale));
  const head = (v: Vec3) => add(pose.neck, rotate(sub(v, rest.neck)));
  const result = (from: Vec3, to: Vec3): HumanBone => ({
    name: bone.name,
    from,
    to,
  });
  if (["pelvis", "spine", "chest"].includes(bone.name))
    return result(trunk(bone.from), trunk(bone.to));
  if (bone.name === "neck") return result(trunk(bone.from), head(bone.to));
  if (bone.name === "head") return result(head(bone.from), head(bone.to));
  for (const [suffix, side] of [
    ["Left", "left"],
    ["Right", "right"],
  ] as const) {
    const shoulder = pose[`${side}Shoulder`],
      elbow = pose[`${side}Elbow`],
      hand = pose[`${side}Hand`],
      hip = pose[`${side}Hip`],
      knee = pose[`${side}Knee`],
      ankle = pose[`${side}Ankle`];
    if (bone.name === `clavicle${suffix}`)
      return result(trunk(bone.from), shoulder);
    if (bone.name === `upperArm${suffix}`) return result(shoulder, elbow);
    if (bone.name === `forearm${suffix}`) return result(elbow, hand);
    if (bone.name === `hand${suffix}`) {
      const transform = (v: Vec3) =>
        add(
          hand,
          rotateHumanVector(
            sub(rest[`${side}Hand`], rest[`${side}Elbow`]),
            sub(hand, elbow),
            sub(v, rest[`${side}Hand`]),
          ),
        );
      return result(transform(bone.from), transform(bone.to));
    }
    if (bone.name === `thigh${suffix}`) return result(hip, knee);
    if (bone.name === `shin${suffix}`) return result(knee, ankle);
    if (bone.name === `foot${suffix}`) {
      const transform = (v: Vec3) =>
        add(
          ankle,
          rotateHumanVector(
            sub(rest[`${side}Toe`], rest[`${side}Ankle`]),
            sub(pose[`${side}Toe`], ankle),
            sub(v, rest[`${side}Ankle`]),
          ),
        );
      return result(transform(bone.from), transform(bone.to));
    }
  }
  throw new RangeError(`Unknown human bone: ${bone.name}`);
}

/** Preserve the bind-pose roll so elbows and wrists do not twist arbitrarily. */
export function getHumanBoneRotation(
  rest: HumanBone,
  target: HumanBone,
): [number, number, number, number] {
  const between = (u: Vec3, v: Vec3): [number, number, number, number] => {
    const a = unit(u),
      b = unit(v),
      d = dot(a, b);
    if (d < -0.999999) {
      const c = unit(cross(a, Math.abs(a[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0]));
      return [...c, 0];
    }
    const c = cross(a, b),
      w = 1 + d,
      n = Math.hypot(...c, w);
    return [c[0] / n, c[1] / n, c[2] / n, w / n];
  };
  const r = between([0, 1, 0], sub(rest.to, rest.from)),
    q = between(sub(rest.to, rest.from), sub(target.to, target.from));
  return [
    q[3] * r[0] + q[0] * r[3] + q[1] * r[2] - q[2] * r[1],
    q[3] * r[1] - q[0] * r[2] + q[1] * r[3] + q[2] * r[0],
    q[3] * r[2] + q[0] * r[1] - q[1] * r[0] + q[2] * r[3],
    q[3] * r[3] - q[0] * r[0] - q[1] * r[1] - q[2] * r[2],
  ];
}
