"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
type Kind = "login" | "register" | "verify" | "reset" | "invite";
export function AuthForm({
  kind: initial,
  token = "",
}: {
  kind: Kind;
  token?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");

  const title = {
    login: "Bem-vindo de volta.",
    register: "Seu método começa aqui.",
    verify: "Confirme sua conta.",
    reset: token ? "Defina sua nova senha." : "Recupere seu acesso.",
    invite: "Seu treino tem um novo espaço.",
  }[kind];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const f = new FormData(e.currentTarget);
    const path = {
      login: "login",
      register: "register",
      verify: "verify",
      reset: token ? "reset" : "request-reset",
      invite: "accept-invite",
    }[kind];
    const body: Record<string, string> = {};
    for (const [k, v] of f.entries())
      if (typeof v === "string" && v) body[k] = v;
    if (token) body.token = token;
    try {
      const r = await fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message || "Não foi possível concluir.");
      if (kind === "login" || kind === "invite") {
        router.replace("/painel");
        router.refresh();
      } else setMessage(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha de conexão.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <Link href="/" className="brand">
        <Zap />
        FITCORE
      </Link>
      <section className="card">
        <span className="eyebrow">SEU ESPAÇO DE EVOLUÇÃO</span>
        <h1 style={{ fontSize: 32, marginTop: 16 }}>{title}</h1>
        <p className="muted">
          {kind === "register"
            ? "Crie sua conta de profissional. Demonstração de 7 dias sem cartão."
            : kind === "invite"
              ? "Ative seu vínculo com o profissional. Se já tem conta, entre nela antes de aceitar o convite."
              : "Acompanhe sua rotina com continuidade."}
        </p>
        <form onSubmit={submit} className="form">
          {kind === "register" && (
            <>
              <label>
                Seu nome
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
              <label>
                Nome profissional ou organização
                <input
                  name="organization"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
            </>
          )}
          {(kind === "login" ||
            kind === "register" ||
            (kind === "reset" && !token)) && (
            <label>
              E-mail
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
              />
            </label>
          )}
          {(kind === "login" ||
            kind === "register" ||
            kind === "invite" ||
            (kind === "reset" && !!token)) && (
            <label>
              {kind === "invite"
                ? "Senha para uma conta nova (opcional se já entrou)"
                : "Senha"}
              <input
                name="password"
                aria-label="Senha"
                type="password"
                required={kind !== "invite"}
                minLength={12}
                maxLength={128}
                autoComplete={
                  kind === "login" ? "current-password" : "new-password"
                }
              />
              <small>Pelo menos 12 caracteres.</small>
            </label>
          )}
          {(kind === "verify" || kind === "invite") && !token && (
            <p className="notice">
              Abra o link recebido por e-mail para continuar.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
          <button
            className="primary"
            disabled={busy || (["verify", "invite"].includes(kind) && !token)}
          >
            {busy
              ? "Aguarde…"
              : kind === "login"
                ? "Entrar"
                : kind === "register"
                  ? "Criar conta"
                  : kind === "verify"
                    ? "Confirmar e-mail"
                    : kind === "invite"
                      ? "Aceitar convite"
                      : token
                        ? "Alterar senha"
                        : "Enviar instruções"}
          </button>
        </form>
        <hr className="subtle-rule" />
        <div className="stack">
          {kind === "login" ? (
            <>
              <button
                className="quiet"
                onClick={() => {
                  setKind("register");
                  setMessage("");
                  setError("");
                }}
              >
                Criar minha conta de profissional
              </button>
              <Link href="/recuperar">Esqueci minha senha</Link>
            </>
          ) : (
            <Link href="/entrar">Já tenho conta / entrar</Link>
          )}
          <small>
            Ao utilizar o serviço, consulte os{" "}
            <Link href="/termos">termos</Link> e a{" "}
            <Link href="/privacidade">privacidade</Link>.
          </small>
        </div>
      </section>
    </main>
  );
}
