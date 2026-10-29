import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Zap, Check } from "lucide-react";
import { ExerciseLibrary } from "@/components/exercise-library";
import { ExerciseAnimation } from "@/components/exercise-animation";
import styles from "./page.module.css";
export const metadata: Metadata = {
  title: "Biblioteca de exercícios animados",
  description:
    "Explore 38 exercícios com animações originais, controles de movimento e instruções de execução na biblioteca FitCore Korvex.",
};
export default function LibraryPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className="brand">
          <Zap size={24} />
          FITCORE<span>by Korvex</span>
        </Link>
        <Link href="/previa">
          Explorar plataforma
          <ArrowUpRight size={15} />
        </Link>
      </header>
      <main>
        <section className={styles.hero}>
          <div>
            <Link className={styles.back} href="/">
              <ArrowLeft size={13} />
              Voltar ao site
            </Link>
            <span className={styles.overline}>BIBLIOTECA DE MOVIMENTO</span>
            <h1>
              Entender o movimento.
              <br />
              <em>Sentir a diferença.</em>
            </h1>
            <p>
              Uma demonstração ao alcance do aluno, em cada exercício. Observe o
              movimento, mude o ângulo e acompanhe no seu ritmo.
            </p>
            <div className={styles.facts}>
              <span>
                <Check size={13} />
                38 exercícios
              </span>
              <span>
                <Check size={13} />
                10 grupos musculares
              </span>
              <span>
                <Check size={13} />
                Sem vídeos externos
              </span>
            </div>
            <a className={styles.cta} href="#exercicios">
              Explorar exercícios
              <ArrowUpRight size={16} />
            </a>
            <small>
              Modelos 3D estilizados. A orientação individual é do seu personal.
            </small>
          </div>
          <ExerciseAnimation exerciseId="agachamento-goblet" />
        </section>
        <details className={styles.renderedSample}>
          <summary>
            <span>AMOSTRA RENDERIZADA</span>Agachamento goblet · MP4 em 60 FPS
            <ArrowUpRight size={16} />
          </summary>
          <div>
            <video
              controls
              playsInline
              loop
              preload="none"
              poster="/exercise-videos/agachamento-goblet.poster.webp"
              aria-label="Demonstração 3D renderizada do agachamento goblet"
            >
              <source
                src="/exercise-videos/agachamento-goblet.mp4"
                type="video/mp4"
              />
              Seu navegador não reproduz este formato. Baixe o MP4 no link
              abaixo.
            </video>
            <div>
              <h2>O mesmo movimento, em vídeo.</h2>
              <p>
                Amostra original renderizada em 720×720, com 60 quadros por
                segundo e ciclo de 3,8 segundos. Os outros exercícios estão
                disponíveis no player 3D interativo da biblioteca.
              </p>
              <p>
                Segure o halter junto ao peito, mantenha os calcanhares apoiados
                e use a amplitude orientada pelo personal.
              </p>
              <a href="/exercise-videos/agachamento-goblet.mp4" download>
                Baixar amostra MP4
                <ArrowUpRight size={14} />
              </a>
              <small>Modelo 3D estilizado. Demonstração educativa.</small>
            </div>
          </div>
        </details>
        <div id="exercicios" className={styles.catalog}>
          <ExerciseLibrary />
        </div>
      </main>
      <footer className={styles.footer}>
        <span>FITCORE / KORVEX · Biblioteca de movimento</span>
        <div>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/previa">
            Conhecer a plataforma
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
