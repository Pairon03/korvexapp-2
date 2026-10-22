import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth">
      <h1>Página não encontrada.</h1>
      <p>O endereço pode ter mudado.</p>
      <Link className="button primary" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
