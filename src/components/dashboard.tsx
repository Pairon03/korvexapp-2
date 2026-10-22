"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  Users,
  Dumbbell,
  BrainCircuit,
  ClipboardList,
  CalendarClock,
  Settings,
  LogOut,
  Plus,
  X,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import {
  StudentForm,
  ExerciseForm,
  AgentForm,
  AssessmentForm,
  ProgramForm,
  SelectStudent,
} from "./forms";
import type { Agent, DashboardData, Version } from "./types";
import { Workout } from "./workout";
import { Photos } from "./photos";
type Tab =
  | "overview"
  | "students"
  | "exercises"
  | "agents"
  | "programs"
  | "assessments"
  | "cycles"
  | "billing"
  | "account";
type Modal = {
  type:
    | "student"
    | "exercise"
    | "agent"
    | "assessment"
    | "program"
    | "generate"
    | "workout"
    | "details";
  agent?: Agent;
  version?: Version;
};
const labels: Record<Tab, string> = {
  overview: "Visão geral",
  students: "Alunos",
  exercises: "Biblioteca",
  agents: "Agentes de IA",
  programs: "Programas",
  assessments: "Avaliações",
  cycles: "Ciclos",
  billing: "Assinatura",
  account: "Minha conta",
};
const states: Record<string, string> = {
  scheduled: "Agendado",
  awaiting_assessment: "Aguardando avaliação",
  incomplete: "Dados incompletos",
  processing: "Em processamento",
  review: "Aguardando revisão",
  published: "Publicado",
  suspended: "Suspenso",
  failed: "Falhou",
  canceled: "Cancelado",
  valid: "Validada",
  blocked: "Bloqueada",
  trialing: "Demonstração",
  active: "Ativa",
  past_due: "Pagamento pendente",
  unpaid: "Não paga",
};
const date = (v: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(v));
const measuredDate = (v: string) => v.split("-").reverse().join("/");
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="dialog-title"
    >
      <button className="close" onClick={close} aria-label="Fechar janela">
        <X size={18} />
      </button>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}
