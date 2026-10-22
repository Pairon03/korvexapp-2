import { Temporal } from "@js-temporal/polyfill";
import {
  Program,
  Rules,
  Student,
  Exercise,
  Assessment,
  programSchema,
} from "./contracts";
export type Validation = {
  valid: boolean;
  reasons: string[];
  checkedAt: string;
};
export function cycleDue(
  publishedAt: string | Date,
  days: number,
  timezone: string,
) {
  return Temporal.Instant.from(new Date(publishedAt).toISOString())
    .toZonedDateTimeISO(timezone)
    .add({ days })
    .toInstant()
    .toString();
}
export function validateProgram(
  value: unknown,
  context: {
    student: Student;
    assessment: Assessment | null;
    exercises: Exercise[];
    rules: Rules;
    now: Date;
    timezone: string;
    recentDiscomfort?: boolean;
  },
): Validation {
  const reasons: string[] = [];
  const parsed = programSchema.safeParse(value);
  if (!parsed.success)
    return {
      valid: false,
      reasons: ["Resposta estruturada inválida."],
      checkedAt: context.now.toISOString(),
    };
  const p = parsed.data,
    { student, assessment, rules, exercises, now } = context;
  if (context.recentDiscomfort)
    reasons.push("Desconforto recente exige revisão profissional.");
  if (student.status !== "active") reasons.push("Aluno inativo.");
  if (student.limitations.trim())
    reasons.push("Limitação relatada exige revisão do profissional.");
  if (!assessment) reasons.push("Avaliação obrigatória ausente.");
  else {
    const today = Temporal.Instant.from(now.toISOString())
      .toZonedDateTimeISO(context.timezone)
      .toPlainDate();
    const age = Temporal.PlainDate.from(assessment.measured_on).until(
      today,
    ).days;
    if (age < 0) reasons.push("Avaliação com data futura.");
    if (age > rules.assessmentMaxAgeDays)
      reasons.push("Avaliação desatualizada.");
    if (assessment.new_pain)
      reasons.push("Dor nova relatada: publicação suspensa.");
  }
  if (p.days.length > student.days_per_week || p.days.length > rules.maxDays)
    reasons.push("Frequência excede a disponibilidade.");
  for (const day of p.days) {
    if (day.exercises.reduce((s, e) => s + e.sets, 0) > rules.maxSetsPerDay)
      reasons.push("Volume diário excede o limite do agente.");
    const ids = new Set<string>();
    for (const e of day.exercises) {
      const item = exercises.find((x) => x.id === e.exerciseId && x.enabled);
      if (!item) reasons.push("Exercício inexistente ou não autorizado.");
      else if (!student.equipment.includes(item.equipment))
        reasons.push("Equipamento indisponível para o aluno.");
      if (ids.has(e.exerciseId))
        reasons.push("Exercício duplicado no mesmo dia.");
      ids.add(e.exerciseId);
      if (e.repsMax < e.repsMin) reasons.push("Faixa de repetições invertida.");
      if (e.restSeconds < rules.restMin || e.restSeconds > rules.restMax)
        reasons.push("Descanso fora dos limites.");
    }
  }
  if (p.alerts.length || p.missingData.length || p.requiresReview)
    reasons.push("Proposta exige revisão ou contém alertas/dados ausentes.");
  return {
    valid: !reasons.length,
    reasons: [...new Set(reasons)],
    checkedAt: now.toISOString(),
  };
}
export const defaultRules: Rules = {
  maxSetsPerDay: 24,
  maxDays: 3,
  restMin: 30,
  restMax: 180,
  assessmentMaxAgeDays: 30,
  cycleDays: 45,
  autoPublish: false,
  methodology:
    "Configuração inicial de exemplo. Revise as regras conforme sua metodologia antes de utilizar.",
};
export function programVolume(program: Program) {
  return program.days.reduce(
    (total, d) => total + d.exercises.reduce((a, e) => a + e.sets, 0),
    0,
  );
}
