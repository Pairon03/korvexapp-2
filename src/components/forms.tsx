"use client";
import { FormEvent, useState } from "react";
import { Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { defaultRules } from "@/domain/validation";
import type { Program, Rules } from "@/domain/contracts";
import type { DashboardData, Agent, Version } from "./types";
export function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}
export function SelectStudent({ data }: { data: DashboardData }) {
  return (
    <label>
      Aluno
      <select
        aria-label="Aluno"
        name="studentId"
        required
        defaultValue={data.actor.studentId || ""}
      >
        <option value="" disabled>
          Selecione o aluno
        </option>
        {data.students
          .filter((s) => s.status === "active")
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
    </label>
  );
}
export function StudentForm({
  submit,
  busy,
}: {
  submit: (data: unknown) => void;
  busy: boolean;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({
          name: f.get("name"),
          email: f.get("email"),
          goal: f.get("goal"),
          experience: f.get("experience"),
          daysPerWeek: Number(f.get("daysPerWeek")),
          equipment: String(f.get("equipment"))
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          limitations: f.get("limitations") || "",
        });
      }}
    >
      <Field label="Nome do aluno" name="name" />
      <Field label="E-mail do aluno" name="email" type="email" />
      <div className="grid two">
        <label>
          Objetivo
          <select name="goal">
            <option value="hypertrophy">Hipertrofia</option>
            <option value="fat_loss">Emagrecimento</option>
            <option value="conditioning">Condicionamento</option>
            <option value="maintenance">Manutenção</option>
          </select>
        </label>
        <label>
          Experiência
          <select name="experience">
            <option value="beginner">Iniciante</option>
            <option value="intermediate">Intermediário</option>
            <option value="advanced">Avançado</option>
          </select>
        </label>
      </div>
      <Field
        label="Dias disponíveis por semana"
        name="daysPerWeek"
        type="number"
        min={1}
        max={7}
        defaultValue={3}
      />
      <Field
        label="Equipamentos disponíveis (separados por vírgula)"
        name="equipment"
      />
      <label>
        Limitações relatadas (opcional)
        <textarea name="limitations" maxLength={2000} />
      </label>
      <small>
        Uma limitação relatada exige revisão e bloqueia a geração/publicação
        automática nesta versão. Não é necessário enviar fotos.
      </small>
      <button disabled={busy} className="primary">
        Cadastrar aluno
      </button>
    </form>
  );
}
export function ExerciseForm({
  submit,
  busy,
}: {
  submit: (data: unknown) => void;
  busy: boolean;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <Field label="Nome" name="name" />
      <Field label="Grupo muscular principal" name="muscle" />
      <Field
        label="Equipamento (igual ao cadastrado no aluno)"
        name="equipment"
      />
      <label>
        Instruções originais de execução
        <textarea
          name="instructions"
          required
          minLength={10}
          maxLength={3000}
        />
      </label>
      <small>
        Cadastre apenas conteúdo próprio ou autorizado. Esta versão não adiciona
        links de mídia automaticamente.
      </small>
      <button className="primary" disabled={busy}>
        Adicionar exercício
      </button>
    </form>
  );
}
export function AssessmentForm({
  data,
  submit,
  busy,
}: {
  data: DashboardData;
  submit: (data: unknown) => void;
  busy: boolean;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({
          studentId: f.get("studentId"),
          measuredOn: f.get("measuredOn"),
          weightKg: Number(f.get("weightKg")),
          heightCm: Number(f.get("heightCm")),
          ...(f.get("waistCm") ? { waistCm: Number(f.get("waistCm")) } : {}),
          newPain: f.get("newPain") === "on",
          notes: f.get("notes") || "",
        });
      }}
    >
      <SelectStudent data={data} />
      <Field
        label="Data da medição"
        name="measuredOn"
        type="date"
        defaultValue={new Date().toLocaleDateString("en-CA")}
      />
      <div className="grid two">
        <Field
          label="Peso (kg)"
          name="weightKg"
          type="number"
          min={1}
          max={600}
          step="0.01"
        />
        <Field
          label="Altura (cm)"
          name="heightCm"
          type="number"
          min={1}
          max={250}
          step="0.01"
        />
      </div>
      <Field
        label="Cintura (cm, opcional)"
        name="waistCm"
        type="number"
        min={1}
        max={400}
        step="0.01"
        required={false}
      />
      <label className="check">
        <input type="checkbox" name="newPain" />
        Há dor nova ou desconforto que exige revisão?
      </label>
      <label>
        Observações
        <textarea name="notes" maxLength={2000} />
      </label>
      <small>
        Não calculamos gordura corporal a partir dessas medidas. Nenhuma foto é
        necessária.
      </small>
      <button disabled={busy} className="primary">
        Salvar avaliação
      </button>
    </form>
  );
}
export function AgentForm({
  submit,
  busy,
  agent,
}: {
  submit: (data: unknown) => void;
  busy: boolean;
  agent?: Agent;
}) {
  const rules = agent?.rules || defaultRules;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const rules: Rules = {
          maxSetsPerDay: Number(f.get("maxSetsPerDay")),
          maxDays: Number(f.get("maxDays")),
          restMin: Number(f.get("restMin")),
          restMax: Number(f.get("restMax")),
          assessmentMaxAgeDays: Number(f.get("assessmentMaxAgeDays")),
          cycleDays: Number(f.get("cycleDays")),
          autoPublish: f.get("autoPublish") === "on",
          methodology: String(f.get("methodology")),
        };
        submit({
          name: f.get("name"),
          rules,
          ...(agent ? { agentId: agent.id } : {}),
        });
      }}
    >
      <Field label="Nome do agente" name="name" defaultValue={agent?.name} />
      <div className="grid two">
        <Field
          label="Máximo de séries por dia"
          name="maxSetsPerDay"
          type="number"
          min={1}
          max={40}
          defaultValue={rules.maxSetsPerDay}
        />
        <Field
          label="Máximo de dias por semana"
          name="maxDays"
          type="number"
          min={1}
          max={7}
          defaultValue={rules.maxDays}
        />
        <Field
          label="Descanso mínimo (segundos)"
          name="restMin"
          type="number"
          min={10}
          max={300}
          defaultValue={rules.restMin}
        />
        <Field
          label="Descanso máximo (segundos)"
          name="restMax"
          type="number"
          min={10}
          max={600}
          defaultValue={rules.restMax}
        />
        <Field
          label="Validade da avaliação (dias)"
          name="assessmentMaxAgeDays"
          type="number"
          min={1}
          max={90}
          defaultValue={rules.assessmentMaxAgeDays}
        />
        <Field
          label="Intervalo do ciclo (dias)"
          name="cycleDays"
          type="number"
          min={1}
          max={365}
          defaultValue={rules.cycleDays}
        />
      </div>
      <label>
        Metodologia e orientações complementares
        <textarea
          name="methodology"
          required
          minLength={10}
          maxLength={3000}
          defaultValue={rules.methodology}
        />
      </label>
      <label className="check">
        <input
          name="autoPublish"
          type="checkbox"
          defaultChecked={rules.autoPublish}
        />
        Autorizar publicação automática quando todas as regras forem aprovadas
      </label>
      <p className="notice">
        Esta autorização também precisa estar ativada individualmente para o
        aluno. Nenhuma instrução livre pode desativar as validações. Atualizar o
        agente cria uma versão; não altera programas ou ciclos já publicados.
      </p>
      <button disabled={busy} className="primary">
        {agent ? "Criar nova versão" : "Criar agente"}
      </button>
    </form>
  );
}
export function ProgramForm({
  data,
  submit,
  busy,
  initial,
}: {
  data: DashboardData;
  submit: (value: unknown) => void;
  busy: boolean;
  initial?: Version;
}) {
  const [days, setDays] = useState<Program["days"]>(
    initial?.content.days || [{ name: "Treino A", exercises: [] }],
  );
  function addExercise(day: number) {
    const first = data.exercises[0];
    if (!first) return;
    setDays((old) =>
      old.map((d, i) =>
        i !== day
          ? d
          : {
              ...d,
              exercises: [
                ...d.exercises,
                {
                  exerciseId: first.id,
                  sets: 3,
                  repsMin: 8,
                  repsMax: 12,
                  restSeconds: 60,
                  rpe: 7,
                  notes: "",
                },
              ],
            },
      ),
    );
  }
  function update(
    day: number,
    index: number,
    values: Partial<Program["days"][number]["exercises"][number]>,
  ) {
    setDays((old) =>
      old.map((d, i) =>
        i !== day
          ? d
          : {
              ...d,
              exercises: d.exercises.map((e, j) =>
                j === index ? { ...e, ...values } : e,
              ),
            },
      ),
    );
  }
  function move(day: number, index: number, delta: number) {
    setDays((old) =>
      old.map((d, i) => {
        if (i !== day) return d;
        const list = [...d.exercises];
        [list[index], list[index + delta]] = [list[index + delta], list[index]];
        return { ...d, exercises: list };
      }),
    );
  }
  function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    submit({
      studentId: f.get("studentId"),
      ...(f.get("agentVersionId")
        ? { agentVersionId: f.get("agentVersionId") }
        : {}),
      content: {
        name: f.get("name"),
        reason: f.get("reason"),
        days,
        alerts: [],
        missingData: [],
        requiresReview: false,
      },
    });
  }
  return (
    <form className="form" onSubmit={send}>
      <label>
        Aluno
        <select
          aria-label="Aluno"
          name="studentId"
          required
          defaultValue={initial?.student_id || ""}
        >
          <option value="" disabled>
            Selecione
          </option>
          {data.students
            .filter((s) => s.status === "active")
            .map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Agente e versão para o próximo ciclo
        <select
          name="agentVersionId"
          defaultValue={initial?.agent_version_id || ""}
        >
          <option value="">
            Sem ciclo automático (regras básicas de validação)
          </option>
          {data.agents.map((a) => (
            <option key={a.version_id} value={a.version_id}>
              {a.name} · v{a.current_version}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Nome do programa"
        name="name"
        defaultValue={initial?.content.name}
      />
      <label>
        Motivo da criação ou alteração
        <textarea
          name="reason"
          minLength={5}
          maxLength={2000}
          required
          defaultValue={
            initial ? `Restauração baseada na versão ${initial.version}.` : ""
          }
        />
      </label>
      {days.map((day, di) => (
        <fieldset className="card" key={di}>
          <legend>Dia {di + 1}</legend>
          <label>
            Nome do dia
            <input
              required
              value={day.name}
              onChange={(e) =>
                setDays((old) =>
                  old.map((d, i) =>
                    i === di ? { ...d, name: e.target.value } : d,
                  ),
                )
              }
            />
          </label>
          {day.exercises.map((exercise, ei) => (
            <div className="workout-exercise" key={ei}>
              <label>
                Exercício
                <select
                  value={exercise.exerciseId}
                  onChange={(e) =>
                    update(di, ei, { exerciseId: e.target.value })
                  }
                >
                  {data.exercises.map((ex) => (
                    <option value={ex.id} key={ex.id}>
                      {ex.name} · {ex.equipment}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid two" style={{ marginTop: 12 }}>
                {(
                  ["sets", "repsMin", "repsMax", "restSeconds", "rpe"] as const
                ).map((key) => (
                  <label key={key}>
                    {
                      {
                        sets: "Séries",
                        repsMin: "Repetições mín.",
                        repsMax: "Repetições máx.",
                        restSeconds: "Descanso (s)",
                        rpe: "Esforço RPE (1–10)",
                      }[key]
                    }
                    <input
                      type="number"
                      required
                      min={key === "restSeconds" ? 10 : 1}
                      max={
                        key === "sets" || key === "rpe"
                          ? 10
                          : key === "restSeconds"
                            ? 600
                            : 100
                      }
                      value={exercise[key]}
                      onChange={(e) =>
                        update(di, ei, { [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
              <label style={{ marginTop: 12 }}>
                Observações
                <input
                  value={exercise.notes}
                  maxLength={500}
                  onChange={(e) => update(di, ei, { notes: e.target.value })}
                />
              </label>
              <div className="flex" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  aria-label="Mover exercício para cima"
                  disabled={ei === 0}
                  onClick={() => move(di, ei, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Mover exercício para baixo"
                  disabled={ei === day.exercises.length - 1}
                  onClick={() => move(di, ei, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Remover exercício"
                  onClick={() =>
                    setDays((old) =>
                      old.map((d, i) =>
                        i !== di
                          ? d
                          : {
                              ...d,
                              exercises: d.exercises.filter((_, j) => j !== ei),
                            },
                      ),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex" style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => addExercise(di)}
              disabled={!data.exercises.length}
            >
              <Plus size={16} />
              Adicionar exercício
            </button>
            {days.length > 1 && (
              <button
                type="button"
                className="danger"
                onClick={() => setDays((old) => old.filter((_, i) => i !== di))}
              >
                Remover dia
              </button>
            )}
          </div>
        </fieldset>
      ))}
      {!data.exercises.length && (
        <p className="notice">
          Cadastre exercícios na biblioteca antes de criar um programa.
        </p>
      )}
      <button
        type="button"
        disabled={days.length >= 7}
        onClick={() =>
          setDays([
            ...days,
            {
              name: `Treino ${String.fromCharCode(65 + days.length)}`,
              exercises: [],
            },
          ])
        }
      >
        <Plus size={16} />
        Adicionar dia
      </button>
      <button
        disabled={busy || days.some((d) => !d.exercises.length)}
        className="primary"
      >
        Validar e salvar proposta
      </button>
      <small>
        Salvar não publica. As regras serão revalidadas no momento da
        publicação.
      </small>
    </form>
  );
}
