import Link from "next/link";
export default function Page() {
  return (
    <main className="legal">
      <Link href="/">← FitCore</Link>
      <h1 style={{ marginTop: 30 }}>Termos de uso</h1>
      <p className="notice">
        Rascunho para revisão jurídica. Plataforma incremental de homologação,
        sem lançamento comercial confirmado.
      </p>
      <h2>Finalidade</h2>
      <p>
        O FitCore organiza o acompanhamento entre personal trainer e aluno. O
        profissional é responsável por configurar regras adequadas ao contexto e
        por revisar informações que exijam intervenção.
      </p>
      <h2>Propostas automatizadas</h2>
      <p>
        A IA é uma ferramenta de apoio. Não realiza diagnósticos nem substitui
        avaliação profissional. A publicação depende das validações
        determinísticas e das autorizações da organização.
      </p>
      <h2>Demonstração e cobrança</h2>
      <p>
        A demonstração dura 7 dias. Os valores apresentados são configurações
        iniciais para testes. Nenhuma cobrança é confirmada pelo retorno do
        navegador; apenas o estado verificado do provedor é utilizado.
        Cancelamentos e alterações de assinatura são gerenciados no portal de
        cobrança quando configurado.
      </p>
      <h2>Operação</h2>
      <p>
        Antes do uso comercial, devem ser concluídos testes de homologação dos
        provedores, suporte, backup/restauração e políticas comerciais e de
        privacidade. Não há promessa de resultado físico individual.
      </p>
    </main>
  );
}
