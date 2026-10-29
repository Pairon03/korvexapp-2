import Link from "next/link";
import {
  Zap,
  ArrowUpRight,
  ArrowRight,
  Users,
  ShieldCheck,
  GitBranch,
  ClipboardCheck,
  BrainCircuit,
  Check,
  Play,
  Dumbbell,
  MoveUpRight,
  LockKeyhole,
} from "lucide-react";
import { admin } from "@/server/db";
import { config } from "@/server/config";
import { previewPlans } from "@/server/preview-plans";
import { LandingPreview } from "@/components/landing-preview";
import styles from "@/components/landing.module.css";

export const dynamic = "force-dynamic";

const benefits = [
  {
    Icon: Users,
    index: "01",
    title: "Sua operação, organizada.",
    text: "Perfil, avaliações e programas no mesmo contexto. Uma visão mais clara para acompanhar cada aluno.",
  },
  {
    Icon: GitBranch,
    index: "02",
    title: "Seu método, preservado.",
    text: "Programas com histórico de versões e regras definidas pelo profissional. Sua metodologia continua no centro.",
  },
  {
    Icon: ClipboardCheck,
    index: "03",
    title: "Seu aluno, mais próximo.",
    text: "Uma área para consultar o programa e registrar o treino. Acompanhamento que continua além da sessão.",
  },
];

