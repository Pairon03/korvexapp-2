/**
 * Poses editoriais originais do FitCore Korvex, em metros (x lateral, y altura,
 * z frente). Não são captura de movimento nem validação biomecânica clínica.
 * Cada ciclo começa e termina na mesma pose; o player controla o tempo.
 */
export type Vec3 = [number, number, number];
export type Skeleton = {
  hip: Vec3;
  chest: Vec3;
  neck: Vec3;
  head: Vec3;
  leftShoulder: Vec3;
  rightShoulder: Vec3;
  leftElbow: Vec3;
  rightElbow: Vec3;
  leftHand: Vec3;
  rightHand: Vec3;
  leftHip: Vec3;
  rightHip: Vec3;
  leftKnee: Vec3;
  rightKnee: Vec3;
  leftAnkle: Vec3;
  rightAnkle: Vec3;
  leftToe: Vec3;
  rightToe: Vec3;
};
export type EquipmentAxis = "x" | "y" | "z";
export type EquipmentPrimitive =
  | { kind: "line"; from: Vec3; to: Vec3; width: number; color?: string }
  | { kind: "box"; center: Vec3; size: Vec3; color?: string }
  | {
      kind: "weight";
      center: Vec3;
      axis: EquipmentAxis;
      radius: number;
      length: number;
    };
export type MotionFrame = {
  body: Skeleton;
  equipment: EquipmentPrimitive[];
  phase: string;
  cue: string;
};
export const motionIds = [
  "supino-reto-com-barra",
  "supino-reto-com-halteres",
  "supino-na-maquina",
  "flexao-de-bracos",
  "crucifixo-na-polia",
  "crucifixo-com-halteres",
  "puxada-frontal-na-polia",
  "barra-fixa-assistida",
  "puxada-com-elastico",
  "remada-curvada-com-barra",
  "remada-baixa-na-polia",
  "remada-unilateral-com-halter",
  "remada-com-elastico",
  "desenvolvimento-com-halteres",
  "desenvolvimento-na-maquina",
  "elevacao-lateral",
  "face-pull",
  "rosca-direta",
  "rosca-martelo",
  "rosca-na-polia",
  "triceps-na-polia",
  "triceps-frances-com-halter",
  "mergulho-no-banco",
  "agachamento-livre-com-barra",
  "agachamento-goblet",
  "leg-press-45",
  "cadeira-extensora",
  "afundo-com-halteres",
  "levantamento-terra-romeno",
  "mesa-flexora",
  "flexao-de-joelho-com-elastico",
  "elevacao-pelvica",
  "abducao-de-quadril",
  "panturrilha-em-pe",
  "panturrilha-sentado",
  "prancha",
  "dead-bug",
  "abdominal-na-polia",
] as const;
export type MotionId = (typeof motionIds)[number];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec3) => Math.hypot(...a);
const unit = (a: Vec3): Vec3 => mul(a, 1 / (length(a) || 1));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const pointMix = (a: Vec3, b: Vec3, t: number): Vec3 =>
  add(a, mul(sub(b, a), t));
