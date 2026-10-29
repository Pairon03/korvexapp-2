"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Dumbbell,
  LayoutDashboard,
  Users,
  Zap,
} from "lucide-react";
import styles from "./landing.module.css";

export function LandingPreview() {
  const [view, setView] = useState<"personal" | "aluno">("personal");
  return (
    <div className={styles.productStage}>
      <div className={styles.productTabs} aria-label="Visões do produto">
        <button
          type="button"
          aria-pressed={view === "personal"}
          onClick={() => setView("personal")}
        >
          Para o personal
        </button>
        <button
          type="button"
          aria-pressed={view === "aluno"}
          onClick={() => setView("aluno")}
        >
          Para o aluno
        </button>
      </div>
      <div className={styles.productWindow}>
        <div className={styles.windowTop}>
          <span className={styles.windowBrand}>
            <Zap size={14} aria-hidden="true" /> FITCORE
          </span>
          <span className={styles.exampleTag}>DADOS FICTÍCIOS</span>
        </div>
        <div className={styles.productBody}>
          <div className={styles.miniRail} aria-hidden="true">
            <LayoutDashboard size={18} />
            <Users size={18} />
            <Dumbbell size={18} />
            <ClipboardCheck size={18} />
          </div>
          <div className={styles.productContent}>
            <span className={styles.productEyebrow}>
              {view === "personal"
                ? "SEU ESPAÇO PROFISSIONAL"
                : "SEU ACOMPANHAMENTO"}
            </span>
            <h2>
              {view === "personal"
                ? "O próximo passo, mais claro."
                : "Tudo pronto para o seu treino."}
            </h2>
            <p>
              {view === "personal"
                ? "Alunos, programas e avaliações no mesmo lugar."
                : "Uma visão simples do programa e da sua rotina."}
            </p>
            <div className={styles.miniMetrics}>
              <div>
                <Users size={16} />
                <strong>{view === "personal" ? "02" : "01"}</strong>
                <span>
                  {view === "personal"
                    ? "Alunos de exemplo"
                    : "Programa de exemplo"}
                </span>
              </div>
              <div>
                <CalendarDays size={16} />
                <strong>
                  45<span>dias</span>
                </strong>
                <span>Ciclo ilustrativo</span>
              </div>
            </div>
            <div className={styles.miniProgram}>
              <div className={styles.programTop}>
                <span>
                  <Dumbbell size={14} /> PROGRAMA DE EXEMPLO
                </span>
                <span>v.01</span>
              </div>
              <h3>
                {view === "personal"
                  ? "Ana · acompanhamento ilustrativo"
                  : "Ana · seu programa de exemplo"}
              </h3>
              <div className={styles.programRow}>
                <span className={styles.roundCheck}>
                  <Check size={12} />
                </span>
                <span>
                  Avaliação e objetivos<small>Contexto para cada decisão</small>
                </span>
                <ChevronRight size={16} />
              </div>
              <div className={styles.programRow}>
                <span className={styles.roundCheck}>
                  <Check size={12} />
                </span>
                <span>
                  Programa com histórico
                  <small>Exercícios, séries e descanso</small>
                </span>
                <ChevronRight size={16} />
              </div>
              <Link href="/previa" className={styles.miniLink}>
                Explorar este exemplo <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.productCaption}>
        <span className={styles.statusDot} /> Uma plataforma. Duas experiências
        conectadas.
      </div>
    </div>
  );
}
