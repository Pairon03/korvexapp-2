import { useId } from "react";
import { getCatalogExercise } from "@/domain/exercise-catalog";
import {
  getTimedExerciseMotion as getExerciseMotion,
  type Vec3,
} from "@/domain/exercise-motion";

export type ExerciseView = "perspective" | "front" | "side" | "back" | "upper";
type Shape = { depth: number; element: React.ReactNode };
const camera = {
  perspective: -0.65,
  front: 0,
  side: -1.48,
  back: 2.7,
  upper: -0.65,
};
const boundsCache = new Map<string, [number, number, number, number]>();
const mix = (a: Vec3, b: Vec3, t: number): Vec3 =>
  a.map((v, i) => v + (b[i] - v) * t) as Vec3;

/** Original vector illustration of an articulated mannequin; not an anatomical scan. */
export function ExerciseFigure({
  exerciseId,
  progress = 0.22,
  view = "perspective",
  decorative = false,
}: {
  exerciseId: string;
  progress?: number;
  view?: ExerciseView;
  decorative?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const exercise = getCatalogExercise(exerciseId);
  if (!exercise) return null;
  const frame = getExerciseMotion(exerciseId, progress),
    b = frame.body;
  const yaw = camera[view];
  const raw = (p: Vec3): Vec3 => [
    p[0] * Math.cos(yaw) - p[2] * Math.sin(yaw),
    -p[1] +
      (p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)) *
        (view === "upper" ? 0.6 : 0.16),
    p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw),
  ];
  const key = `${exerciseId}:${view}`;
  let bounds = boundsCache.get(key);
  if (!bounds) {
    const pts: Vec3[] = [];
    for (let t = 0; t < 1; t += 0.125) {
      const f = getExerciseMotion(exerciseId, t);
      pts.push(...Object.values(f.body).map(raw));
      for (const e of f.equipment) {
        if (e.kind === "line") pts.push(raw(e.from), raw(e.to));
        else {
          const size: Vec3 =
            e.kind === "box"
              ? e.size
              : [e.radius * 2, e.radius * 2, e.radius * 2];
          for (const x of [-1, 1])
            for (const y of [-1, 1])
              for (const z of [-1, 1])
                pts.push(
                  raw([
                    e.center[0] + (size[0] * x) / 2,
                    e.center[1] + (size[1] * y) / 2,
                    e.center[2] + (size[2] * z) / 2,
                  ]),
                );
        }
      }
    }
    bounds = [
      Math.min(...pts.map((p) => p[0])) - 0.2,
      Math.max(...pts.map((p) => p[0])) + 0.2,
      Math.min(...pts.map((p) => p[1])) - 0.2,
      Math.max(...pts.map((p) => p[1])) + 0.16,
    ];
    boundsCache.set(key, bounds);
  }
  const scale = Math.min(
    710 / Math.max(bounds[1] - bounds[0], 1.1),
    460 / Math.max(bounds[3] - bounds[2], 1.8),
  );
  const p = (v: Vec3): Vec3 => {
    const r = raw(v);
    return [
      430 + (r[0] - (bounds[0] + bounds[1]) / 2) * scale,
      280 + (r[1] - (bounds[2] + bounds[3]) / 2) * scale,
      r[2],
    ];
  };
  const shapes: Shape[] = [];
  const gradient = (name: string) => `url(#${uid}-${name})`;
  function tube(
    a: Vec3,
    c: Vec3,
    width: number,
    focused = false,
    equipment = false,
    color?: string,
  ) {
    const pa = p(a),
      pc = p(c),
      w = Math.max(width * scale, 1);
    shapes.push({
      depth: (pa[2] + pc[2]) / 2,
      element: (
        <g key={`tube-${shapes.length}`}>
          <line
            x1={pa[0]}
            y1={pa[1]}
            x2={pc[0]}
            y2={pc[1]}
            stroke={
              color ||
              gradient(equipment ? "metal" : focused ? "focus" : "body")
            }
            strokeWidth={w}
            strokeLinecap="round"
          />
          <line
            x1={pa[0] - w * 0.12}
            y1={pa[1]}
            x2={pc[0] - w * 0.12}
            y2={pc[1]}
            stroke={equipment ? "#ffffff18" : "#ffffff35"}
            strokeWidth={w * 0.18}
            strokeLinecap="round"
          />
        </g>
      ),
    });
  }
  function ellipsoid(
    center: Vec3,
    rx: number,
    ry: number,
    focused = false,
    fill?: string,
  ) {
    const q = p(center);
    shapes.push({
      depth: q[2],
      element: (
        <ellipse
          key={`joint-${shapes.length}`}
          cx={q[0]}
          cy={q[1]}
          rx={rx * scale}
          ry={ry * scale}
          fill={fill || gradient(focused ? "focus" : "body")}
          stroke="#111b2780"
          strokeWidth="0.6"
        />
      ),
    });
  }
  function box(center: Vec3, size: Vec3, color = "#323f4b") {
    const corners: Vec3[] = [];
    for (const x of [-1, 1])
      for (const y of [-1, 1])
        for (const z of [-1, 1])
          corners.push(
            p([
              center[0] + (x * size[0]) / 2,
              center[1] + (y * size[1]) / 2,
              center[2] + (z * size[2]) / 2,
            ]),
          );
    const face = (indices: number[], opacity: number) => {
      const points = indices
        .map((i) => `${corners[i][0]},${corners[i][1]}`)
        .join(" ");
      shapes.push({
        depth: indices.reduce((v, i) => v + corners[i][2], 0) / indices.length,
        element: (
          <polygon
            key={`face-${shapes.length}`}
            points={points}
            fill={color}
            fillOpacity={opacity}
            stroke="#a6b7c52b"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        ),
      });
    };
    face([0, 1, 3, 2], 0.8);
    face([4, 5, 7, 6], 0.9);
    face([0, 4, 6, 2], 0.7);
    face([1, 5, 7, 3], 0.85);
    face([2, 3, 7, 6], 1);
  }
  for (const e of frame.equipment) {
    if (e.kind === "line") tube(e.from, e.to, e.width, false, true, e.color);
    else if (e.kind === "box") box(e.center, e.size, e.color);
    else {
      const direction: Vec3 =
        e.axis === "x" ? [1, 0, 0] : e.axis === "y" ? [0, 1, 0] : [0, 0, 1];
      const end = (sign: number): Vec3 =>
        e.center.map(
          (v, i) => v + (direction[i] * e.length * sign) / 2,
        ) as Vec3;
      tube(end(-1), end(1), e.radius * 2, false, true);
      ellipsoid(end(1), e.radius * 0.6, e.radius, false, "#283744");
      ellipsoid(end(-1), e.radius * 0.45, e.radius, false, "#607181");
    }
  }
  const g = exercise.group;
  const shoulderFocus = g === "Ombros",
    armFocus = g === "Bíceps" || g === "Tríceps";
  const thighFocus = g === "Quadríceps" || g === "Posteriores de coxa";
  // The torso is drawn as a rounded, tapered surface, with separate muscle landmarks.
  const ls = p(b.leftShoulder),
    rs = p(b.rightShoulder),
    lh = p(b.leftHip),
    rh = p(b.rightHip),
    hip = p(b.hip);
  const torsoPath = `M ${ls[0]} ${ls[1]} Q ${(ls[0] + rs[0]) / 2} ${(ls[1] + rs[1]) / 2 - 7} ${rs[0]} ${rs[1]} Q ${rs[0] + (rh[0] - rs[0]) * 0.5} ${(rs[1] + rh[1]) / 2} ${rh[0]} ${rh[1]} Q ${hip[0]} ${hip[1] + 11} ${lh[0]} ${lh[1]} Q ${ls[0] + (lh[0] - ls[0]) * 0.5} ${(ls[1] + lh[1]) / 2} ${ls[0]} ${ls[1]} Z`;
  shapes.push({
    depth: p(b.chest)[2],
    element: (
      <path
        key="torso"
        d={torsoPath}
        fill={gradient(g === "Costas" ? "focus" : "body")}
        stroke="#65798c"
        strokeWidth="0.7"
      />
    ),
  });
  const torsoCenter = mix(b.hip, b.chest, 0.72);
  if (g === "Peito" || g === "Abdômen") {
    const center = p(g === "Abdômen" ? mix(b.hip, b.chest, 0.44) : torsoCenter);
    shapes.push({
      depth: center[2] + 0.05,
      element: (
        <g key="muscle" opacity="0.9">
          <ellipse
            cx={center[0] - scale * 0.065}
            cy={center[1]}
            rx={scale * 0.065}
            ry={scale * (g === "Peito" ? 0.06 : 0.09)}
            fill={gradient("focus")}
          />
          <ellipse
            cx={center[0] + scale * 0.065}
            cy={center[1]}
            rx={scale * 0.065}
            ry={scale * (g === "Peito" ? 0.06 : 0.09)}
            fill={gradient("focus")}
          />
        </g>
      ),
    });
  }
  tube(b.chest, b.neck, 0.105);
  ellipsoid(b.head, 0.088, 0.115);
  for (const side of ["left", "right"] as const) {
    const s = b[`${side}Shoulder`],
      elbow = b[`${side}Elbow`],
      hand = b[`${side}Hand`];
    const h = b[`${side}Hip`],
      knee = b[`${side}Knee`],
      ankle = b[`${side}Ankle`],
      toe = b[`${side}Toe`];
    tube(s, elbow, 0.09, armFocus);
    tube(elbow, hand, 0.065);
    ellipsoid(s, 0.068, 0.07, shoulderFocus);
    ellipsoid(elbow, 0.039, 0.039);
    ellipsoid(hand, 0.036, 0.047);
    tube(h, knee, 0.145, thighFocus);
    tube(knee, ankle, 0.095, g === "Panturrilhas");
    ellipsoid(h, 0.09, 0.095, g === "Glúteos");
    ellipsoid(knee, 0.052, 0.052);
    tube(ankle, toe, 0.065, false, false, "#8d9daf");
  }
  shapes.sort((a, c) => a.depth - c.depth);
  return (
    <svg
      viewBox="0 0 860 560"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={
        decorative ? undefined : `Ilustração animada: ${exercise.name}`
      }
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#728497" />
          <stop offset="0.35" stopColor="#dce4ea" />
          <stop offset="0.62" stopColor="#b8c6d3" />
          <stop offset="1" stopColor="#52687c" />
        </linearGradient>
        <linearGradient id={`${uid}-focus`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#9c3e13" />
          <stop offset="0.4" stopColor="#ffb264" />
          <stop offset="0.7" stopColor="#ff8425" />
          <stop offset="1" stopColor="#bd4e13" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`}>
          <stop stopColor="#233440" />
          <stop offset="0.4" stopColor="#6d8494" />
          <stop offset="0.6" stopColor="#a0b0bd" />
          <stop offset="1" stopColor="#263b4a" />
        </linearGradient>
        <radialGradient id={`${uid}-ground`}>
          <stop stopColor="#0b1017" stopOpacity="0.8" />
          <stop offset="1" stopColor="#0b1017" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="430" cy="496" rx="265" ry="38" fill={gradient("ground")} />
      <g opacity="0.25" stroke="#5b7082" strokeWidth="0.6">
        {[-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].map((n) => {
          const a = p([n, 0, -1.2]),
            c = p([n, 0, 1.2]),
            d = p([-1.2, 0, n]),
            e = p([1.2, 0, n]);
          return (
            <g key={n}>
              <path d={`M${a[0]} ${a[1]}L${c[0]} ${c[1]}`} />
              <path d={`M${d[0]} ${d[1]}L${e[0]} ${e[1]}`} />
            </g>
          );
        })}
      </g>
      {shapes.map((s) => s.element)}
    </svg>
  );
}