const line = (
  from: Vec3,
  to: Vec3,
  width = 0.035,
  color?: string,
): EquipmentPrimitive => ({ kind: "line", from, to, width, color });
const box = (center: Vec3, size: Vec3, color?: string): EquipmentPrimitive => ({
  kind: "box",
  center,
  size,
  color,
});
const weight = (
  center: Vec3,
  axis: EquipmentAxis = "x",
  radius = 0.105,
  len = 0.16,
): EquipmentPrimitive => ({
  kind: "weight",
  center,
  axis,
  radius,
  length: len,
});
/** Two-segment IK keeps the arm silhouette coherent while the hand grips a load. */
function joint(root: Vec3, end: Vec3, a: number, b: number, bend: Vec3): Vec3 {
  const delta = sub(end, root),
    d = Math.max(0.001, Math.min(a + b - 0.001, length(delta)));
  const dir = unit(delta),
    along = (a * a - b * b + d * d) / (2 * d);
  let normal = sub(bend, mul(dir, dot(bend, dir)));
  if (length(normal) < 0.001)
    normal = sub([0, 0, 1], mul(dir, dot([0, 0, 1], dir)));
  if (length(normal) < 0.001) normal = [1, 0, 0];
  return add(
    add(root, mul(dir, along)),
    mul(unit(normal), Math.sqrt(Math.max(0, a * a - along * along))),
  );
}
function standing(): Skeleton {
  return {
    hip: [0, 0.98, 0],
    chest: [0, 1.48, 0],
    neck: [0, 1.61, 0],
    head: [0, 1.76, 0],
    leftShoulder: [-0.22, 1.48, 0],
    rightShoulder: [0.22, 1.48, 0],
    leftElbow: [-0.26, 1.19, 0.03],
    rightElbow: [0.26, 1.19, 0.03],
    leftHand: [-0.27, 0.91, 0.05],
    rightHand: [0.27, 0.91, 0.05],
    leftHip: [-0.115, 0.98, 0],
    rightHip: [0.115, 0.98, 0],
    leftKnee: [-0.16, 0.53, 0.035],
    rightKnee: [0.16, 0.53, 0.035],
    leftAnkle: [-0.17, 0.08, 0],
    rightAnkle: [0.17, 0.08, 0],
    leftToe: [-0.17, 0.045, 0.18],
    rightToe: [0.17, 0.045, 0.18],
  };
}
function trunk(b: Skeleton, hip: Vec3, pitch = 0) {
  b.hip = hip;
  const direction: Vec3 = [0, Math.cos(pitch), Math.sin(pitch)];
  b.chest = add(hip, mul(direction, 0.5));
  b.neck = add(hip, mul(direction, 0.63));
  b.head = add(hip, mul(direction, 0.78));
  b.leftHip = add(hip, [-0.115, 0, 0]);
  b.rightHip = add(hip, [0.115, 0, 0]);
  b.leftShoulder = add(b.chest, [-0.22, 0, 0]);
  b.rightShoulder = add(b.chest, [0.22, 0, 0]);
}
function arms(
  b: Skeleton,
  left: Vec3,
  right: Vec3,
  bendLeft: Vec3 = [-0.6, 0, 0.7],
  bendRight: Vec3 = [0.6, 0, 0.7],
) {
  b.leftHand = left;
  b.rightHand = right;
  b.leftElbow = joint(b.leftShoulder, left, 0.3, 0.29, bendLeft);
  b.rightElbow = joint(b.rightShoulder, right, 0.3, 0.29, bendRight);
}
function legs(b: Skeleton, left: Vec3, right: Vec3, bend: Vec3 = [0, 0, 1]) {
  b.leftAnkle = left;
  b.rightAnkle = right;
  b.leftKnee = joint(b.leftHip, left, 0.45, 0.45, bend);
  b.rightKnee = joint(b.rightHip, right, 0.45, 0.45, bend);
  b.leftToe = add(left, [0, -0.035, 0.18]);
  b.rightToe = add(right, [0, -0.035, 0.18]);
}
function seated(b: Skeleton, height = 0.57) {
  trunk(b, [0, height, 0]);
  b.leftKnee = [-0.17, height, 0.43];
  b.rightKnee = [0.17, height, 0.43];
  b.leftAnkle = [-0.17, 0.1, 0.48];
  b.rightAnkle = [0.17, 0.1, 0.48];
  b.leftToe = [-0.17, 0.055, 0.66];
  b.rightToe = [0.17, 0.055, 0.66];
}
function bench(
  e: EquipmentPrimitive[],
  center: Vec3 = [0, 0.42, -0.25],
  long = 1.35,
) {
  e.push(box(center, [0.46, 0.12, long], "#303c50"));
  for (const z of [-0.48, 0.48])
    e.push(
      line(add(center, [0, -0.05, z]), add(center, [0, -center[1], z]), 0.06),
      line(
        add(center, [-0.3, -center[1], z]),
        add(center, [0.3, -center[1], z]),
        0.05,
      ),
    );
}
function chair(e: EquipmentPrimitive[], height = 0.47, back = true) {
  e.push(box([0, height, 0], [0.48, 0.12, 0.5], "#303c50"));
  for (const x of [-0.18, 0.18])
    e.push(
      line([x, 0, -0.16], [x, height, -0.16], 0.05),
      line([x, 0, 0.16], [x, height, 0.16], 0.05),
    );
  if (back)
    e.push(box([0, height + 0.39, -0.18], [0.45, 0.66, 0.12], "#303c50"));
}
function dumbbell(e: EquipmentPrimitive[], p: Vec3, axis: EquipmentAxis = "x") {
  e.push(weight(p, axis, 0.075, 0.22));
}
function dumbbells(
  b: Skeleton,
  e: EquipmentPrimitive[],
  axis: EquipmentAxis = "x",
) {
  dumbbell(e, b.leftHand, axis);
  dumbbell(e, b.rightHand, axis);
}
function barbell(e: EquipmentPrimitive[], left: Vec3, right: Vec3) {
  const middle = pointMix(left, right, 0.5),
    half = Math.max(0.62, Math.abs(left[0]) + 0.22);
  e.push(
    line(
      add(middle, [-half - 0.12, 0, 0]),
      add(middle, [half + 0.12, 0, 0]),
      0.035,
      "#bac7d9",
    ),
  );
  e.push(
    weight(add(middle, [-half, 0, 0]), "x", 0.18, 0.11),
    weight(add(middle, [half, 0, 0]), "x", 0.18, 0.11),
  );
}
function cableFrame(e: EquipmentPrimitive[], wide = false) {
  const x = wide ? 0.85 : 0.66;
  for (const side of [-1, 1]) {
    e.push(
      line([side * x, 0, -0.45], [side * x, 2.22, -0.45], 0.045),
      line([side * x, 0, -0.64], [side * x, 0, 0.36], 0.05),
    );
    e.push(box([side * x, 0.41, -0.46], [0.2, 0.64, 0.2], "#253144"));
  }
  e.push(line([-x, 2.22, -0.45], [x, 2.22, -0.45], 0.045));
}
function supine(b: Skeleton) {
  trunk(b, [0, 0.59, 0], -Math.PI / 2);
  b.leftKnee = [-0.17, 0.43, 0.37];
  b.rightKnee = [0.17, 0.43, 0.37];
  b.leftAnkle = [-0.18, 0.08, 0.4];
  b.rightAnkle = [0.18, 0.08, 0.4];
  b.leftToe = [-0.18, 0.045, 0.58];
  b.rightToe = [0.18, 0.045, 0.58];
}
function squat(b: Skeleton, q: number) {
  trunk(b, [0, mix(0.98, 0.62, q), mix(0, -0.23, q)], mix(0, 0.25, q));
  legs(b, [-0.26, 0.08, 0.05], [0.26, 0.08, 0.05]);
}
const cues: Record<MotionId, string> = {
  "supino-reto-com-barra":
    "Mantenha escápulas e quadril apoiados. Use a amplitude orientada pelo personal.",
  "supino-reto-com-halteres":
    "Desça os halteres com controle e mantenha os punhos alinhados.",
  "supino-na-maquina":
    "Ajuste o assento para que as alças fiquem na linha do peito.",
  "flexao-de-bracos":
    "Mantenha tronco e quadril alinhados durante a descida e a subida.",
  "crucifixo-na-polia":
    "Conserve uma pequena flexão dos cotovelos; aproxime as mãos em arco.",
  "crucifixo-com-halteres":
    "Controle a abertura dos braços sem ultrapassar a amplitude confortável.",
  "puxada-frontal-na-polia":
    "Leve os cotovelos para baixo e a barra à frente do corpo.",
  "barra-fixa-assistida":
    "Use a assistência orientada pelo personal e evite balançar o corpo.",
  "puxada-com-elastico":
    "Confira a fixação do elástico antes de puxar em direção ao peito.",
  "remada-curvada-com-barra":
    "Mantenha a coluna neutra e leve a barra ao abdômen sem impulso.",
  "remada-baixa-na-polia": "Puxe o cabo sem lançar o tronco para trás.",
  "remada-unilateral-com-halter":
    "Mantenha a mão e o joelho de apoio estáveis; leve o halter ao quadril.",
  "remada-com-elastico":
    "Mantenha tensão no elástico e evite elevar os ombros.",
  "desenvolvimento-com-halteres":
    "Eleve os halteres sem aumentar o arco da lombar.",
  "desenvolvimento-na-maquina":
    "Ajuste o banco e estenda os braços sem travar os cotovelos.",
  "elevacao-lateral":
    "Eleve os braços com controle, até a altura orientada pelo personal.",
  "face-pull": "Leve a corda à altura do rosto, sem projetar o tronco.",
  "rosca-direta":
    "Mantenha os cotovelos próximos ao corpo e evite balanço do tronco.",
  "rosca-martelo":
    "Mantenha a pegada neutra e flexione os cotovelos de forma alternada.",
  "rosca-na-polia": "Flexione os cotovelos mantendo os braços junto ao tronco.",
  "triceps-na-polia": "Estenda os cotovelos sem afastar os braços do corpo.",
  "triceps-frances-com-halter":
    "Mantenha os cotovelos apontados para cima e controle a descida.",
  "mergulho-no-banco":
    "Mantenha o quadril fora do banco e use somente a amplitude orientada.",
  "agachamento-livre-com-barra":
    "Mantenha os pés apoiados, os joelhos alinhados e a coluna neutra.",
  "agachamento-goblet":
    "Mantenha a carga junto ao peito e os calcanhares no chão.",
  "leg-press-45":
    "Mantenha a lombar apoiada; não trave os joelhos ao empurrar.",
  "cadeira-extensora":
    "Alinhe o eixo da máquina ao joelho e estenda sem impulso.",
  "afundo-com-halteres":
    "Mantenha o joelho da frente alinhado ao pé; a base deve permanecer estável.",
  "levantamento-terra-romeno":
    "Leve o quadril para trás e mantenha a carga próxima às pernas.",
  "mesa-flexora": "Flexione os joelhos mantendo o quadril apoiado.",
  "flexao-de-joelho-com-elastico":
    "Confira a fixação do elástico e flexione o joelho sem mover o quadril.",
  "elevacao-pelvica":
    "Eleve o quadril sem hiperestender a lombar, mantendo as costas apoiadas.",
  "abducao-de-quadril":
    "Afaste os joelhos com controle, sem tirar o tronco do encosto.",
  "panturrilha-em-pe":
    "Eleve os calcanhares de forma controlada; mantenha o antepé apoiado.",
  "panturrilha-sentado":
    "Eleve os calcanhares com controle e mantenha a carga estável sobre as coxas.",
  prancha: "Mantenha o corpo alinhado e respire; não deixe o quadril cair.",
  "dead-bug": "Estenda braço e perna opostos mantendo a lombar apoiada.",
  "abdominal-na-polia":
    "Flexione o tronco de forma controlada, sem puxar somente com os braços.",
};

