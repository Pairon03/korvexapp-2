import { z } from "zod";
export const id = z.uuid();
export const credentials = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const registration = credentials.extend({
  name: z.string().trim().min(2).max(100),
  organization: z.string().trim().min(2).max(100),
});
export const studentInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    goal: z.enum(["hypertrophy", "fat_loss", "conditioning", "maintenance"]),
    experience: z.enum(["beginner", "intermediate", "advanced"]),
    daysPerWeek: z.number().int().min(1).max(7),
    equipment: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
    limitations: z.string().max(2000).default(""),
  })
  .strict();
export const assessmentInput = z
  .object({
    studentId: id,
    measuredOn: z.iso.date(),
    weightKg: z.number().positive().max(600),
    heightCm: z.number().positive().max(250),
    waistCm: z.number().positive().max(400).optional(),
    newPain: z.boolean(),
    notes: z.string().max(2000).default(""),
  })
  .strict();
export const exerciseInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    muscle: z.string().min(2).max(40),
    equipment: z.string().trim().min(1).max(60),
    instructions: z.string().min(10).max(3000),
  })
  .strict();
export const rulesSchema = z
  .object({
    maxSetsPerDay: z.number().int().min(1).max(40),
    maxDays: z.number().int().min(1).max(7),
    restMin: z.number().int().min(10).max(300),
    restMax: z.number().int().min(10).max(600),
    assessmentMaxAgeDays: z.number().int().min(1).max(90),
    cycleDays: z.number().int().min(1).max(365),
    autoPublish: z.boolean(),
    methodology: z.string().min(10).max(3000),
  })
  .strict()
  .refine(
    (r) => r.restMax >= r.restMin,
    "Descanso máximo deve ser maior que o mínimo.",
  );
export const agentInput = z
  .object({ name: z.string().min(2).max(100), rules: rulesSchema })
  .strict();
export const programSchema = z
  .object({
    name: z.string().min(2).max(100),
    reason: z.string().min(5).max(2000),
    days: z
      .array(
        z
          .object({
            name: z.string().min(1).max(60),
            exercises: z
              .array(
                z
                  .object({
                    exerciseId: id,
                    sets: z.number().int().min(1).max(10),
                    repsMin: z.number().int().min(1).max(100),
                    repsMax: z.number().int().min(1).max(100),
                    restSeconds: z.number().int().min(10).max(600),
                    rpe: z.number().min(1).max(10),
                    notes: z.string().max(500),
                  })
                  .strict(),
              )
              .min(1)
              .max(12),
          })
          .strict(),
      )
      .min(1)
      .max(7),
    alerts: z.array(z.string().max(500)).max(20),
    missingData: z.array(z.string().max(100)).max(20),
    requiresReview: z.boolean(),
  })
  .strict();
export type Program = z.infer<typeof programSchema>;
export type Rules = z.infer<typeof rulesSchema>;
export type Student = {
  id: string;
  days_per_week: number;
  equipment: string[];
  limitations: string;
  revision: number;
  automation_enabled: boolean;
  status: string;
};
export type Exercise = { id: string; equipment: string; enabled: boolean };
export type Assessment = {
  id: string;
  measured_on: string;
  new_pain: boolean;
  weight_kg: number | string;
  height_cm: number | string;
  created_at: Date;
};
