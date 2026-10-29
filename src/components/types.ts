import type { Program, Rules } from "@/domain/contracts";
export type Student = {
  id: string;
  name: string;
  email: string;
  goal: string;
  experience: string;
  days_per_week: number;
  equipment: string[];
  limitations: string;
  automation_enabled: boolean;
  status: string;
  user_id: string | null;
};
export type Exercise = {
  id: string;
  catalog_id?: string | null;
  name: string;
  muscle: string;
  equipment: string;
  instructions: string;
};
export type Agent = {
  id: string;
  name: string;
  current_version: number;
  version_id: string;
  rules: Rules;
};
export type Version = {
  id: string;
  plan_id: string;
  student_id: string;
  student_name: string;
  version: number;
  content: Program;
  published_at: string;
  source: string;
  agent_version_id: string | null;
};
export type Assessment = {
  id: string;
  student_id: string;
  measured_on: string;
  weight_kg: string;
  height_cm: string;
  waist_cm: string | null;
  new_pain: boolean;
  notes: string;
};
export type Cycle = {
  id: string;
  student_id: string;
  due_at: string;
  status: string;
  reason: string | null;
  attempts: number;
};
export type Proposal = {
  id: string;
  student_id: string;
  content: Program;
  status: string;
  validation: { valid: boolean; reasons: string[] };
};
export type Log = {
  id: string;
  student_id: string;
  version_id: string;
  sets: { exerciseId: string; kg: number; reps: number; rpe: number }[];
  discomfort: boolean;
  created_at: string;
};
export type DashboardData = {
  actor: {
    userId: string;
    name: string;
    email: string;
    role: "owner" | "trainer" | "student";
    studentId: string | null;
    tenantId: string;
  };
  tenant: { name: string; timezone: string };
  organizations: { id: string; name: string; role: string }[];
  members: { id: string; name: string; email: string; role: string }[];
  students: Student[];
  exercises: Exercise[];
  agents: Agent[];
  versions: Version[];
  assessments: Assessment[];
  cycles: Cycle[];
  proposals: Proposal[];
  notifications: { id: string; message: string; created_at: string }[];
  logs: Log[];
  subscription: {
    status: string;
    name: string;
    trial_ends_at: string | null;
    student_limit: number;
    price_cents: number;
    monthly_token_limit: number;
  } | null;
  integrations: { ai: boolean; payments: boolean; email: string };
};
