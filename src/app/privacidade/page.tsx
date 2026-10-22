import Link from "next/link";
export default function Page() {
  return (
    <main className="legal">
      <Link href="/">← FitCore</Link>
      <h1 style={{ marginTop: 30 }}>Privacidade</h1>
      <p className="notice">
        Rascunho para revisão jurídica e operacional. Não constitui declaração
        de conformidade com a LGPD.
      </p>
      <h2>Dados e finalidades</h2>
      <p>
        Contas, vínculos com organizações, registros de treinamento e avaliações
        são utilizados para prestar o acompanhamento solicitado. Informações de
        saúde são restritas ao aluno e aos profissionais autorizados da
        organização.
      </p>
      <h2>IA e fornecedores</h2>
      <p>
        Quando configurada e solicitada pelo profissional, a IA recebe apenas o
        contexto necessário para propor um programa. Esta versão não envia fotos
        à IA. Identidades, e-mails e senhas não fazem parte do contexto do
        modelo.
      </p>
      <h2>Controle dos dados</h2>
      <p>
        A área da conta permite exportar registros e registrar uma solicitação
        de exclusão. A solicitação não significa que a exclusão já ocorreu:
        retenções legais, arquivos e backups precisam ser considerados no
        atendimento.
      </p>
      <h2>Cookies</h2>
      <p>
        Um cookie de sessão essencial e protegido mantém sua autenticação. Esta
        versão não inclui cookies de publicidade ou analytics.
      </p>
      <h2>Antes da produção</h2>
      <p>
        A entidade operadora, o canal de contato do encarregado, as bases legais
        por finalidade, os prazos de retenção, os contratos dos fornecedores e
        as transferências internacionais precisam ser definidos e revisados
        antes de coletar dados reais em produção.
      </p>
    </main>
  );
}
