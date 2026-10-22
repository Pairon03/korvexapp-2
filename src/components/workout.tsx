"use client";
import { useEffect, useState } from "react";
import { Play, Check, SkipForward } from "lucide-react";
import type { Version, Exercise } from "./types";
type SetLog = { exerciseId: string; kg: number; reps: number; rpe: number };
type Draft = {
  requestId: string;
  start: number;
  restEnd: number;
  sets: SetLog[];
};
export function Workout({
  version,
  exercises,
  userId,
  submit,
  busy,
}: {
  version: Version;
  exercises: Exercise[];
  userId: string;
  submit: (value: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const key = `fitcore-session:${userId}:${version.id}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const old = localStorage.getItem(key);
      if (old) return JSON.parse(old);
    } catch {}
    return {
      requestId: crypto.randomUUID(),
      start: Date.now(),
      restEnd: 0,
      sets: [],
    };
  });
  const [clock, setClock] = useState(() => Date.now()),
    [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      setTimeout(() => setStorageError(true), 0);
    }
  }, [draft, key]);
  const elapsed = Math.max(0, Math.floor((clock - draft.start) / 1000)),
    rest = Math.max(0, Math.ceil((draft.restEnd - clock) / 1000));
  return (
    <div className="stack">
      <p className="notice">
        As séries abaixo são um rascunho neste navegador até você selecionar
        “Finalizar e salvar no servidor”. Não feche a janela durante o envio.
      </p>
      {storageError && (
        <p className="error" role="alert">
          O navegador não permitiu salvar o rascunho. Mantenha esta aba aberta e
          salve no servidor.
        </p>
      )}
      <div className="flex between">
        <span className="eyebrow">SESSÃO EM ANDAMENTO</span>
        <strong style={{ fontSize: 30 }}>
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </strong>
      </div>
      {rest > 0 && (
        <div className="card">
          <strong>Descanso: {rest}s</strong>
          <button onClick={() => setDraft({ ...draft, restEnd: 0 })}>
            <SkipForward size={15} />
            Pular descanso
          </button>
        </div>
      )}
      {version.content.days.map((day, di) => (
        <section key={di}>
          <h3>{day.name}</h3>
          {day.exercises.map((planned, i) => {
            const exercise = exercises.find((e) => e.id === planned.exerciseId);
            return (
              <article className="workout-exercise" key={i}>
                <h3>{exercise?.name || "Exercício do programa"}</h3>
                <p className="muted">{exercise?.instructions}</p>
                <p>
                  {planned.sets} séries · {planned.repsMin}–{planned.repsMax}{" "}
                  repetições · {planned.restSeconds}s descanso
                </p>
                <small>{planned.notes}</small>
                <form
                  className="set-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    setDraft({
                      ...draft,
                      restEnd: Date.now() + planned.restSeconds * 1000,
                      sets: [
                        ...draft.sets,
                        {
                          exerciseId: planned.exerciseId,
                          kg: Number(f.get("kg")),
                          reps: Number(f.get("reps")),
                          rpe: Number(f.get("rpe")),
                        },
                      ],
                    });
                  }}
                >
                  <label>
                    Carga (kg)
                    <input
                      name="kg"
                      type="number"
                      min={0}
                      max={1000}
                      step="0.5"
                      defaultValue={0}
                      required
                    />
                  </label>
                  <label>
                    Repetições
                    <input
                      name="reps"
                      type="number"
                      min={1}
                      max={200}
                      defaultValue={planned.repsMin}
                      required
                    />
                  </label>
                  <label>
                    RPE
                    <input
                      name="rpe"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={planned.rpe}
                      required
                    />
                  </label>
                  <button>
                    <Check size={16} />
                    Concluir série
                  </button>
                </form>
                <p style={{ marginTop: 12 }}>
                  {
                    draft.sets.filter(
                      (s) => s.exerciseId === planned.exerciseId,
                    ).length
                  }{" "}
                  série(s) registradas no rascunho
                </p>
              </article>
            );
          })}
        </section>
      ))}
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (!confirm("Finalizar esta sessão e salvar as séries no servidor?"))
            return;
          const saved = await submit({
            studentId: version.student_id,
            versionId: version.id,
            requestId: draft.requestId,
            sets: draft.sets,
            discomfort: f.get("discomfort") === "on",
            notes: f.get("notes") || "",
          });
          if (saved) localStorage.removeItem(key);
        }}
      >
        <label className="check">
          <input type="checkbox" name="discomfort" />
          Houve dor ou desconforto durante a execução?
        </label>
        <label>
          Observações
          <textarea name="notes" maxLength={2000} />
        </label>
        <button className="primary" disabled={busy || !draft.sets.length}>
          <Play size={16} />
          Finalizar e salvar no servidor
        </button>
      </form>
    </div>
  );
}
