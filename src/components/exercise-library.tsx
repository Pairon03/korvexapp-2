"use client";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Play,
  X,
  Check,
  Plus,
  ArrowUpRight,
  Dumbbell,
  ShieldCheck,
} from "lucide-react";
import {
  exerciseCatalog,
  exerciseGroups,
  exerciseEquipment,
  getCatalogExercise,
  type CatalogExercise,
} from "@/domain/exercise-catalog";
import { ExerciseAnimation } from "./exercise-animation";
import { ExerciseFigure } from "./exercise-figure";
import styles from "./exercise-library.module.css";

const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function ExerciseLibrary({
  onSelect,
  importedIds = [],
  compact = false,
}: {
  onSelect?: (exercise: CatalogExercise) => Promise<void> | void;
  importedIds?: string[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("Todos"),
    [equipment, setEquipment] = useState("Todos"),
    [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<CatalogExercise | null>(null),
    [pending, setPending] = useState<string | null>(null),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const filtered = exerciseCatalog.filter(
    (ex) =>
      (group === "Todos" || ex.group === group) &&
      (equipment === "Todos" || ex.equipment.includes(equipment as never)) &&
      normalized(`${ex.name} ${ex.group} ${ex.equipment.join(" ")}`).includes(
        normalized(query),
      ),
  );
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [selected]);
  async function select(ex: CatalogExercise) {
    if (!onSelect || pending) return;
    setPending(ex.id);
    setError("");
    try {
      await onSelect(ex);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível adicionar o exercício. Tente novamente.",
      );
    } finally {
      setPending(null);
    }
  }
  const close = () => {
    dialog.current?.close();
    setSelected(null);
    setError("");
  };
  return (
    <section
      className={`${styles.library} ${compact ? styles.compact : ""}`}
      aria-label="Biblioteca de exercícios animados"
    >
      <div className={styles.libraryHeading}>
        <div>
          <span className={styles.overline}>BIBLIOTECA FITCORE</span>
          <h2>Um movimento. Todos os detalhes.</h2>
          <p>
            38 exercícios, 10 grupos musculares. Escolha e veja a execução
            animada.
          </p>
        </div>
        <span className={styles.assetBadge}>
          <ShieldCheck size={14} />
          Animações originais
        </span>
      </div>
      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={18} />
          <span className="sr-only">Buscar exercício</span>
          <input
            type="search"
            aria-label="Buscar exercício"
            placeholder="Buscar exercício, músculo ou equipamento…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(12);
            }}
          />
        </label>
        <label className={styles.equipment}>
          <SlidersHorizontal size={16} />
          <span className="sr-only">Filtrar equipamento</span>
          <select
            aria-label="Filtrar equipamento"
            value={equipment}
            onChange={(e) => {
              setEquipment(e.target.value);
              setLimit(12);
            }}
          >
            <option value="Todos">Todos os equipamentos</option>
            {exerciseEquipment.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.groups} aria-label="Grupos musculares">
        {["Todos", ...exerciseGroups].map((g) => (
          <button
            key={g}
            aria-pressed={group === g}
            onClick={() => {
              setGroup(g);
              setLimit(12);
            }}
          >
            {g}
            <span>
              {g === "Todos"
                ? 38
                : exerciseCatalog.filter((e) => e.group === g).length}
            </span>
          </button>
        ))}
      </div>
      <div className={styles.resultHeading}>
        <p role="status">
          {filtered.length}{" "}
          {filtered.length === 1
            ? "exercício disponível"
            : "exercícios disponíveis"}
        </p>
        <span>
          <span className={styles.greenDot} />
          Ilustrações com controle de movimento
        </span>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className={styles.cards}>
        {filtered.slice(0, limit).map((ex) => (
          <article key={ex.id} className={styles.card}>
            <button
              className={styles.thumbnail}
              onClick={() => {
                setSelected(ex);
                setError("");
              }}
              aria-label={`Ver animação de ${ex.name}`}
            >
              <div className={styles.miniFigure}>
                <ExerciseFigure exerciseId={ex.id} decorative />
              </div>
              <span className={styles.level}>{ex.level}</span>
              <span className={styles.play}>
                <Play size={14} fill="currentColor" />
              </span>
              <span className={styles.animationTag}>ANIMADO</span>
            </button>
            <div className={styles.cardBody}>
              <span className={styles.muscle}>{ex.group}</span>
              <h3>{ex.name}</h3>
              <p>
                <Dumbbell size={12} />
                {ex.equipment.join(" · ")}
              </p>
              <div className={styles.cardActions}>
                <button
                  onClick={() => {
                    setSelected(ex);
                    setError("");
                  }}
                >
                  Ver execução
                  <ArrowUpRight size={14} />
                </button>
                {onSelect && (
                  <button
                    className={styles.add}
                    disabled={!!pending || importedIds.includes(ex.id)}
                    onClick={() => void select(ex)}
                    aria-label={
                      importedIds.includes(ex.id)
                        ? `${ex.name} já na biblioteca`
                        : `Adicionar ${ex.name} à biblioteca`
                    }
                  >
                    {importedIds.includes(ex.id) ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className={styles.empty}>
          <Search size={26} />
          <h3>Nenhum exercício encontrado</h3>
          <p>Tente outro termo ou ajuste os filtros.</p>
          <button
            onClick={() => {
              setQuery("");
              setGroup("Todos");
              setEquipment("Todos");
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
      {filtered.length > limit && (
        <button
          className={styles.loadMore}
          onClick={() => setLimit((n) => n + 12)}
        >
          Mostrar mais exercícios
          <span>{filtered.length - limit} restantes</span>
        </button>
      )}
      {selected && (
        <dialog
          ref={dialog}
          className={styles.dialog}
          aria-labelledby="exercise-detail-title"
          onCancel={close}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className={styles.dialogTop}>
            <div>
              <span className={styles.overline}>
                {selected.group} / {selected.level}
              </span>
              <h2 id="exercise-detail-title">{selected.name}</h2>
            </div>
            <button
              className={styles.close}
              aria-label="Fechar demonstração"
              onClick={close}
            >
              <X size={20} />
            </button>
          </div>
          <ExerciseAnimation key={selected.id} exerciseId={selected.id} />
          <div className={styles.details}>
            <div>
              <h3>Como executar</h3>
              <p>{selected.instruction}</p>
              <h3>Pontos de atenção</h3>
              <ul>
                {selected.commonMistakes.map((m) => (
                  <li key={m}>Evite: {m.toLocaleLowerCase("pt-BR")}.</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Equipamento</h3>
              <p>{selected.equipment.join(" · ")}</p>
              {selected.secondaryMuscles.length > 0 && (
                <>
                  <h3>Também trabalha</h3>
                  <p>{selected.secondaryMuscles.join(" · ")}</p>
                </>
              )}
              {selected.cautions.length > 0 && (
                <>
                  <h3>Cuidados indicados no catálogo</h3>
                  <p>
                    {selected.cautions.join(" · ")}. Avalie a adequação com o
                    profissional.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className={styles.substitutions}>
            <h3>Alternativas para avaliar com o personal</h3>
            <div>
              {selected.substitutionIds.map((id) => {
                const ex = getCatalogExercise(id);
                return (
                  ex && (
                    <button
                      key={id}
                      onClick={() => {
                        setSelected(ex);
                        setError("");
                        dialog.current?.scrollTo({ top: 0 });
                      }}
                    >
                      {ex.name}
                      <ArrowUpRight size={13} />
                    </button>
                  )
                );
              })}
            </div>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className={styles.dialogFoot}>
            <p>
              Ilustração educativa. As alternativas não são trocas automáticas
              de prescrição.
            </p>
            {onSelect && (
              <button
                className="primary"
                disabled={!!pending || importedIds.includes(selected.id)}
                onClick={() => void select(selected)}
              >
                {importedIds.includes(selected.id) ? (
                  <>
                    <Check size={16} />
                    Já na sua biblioteca
                  </>
                ) : pending === selected.id ? (
                  "Adicionando…"
                ) : (
                  <>
                    <Plus size={16} />
                    Adicionar à minha biblioteca
                  </>
                )}
              </button>
            )}
          </div>
        </dialog>
      )}
    </section>
  );
}
