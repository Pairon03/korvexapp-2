import Link from "next/link";
export function PreviewNotice() {
  return (
    <main className="auth">
      <span className="eyebrow">FITCORE · PRÉVIA PÚBLICA</span>
      <h1 style={{ marginTop: 24 }}>Conheça o visual do FitCore.</h1>
      <p className="notice">
        Cadastro e acesso a contas não estão habilitados nesta publicação. A
        prévia usa somente dados fictícios e não salva informações pessoais.
      </p>
      <Link className="button primary" href="/previa">
        Explorar a prévia
      </Link>
      <p style={{ marginTop: 24 }}>
        <Link href="/">Voltar ao site</Link>
      </p>
    </main>
  );
}