export function getExerciseMotion(id: string, progress: number): MotionFrame {
  if (!motionIds.includes(id as MotionId))
    throw new RangeError(`Animação não cadastrada: ${id}`);
  const p = Number.isFinite(progress) ? ((progress % 1) + 1) % 1 : 0;
  const q = (1 - Math.cos(p * Math.PI * 2)) / 2;
  const b = standing(),
    e: EquipmentPrimitive[] = [];
  let phase = p < 0.5 ? "Movimento controlado" : "Retorno controlado";
  switch (id as MotionId) {
    case "supino-reto-com-barra":
    case "supino-reto-com-halteres": {
      supine(b);
      bench(e);
      const spread = id === "supino-reto-com-barra" ? 0.34 : mix(0.35, 0.25, q);
      arms(
        b,
        [-spread, mix(0.7, 1.14, q), -0.46],
        [spread, mix(0.7, 1.14, q), -0.46],
        [-1, -0.2, 0.1],
        [1, -0.2, 0.1],
      );
      if (id === "supino-reto-com-barra") barbell(e, b.leftHand, b.rightHand);
      else dumbbells(b, e);
      break;
    }
    case "supino-na-maquina": {
      seated(b);
      chair(e);
      cableFrame(e);
      arms(
        b,
        [-0.3, 1.01, mix(0.12, 0.55, q)],
        [0.3, 1.01, mix(0.12, 0.55, q)],
        [-1, 0, 0],
        [1, 0, 0],
      );
      for (const hand of [b.leftHand, b.rightHand])
        e.push(
          line([Math.sign(hand[0]) * 0.61, 1.2, -0.3], hand, 0.065),
          line(add(hand, [0, -0.09, 0]), add(hand, [0, 0.09, 0]), 0.035),
        );
      break;
    }
    case "flexao-de-bracos": {
      trunk(b, [0, mix(0.26, 0.5, q), 0.08], -1.45);
      b.leftAnkle = [-0.14, 0.1, 0.87];
      b.rightAnkle = [0.14, 0.1, 0.87];
      b.leftToe = [-0.14, 0.04, 1.0];
      b.rightToe = [0.14, 0.04, 1.0];
      b.leftKnee = pointMix(b.leftHip, b.leftAnkle, 0.5);
      b.rightKnee = pointMix(b.rightHip, b.rightAnkle, 0.5);
      arms(
        b,
        [-0.32, 0.085, -0.48],
        [0.32, 0.085, -0.48],
        [-1, 0, 0.35],
        [1, 0, 0.35],
      );
      break;
    }
    case "crucifixo-na-polia": {
      trunk(b, [0, 0.98, 0], 0.08);
      cableFrame(e, true);
      const theta = mix(1.22, 0.12, q),
        s = Math.sin(theta),
        c = Math.cos(theta);
      arms(
        b,
        [-(0.22 + 0.48 * s), 1.27, 0.47 * c],
        [0.22 + 0.48 * s, 1.27, 0.47 * c],
        [-1, -0.2, 0],
        [1, -0.2, 0],
      );
      e.push(
        line([-0.85, 1.66, -0.45], b.leftHand, 0.014, "#ae90f5"),
        line([0.85, 1.66, -0.45], b.rightHand, 0.014, "#ae90f5"),
      );
      break;
    }
    case "crucifixo-com-halteres": {
      supine(b);
      bench(e);
      const theta = mix(1.18, 0.1, q),
        s = Math.sin(theta),
        c = Math.cos(theta);
      arms(
        b,
        [-(0.22 + 0.47 * s), 0.59 + 0.47 * c, -0.47],
        [0.22 + 0.47 * s, 0.59 + 0.47 * c, -0.47],
        [-1, 0, 0.15],
        [1, 0, 0.15],
      );
      dumbbells(b, e);
      break;
    }
    case "puxada-frontal-na-polia":
    case "puxada-com-elastico": {
      seated(b);
      chair(e, 0.47, false);
      cableFrame(e);
      arms(
        b,
        [-0.39, mix(1.62, 1.15, q), mix(0, 0.15, q)],
        [0.39, mix(1.62, 1.15, q), mix(0, 0.15, q)],
        [-1, 0, 0.1],
        [1, 0, 0.1],
      );
      if (id === "puxada-frontal-na-polia") {
        e.push(
          line(
            [-0.52, b.leftHand[1], b.leftHand[2]],
            [0.52, b.rightHand[1], b.rightHand[2]],
            0.035,
          ),
          line([0, 2.22, -0.4], pointMix(b.leftHand, b.rightHand, 0.5), 0.012),
        );
        e.push(box([0, 0.8, 0.36], [0.54, 0.13, 0.14], "#344259"));
      } else {
        e.push(
          line([0, 2.22, -0.45], b.leftHand, 0.018, "#ae90f5"),
          line([0, 2.22, -0.45], b.rightHand, 0.018, "#ae90f5"),
        );
      }
      break;
    }
    case "barra-fixa-assistida": {
      trunk(b, [0, mix(0.92, 1.28, q), 0.04]);
      arms(b, [-0.37, 1.99, 0], [0.37, 1.99, 0], [-1, 0, 0.3], [1, 0, 0.3]);
      b.leftKnee = [-0.14, b.hip[1] - 0.4, 0.14];
      b.rightKnee = [0.14, b.hip[1] - 0.4, 0.14];
      b.leftAnkle = [-0.14, b.hip[1] - 0.54, -0.2];
      b.rightAnkle = [0.14, b.hip[1] - 0.54, -0.2];
      b.leftToe = add(b.leftAnkle, [0, -0.03, 0.16]);
      b.rightToe = add(b.rightAnkle, [0, -0.03, 0.16]);
      cableFrame(e);
      e.push(
        line([-0.65, 1.99, 0], [0.65, 1.99, 0], 0.04),
        box([0, b.leftKnee[1] - 0.07, 0.1], [0.52, 0.12, 0.4], "#59617d"),
        line([0.61, 0.1, -0.25], [0.61, b.leftKnee[1] - 0.07, 0.1], 0.05),
      );
      break;
    }
    case "remada-curvada-com-barra": {
      trunk(b, [0, 0.87, -0.15], 0.87);
      legs(b, [-0.21, 0.08, 0], [0.21, 0.08, 0]);
      arms(
        b,
        [-0.27, mix(0.7, 1.04, q), mix(0.48, 0.26, q)],
        [0.27, mix(0.7, 1.04, q), mix(0.48, 0.26, q)],
        [-0.25, 0, -1],
        [0.25, 0, -1],
      );
      barbell(e, b.leftHand, b.rightHand);
      break;
    }
    case "remada-baixa-na-polia": {
      seated(b, 0.45);
      bench(e, [0, 0.3, -0.1], 0.75);
      cableFrame(e);
      b.leftKnee = [-0.18, 0.36, 0.38];
      b.rightKnee = [0.18, 0.36, 0.38];
      b.leftAnkle = [-0.18, 0.13, 0.76];
      b.rightAnkle = [0.18, 0.13, 0.76];
      b.leftToe = [-0.18, 0.1, 0.93];
      b.rightToe = [0.18, 0.1, 0.93];
      arms(
        b,
        [-0.1, 0.91, mix(0.51, 0.15, q)],
        [0.1, 0.91, mix(0.51, 0.15, q)],
        [-0.45, 0, -1],
        [0.45, 0, -1],
      );
      e.push(
        line([0, 0.4, 1.07], pointMix(b.leftHand, b.rightHand, 0.5), 0.014),
        line(b.leftHand, b.rightHand, 0.035),
        box([0, 0.12, 0.91], [0.55, 0.2, 0.12]),
      );
      break;
    }
    case "remada-unilateral-com-halter": {
      trunk(b, [0.04, 0.92, 0.05], 1.08);
      bench(e, [-0.25, 0.53, 0.13], 1.15);
      b.leftKnee = [-0.24, 0.65, 0.32];
      b.leftAnkle = [-0.25, 0.65, -0.1];
      b.leftToe = [-0.25, 0.62, -0.25];
      b.rightKnee = [0.29, 0.54, 0];
      b.rightAnkle = [0.36, 0.08, -0.12];
      b.rightToe = [0.36, 0.045, 0.06];
      arms(
        b,
        [-0.25, 0.62, 0.61],
        [0.34, mix(0.62, 0.97, q), mix(0.47, 0.23, q)],
        [-0.3, 0, 0.2],
        [0.5, 0, -1],
      );
      dumbbell(e, b.rightHand);
      break;
    }
    case "remada-com-elastico": {
      trunk(b, [0, 0.98, 0], 0.06);
      arms(
        b,
        [-0.24, 1.13, mix(0.53, 0.13, q)],
        [0.24, 1.13, mix(0.53, 0.13, q)],
        [-0.5, 0, -1],
        [0.5, 0, -1],
      );
      e.push(
        line([0, 0, 1.0], [0, 1.2, 1.0], 0.055),
        line([0, 1.12, 1.0], b.leftHand, 0.018, "#ae90f5"),
        line([0, 1.12, 1.0], b.rightHand, 0.018, "#ae90f5"),
      );
      break;
    }
    case "desenvolvimento-com-halteres":
    case "desenvolvimento-na-maquina": {
      seated(b);
      chair(e);
      arms(
        b,
        [-mix(0.42, 0.24, q), mix(1.27, 1.64, q), 0.03],
        [mix(0.42, 0.24, q), mix(1.27, 1.64, q), 0.03],
        [-1, 0, 0],
        [1, 0, 0],
      );
      if (id === "desenvolvimento-com-halteres") dumbbells(b, e);
      else {
        cableFrame(e);
        for (const hand of [b.leftHand, b.rightHand])
          e.push(line([Math.sign(hand[0]) * 0.65, 1.45, -0.35], hand, 0.065));
      }
      break;
    }
    case "elevacao-lateral": {
      const theta = mix(0.08, 1.42, q);
      for (const side of [-1, 1] as const) {
        const shoulder = side < 0 ? b.leftShoulder : b.rightShoulder;
        const elbow = add(shoulder, [
          side * 0.3 * Math.sin(theta),
          -0.3 * Math.cos(theta),
          0.015,
        ]);
        const hand = add(elbow, [
          side * 0.27 * Math.sin(theta),
          -0.27 * Math.cos(theta),
          0.055,
        ]);
        if (side < 0) {
          b.leftElbow = elbow;
          b.leftHand = hand;
        } else {
          b.rightElbow = elbow;
          b.rightHand = hand;
        }
      }
      dumbbells(b, e);
      break;
    }
    case "face-pull": {
      arms(
        b,
        [-mix(0.13, 0.3, q), mix(1.48, 1.57, q), mix(0.55, 0.18, q)],
        [mix(0.13, 0.3, q), mix(1.48, 1.57, q), mix(0.55, 0.18, q)],
        [-1, 0, 0],
        [1, 0, 0],
      );
      cableFrame(e);
      e.push(
        line([0, 1.65, 0.85], pointMix(b.leftHand, b.rightHand, 0.5), 0.018),
        line([0, 0, 0.85], [0, 2.1, 0.85], 0.05),
        line(b.leftHand, b.rightHand, 0.022),
      );
      break;
    }
    case "rosca-direta":
    case "rosca-martelo":
    case "rosca-na-polia": {
      for (const side of [-1, 1] as const) {
        const amount = id === "rosca-martelo" ? (side < 0 ? q : 1 - q) : q;
        const theta = mix(0.1, 2.12, amount),
          elbow: Vec3 = [side * 0.26, 1.18, 0.04];
        const hand = add(elbow, [
          0,
          -0.28 * Math.cos(theta),
          0.28 * Math.sin(theta),
        ]);
        if (side < 0) {
          b.leftElbow = elbow;
          b.leftHand = hand;
        } else {
          b.rightElbow = elbow;
          b.rightHand = hand;
        }
      }
      if (id === "rosca-direta") barbell(e, b.leftHand, b.rightHand);
      else if (id === "rosca-martelo") dumbbells(b, e, "z");
      else {
        cableFrame(e);
        e.push(
          line([0, 0.08, 0.68], pointMix(b.leftHand, b.rightHand, 0.5), 0.015),
          line(b.leftHand, b.rightHand, 0.035),
        );
      }
      break;
    }
    case "triceps-na-polia": {
      for (const side of [-1, 1] as const) {
        const elbow: Vec3 = [side * 0.24, 1.17, 0.08],
          theta = mix(1.5, 0.1, q);
        const hand = add(elbow, [
          0,
          -0.28 * Math.cos(theta),
          0.28 * Math.sin(theta),
        ]);
        if (side < 0) {
          b.leftElbow = elbow;
          b.leftHand = hand;
        } else {
          b.rightElbow = elbow;
          b.rightHand = hand;
        }
      }
      cableFrame(e);
      e.push(
        line([0, 2.18, 0.6], pointMix(b.leftHand, b.rightHand, 0.5), 0.014),
        line(b.leftHand, b.rightHand, 0.035),
      );
      break;
    }
    case "triceps-frances-com-halter": {
      seated(b);
      chair(e);
      b.leftElbow = [-0.15, 1.36, -0.01];
      b.rightElbow = [0.15, 1.36, -0.01];
      const theta = mix(-0.35, 1.34, q);
      b.leftHand = [
        -0.06,
        1.36 + 0.26 * Math.sin(theta),
        -0.01 - 0.26 * Math.cos(theta),
      ];
      b.rightHand = [0.06, b.leftHand[1], b.leftHand[2]];
      dumbbell(e, pointMix(b.leftHand, b.rightHand, 0.5), "z");
      break;
    }
    case "mergulho-no-banco": {
      const y = mix(0.47, 0.32, q);
      trunk(b, [0, y, 0.43]);
      chair(e, 0.49, false);
      arms(
        b,
        [-0.26, 0.55, 0.12],
        [0.26, 0.55, 0.12],
        [-0.4, 0, -1],
        [0.4, 0, -1],
      );
      b.leftKnee = [-0.17, 0.3, 0.83];
      b.rightKnee = [0.17, 0.3, 0.83];
      b.leftAnkle = [-0.17, 0.08, 1.1];
      b.rightAnkle = [0.17, 0.08, 1.1];
      b.leftToe = [-0.17, 0.05, 1.27];
      b.rightToe = [0.17, 0.05, 1.27];
      break;
    }
    case "agachamento-livre-com-barra": {
      squat(b, q);
      arms(
        b,
        add(b.chest, [-0.41, 0.01, -0.1]),
        add(b.chest, [0.41, 0.01, -0.1]),
        [-0.2, -1, 0.2],
        [0.2, -1, 0.2],
      );
      barbell(e, b.leftHand, b.rightHand);
      phase = p < 0.5 ? "Descida controlada" : "Retorno à posição inicial";
      break;
    }
    case "agachamento-goblet": {
      squat(b, q);
      arms(
        b,
        add(b.chest, [-0.075, -0.06, 0.2]),
        add(b.chest, [0.075, -0.06, 0.2]),
        [-1, -1, 0],
        [1, -1, 0],
      );
      dumbbell(e, pointMix(b.leftHand, b.rightHand, 0.5), "y");
      phase = p < 0.5 ? "Descida controlada" : "Retorno à posição inicial";
      break;
    }
    case "leg-press-45": {
      trunk(b, [0, 0.39, -0.12], -0.65);
      chair(e, 0.28);
      const z = mix(0.4, 0.6, q),
        y = mix(0.64, 0.88, q);
      legs(b, [-0.2, y, z], [0.2, y, z], [0, 1, -0.4]);
      b.leftToe = add(b.leftAnkle, [0, 0.12, 0.09]);
      b.rightToe = add(b.rightAnkle, [0, 0.12, 0.09]);
      arms(b, [-0.28, 0.47, -0.05], [0.28, 0.47, -0.05]);
      e.push(box([0, y + 0.04, z + 0.12], [0.75, 0.42, 0.09], "#59677f"));
      for (const x of [-0.55, 0.55])
        e.push(
          line([x, 0.25, 0.1], [x, 1.49, 1.34], 0.06),
          line([x, 0.1, -0.4], [x, 0.1, 1.4], 0.06),
        );
      break;
    }
    case "cadeira-extensora": {
      seated(b, 0.63);
      chair(e, 0.53);
      const theta = mix(0, 1.3, q);
      for (const side of [-1, 1] as const) {
        const knee: Vec3 = [side * 0.17, 0.63, 0.43],
          ankle = add(knee, [
            0,
            -0.43 * Math.cos(theta),
            0.43 * Math.sin(theta),
          ]);
        if (side < 0) {
          b.leftKnee = knee;
          b.leftAnkle = ankle;
          b.leftToe = add(ankle, [0, -0.025, 0.15]);
        } else {
          b.rightKnee = knee;
          b.rightAnkle = ankle;
          b.rightToe = add(ankle, [0, -0.025, 0.15]);
        }
      }
      arms(b, [-0.3, 0.63, 0.05], [0.3, 0.63, 0.05]);
      e.push(
        line(b.leftAnkle, b.rightAnkle, 0.12, "#59677f"),
        line([0, 0.22, 0.36], pointMix(b.leftAnkle, b.rightAnkle, 0.5), 0.06),
      );
      break;
    }
    case "afundo-com-halteres": {
      trunk(b, [0, mix(0.86, 0.59, q), 0], 0.07);
      legs(b, [-0.16, 0.08, 0.43], [0.16, 0.12, -0.51], [0, 0, 1]);
      b.rightToe = [0.16, 0.045, -0.36];
      arms(
        b,
        add(b.leftShoulder, [-0.03, -0.57, 0.02]),
        add(b.rightShoulder, [0.03, -0.57, 0.02]),
      );
      dumbbells(b, e);
      phase = p < 0.5 ? "Descida controlada" : "Retorno controlado";
      break;
    }
    case "levantamento-terra-romeno": {
      trunk(b, [0, mix(0.98, 0.87, q), mix(0, -0.24, q)], mix(0.03, 1.01, q));
      legs(b, [-0.19, 0.08, 0], [0.19, 0.08, 0]);
      const y = mix(0.91, 0.56, q),
        z = mix(0.12, 0.22, q);
      arms(b, [-0.25, y, z], [0.25, y, z]);
      barbell(e, b.leftHand, b.rightHand);
      phase = p < 0.5 ? "Quadril para trás" : "Retorno controlado";
      break;
    }
    case "mesa-flexora": {
      trunk(b, [0, 0.62, 0], Math.PI / 2);
      bench(e, [0, 0.43, 0.2], 1.43);
      b.leftKnee = [-0.16, 0.61, -0.44];
      b.rightKnee = [0.16, 0.61, -0.44];
      const theta = mix(0.05, 1.45, q);
      b.leftAnkle = add(b.leftKnee, [
        0,
        0.43 * Math.sin(theta),
        -0.43 * Math.cos(theta),
      ]);
      b.rightAnkle = add(b.rightKnee, [
        0,
        0.43 * Math.sin(theta),
        -0.43 * Math.cos(theta),
      ]);
      b.leftToe = add(b.leftAnkle, [0, -0.1, -0.05]);
      b.rightToe = add(b.rightAnkle, [0, -0.1, -0.05]);
      arms(b, [-0.26, 0.53, 0.63], [0.26, 0.53, 0.63]);
      e.push(
        line(b.leftAnkle, b.rightAnkle, 0.13, "#59677f"),
        line([0.45, 0.3, -0.42], b.rightAnkle, 0.05),
      );
      break;
    }
    case "flexao-de-joelho-com-elastico": {
      const theta = mix(0.05, 1.55, q);
      b.rightAnkle = add(b.rightKnee, [
        0,
        -0.43 * Math.cos(theta),
        -0.43 * Math.sin(theta),
      ]);
      b.rightToe = add(b.rightAnkle, [0, -0.03, 0.15]);
      arms(b, [-0.25, 1.11, 0.4], [0.25, 1.11, 0.4]);
      e.push(
        line([-0.35, 0, 0.48], [-0.35, 1.4, 0.48], 0.05),
        line([-0.35, 1.1, 0.48], [0.35, 1.1, 0.48], 0.045),
        line([0.17, 0.08, 0.7], b.rightAnkle, 0.018, "#ae90f5"),
      );
      break;
    }
    case "elevacao-pelvica": {
      const y = mix(0.33, 0.61, q);
      trunk(b, [0, y, 0.18], mix(-0.97, -Math.PI / 2, q));
      bench(e, [0, 0.39, -0.49], 0.42);
      b.leftKnee = [-0.19, 0.53, 0.57];
      b.rightKnee = [0.19, 0.53, 0.57];
      b.leftAnkle = [-0.2, 0.08, 0.57];
      b.rightAnkle = [0.2, 0.08, 0.57];
      b.leftToe = [-0.2, 0.045, 0.75];
      b.rightToe = [0.2, 0.045, 0.75];
      arms(b, [-0.31, y + 0.1, 0.18], [0.31, y + 0.1, 0.18]);
      barbell(e, b.leftHand, b.rightHand);
      e.push(box([0, y + 0.04, 0.18], [0.35, 0.1, 0.16], "#59677f"));
      break;
    }
    case "abducao-de-quadril": {
      seated(b);
      chair(e);
      const theta = mix(0.12, 0.61, q),
        spread = 0.115 + 0.43 * Math.sin(theta),
        z = 0.43 * Math.cos(theta);
      b.leftKnee = [-spread, 0.57, z];
      b.rightKnee = [spread, 0.57, z];
      b.leftAnkle = [-spread, 0.12, z + 0.02];
      b.rightAnkle = [spread, 0.12, z + 0.02];
      b.leftToe = [-spread, 0.08, z + 0.19];
      b.rightToe = [spread, 0.08, z + 0.19];
      arms(b, [-0.29, 0.64, 0.02], [0.29, 0.64, 0.02]);
      e.push(
        box([-spread - 0.06, 0.58, z], [0.1, 0.26, 0.18], "#59677f"),
        box([spread + 0.06, 0.58, z], [0.1, 0.26, 0.18], "#59677f"),
        line([-0.45, 0.08, 0.05], [0.45, 0.08, 0.05], 0.06),
      );
      break;
    }
    case "panturrilha-em-pe": {
      const lift = 0.1 * q;
      trunk(b, [0, 0.98 + lift, 0]);
      b.leftKnee = add(b.leftKnee, [0, lift, 0]);
      b.rightKnee = add(b.rightKnee, [0, lift, 0]);
      b.leftAnkle = add(b.leftAnkle, [0, lift, 0]);
      b.rightAnkle = add(b.rightAnkle, [0, lift, 0]);
      b.leftToe = [-0.17, 0.045, 0.18];
      b.rightToe = [0.17, 0.045, 0.18];
      arms(
        b,
        add(b.leftShoulder, [-0.03, -0.57, 0.03]),
        add(b.rightShoulder, [0.03, -0.57, 0.03]),
      );
      dumbbells(b, e);
      break;
    }
    case "panturrilha-sentado": {
      seated(b);
      chair(e, 0.47, false);
      const lift = 0.09 * q;
      b.leftKnee = add(b.leftKnee, [0, lift, 0]);
      b.rightKnee = add(b.rightKnee, [0, lift, 0]);
      b.leftAnkle = add(b.leftAnkle, [0, lift, 0]);
      b.rightAnkle = add(b.rightAnkle, [0, lift, 0]);
      arms(
        b,
        add(b.leftKnee, [0, 0.08, -0.08]),
        add(b.rightKnee, [0, 0.08, -0.08]),
      );
      dumbbells(b, e);
      e.push(box([0, 0.035, 0.66], [0.55, 0.07, 0.22]));
      break;
    }
    case "prancha": {
      const breath = 0.004 * Math.sin(p * Math.PI * 2);
      trunk(b, [0, 0.4 + breath, 0.07], -1.48);
      b.leftAnkle = [-0.15, 0.1, 0.88];
      b.rightAnkle = [0.15, 0.1, 0.88];
      b.leftToe = [-0.15, 0.045, 1.01];
      b.rightToe = [0.15, 0.045, 1.01];
      b.leftKnee = pointMix(b.leftHip, b.leftAnkle, 0.5);
      b.rightKnee = pointMix(b.rightHip, b.rightAnkle, 0.5);
      b.leftElbow = [-0.25, 0.1, -0.47];
      b.rightElbow = [0.25, 0.1, -0.47];
      b.leftHand = [-0.25, 0.08, -0.74];
      b.rightHand = [0.25, 0.08, -0.74];
      phase = "Sustentação e respiração";
      break;
    }
    case "dead-bug": {
      trunk(b, [0, 0.16, 0], -Math.PI / 2);
      const a = q;
      b.leftKnee = pointMix([-0.15, 0.6, 0.04], [-0.15, 0.3, 0.37], a);
      b.rightKnee = pointMix([0.15, 0.3, 0.37], [0.15, 0.6, 0.04], a);
      b.leftAnkle = pointMix([-0.15, 0.6, 0.47], [-0.15, 0.12, 0.78], a);
      b.rightAnkle = pointMix([0.15, 0.12, 0.78], [0.15, 0.6, 0.47], a);
      b.leftToe = add(b.leftAnkle, [0, -0.035, 0.14]);
      b.rightToe = add(b.rightAnkle, [0, -0.035, 0.14]);
      arms(
        b,
        pointMix([-0.22, 0.2, -1.04], [-0.22, 0.72, -0.48], a),
        pointMix([0.22, 0.72, -0.48], [0.22, 0.2, -1.04], a),
        [-1, 0, 0],
        [1, 0, 0],
      );
      phase = "Braço e perna opostos";
      break;
    }
    case "abdominal-na-polia": {
      trunk(b, [0, 0.5, -0.08], mix(0.08, 0.67, q));
      b.leftKnee = [-0.16, 0.09, 0.11];
      b.rightKnee = [0.16, 0.09, 0.11];
      b.leftAnkle = [-0.16, 0.1, -0.33];
      b.rightAnkle = [0.16, 0.1, -0.33];
      b.leftToe = [-0.16, 0.045, -0.49];
      b.rightToe = [0.16, 0.045, -0.49];
      arms(
        b,
        add(b.neck, [-0.18, 0.01, 0.09]),
        add(b.neck, [0.18, 0.01, 0.09]),
        [-1, -0.1, 0.4],
        [1, -0.1, 0.4],
      );
      cableFrame(e);
      e.push(
        line([0, 2.2, 0.65], pointMix(b.leftHand, b.rightHand, 0.5), 0.018),
        line(b.leftHand, b.rightHand, 0.023),
      );
      break;
    }
  }
  return { body: b, equipment: e, phase, cue: cues[id as MotionId] };
}