async function fetchDashboard(tenantId = ""): Promise<DashboardData> {
  const r = await fetch("/api/dashboard", {
    cache: "no-store",
    headers: tenantId ? { "x-tenant-id": tenantId } : {},
  });
  const v = await r.json();
  if (!r.ok) throw Error(r.status === 401 ? "SESSION_EXPIRED" : v.message);
  return v;
}
export function Dashboard() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
  const [data, setData] = useState<DashboardData | null>(null),
    [tab, setTab] = useState<Tab>("overview"),
    [modal, setModal] = useState<Modal | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [query, setQuery] = useState(""),
    [selectedStudent, setSelectedStudent] = useState("");
  const load = useCallback(async () => {
    setData(await fetchDashboard(tenantId));
  }, [tenantId]);
  useEffect(() => {
    let active = true;
    fetchDashboard(tenantId)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) {
          if (e.message === "SESSION_EXPIRED") router.replace("/entrar");
          else setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [router, tenantId]);
  async function run(
    path: string,
    value: unknown = {},
    options: { close?: boolean; refresh?: boolean } = {},
  ) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch(`/api/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tenantId ? { "x-tenant-id": tenantId } : {}),
        },
        body: JSON.stringify(value),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.message || "A operação não foi concluída.");
      if (result.url) {
        window.location.assign(result.url);
        return true;
      }
      if (path === "auth/logout") {
        router.replace("/entrar");
        router.refresh();
        return true;
      }
      if (options.refresh !== false) await load();
      setSuccess(result.message || "Registro salvo no servidor.");
      if (options.close !== false) setModal(null);
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Falha de conexão. Seus dados não foram confirmados.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="auth">
        <span className="brand">
          <Zap />
          FITCORE
        </span>
        <h1 style={{ marginTop: 40 }}>Preparando seu espaço.</h1>
        {error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <button onClick={() => load().catch((e) => setError(e.message))}>
              Tentar novamente
            </button>
          </>
        ) : (
          <p role="status">Carregando seus registros…</p>
        )}
      </main>
    );
  const staff = data.actor.role !== "student",
    name = (id: string) =>
      data.students.find((s) => s.id === id)?.name || "Aluno",
    byStudent = <T extends { student_id: string }>(rows: T[]) =>
      selectedStudent
        ? rows.filter((r) => r.student_id === selectedStudent)
        : rows;
  const tabs: { id: Tab; Icon: typeof Users }[] = staff
    ? [
        { id: "overview", Icon: LayoutDashboard },
        { id: "students", Icon: Users },
        { id: "exercises", Icon: Dumbbell },
        { id: "agents", Icon: BrainCircuit },
        { id: "programs", Icon: ClipboardList },
        { id: "assessments", Icon: FileCheck2 },
        { id: "cycles", Icon: CalendarClock },
        { id: "billing", Icon: Settings },
        { id: "account", Icon: Settings },
      ]
    : [
        { id: "overview", Icon: LayoutDashboard },
        { id: "programs", Icon: Dumbbell },
        { id: "assessments", Icon: FileCheck2 },
        { id: "account", Icon: Settings },
      ];
  const activeStudents = data.students.filter((s) => s.status === "active"),
    publishedStudents = new Set(data.versions.map((v) => v.student_id)),
    pending = data.cycles.filter((c) =>
      ["incomplete", "awaiting_assessment", "suspended", "failed"].includes(
        c.status,
      ),
    );
  function filter() {
    return (
      <select
        aria-label="Filtrar por aluno"
        value={selectedStudent}
        onChange={(e) => setSelectedStudent(e.target.value)}
      >
        <option value="">Todos os alunos</option>
        {data!.students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    );
  }
  function newButton(type: Modal["type"], text: string) {
    return (
      <button className="primary" onClick={() => setModal({ type })}>
        <Plus size={16} />
        {text}
      </button>
    );
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <Zap />
          FITCORE
        </Link>
        <label className="sr-only" htmlFor="org-switch">
          Organização
        </label>
        <select
          id="org-switch"
          value={data.actor.tenantId}
          disabled={busy}
          onChange={(e) => {
            setData(null);
            setTab("overview");
            setTenantId(e.target.value);
          }}
        >
          {data.organizations.map((o) => (
            <option value={o.id} key={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <nav aria-label="Navegação da plataforma">
          {tabs.map(({ id, Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                setTab(id);
                setQuery("");
                setSelectedStudent("");
                setError("");
                setSuccess("");
              }}
            >
              <Icon size={18} />
              {labels[id]}
            </button>
          ))}
        </nav>
        <div className="bottom">
          <p>
            {data.actor.name}
            <br />
            <span className="muted">
              {staff ? "Área profissional" : "Área do aluno"}
            </span>
          </p>
          <button
            disabled={busy}
            onClick={() => run("auth/logout", {}, { refresh: false })}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
      <main className="main">
        <header>
          <div>
            <span className="eyebrow">
              {data.tenant.name} ·{" "}
              {staff ? "ESPAÇO PROFISSIONAL" : "ESPAÇO DO ALUNO"}
            </span>
            <h1>
              {tab === "overview"
                ? `Vamos evoluir, ${data.actor.name.split(" ")[0]}.`
                : labels[tab]}
            </h1>
            <p className="muted">
              {tab === "overview"
                ? "Seu acompanhamento, com contexto e continuidade."
                : "Registros persistidos no servidor, associados à sua organização."}
            </p>
          </div>
          <span className="pill">
            {staff
              ? states[data.subscription?.status || ""] ||
                data.subscription?.status
              : "Aluno vinculado"}
          </span>
        </header>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="success">
            {success}
          </p>
        )}
        {tab === "overview" && (
          <div className="stack">
            {staff && (
              <>
                <div className="grid">
                  {[
                    ["Alunos ativos", activeStudents.length],
                    ["Alunos com programas", publishedStudents.size],
                    ["Ciclos que precisam de atenção", pending.length],
                  ].map(([label, n]) => (
                    <article key={label} className="card metric">
                      <small>{label}</small>
                      <strong>{n}</strong>
                    </article>
                  ))}
                </div>
                <div className="flex">
                  {newButton("student", "Cadastrar aluno")}
                  {newButton("program", "Criar programa")}
                  {newButton("assessment", "Nova avaliação")}
                </div>
                <section className="card">
                  <h2>Seu próximo passo</h2>
                  <div className="steps">
                    {[
                      ["Cadastre seu primeiro aluno", !!data.students.length],
                      [
                        "Adicione exercícios à biblioteca",
                        !!data.exercises.length,
                      ],
                      ["Configure um agente versionado", !!data.agents.length],
                      ["Registre uma avaliação", !!data.assessments.length],
                      ["Valide e publique um programa", !!data.versions.length],
                    ].map(([label, done]) => (
                      <p key={String(label)}>
                        <span className={done ? "accent" : "muted"}>
                          {done ? "✓ " : ""}
                          {label}
                        </span>
                      </p>
                    ))}
                  </div>
                </section>
              </>
            )}
            {!staff && (
              <>
                <article className="card">
                  <h2>Seu treino, no seu ritmo.</h2>
                  <p className="muted">
                    O programa publicado pelo seu profissional aparece na seção
                    Programas. Registre as séries realizadas e informe
                    dificuldades.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setTab("programs")}
                  >
                    Abrir meu programa <ArrowUpRight size={16} />
                  </button>
                </article>
                <div className="grid two">
                  <article className="card metric">
                    <small>Sessões registradas</small>
                    <strong>{data.logs.length}</strong>
                  </article>
                  <article className="card metric">
                    <small>Avaliações registradas</small>
                    <strong>{data.assessments.length}</strong>
                  </article>
                </div>
              </>
            )}
            <section className="card">
              <h2>Atividade recente</h2>
              {data.notifications.length ? (
                <div className="timeline">
                  {data.notifications.map((n) => (
                    <article key={n.id}>
                      <small>{date(n.created_at)}</small>
                      <p>{n.message}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty>
                  Nenhuma notificação. Suas próximas ações aparecerão aqui.
                </Empty>
              )}
            </section>
            {staff && (
              <p className="notice">
                IA:{" "}
                {data.integrations.ai
                  ? "credencial presente; funcionamento depende do provedor"
                  : "não configurada"}
                . Pagamentos:{" "}
                {data.integrations.payments
                  ? "credencial presente; validar homologação"
                  : "não configurados"}
                . E-mail: {data.integrations.email}.
              </p>
            )}
          </div>
        )}
        {tab === "students" && (
          <>
            <div className="toolbar">
              <input
                aria-label="Buscar aluno"
                placeholder="Buscar por nome ou e-mail"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {newButton("student", "Cadastrar aluno")}
            </div>
            <div className="list">
              {data.students
                .filter((s) =>
                  `${s.name} ${s.email}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((s) => (
                  <article className="list-item" key={s.id}>
                    <div className="flex between">
                      <div>
                        <h3>{s.name}</h3>
                        <small>
                          {s.email} · {s.days_per_week} dias/semana ·{" "}
                          {s.status === "active" ? "Ativo" : "Arquivado"}
                        </small>
                      </div>
                      <span className="pill">
                        {s.user_id ? "Conta vinculada" : "Convite pendente"}
                      </span>
                    </div>
                    <p className="muted">
                      Equipamentos: {s.equipment.join(", ")}
                    </p>
                    {s.limitations && (
                      <p className="notice">
                        Limitação relatada: revisão profissional necessária.
                      </p>
                    )}
                    <div className="flex">
                      <button
                        disabled={busy || s.status !== "active"}
                        onClick={() =>
                          run("students/invite", { studentId: s.id })
                        }
                      >
                        Enviar convite
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `${s.automation_enabled ? "Pausar" : "Ativar"} a automação deste aluno?`,
                            )
                          )
                            run("students/settings", {
                              studentId: s.id,
                              automationEnabled: !s.automation_enabled,
                              status: s.status,
                            });
                        }}
                      >
                        {s.automation_enabled
                          ? "Pausar automação"
                          : "Ativar automação"}
                      </button>
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              s.status === "active"
                                ? "Arquivar o aluno e suspender os ciclos?"
                                : "Reativar o aluno?",
                            )
                          )
                            run("students/settings", {
                              studentId: s.id,
                              automationEnabled: false,
                              status:
                                s.status === "active" ? "archived" : "active",
                            });
                        }}
                      >
                        {s.status === "active" ? "Arquivar" : "Reativar"}
                      </button>
                    </div>
                  </article>
                ))}
              {!data.students.length && (
                <Empty>
                  Cadastre seu primeiro aluno. Fotos não são obrigatórias.
                </Empty>
              )}
            </div>
          </>
        )}
        {tab === "exercises" && (
          <>
            <div className="toolbar">
              <input
                aria-label="Buscar exercício"
                placeholder="Buscar por nome, grupo ou equipamento"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {newButton("exercise", "Adicionar exercício")}
            </div>
            <div className="grid">
              {data.exercises
                .filter((e) =>
                  `${e.name} ${e.muscle} ${e.equipment}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((e) => (
                  <article key={e.id} className="card">
                    <Dumbbell className="accent" size={22} />
                    <h3 style={{ marginTop: 18 }}>{e.name}</h3>
                    <small>
                      {e.muscle} · {e.equipment}
                    </small>
                    <p className="muted" style={{ marginTop: 12 }}>
                      {e.instructions}
                    </p>
                  </article>
                ))}
            </div>
            {!data.exercises.length && (
              <Empty>
                A biblioteca está vazia. Cadastre exercícios próprios com
                instruções autorizadas.
              </Empty>
            )}
          </>
        )}
        {tab === "agents" && (
          <>
            <div className="toolbar">{newButton("agent", "Criar agente")}</div>
            <div className="grid two">
              {data.agents.map((a) => (
                <article className="card" key={a.id}>
                  <div className="flex between">
                    <BrainCircuit className="accent" />
                    <span className="pill">VERSÃO {a.current_version}</span>
                  </div>
                  <h3 style={{ marginTop: 20 }}>{a.name}</h3>
                  <p className="muted">
                    Até {a.rules.maxDays} dias/semana · {a.rules.maxSetsPerDay}{" "}
                    séries/dia
                    <br />
                    Ciclo de {a.rules.cycleDays} dias · avaliação válida por{" "}
                    {a.rules.assessmentMaxAgeDays} dias
                  </p>
                  <p>
                    Publicação automática:{" "}
                    {a.rules.autoPublish
                      ? "autorizada no agente"
                      : "exige revisão"}
                  </p>
                  <button onClick={() => setModal({ type: "agent", agent: a })}>
                    Editar como nova versão
                  </button>
                </article>
              ))}
            </div>
            {!data.agents.length && (
              <Empty>
                Defina sua metodologia em regras estruturadas. Mudanças criam
                versões e preservam o histórico.
              </Empty>
            )}
          </>
        )}
        {tab === "assessments" && (
          <>
            <div className="toolbar">
              {staff && filter()}
              {newButton("assessment", "Nova avaliação")}
            </div>
            {!data.assessments.length ? (
              <Empty>
                Registre peso e altura para começar. Cintura é opcional e fotos
                não são exigidas.
              </Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Avaliações registradas</caption>
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Data</th>
                      <th>Peso</th>
                      <th>Altura</th>
                      <th>Cintura</th>
                      <th>Atenção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byStudent(data.assessments).map((a) => (
                      <tr key={a.id}>
                        <td>{name(a.student_id)}</td>
                        <td>{measuredDate(a.measured_on)}</td>
                        <td>
                          {Number(a.weight_kg).toLocaleString("pt-BR")} kg
                        </td>
                        <td>
                          {Number(a.height_cm).toLocaleString("pt-BR")} cm
                        </td>
                        <td>
                          {a.waist_cm
                            ? `${Number(a.waist_cm).toLocaleString("pt-BR")} cm`
                            : "Não informada"}
                        </td>
                        <td>
                          {a.new_pain ? "Dor relatada" : "Sem alerta informado"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted" style={{ marginTop: 18 }}>
              Valores ausentes não são substituídos por zero. Não há cálculo de
              gordura corporal nesta etapa.
            </p>
            <Photos data={data} />
          </>
        )}
        {tab === "programs" && (
          <>
            <div className="toolbar">
              {staff && (
                <>
                  {filter()}
                  {newButton("program", "Criar programa manual")}
                  {newButton("generate", "Solicitar proposta à IA")}
                </>
              )}
            </div>
            {staff && data.proposals.length > 0 && (
              <section className="stack" style={{ marginBottom: 28 }}>
                <h2>Propostas para revisão</h2>
                {byStudent(data.proposals).map((p) => (
                  <article className="card" key={p.id}>
                    <div className="flex between">
                      <h3>
                        {p.content.name} · {name(p.student_id)}
                      </h3>
                      <span className="pill">{states[p.status]}</span>
                    </div>
                    <p className="muted">{p.content.reason}</p>
                    <ul>
                      {p.validation.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <details>
                      <summary>Ver proposta estruturada</summary>
                      <pre className="json">
                        {JSON.stringify(p.content, null, 2)}
                      </pre>
                    </details>
                    <button
                      className="primary"
                      style={{ marginTop: 16 }}
                      disabled={busy || p.status !== "valid"}
                      onClick={() => {
                        if (
                          confirm(
                            "Publicar esta proposta como nova versão? O histórico anterior será preservado.",
                          )
                        )
                          run("proposals/publish", { proposalId: p.id });
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Publicar nova versão
                    </button>
                  </article>
                ))}
              </section>
            )}
            <h2>{staff ? "Histórico de programas" : "Seus programas"}</h2>
            <div className="list">
              {byStudent(data.versions).map((v) => (
                <article className="list-item" key={v.id}>
                  <div className="flex between">
                    <div>
                      <h3>{v.content.name}</h3>
                      <small>
                        {name(v.student_id)} · v{v.version} ·{" "}
                        {date(v.published_at)}
                      </small>
                    </div>
                    <span className="pill">
                      PUBLICADO · {v.source === "ai" ? "IA" : "MANUAL"}
                    </span>
                  </div>
                  <p className="muted">
                    {v.content.days.length} dias de treino · {v.content.reason}
                  </p>
                  <div className="flex">
                    <button
                      onClick={() => setModal({ type: "details", version: v })}
                    >
                      Ver programa
                    </button>
                    <button
                      className="primary"
                      onClick={() => setModal({ type: "workout", version: v })}
                    >
                      Registrar treino
                    </button>
                    {staff && (
                      <button
                        onClick={() =>
                          setModal({ type: "program", version: v })
                        }
                      >
                        Criar proposta a partir desta versão
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!data.versions.length && (
              <Empty>
                {staff
                  ? "Crie um programa, valide e publique a primeira versão."
                  : "Seu profissional ainda não publicou um programa para você."}
              </Empty>
            )}
            <h2 style={{ marginTop: 30 }}>Execuções registradas</h2>
            {data.logs.length ? (
              <div className="list">
                {byStudent(data.logs).map((l) => (
                  <article className="list-item" key={l.id}>
                    <h3>
                      {name(l.student_id)} · {date(l.created_at)}
                    </h3>
                    <p>
                      {l.sets.length} séries ·{" "}
                      {l.sets
                        .reduce((n, s) => n + s.kg * s.reps, 0)
                        .toLocaleString("pt-BR")}{" "}
                      kg de volume estimado
                    </p>
                    {l.discomfort && (
                      <p className="notice">
                        Desconforto relatado. A publicação automática foi
                        suspensa para revisão.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <Empty>
                Quando uma sessão for finalizada, seu registro aparecerá aqui.
              </Empty>
            )}
          </>
        )}
        {tab === "cycles" && (
          <>
            <div className="toolbar">
              {filter()}
              <button onClick={() => load().catch((e) => setError(e.message))}>
                <RefreshCw size={16} />
                Atualizar
              </button>
            </div>
            <p className="notice">
              As datas são calculadas no servidor no fuso {data.tenant.timezone}
              . O worker processa ciclos vencidos; fotos não são requisito.
              Ativar a publicação exige autorização no agente e no aluno.
            </p>
            <div className="list">
              {byStudent(data.cycles).map((c) => (
                <article className="list-item" key={c.id}>
                  <div className="flex between">
                    <h3>{name(c.student_id)}</h3>
                    <span className="pill">{states[c.status]}</span>
                  </div>
                  <p className="muted">
                    Reavaliação prevista: {date(c.due_at)} · {c.attempts}{" "}
                    tentativa(s)
                  </p>
                  {c.reason && <p className="notice">{c.reason}</p>}
                  <div className="flex">
                    <button
                      disabled={
                        busy ||
                        ["published", "canceled", "suspended"].includes(
                          c.status,
                        )
                      }
                      onClick={() => run("cycles/process", { cycleId: c.id })}
                    >
                      Verificar ciclo agora
                    </button>
                    {!["published", "canceled"].includes(c.status) && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run("cycles/status", {
                              cycleId: c.id,
                              status:
                                c.status === "suspended"
                                  ? "scheduled"
                                  : "suspended",
                            })
                          }
                        >
                          {c.status === "suspended" ? "Retomar" : "Suspender"}
                        </button>
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Cancelar este ciclo? Esta ação mantém o programa vigente.",
                              )
                            )
                              run("cycles/status", {
                                cycleId: c.id,
                                status: "canceled",
                              });
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!data.cycles.length && (
              <Empty>
                Um programa publicado com um agente gera o próximo ciclo
                automaticamente.
              </Empty>
            )}
          </>
        )}
        {tab === "billing" && <Billing data={data} busy={busy} run={run} />}
        {tab === "account" && (
          <section className="card stack">
            <h2>{data.actor.name}</h2>
            <p>
              {data.actor.email}
              <br />
              <small>
                {data.tenant.name} · Fuso {data.tenant.timezone}
              </small>
            </p>
            <a
              className="button"
              href={`/api/export?tenant=${data.actor.tenantId}`}
              download="fitcore-export.json"
            >
              Exportar meus registros (JSON)
            </a>
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Registrar uma solicitação de exclusão? Isso não exclui imediatamente os dados.",
                  )
                )
                  run("privacy/deletion");
              }}
            >
              Solicitar exclusão de dados
            </button>
            <p className="muted">
              Solicitações de exclusão são registradas para atendimento. O fluxo
              de eliminação em backups e arquivos ainda precisa ser
              operacionalizado antes da produção.
            </p>
            {data.actor.role === "owner" && (
              <>
                <hr className="subtle-rule" />
                <h3>Organização e equipe</h3>
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(
                      "organization/settings",
                      Object.fromEntries(new FormData(e.currentTarget)),
                    );
                  }}
                >
                  <label>
                    Nome da organização
                    <input
                      name="name"
                      defaultValue={data.tenant.name}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Fuso horário IANA
                    <input
                      name="timezone"
                      defaultValue={data.tenant.timezone}
                      required
                      placeholder="America/Sao_Paulo"
                    />
                  </label>
                  <small>
                    A alteração vale para novos ciclos. Datas de ciclos
                    existentes são preservadas.
                  </small>
                  <button disabled={busy}>Salvar organização</button>
                </form>
                <form
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(
                      "organization/invite",
                      Object.fromEntries(new FormData(e.currentTarget)),
                    );
                  }}
                >
                  <label>
                    Nome do profissional
                    <input name="name" required minLength={2} />
                  </label>
                  <label>
                    E-mail do profissional
                    <input name="email" type="email" required />
                  </label>
                  <button disabled={busy}>Convidar profissional</button>
                </form>
                <div className="list">
                  {data.members.map((m) => (
                    <div className="list-item" key={m.id}>
                      <strong>{m.name}</strong>
                      <p className="muted">
                        {m.email} ·{" "}
                        {m.role === "owner"
                          ? "Responsável"
                          : m.role === "trainer"
                            ? "Profissional"
                            : "Aluno"}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex">
              <Link className="button quiet" href="/privacidade">
                Privacidade
              </Link>
              <Link className="button quiet" href="/termos">
                Termos
              </Link>
              <button
                disabled={busy}
                onClick={() => run("auth/logout", {}, { refresh: false })}
              >
                <LogOut size={16} />
                Sair da conta
              </button>
            </div>
          </section>
        )}
      </main>
      {modal && (
        <Dialog
          title={
            {
              student: "Cadastrar aluno",
              exercise: "Adicionar exercício",
              agent: modal.agent ? "Nova versão do agente" : "Criar agente",
              assessment: "Registrar avaliação",
              program: "Construtor de programa",
              generate: "Proposta com IA",
              workout: "Executar treino",
              details: "Programa publicado",
            }[modal.type]
          }
          close={() => {
            if (!busy) setModal(null);
          }}
        >
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {modal.type === "student" && (
            <StudentForm busy={busy} submit={(v) => run("students", v)} />
          )}
          {modal.type === "exercise" && (
            <ExerciseForm busy={busy} submit={(v) => run("exercises", v)} />
          )}
          {modal.type === "agent" && (
            <AgentForm
              agent={modal.agent}
              busy={busy}
              submit={(v) => run(modal.agent ? "agents/version" : "agents", v)}
            />
          )}
          {modal.type === "assessment" && (
            <AssessmentForm
              data={data}
              busy={busy}
              submit={(v) => run("assessments", v)}
            />
          )}
          {modal.type === "program" && (
            <ProgramForm
              data={data}
              initial={modal.version}
              busy={busy}
              submit={async (v) => {
                if (await run("proposals", v)) setTab("programs");
              }}
            />
          )}
          {modal.type === "generate" && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (await run("proposals/generate", Object.fromEntries(f)))
                  setTab("programs");
              }}
            >
              <SelectStudent data={data} />
              <label>
                Agente
                <select name="agentVersionId" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {data.agents.map((a) => (
                    <option value={a.version_id} key={a.id}>
                      {a.name} · v{a.current_version}
                    </option>
                  ))}
                </select>
              </label>
              <p className="notice">
                A IA receberá apenas os dados necessários, sem nome, e-mail ou
                fotos. Uma proposta não é uma publicação. Limites e alertas
                serão verificados pelo servidor.
              </p>
              {!data.integrations.ai && (
                <p className="error">
                  Provedor não configurado. Você pode criar um programa manual
                  enquanto configura a IA.
                </p>
              )}
              <button
                className="primary"
                disabled={busy || !data.integrations.ai}
              >
                Gerar proposta
              </button>
            </form>
          )}
          {modal.type === "workout" && modal.version && (
            <Workout
              version={modal.version}
              exercises={data.exercises}
              userId={data.actor.userId}
              busy={busy}
              submit={async (v) => {
                const ok = await run("logs", v);
                if (ok) setTab("programs");
                return ok;
              }}
            />
          )}
          {modal.type === "details" && modal.version && (
            <div className="stack">
              <span className="pill">
                v{modal.version.version} · {date(modal.version.published_at)}
              </span>
              <h3>{modal.version.content.name}</h3>
              {modal.version.content.days.map((day, i) => (
                <section key={i}>
                  <h3>{day.name}</h3>
                  {day.exercises.map((e, j) => (
                    <div key={j} className="workout-exercise">
                      <strong>
                        {data.exercises.find((x) => x.id === e.exerciseId)
                          ?.name || e.exerciseId}
                      </strong>
                      <p>
                        {e.sets} séries · {e.repsMin}–{e.repsMax} reps ·{" "}
                        {e.restSeconds}s descanso · RPE {e.rpe}
                      </p>
                      <p className="muted">{e.notes}</p>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
function Billing({
  data,
  busy,
  run,
}: {
  data: DashboardData;
  busy: boolean;
  run: (path: string, value?: unknown) => Promise<boolean>;
}) {
  const [plans, setPlans] = useState<
    { id: string; name: string; price_cents: number; student_limit: number }[]
  >([]);
  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => {});
  }, []);
  return (
    <div className="stack">
      <section className="card">
        <h2>{data.subscription?.name || "Assinatura"}</h2>
        <p>
          Estado:{" "}
          {states[data.subscription?.status || ""] || data.subscription?.status}
        </p>
        {data.subscription?.trial_ends_at &&
          data.subscription.status === "trialing" && (
            <p>Demonstração até {date(data.subscription.trial_ends_at)}.</p>
          )}
        <p>
          Até {data.subscription?.student_limit} alunos ·{" "}
          {data.subscription?.monthly_token_limit.toLocaleString("pt-BR")}{" "}
          tokens reservados/mês
        </p>
        <button
          disabled={busy || !data.integrations.payments}
          onClick={() => run("billing/portal")}
        >
          Gerenciar assinatura no provedor
        </button>
      </section>
      <p className="notice">
        {data.integrations.payments
          ? "O preço real deve estar configurado no provedor antes de abrir o checkout."
          : "Pagamentos não configurados. Nenhum checkout ou cobrança está sendo simulado."}{" "}
        A confirmação depende de webhook assinado, nunca do retorno do
        navegador.
      </p>
      <div className="grid">
        {plans.map((p) => (
          <article key={p.id} className="card">
            <h3>{p.name}</h3>
            <p>
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(p.price_cents / 100)}{" "}
              / mês
            </p>
            <p>Até {p.student_limit} alunos</p>
            <button
              disabled={
                busy ||
                !data.integrations.payments ||
                data.actor.role !== "owner"
              }
              onClick={() => run("billing/checkout", { planId: p.id })}
            >
              Abrir checkout hospedado
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
