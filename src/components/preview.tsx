"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Zap,
  LayoutDashboard,
  Users,
  Dumbbell,
  ClipboardCheck,
  CalendarClock,
  BrainCircuit,
  ArrowLeft,
  Eye,
} from "lucide-react";
const students = [
  {
    id: "example-1",
    name: "Ana · exemplo fictício",
    goal: "Condicionamento",
    days: 3,
  },
  {
    id: "example-2",
    name: "Rafael · exemplo fictício",
    goal: "Manutenção",
    days: 2,
  },
];
const program = {
  name: "Programa de demonstração",
  student: students[0].name,
  version: 1,
  days: [
    {
      name: "Treino A · exemplo visual",
      exercises: [
        { name: "Agachamento livre", sets: 3, reps: "8–12", rest: 60 },
        { name: "Remada com halteres", sets: 3, reps: "8–12", rest: 60 },
      ],
    },
  ],
};
const tabs = [
  { id: "overview", label: "Visão geral", Icon: LayoutDashboard },
  { id: "students", label: "Alunos", Icon: Users },
  { id: "programs", label: "Programas", Icon: Dumbbell },
  { id: "assessments", label: "Avaliações", Icon: ClipboardCheck },
  { id: "agents", label: "Agentes de IA", Icon: BrainCircuit },
  { id: "cycles", label: "Ciclos", Icon: CalendarClock },
] as const;
type Tab = (typeof tabs)[number]["id"];
export function Preview() {
  const [tab, setTab] = useState<Tab>("overview"),
    [studentView, setStudentView] = useState(false),
    [query, setQuery] = useState("");
  const visible = studentView
    ? tabs.filter((t) => ["overview", "programs", "assessments"].includes(t.id))
    : tabs;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <Zap />
          FITCORE
        </Link>
        <span className="pill">PRÉVIA · DADOS FICTÍCIOS</span>
        <nav aria-label="Navegação da prévia">
          {visible.map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                setTab(id);
                setQuery("");
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="bottom">
          <p>Ambiente visual de demonstração</p>
          <Link className="button quiet" href="/">
            <ArrowLeft size={16} />
            Voltar ao site
          </Link>
        </div>
      </aside>
      <main className="main">
        <header>
          <div>
            <span className="eyebrow">
              {studentView ? "ÁREA DO ALUNO" : "ESPAÇO PROFISSIONAL"} · EXEMPLO
            </span>
            <h1>
              {tab === "overview"
                ? "Seu acompanhamento, em um só lugar."
                : tabs.find((t) => t.id === tab)?.label}
            </h1>
            <p className="muted">
              Explore a apresentação das telas no celular ou no computador.
            </p>
          </div>
          <button
            onClick={() => {
              setStudentView(!studentView);
              setTab("overview");
            }}
          >
            <Eye size={16} />
            {studentView ? "Ver área do personal" : "Ver área do aluno"}
          </button>
        </header>
        <p role="status" className="notice">
          Prévia visual: todos os nomes, programas e indicadores abaixo são
          exemplos fictícios. Não há cadastro, salvamento, geração por IA ou
          cobrança nesta área.
        </p>
        {tab === "overview" && (
          <div className="stack" style={{ marginTop: 24 }}>
            <div className="grid">
              {[
                [
                  studentView ? "Seu programa de exemplo" : "Alunos de exemplo",
                  studentView ? 1 : students.length,
                ],
                ["Programas de exemplo", 1],
                ["Ciclos ilustrados", 1],
              ].map(([label, n]) => (
                <article className="card metric" key={label}>
                  <small>{label}</small>
                  <strong>{n}</strong>
                </article>
              ))}
            </div>
            <section className="card">
              <span className="eyebrow">UMA ROTINA MAIS CLARA</span>
              <h2 style={{ marginTop: 18 }}>
                {studentView
                  ? "Seu próximo treino"
                  : "Do aluno à próxima evolução"}
              </h2>
              <p className="muted">
                {studentView
                  ? "Aqui o aluno encontrará o programa publicado pelo profissional, com exercícios, séries e descanso."
                  : "O profissional reúne avaliações, configura a metodologia e publica programas com histórico de versões."}
              </p>
              <div className="flex">
                <button className="primary" onClick={() => setTab("programs")}>
                  Conhecer o programa de exemplo
                </button>
                <button onClick={() => setTab("assessments")}>
                  Conhecer avaliações
                </button>
              </div>
            </section>
            <section className="card">
              <h2>Como funciona o acompanhamento</h2>
              <div className="steps">
                <p>Perfil do aluno e objetivos definidos com o profissional.</p>
                <p>Avaliação atualizada, com fotos opcionais.</p>
                <p>Programa estruturado e validado antes da publicação.</p>
                <p>Novo ciclo, com histórico preservado.</p>
              </div>
            </section>
          </div>
        )}
        {tab === "students" && (
          <section style={{ marginTop: 24 }}>
            <div className="toolbar">
              <input
                aria-label="Buscar aluno de exemplo"
                placeholder="Buscar aluno de exemplo"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="list">
              {students
                .filter((s) =>
                  s.name.toLowerCase().includes(query.toLowerCase()),
                )
                .map((s) => (
                  <article className="list-item" key={s.id}>
                    <h3>{s.name}</h3>
                    <p className="muted">
                      {s.goal} · {s.days} dias por semana · cadastro ilustrativo
                    </p>
                    <button onClick={() => setTab("programs")}>
                      Ver exemplo de programa
                    </button>
                  </article>
                ))}
            </div>
            <p className="muted" style={{ marginTop: 18 }}>
              Nenhum aluno real foi cadastrado nesta prévia.
            </p>
          </section>
        )}
        {tab === "programs" && (
          <section className="stack" style={{ marginTop: 24 }}>
            <article className="card">
              <span className="pill">EXEMPLO VISUAL · v{program.version}</span>
              <h2 style={{ marginTop: 18 }}>{program.name}</h2>
              <p className="muted">{program.student}</p>
              <p className="notice">
                Este conteúdo ilustra o layout. Não é uma prescrição
                individualizada de exercícios.
              </p>
              {program.days.map((day) => (
                <section key={day.name}>
                  <h3>{day.name}</h3>
                  {day.exercises.map((e) => (
                    <article key={e.name} className="workout-exercise">
                      <strong>{e.name}</strong>
                      <p className="muted">
                        {e.sets} séries · {e.reps} repetições · {e.rest}s de
                        descanso
                      </p>
                    </article>
                  ))}
                </section>
              ))}
            </article>
            <div className="card">
              <h3>Registro do treino</h3>
              <p className="muted">
                Na aplicação conectada, o aluno registra carga, repetições e
                esforço. O descanso é acompanhado por cronômetro, e o histórico
                é salvo no servidor.
              </p>
              <p>O envio de registros está desativado nesta prévia pública.</p>
            </div>
          </section>
        )}
        {tab === "assessments" && (
          <section className="stack" style={{ marginTop: 24 }}>
            <article className="card">
              <ClipboardCheck className="accent" />
              <h2 style={{ marginTop: 18 }}>Avaliar para acompanhar.</h2>
              <p className="muted">
                A tela conectada reúne data, peso, altura, cintura opcional e
                observações. Não há medidas reais nem fotos corporais nesta
                prévia.
              </p>
              <div className="grid two">
                {[
                  "Peso e altura",
                  "Histórico de avaliações",
                  "Alertas para revisão",
                  "Fotos opcionais e privadas",
                ].map((t) => (
                  <div className="list-item" key={t}>
                    {t}
                  </div>
                ))}
              </div>
            </article>
            <p className="notice">
              Fotos não são requisito para acompanhar avaliações ou programas.
              Nenhuma imagem pessoal pode ser enviada por esta prévia.
            </p>
          </section>
        )}
        {tab === "agents" && (
          <section className="card" style={{ marginTop: 24 }}>
            <BrainCircuit className="accent" />
            <h2 style={{ marginTop: 18 }}>Sua metodologia em regras.</h2>
            <p className="muted">
              Um agente é configurado pelo profissional e suas alterações geram
              novas versões. A IA propõe; o servidor valida antes de publicar.
            </p>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Configuração ilustrativa</caption>
                <tbody>
                  {[
                    ["Frequência de exemplo", "Até 3 dias por semana"],
                    ["Limite ilustrativo", "24 séries por dia"],
                    ["Ciclo de referência", "45 dias"],
                    [
                      "Publicação automática",
                      "Somente com autorizações e validações",
                    ],
                    ["Provedor de IA", "Não conectado nesta prévia"],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {tab === "cycles" && (
          <section className="card" style={{ marginTop: 24 }}>
            <CalendarClock className="accent" />
            <h2 style={{ marginTop: 18 }}>
              O próximo ciclo começa com contexto.
            </h2>
            <div className="steps">
              <p>Aguardar o prazo configurado pelo profissional.</p>
              <p>Conferir avaliação, disponibilidade e autorizações.</p>
              <p>Bloquear quando houver dados insuficientes ou alertas.</p>
              <p>Validar a proposta e preservar a versão anterior.</p>
            </div>
            <p className="notice">
              Fluxo ilustrativo. Não há agendador ativo nem publicação
              automática nesta prévia.
            </p>
          </section>
        )}
        <footer className="footer" style={{ marginTop: 36 }}>
          <span>FITCORE · Prévia pública sem dados reais</span>
          <Link href="/">Voltar à página inicial</Link>
        </footer>
      </main>
    </div>
  );
}
