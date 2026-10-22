import Link from "next/link";
import {
  Zap,
  ArrowUpRight,
  Users,
  ShieldCheck,
  GitBranch,
  CalendarClock,
  ClipboardCheck,
  BrainCircuit,
  ArrowRight,
} from "lucide-react";
import { admin } from "@/server/db";
import { config } from "@/server/config";
import { previewPlans } from "@/server/preview-plans";
export const dynamic = "force-dynamic";
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
  return (
    <div className="container">
      <header className="topbar">
        <Link href="/" className="brand">
          <Zap />
          FITCORE<span className="pill">PARA PROFISSIONAIS</span>
        </Link>
        <nav aria-label="Menu principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <Link
            href={config.preview ? "/previa" : "/entrar"}
            className="button quiet"
          >
            {config.preview ? "Ver prévia" : "Entrar"}{" "}
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        {config.preview && (
          <p className="notice banner">
            Prévia visual pública. Conta, registros no servidor, IA e pagamentos
            não estão ativos nesta publicação.
          </p>
        )}
        <section className="hero">
          <div>
            <span className="eyebrow">Sua metodologia. Mais alcance.</span>
            <h1>
              Você orienta.
              <br />A tecnologia
              <br />
              <span className="accent">acompanha.</span>
            </h1>
            <p>
              Um espaço para organizar seus alunos, acompanhar avaliações e
              evoluir programas com rastreabilidade. A IA apoia suas decisões.
              As regras continuam sob seu controle.
            </p>
            <div className="flex">
              <Link
                className="button primary"
                href={config.preview ? "/previa" : "/entrar?modo=cadastro"}
              >
                {config.preview ? "Explorar a prévia" : "Criar meu espaço"}{" "}
                <ArrowRight size={17} />
              </Link>
              <a className="button quiet" href="#como-funciona">
                Conhecer o fluxo
              </a>
            </div>
            <p style={{ fontSize: 12, marginTop: 16 }}>
              {config.preview
                ? "Prévia pública com dados fictícios. Sem cadastro ou cobranças."
                : "Demonstração de 7 dias, sem cartão. Plataforma em desenvolvimento."}
            </p>
          </div>
          <div
            className="preview"
            aria-label="Ilustração conceitual do fluxo, sem dados de clientes"
          >
            <div className="flex between">
              <span className="eyebrow">SEU MÉTODO EM CADA ETAPA</span>
              <GitBranch size={20} className="accent" />
            </div>
            <h2 style={{ margin: "24px 0 8px" }}>
              Organize. Valide.
              <br />
              Publique com confiança.
            </h2>
            <small>Fluxo ilustrativo do produto</small>
            <div className="preview-row">
              <Users size={22} />
              <div>
                <strong>Perfil do aluno</strong>
                <br />
                <small>Objetivos, rotina e equipamentos</small>
              </div>
            </div>
            <div className="preview-row">
              <ClipboardCheck size={22} />
              <div>
                <strong>Avaliação atualizada</strong>
                <br />
                <small>Medidas reais. Fotos opcionais.</small>
              </div>
            </div>
            <div className="preview-row">
              <BrainCircuit size={22} />
              <div>
                <strong>Proposta estruturada</strong>
                <br />
                <small>Validação antes da publicação</small>
              </div>
            </div>
            <div className="preview-row">
              <CalendarClock size={22} />
              <div>
                <strong>Próximo ciclo</strong>
                <br />
                <small>45 dias por padrão, ajustável</small>
              </div>
            </div>
          </div>
        </section>
        <section className="section" id="como-funciona">
          <span className="eyebrow">UMA ROTINA MAIS CLARA</span>
          <h2 style={{ marginTop: 14 }}>
            Menos planilhas.
            <br />
            Mais contexto para acompanhar.
          </h2>
          <div className="grid">
            {[
              {
                Icon: Users,
                title: "O aluno no centro",
                text: "Convide seus alunos, registre avaliações e acompanhe a execução dos programas em um único lugar.",
              },
              {
                Icon: GitBranch,
                title: "Evolução com histórico",
                text: "Publique versões imutáveis. Saiba o que mudou, quando mudou e quem autorizou cada publicação.",
              },
              {
                Icon: ShieldCheck,
                title: "Automação com limites",
                text: "Ciclos verificam dados e condições no servidor. Dor relatada, dados insuficientes ou regras violadas bloqueiam a publicação.",
              },
            ].map(({ Icon, title, text }) => (
              <article className="card" key={title}>
                <Icon className="accent" size={25} />
                <h3 style={{ marginTop: 20 }}>{title}</h3>
                <p className="muted">{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section">
          <div className="grid two">
            <div>
              <span className="eyebrow">CONTROLE É PARTE DO MÉTODO</span>
              <h2 style={{ marginTop: 15 }}>
                Seu agente.
                <br />
                Suas regras versionadas.
              </h2>
              <p className="muted">
                Defina frequência, volume, descanso e critérios de revisão.
                Instruções livres não podem desativar as validações obrigatórias
                da plataforma.
              </p>
            </div>
            <div className="steps">
              <p>Cadastre o aluno e uma avaliação recente.</p>
              <p>Configure o agente e a biblioteca permitida.</p>
              <p>Crie um programa manual ou solicite uma proposta à IA.</p>
              <p>Valide, publique e acompanhe o ciclo de atualização.</p>
            </div>
          </div>
          <aside className="notice banner">
            IA e cobrança dependem de provedores configurados. Uma integração
            sem credenciais não é apresentada como operacional. O envio de fotos
            não é requisito para avaliar ou atualizar um programa.
          </aside>
        </section>
        <section className="section" id="planos">
          <span className="eyebrow">PLANOS DE LANÇAMENTO</span>
          <h2 style={{ marginTop: 14 }}>Um espaço para cada fase.</h2>
          <p className="muted">
            Preços configurados para testes. Checkout só é habilitado após
            configurar o provedor e os preços reais.
          </p>
          <div className="grid">
            {plans.map((p) => (
              <article key={p.id} className="card">
                <h3>{p.name}</h3>
                <p>
                  <strong style={{ fontSize: 38 }}>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(p.price_cents / 100)}
                  </strong>
                  <small> / mês</small>
                </p>
                <p>Até {p.student_limit} alunos ativos</p>
                <p className="muted">
                  Agentes configuráveis e histórico de programas.
                </p>
                <Link
                  href={config.preview ? "/previa" : "/entrar?modo=cadastro"}
                  className="button primary"
                >
                  {config.preview ? "Ver a prévia" : "Experimentar sem cartão"}
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="section" id="perguntas">
          <h2>Perguntas frequentes</h2>
          {[
            [
              "A IA substitui o personal?",
              "Não. Ela produz propostas estruturadas, submetidas a regras no servidor. O profissional configura a metodologia e autoriza a automação por aluno.",
            ],
            [
              "As fotos são obrigatórias?",
              "Não. A ausência de fotos não bloqueia o fluxo de avaliação e treinamento.",
            ],
            [
              "O ciclo sempre altera o treino após 45 dias?",
              "Não. O prazo inicia uma verificação. Avaliações ausentes, alertas e permissões podem impedir uma nova publicação.",
            ],
            [
              "Já posso usar em produção?",
              "Esta é uma entrega incremental para homologação. Consulte o README para integrações pendentes, verificações e limites conhecidos.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="list-item" style={{ marginBottom: 10 }}>
              <summary>{q}</summary>
              <p className="muted" style={{ marginTop: 14 }}>
                {a}
              </p>
            </details>
          ))}
        </section>
        <section className="card section">
          <h2>
            Construa a próxima etapa
            <br />
            da sua metodologia.
          </h2>
          <Link
            href={config.preview ? "/previa" : "/entrar?modo=cadastro"}
            className="button primary"
          >
            {config.preview
              ? "Explorar a prévia"
              : "Começar minha demonstração"}{" "}
            <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="footer">
        <span>FITCORE · Plataforma de treinamento · Em desenvolvimento</span>
        <div>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos</Link>
          <a href="/painel">Área da conta</a>
        </div>
      </footer>
    </div>
  );
}