/** Camera categories used by both the player and the offline render pipeline. */
export type MotionCamera = "perspective" | "front" | "side" | "back" | "upper";
export type MotionFirstPhase =
  "eccentric" | "concentric" | "static" | "alternating";
export type MotionPresentation = Readonly<{
  durationSeconds: number;
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
  camera: MotionCamera;
  /** The full production brief is retained when a coarse camera preset is used. */
  cameraDescription: string;
  eccentricSeconds?: number;
  isometricSeconds?: number;
  concentricSeconds?: number;
  firstPhase: MotionFirstPhase;
  durationSource: "production-guide" | "editorial-breathing-cycle";
}>;

/**
 * Rendering brief supplied for the 38-exercise library. Muscle labels are
 * editorial heatmap targets, not a claim of measured muscle activation.
 * The guide leaves the plank loop untimed: its 6-second visual breathing cycle
 * is an explicit presentation choice, never a prescribed hold duration.
 */
export const motionPresentation = {
  "supino-reto-com-barra": {
    durationSeconds: 3.8,
    eccentricSeconds: 2,
    isometricSeconds: 0.3,
    concentricSeconds: 1.5,
    primaryMuscles: ["Peitoral maior"],
    secondaryMuscles: ["Tríceps", "Deltoide anterior"],
    camera: "upper",
    cameraDescription: "3/4 superior, 45° diagonal",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "supino-reto-com-halteres": {
    durationSeconds: 3.8,
    eccentricSeconds: 2,
    isometricSeconds: 0.3,
    concentricSeconds: 1.5,
    primaryMuscles: ["Peitoral maior"],
    secondaryMuscles: ["Tríceps", "Deltoide anterior"],
    camera: "upper",
    cameraDescription: "3/4 superior frontal",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "supino-na-maquina": {
    durationSeconds: 3.6,
    eccentricSeconds: 2,
    isometricSeconds: 0.2,
    concentricSeconds: 1.4,
    primaryMuscles: ["Peitoral maior"],
    secondaryMuscles: ["Tríceps"],
    camera: "side",
    cameraDescription: "Lateral 45°",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "flexao-de-bracos": {
    durationSeconds: 3.5,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.2,
    concentricSeconds: 1.5,
    primaryMuscles: ["Peitoral maior"],
    secondaryMuscles: ["Tríceps", "Reto abdominal"],
    camera: "side",
    cameraDescription: "Perfil 3/4 baixo",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "crucifixo-na-polia": {
    durationSeconds: 4,
    eccentricSeconds: 2.2,
    isometricSeconds: 0.4,
    concentricSeconds: 1.4,
    primaryMuscles: ["Peitoral maior (porção esternal)"],
    secondaryMuscles: ["Deltoide anterior"],
    camera: "front",
    cameraDescription: "Frontal com leve inclinação de 15°",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "crucifixo-com-halteres": {
    durationSeconds: 4,
    eccentricSeconds: 2.2,
    isometricSeconds: 0.3,
    concentricSeconds: 1.5,
    primaryMuscles: ["Peitoral maior"],
    secondaryMuscles: ["Deltoide anterior"],
    camera: "upper",
    cameraDescription: "Superior zenital 60°",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "puxada-frontal-na-polia": {
    durationSeconds: 3.6,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.5,
    concentricSeconds: 1.3,
    primaryMuscles: ["Grande dorsal"],
    secondaryMuscles: ["Bíceps", "Redondo maior"],
    camera: "back",
    cameraDescription: "3/4 posterior, costas",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "barra-fixa-assistida": {
    durationSeconds: 3.8,
    eccentricSeconds: 2,
    isometricSeconds: 0.4,
    concentricSeconds: 1.4,
    primaryMuscles: ["Grande dorsal"],
    secondaryMuscles: ["Bíceps", "Trapézio inferior"],
    camera: "back",
    cameraDescription: "Posterior, plano médio",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "puxada-com-elastico": {
    durationSeconds: 3.4,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.4,
    concentricSeconds: 1.2,
    primaryMuscles: ["Grande dorsal"],
    secondaryMuscles: ["Bíceps"],
    camera: "back",
    cameraDescription: "Posterior 30°",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "remada-curvada-com-barra": {
    durationSeconds: 3.6,
    eccentricSeconds: 2,
    isometricSeconds: 0.4,
    concentricSeconds: 1.2,
    primaryMuscles: ["Grande dorsal", "Trapézio médio"],
    secondaryMuscles: ["Bíceps", "Isquiotibiais"],
    camera: "side",
    cameraDescription: "Perfil 3/4 lateral",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "remada-baixa-na-polia": {
    durationSeconds: 3.5,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.5,
    concentricSeconds: 1.2,
    primaryMuscles: ["Grande dorsal", "Romboides"],
    secondaryMuscles: ["Bíceps", "Deltoide posterior"],
    camera: "side",
    cameraDescription: "Lateral 45°, perfil",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "remada-unilateral-com-halter": {
    durationSeconds: 3.6,
    eccentricSeconds: 2,
    isometricSeconds: 0.4,
    concentricSeconds: 1.2,
    primaryMuscles: ["Grande dorsal"],
    secondaryMuscles: ["Bíceps"],
    camera: "side",
    cameraDescription: "3/4 lateral focado no braço ativo",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "remada-com-elastico": {
    durationSeconds: 3.2,
    eccentricSeconds: 1.7,
    isometricSeconds: 0.4,
    concentricSeconds: 1.1,
    primaryMuscles: ["Grande dorsal", "Romboides"],
    secondaryMuscles: ["Bíceps"],
    camera: "side",
    cameraDescription: "Lateral 45°",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "desenvolvimento-com-halteres": {
    durationSeconds: 3.8,
    eccentricSeconds: 2,
    isometricSeconds: 0.4,
    concentricSeconds: 1.4,
    primaryMuscles: ["Deltoide anterior", "Deltoide médio"],
    secondaryMuscles: ["Tríceps", "Trapézio"],
    camera: "perspective",
    cameraDescription: "Frontal 3/4, altura do tronco",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "desenvolvimento-na-maquina": {
    durationSeconds: 3.6,
    eccentricSeconds: 2,
    isometricSeconds: 0.3,
    concentricSeconds: 1.3,
    primaryMuscles: ["Deltoide anterior", "Deltoide médio"],
    secondaryMuscles: ["Tríceps"],
    camera: "front",
    cameraDescription: "Frontal 30°",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "elevacao-lateral": {
    durationSeconds: 3.5,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.5,
    concentricSeconds: 1.2,
    primaryMuscles: ["Deltoide lateral"],
    secondaryMuscles: ["Trapézio superior"],
    camera: "front",
    cameraDescription: "Frontal direto, plano médio",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "face-pull": {
    durationSeconds: 3.4,
    eccentricSeconds: 1.6,
    isometricSeconds: 0.6,
    concentricSeconds: 1.2,
    primaryMuscles: ["Deltoide posterior"],
    secondaryMuscles: ["Trapézio", "Romboides"],
    camera: "back",
    cameraDescription: "3/4 posterior superior",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "rosca-direta": {
    durationSeconds: 3.4,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.4,
    concentricSeconds: 1.2,
    primaryMuscles: ["Bíceps braquial"],
    secondaryMuscles: ["Braquiorradial"],
    camera: "perspective",
    cameraDescription: "Frontal 3/4, cintura até cabeça",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "rosca-martelo": {
    durationSeconds: 3.4,
    eccentricSeconds: 1.9,
    isometricSeconds: 0.3,
    concentricSeconds: 1.2,
    primaryMuscles: ["Braquial", "Braquiorradial"],
    secondaryMuscles: ["Bíceps braquial"],
    camera: "side",
    cameraDescription: "3/4 lateral",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "rosca-na-polia": {
    durationSeconds: 3.4,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.4,
    concentricSeconds: 1.2,
    primaryMuscles: ["Bíceps braquial"],
    secondaryMuscles: ["Antebraço"],
    camera: "side",
    cameraDescription: "Perfil 45°",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "triceps-na-polia": {
    durationSeconds: 3.2,
    eccentricSeconds: 1.7,
    isometricSeconds: 0.4,
    concentricSeconds: 1.1,
    primaryMuscles: ["Tríceps (todas as cabeças)"],
    secondaryMuscles: ["Ancôneo"],
    camera: "side",
    cameraDescription: "Perfil lateral 45°",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "triceps-frances-com-halter": {
    durationSeconds: 3.6,
    eccentricSeconds: 1.9,
    isometricSeconds: 0.3,
    concentricSeconds: 1.4,
    primaryMuscles: ["Tríceps (cabeça longa)"],
    secondaryMuscles: ["Deltoide"],
    camera: "side",
    cameraDescription: "Perfil lateral superior",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "mergulho-no-banco": {
    durationSeconds: 3.4,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.2,
    concentricSeconds: 1.4,
    primaryMuscles: ["Tríceps braquial"],
    secondaryMuscles: ["Peitoral maior", "Deltoide anterior"],
    camera: "side",
    cameraDescription: "Perfil lateral 3/4",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "agachamento-livre-com-barra": {
    durationSeconds: 4,
    eccentricSeconds: 2,
    isometricSeconds: 0.3,
    concentricSeconds: 1.7,
    primaryMuscles: ["Quadríceps"],
    secondaryMuscles: ["Glúteos", "Isquiotibiais"],
    camera: "side",
    cameraDescription: "Perfil 3/4, corpo inteiro",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "agachamento-goblet": {
    durationSeconds: 3.8,
    eccentricSeconds: 1.9,
    isometricSeconds: 0.3,
    concentricSeconds: 1.6,
    primaryMuscles: ["Quadríceps"],
    secondaryMuscles: ["Glúteos", "Core"],
    camera: "perspective",
    cameraDescription: "Frontal 3/4",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "leg-press-45": {
    durationSeconds: 3.8,
    eccentricSeconds: 2,
    isometricSeconds: 0.3,
    concentricSeconds: 1.5,
    primaryMuscles: ["Quadríceps"],
    secondaryMuscles: ["Glúteos"],
    camera: "side",
    cameraDescription: "Lateral 45°, enquadrando as pernas",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "cadeira-extensora": {
    durationSeconds: 3.2,
    eccentricSeconds: 1.6,
    isometricSeconds: 0.5,
    concentricSeconds: 1.1,
    primaryMuscles: ["Quadríceps (reto femoral isolado)"],
    secondaryMuscles: [],
    camera: "side",
    cameraDescription: "Perfil lateral fechado",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "afundo-com-halteres": {
    durationSeconds: 3.8,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.3,
    concentricSeconds: 1.7,
    primaryMuscles: ["Quadríceps"],
    secondaryMuscles: ["Glúteo máximo"],
    camera: "side",
    cameraDescription: "Perfil lateral dinâmico",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "levantamento-terra-romeno": {
    durationSeconds: 3.8,
    eccentricSeconds: 2,
    isometricSeconds: 0.2,
    concentricSeconds: 1.6,
    primaryMuscles: ["Isquiotibiais"],
    secondaryMuscles: ["Glúteos", "Eretores espinhais"],
    camera: "side",
    cameraDescription: "Perfil lateral 90°",
    firstPhase: "eccentric",
    durationSource: "production-guide",
  },
  "mesa-flexora": {
    durationSeconds: 3.4,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.4,
    concentricSeconds: 1.2,
    primaryMuscles: ["Isquiotibiais"],
    secondaryMuscles: ["Gastrocnêmio"],
    camera: "side",
    cameraDescription: "Lateral com foco nas pernas",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "flexao-de-joelho-com-elastico": {
    durationSeconds: 3.2,
    eccentricSeconds: 1.7,
    isometricSeconds: 0.4,
    concentricSeconds: 1.1,
    primaryMuscles: ["Isquiotibiais"],
    secondaryMuscles: ["Panturrilha"],
    camera: "side",
    cameraDescription: "Lateral 3/4",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "elevacao-pelvica": {
    durationSeconds: 3.6,
    eccentricSeconds: 1.6,
    isometricSeconds: 0.8,
    concentricSeconds: 1.2,
    primaryMuscles: ["Glúteo máximo"],
    secondaryMuscles: ["Isquiotibiais", "Core"],
    camera: "side",
    cameraDescription: "Perfil lateral 45°",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "abducao-de-quadril": {
    durationSeconds: 3.2,
    eccentricSeconds: 1.7,
    isometricSeconds: 0.4,
    concentricSeconds: 1.1,
    primaryMuscles: ["Glúteo médio", "Glúteo mínimo"],
    secondaryMuscles: ["Tensor da fáscia lata"],
    camera: "perspective",
    cameraDescription: "Frontal 3/4",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "panturrilha-em-pe": {
    durationSeconds: 3,
    eccentricSeconds: 1.4,
    isometricSeconds: 0.6,
    concentricSeconds: 1,
    primaryMuscles: ["Gastrocnêmio"],
    secondaryMuscles: ["Sóleo"],
    camera: "back",
    cameraDescription: "Posterior inferior, close das pernas",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  "panturrilha-sentado": {
    durationSeconds: 3,
    eccentricSeconds: 1.4,
    isometricSeconds: 0.6,
    concentricSeconds: 1,
    primaryMuscles: ["Sóleo"],
    secondaryMuscles: ["Gastrocnêmio profundo"],
    camera: "side",
    cameraDescription: "3/4 lateral inferior",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
  prancha: {
    durationSeconds: 6,
    primaryMuscles: ["Reto abdominal", "Transverso do abdômen"],
    secondaryMuscles: ["Oblíquos", "Glúteos"],
    camera: "side",
    cameraDescription: "Perfil lateral alinhado",
    firstPhase: "static",
    durationSource: "editorial-breathing-cycle",
  },
  "dead-bug": {
    durationSeconds: 4.2,
    primaryMuscles: ["Core profundo", "Transverso do abdômen"],
    secondaryMuscles: ["Reto abdominal"],
    camera: "upper",
    cameraDescription: "Diagonal superior zenital, 45°",
    firstPhase: "alternating",
    durationSource: "production-guide",
  },
  "abdominal-na-polia": {
    durationSeconds: 3.4,
    eccentricSeconds: 1.8,
    isometricSeconds: 0.4,
    concentricSeconds: 1.2,
    primaryMuscles: ["Reto abdominal"],
    secondaryMuscles: ["Oblíquos"],
    camera: "side",
    cameraDescription: "Perfil 3/4 ajoelhado",
    firstPhase: "concentric",
    durationSource: "production-guide",
  },
} as const satisfies Record<MotionId, MotionPresentation>;

export type MotionTiming = Readonly<{
  /** Progress into the original, symmetric pose function. */
  frameProgress: number;
  phaseKind:
    "eccentric" | "isometric" | "concentric" | "static" | "alternating";
  phaseLabel: string;
  timeSeconds: number;
  durationSeconds: number;
}>;

const originalEccentricFirst: ReadonlySet<MotionId> = new Set([
  "mergulho-no-banco",
  "agachamento-livre-com-barra",
  "agachamento-goblet",
  "afundo-com-halteres",
  "levantamento-terra-romeno",
]);

/** Maps real loop time to the pose timeline, including the supplied pause. */
export function getMotionTiming(id: string, progress: number): MotionTiming {
  if (!motionIds.includes(id as MotionId))
    throw new RangeError(`Animação não cadastrada: ${id}`);
  const motionId = id as MotionId;
  const spec: MotionPresentation = motionPresentation[motionId];
  const p = Number.isFinite(progress) ? ((progress % 1) + 1) % 1 : 0;
  const t = p * spec.durationSeconds;
  if (spec.firstPhase === "static" || spec.firstPhase === "alternating") {
    return {
      frameProgress: p,
      phaseKind: spec.firstPhase,
      phaseLabel:
        spec.firstPhase === "static"
          ? "Sustentação e respiração"
          : "Alternância de braço e perna opostos",
      timeSeconds: t,
      durationSeconds: spec.durationSeconds,
    };
  }
  const first =
    spec.firstPhase === "eccentric"
      ? spec.eccentricSeconds!
      : spec.concentricSeconds!;
  const second =
    spec.firstPhase === "eccentric"
      ? spec.concentricSeconds!
      : spec.eccentricSeconds!;
  const hold = spec.isometricSeconds!;
  let frameProgress: number;
  let phaseKind: MotionTiming["phaseKind"];
  if (t < first) {
    frameProgress = (0.5 * t) / first;
    phaseKind = spec.firstPhase;
  } else if (t < first + hold) {
    frameProgress = 0.5;
    phaseKind = "isometric";
  } else {
    frameProgress = 0.5 + (0.5 * (t - first - hold)) / second;
    phaseKind = spec.firstPhase === "eccentric" ? "concentric" : "eccentric";
  }
  const originalFirst = originalEccentricFirst.has(motionId)
    ? "eccentric"
    : "concentric";
  if (originalFirst !== spec.firstPhase)
    frameProgress = (frameProgress + 0.5) % 1;
  const phaseLabel =
    phaseKind === "isometric"
      ? "Pausa isométrica"
      : phaseKind === "eccentric"
        ? "Fase excêntrica · movimento controlado"
        : "Fase concêntrica · movimento controlado";
  return {
    frameProgress,
    phaseKind,
    phaseLabel,
    timeSeconds: t,
    durationSeconds: spec.durationSeconds,
  };
}

export type TimedMotionFrame = MotionFrame & { timing: MotionTiming };
/** Real cadence wrapper; getExerciseMotion remains the untimed pose primitive. */
export function getTimedExerciseMotion(
  id: string,
  progress: number,
): TimedMotionFrame {
  const timing = getMotionTiming(id, progress);
  return {
    ...getExerciseMotion(id, timing.frameProgress),
    phase: timing.phaseLabel,
    timing,
  };
}
