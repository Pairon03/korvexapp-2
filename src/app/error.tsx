"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="auth">
      <h1>Não foi possível abrir esta página.</h1>
      <p>Seus registros não foram descartados. Tente novamente.</p>
      <button onClick={reset}>Tentar novamente</button>
    </main>
  );
}