export default async function Home() {
  const plans = config.preview
    ? previewPlans
    : ((
        await admin.query(
          "select id,name,price_cents,student_limit from app.subscription_plans where enabled=true order by price_cents",
        )
      ).rows as {
        id: string;
        name: string;
        price_cents: number;
        student_limit: number;
      }[]);
  const actionHref = config.preview ? "/previa" : "/entrar?modo=cadastro";
  const actionLabel = config.preview ? "Explorar a prévia" : "Criar meu espaço";
  const questions = [
    [
      "Para quem é o FitCore?",
      "Para personal trainers que querem organizar o acompanhamento, preservar a própria metodologia e oferecer uma experiência mais clara aos alunos.",
    ],
    [
      "O que posso explorar agora?",
      config.preview
        ? "A biblioteca tem 38 exercícios em 10 grupos, com animações 3D próprias e orientações. O painel é uma demonstração interativa com dados fictícios: não cria contas, salva registros, gera programas por IA ou realiza cobranças."
        : "Você pode explorar a biblioteca e criar seu espaço na plataforma. A disponibilidade de IA, email e cobrança depende das integrações configuradas para esta instalação.",
    ],
    [
      "A IA substitui o personal?",
      "O profissional define a metodologia e as regras. A IA pode apoiar a criação de propostas, que passam por validações antes da publicação. Na prévia pública, a geração por IA está desativada.",
    ],
    [
      "As animações substituem uma orientação individual?",
      "As demonstrações ajudam a visualizar os movimentos e acompanham as instruções do catálogo. Não substituem avaliação individual ou orientação profissional. Cuidados e substituições devem ser revisados para cada aluno.",
    ],
    [
      "Preciso enviar fotos para acompanhar um aluno?",
      "Não. Fotos são opcionais. Sua ausência não impede o acompanhamento de avaliações e programas na aplicação conectada.",
    ],
    [
      "Posso usar no celular?",
      "Sim. A interface se adapta ao celular e ao computador. Você pode abrir a biblioteca e explorar as telas de demonstração diretamente pelo navegador.",
    ],
  ];
  return (
    <div className={styles.root}>
      <a className={styles.skipLink} href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className={styles.header}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="FitCore by Korvex, início"
        >
          <span className={styles.brandMark}>
            <Zap size={23} fill="currentColor" aria-hidden="true" />
          </span>
          <span>
            FitCore<small>by Korvex</small>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Menu principal">
          <a href="#plataforma">Plataforma</a>
          <Link href="/biblioteca">Biblioteca</Link>
          <a href="#planos">Planos</a>
        </nav>
        <Link
          className={styles.headerAction}
          href={config.preview ? "/previa" : "/entrar"}
        >
          {config.preview ? "Ver prévia" : "Entrar"}
          <ArrowUpRight size={16} />
        </Link>
      </header>
      <main id="conteudo">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <span className={styles.statusDot} /> FEITO PARA PERSONAL TRAINERS
            </span>
            <h1 id="hero-title">
              Seu método de treino.
              <br />
              <span>Uma experiência à altura.</span>
            </h1>
            <p className={styles.heroDescription}>
              Reúna alunos, avaliações e programas em uma plataforma feita para
              valorizar o seu acompanhamento.
            </p>
            <div className={styles.actions}>
              <Link href={actionHref} className={styles.primary}>
                {actionLabel}
                <ArrowRight size={18} />
              </Link>
              <Link href="/biblioteca" className={styles.secondary}>
                <Play size={15} /> Conhecer a biblioteca
              </Link>
            </div>
            <p className={styles.heroNote}>
              {config.preview
                ? "Demonstração com dados fictícios. Sem cadastro ou cobrança."
                : "Sua metodologia no centro. Conheça a plataforma."}
            </p>
          </div>
          <LandingPreview />
        </section>
        <div className={styles.capabilityStrip}>
          <span>
            <ShieldCheck size={17} /> Decisões sob seu controle
          </span>
          <span>
            <GitBranch size={17} /> Histórico de programas
          </span>
          <span>
            <Dumbbell size={17} /> Biblioteca com 38 exercícios
          </span>
          <span>
            <LockKeyhole size={17} /> Fotos opcionais
          </span>
        </div>
        <section className={styles.section} id="plataforma">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>MAIS CLAREZA EM CADA ETAPA</span>
              <h2>
                O cuidado é seu.
                <br />
                <span>A estrutura também pode ser.</span>
              </h2>
            </div>
            <p>
              Do primeiro perfil ao próximo programa, mantenha o contexto de
              cada aluno por perto.
            </p>
          </div>
          <div className={styles.benefitGrid}>
            {benefits.map(({ Icon, index, title, text }) => (
              <article className={styles.benefit} key={index}>
                <div className={styles.benefitTop}>
                  <Icon size={23} />
                  <span>{index}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className={styles.librarySection}
          aria-labelledby="library-title"
        >
          <div className={styles.libraryCopy}>
            <span className={styles.eyebrow}>BIBLIOTECA FITCORE</span>
            <h2 id="library-title">
              O movimento merece
              <br />
              <span>mais clareza.</span>
            </h2>
            <p>
              38 exercícios em 10 grupos musculares. Explore demonstrações
              vetoriais, instruções, erros comuns e opções de substituição do
              catálogo.
            </p>
            <Link href="/biblioteca" className={styles.primary}>
              Explorar os exercícios
              <ArrowUpRight size={18} />
            </Link>
            <small>
              Conteúdo educativo. A adequação de cada movimento depende da
              avaliação profissional.
            </small>
          </div>
          <div
            className={styles.libraryVisual}
            aria-label="Ilustração da biblioteca de movimentos"
          >
            <div className={styles.libraryVisualTop}>
              <span>
                <span className={styles.statusDot} /> MOVIMENTO EM FOCO
              </span>
              <span>01 / 38</span>
            </div>
            <div className={styles.figureStage}>
              <span className={styles.figureOrbit} />
              <svg
                viewBox="0 0 300 220"
                className={styles.exerciseFigure}
                aria-hidden="true"
              >
                <path
                  d="M40 191H260"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity=".22"
                />
                <path
                  d="M122 91L107 125L145 157L126 190M121 92L153 121L173 155L200 190"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M122 94L143 104L158 83M121 94L99 112L81 94"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="120" cy="63" r="16" fill="currentColor" />
                <path
                  d="M66 83L95 111M148 72L173 96"
                  stroke="#b8ff3b"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M124 88L151 113"
                  stroke="#b8ff3b"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity=".8"
                />
              </svg>
              <span className={styles.figureLabel}>ILUSTRAÇÃO EDITORIAL</span>
            </div>
            <div className={styles.libraryVisualBottom}>
              <div>
                <strong>Veja. Entenda. Revise.</strong>
                <span>Orientação junto de cada movimento.</span>
              </div>
              <Link
                href="/biblioteca"
                aria-label="Abrir biblioteca de exercícios"
              >
                <MoveUpRight size={21} />
              </Link>
            </div>
          </div>
        </section>
        <section className={styles.section} id="como-funciona">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>UM FLUXO COM CONTEXTO</span>
              <h2>
                Do aluno ao próximo ciclo.
                <br />
                <span>Com o seu método.</span>
              </h2>
            </div>
            <p>
              Uma sequência pensada para organizar o trabalho e manter a revisão
              profissional em cada decisão.
            </p>
          </div>
          <ol className={styles.flowGrid}>
            {[
              [
                "01",
                "Conheça o aluno",
                "Reúna objetivos, rotina, equipamentos e uma avaliação atualizada.",
              ],
              [
                "02",
                "Estruture o programa",
                "Use a biblioteca e organize os exercícios de acordo com sua metodologia.",
              ],
              [
                "03",
                "Revise e publique",
                "Confira a proposta e preserve o histórico das versões publicadas.",
              ],
              [
                "04",
                "Acompanhe a evolução",
                "Consulte registros e reavalie as condições antes do próximo ciclo.",
              ],
            ].map(([number, title, text]) => (
              <li key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <div className={styles.aiNote}>
            <BrainCircuit size={22} />
            <p>
              <strong>IA como apoio. Critério profissional como base.</strong>
              <span>
                Regras e validações orientam as propostas.{" "}
                {config.preview
                  ? "Geração por IA e automações não estão ativas nesta prévia."
                  : "O uso depende das integrações e autorizações configuradas."}
              </span>
            </p>
          </div>
        </section>
        <section className={styles.pricingSection} id="planos">
          <div className={styles.centerHeading}>
            <span className={styles.eyebrow}>
              {config.preview ? "PLANOS EM APRESENTAÇÃO" : "PLANOS FITCORE"}
            </span>
            <h2>
              Um espaço para
              <br />
              <span>cada fase da sua operação.</span>
            </h2>
            <p>
              {config.preview
                ? "Valores de referência para conhecer a proposta. Esta prévia não realiza assinaturas ou cobranças."
                : "Escolha a capacidade que acompanha o seu momento. Consulte as condições na área da conta."}
            </p>
          </div>
          <div className={styles.planGrid}>
            {plans.map((plan, index) => (
              <article
                key={plan.id}
                className={`${styles.plan} ${index === 1 ? styles.recommendedPlan : ""}`}
              >
                {index === 1 && (
                  <span className={styles.planRecommendation}>
                    SUGESTÃO PARA UMA CARTEIRA EM CRESCIMENTO
                  </span>
                )}
                <span className={styles.planProfile}>
                  {index === 0
                    ? "PARA ESTRUTURAR"
                    : index === 1
                      ? "PARA AMPLIAR"
                      : "PARA EQUIPES E ESTÚDIOS"}
                </span>
                <h3>{plan.name}</h3>
                <div className={styles.price}>
                  <strong>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }).format(plan.price_cents / 100)}
                  </strong>
                  <span>/ mês</span>
                </div>
                <p className={styles.planLimit}>
                  Até <strong>{plan.student_limit} alunos ativos</strong>
                </p>
                <ul>
                  {[
                    "Alunos e avaliações organizados",
                    "Programas com histórico de versões",
                    "Biblioteca de exercícios",
                    "Regras de acompanhamento",
                  ].map((feature) => (
                    <li key={feature}>
                      <Check size={16} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={actionHref}
                  className={index === 1 ? styles.primary : styles.secondary}
                >
                  {config.preview
                    ? "Conhecer na prévia"
                    : "Conhecer este plano"}
                  <ArrowRight size={16} />
                </Link>
                {config.preview && (
                  <small>Referência de preço · sem checkout ativo</small>
                )}
              </article>
            ))}
          </div>
        </section>
        <section className={styles.faqSection} id="perguntas">
          <div>
            <span className={styles.eyebrow}>ANTES DO PRÓXIMO PASSO</span>
            <h2>
              Clareza também
              <br />
              <span>nas respostas.</span>
            </h2>
            <p>
              O que você precisa saber para explorar o FitCore com contexto.
            </p>
          </div>
          <div className={styles.faqList}>
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={styles.finalCta}>
          <span className={styles.eyebrow}>
            A PRÓXIMA ETAPA DO SEU ACOMPANHAMENTO
          </span>
          <h2>
            Seu método tem valor.
            <br />
            <span>Apresente isso em cada detalhe.</span>
          </h2>
          <div className={styles.actions}>
            <Link href={actionHref} className={styles.primary}>
              {actionLabel}
              <ArrowRight size={18} />
            </Link>
            <Link href="/biblioteca" className={styles.secondary}>
              Explorar a biblioteca
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <p>
            {config.preview
              ? "Explore o painel com dados fictícios e conheça a biblioteca disponível."
              : "Organize seu espaço e conheça os recursos da plataforma."}
          </p>
        </section>
      </main>
      <footer className={styles.footer}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>
            <Zap size={19} fill="currentColor" aria-hidden="true" />
          </span>
          <span>
            FitCore<small>by Korvex</small>
          </span>
        </Link>
        <p>
          A tecnologia acompanha.
          <br />O método continua sendo seu.
        </p>
        <nav aria-label="Links do rodapé">
          <Link href="/biblioteca">Biblioteca</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos</Link>
          <Link href="/painel">Área da conta</Link>
        </nav>
        <span className={styles.footerNote}>
          FitCore by Korvex ·{" "}
          {config.preview
            ? "Biblioteca e demonstração pública"
            : "Plataforma de acompanhamento"}
        </span>
      </footer>
    </div>
  );
}
