"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Maximize2, Gauge, Move3D } from "lucide-react";
import { getCatalogExercise } from "@/domain/exercise-catalog";
import {
  getTimedExerciseMotion,
  motionPresentation,
  type MotionId,
} from "@/domain/exercise-motion";
import { type ExerciseView } from "./exercise-figure";
import { ExerciseScene } from "./exercise-scene";
import styles from "./exercise-animation.module.css";

export function ExerciseDemonstration({ exerciseId }: { exerciseId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="exercise-demonstration"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <Play size={15} />
        Ver execução animada
      </summary>
      {open && <ExerciseAnimation exerciseId={exerciseId} compact />}
    </details>
  );
}

export function ExerciseAnimation({
  exerciseId,
  compact = false,
}: {
  exerciseId: string;
  compact?: boolean;
}) {
  const [progress, setProgress] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [view, setView] = useState<ExerciseView>(
      () => motionPresentation[exerciseId as MotionId]?.camera || "perspective",
    );
  const [fullscreenError, setFullscreenError] = useState("");
  const root = useRef<HTMLDivElement>(null),
    visible = useRef(true),
    progressRef = useRef(0);
  const exercise = getCatalogExercise(exerciseId);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    let raf = 0,
      last = 0,
      accumulated = 0;
    const tick = (now: number) => {
      const delta = last ? Math.min(now - last, 80) : 0;
      last = now;
      if (visible.current && !document.hidden) accumulated += delta;
      if (accumulated > 0) {
        // Cadence follows the production guide, not a training prescription.
        progressRef.current =
          (progressRef.current +
            (accumulated * speed) /
              (motionPresentation[exerciseId as MotionId].durationSeconds *
                1000)) %
          1;
        setProgress(progressRef.current);
        accumulated = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, exerciseId]);
  if (!exercise) return null;
  const frame = getTimedExerciseMotion(exerciseId, progress);
  const presentation = motionPresentation[exerciseId as MotionId];
  const seek = (n: number) => {
    setPlaying(false);
    progressRef.current = n;
    setProgress(n);
  };
  return (
    <div
      className={`${styles.player} ${compact ? styles.compact : ""}`}
      ref={root}
      data-animation-id={exerciseId}
    >
      <div className={styles.topline}>
        <span>
          <i /> ESTÚDIO DE MOVIMENTO
        </span>
        <span>FITCORE / KORVEX</span>
      </div>
      <div className={styles.stage}>
        <div className={styles.stageLabel}>
          <span className={styles.dot} />
          {exercise.group}
          <small>Grupo em foco</small>
        </div>
        <div className={styles.figure}>
          <ExerciseScene
            exerciseId={exerciseId}
            progress={progress}
            view={view}
          />
        </div>
        <span className={styles.angle}>
          {view === "perspective"
            ? "VISTA EM PERSPECTIVA"
            : view === "front"
              ? "VISTA FRONTAL"
              : view === "back"
                ? "VISTA POSTERIOR"
                : view === "upper"
                  ? "VISTA SUPERIOR"
                  : "VISTA LATERAL"}
        </span>
        {!playing && (
          <button
            className={styles.stagePlay}
            aria-label="Reproduzir animação"
            onClick={() => setPlaying(true)}
          >
            <Play size={22} fill="currentColor" />
          </button>
        )}
      </div>
      <div className={styles.phase}>
        <div>
          <span className={styles.phaseNumber}>
            {progress < 0.5 ? "01" : "02"}
          </span>
          <div>
            <strong>{frame.phase}</strong>
            <p>{frame.cue}</p>
          </div>
        </div>
        <span className={styles.vector}>Modelo 3D original</span>
      </div>
      <div className={styles.controls}>
        <label className={styles.timeline}>
          <span className="sr-only">Progresso da animação</span>
          <input
            aria-label="Progresso da animação"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={Math.round(progress * 100)}
            onChange={(e) => seek(Number(e.target.value) / 100)}
          />
        </label>
        <div className={styles.controlRow}>
          <div className={styles.controlGroup}>
            <button
              className={styles.play}
              aria-label={playing ? "Pausar animação" : "Reproduzir animação"}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
              <span>{playing ? "Pausar" : "Reproduzir"}</span>
            </button>
            <button
              aria-label="Reiniciar animação"
              title="Reiniciar"
              onClick={() => seek(0)}
            >
              <RotateCcw size={17} />
            </button>
            <label className={styles.selectControl}>
              <Gauge size={16} />
              <span className="sr-only">Velocidade da animação</span>
              <select
                aria-label="Velocidade da animação"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={0.5}>0,5×</option>
                <option value={1}>1×</option>
                <option value={1.5}>1,5×</option>
              </select>
            </label>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.selectControl}>
              <Move3D size={16} />
              <span className="sr-only">Ângulo da animação</span>
              <select
                aria-label="Ângulo da animação"
                value={view}
                onChange={(e) => setView(e.target.value as ExerciseView)}
              >
                <option value="perspective">Perspectiva</option>
                <option value="side">Lateral</option>
                <option value="front">Frontal</option>
                <option value="back">Posterior</option>
                <option value="upper">Superior</option>
              </select>
            </label>
            <button
              className={styles.fullscreen}
              aria-label="Tela cheia"
              onClick={async () => {
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else if (root.current?.requestFullscreen)
                    await root.current.requestFullscreen();
                  else
                    setFullscreenError(
                      "Use a visualização ampliada do navegador neste dispositivo.",
                    );
                } catch {
                  setFullscreenError(
                    "A tela cheia não está disponível neste navegador.",
                  );
                }
              }}
            >
              <Maximize2 size={17} />
            </button>
          </div>
        </div>
      </div>
      {fullscreenError && (
        <p className={styles.caption} role="status">
          {fullscreenError}
        </p>
      )}
      <div className={styles.legend}>
        <span>
          <i style={{ background: "#ff761c" }} />
          Primário: {presentation.primaryMuscles.join(" · ")}
        </span>
        {presentation.secondaryMuscles.length > 0 && (
          <span>
            <i style={{ background: "#e8b352" }} />
            Secundário: {presentation.secondaryMuscles.join(" · ")}
          </span>
        )}
        {exercise.cautions.length > 0 && (
          <span>
            <i style={{ background: "#ff585a" }} />
            Cuidados: {exercise.cautions.join(" · ")}
          </span>
        )}
      </div>
      <p className={styles.caption}>
        Modelo 3D estilizado · Ciclo visual de{" "}
        {presentation.durationSeconds.toLocaleString("pt-BR")}s. Ajuste execução
        e amplitude com o personal.
      </p>
    </div>
  );
}
