"use client";
import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "./types";
type Photo = {
  id: string;
  student_id: string;
  category: string;
  measured_on: string;
};
type Data = {
  photos: Photo[];
  consents: { student_id: string; granted: boolean }[];
};
async function getPhotos(tenantId: string): Promise<Data> {
  const r = await fetch("/api/photos", {
    cache: "no-store",
    headers: { "x-tenant-id": tenantId },
  });
  const v = await r.json();
  if (!r.ok) throw Error(v.message);
  return v;
}
export function Photos({ data }: { data: DashboardData }) {
  const [items, setItems] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setItems(await getPhotos(data.actor.tenantId));
  }, [data.actor.tenantId]);
  useEffect(() => {
    getPhotos(data.actor.tenantId)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [data.actor.tenantId]);
  async function action(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/photos/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": data.actor.tenantId,
        },
        body: JSON.stringify(body),
      });
      const value = await r.json();
      if (!r.ok) throw Error(value.message);
      await load();
      setMessage(value.message || "Preferência salva.");
      return value;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  const granted = items?.consents.find(
    (c) => c.student_id === data.actor.studentId,
  )?.granted;
  return (
    <section className="card stack">
      <h2>Fotos de evolução · opcionais</h2>
      <p className="muted">
        Fotos são armazenadas de forma privada para acompanhamento pelo aluno e
        profissionais da organização. Esta versão não envia fotos à IA, não
        estima gordura corporal por imagem e não utiliza imagens para
        publicidade ou treinamento de modelos.
      </p>
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
      {data.actor.role === "student" && (
        <>
          <p>
            Autorização de armazenamento:{" "}
            <strong>{granted ? "concedida" : "não concedida"}</strong>
          </p>
          <button
            disabled={busy}
            onClick={() => {
              if (
                granted &&
                !confirm(
                  "Revogar o consentimento e excluir as fotos do armazenamento ativo?",
                )
              )
                return;
              action("consent", {
                studentId: data.actor.studentId,
                granted: !granted,
              });
            }}
          >
            {granted
              ? "Revogar autorização e excluir fotos"
              : "Autorizar armazenamento privado de fotos"}
          </button>
          <small>
            Você pode continuar utilizando avaliações e treinos sem esta
            autorização.
          </small>
        </>
      )}
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const form = e.currentTarget;
          try {
            const r = await fetch("/api/photos/upload", {
              method: "POST",
              headers: { "x-tenant-id": data.actor.tenantId },
              body: new FormData(form),
            });
            const v = await r.json();
            if (!r.ok) throw Error(v.message);
            await load();
            form.reset();
            setMessage("Foto salva no armazenamento privado.");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Falha no upload.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Aluno
          <select
            name="studentId"
            required
            defaultValue={data.actor.studentId || ""}
          >
            <option value="" disabled>
              Selecione
            </option>
            {data.students.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid two">
          <label>
            Categoria
            <select name="category">
              <option value="front">Frente</option>
              <option value="side">Perfil</option>
              <option value="back">Costas</option>
            </select>
          </label>
          <label>
            Data da foto
            <input
              type="date"
              required
              name="measuredOn"
              defaultValue={new Date().toLocaleDateString("en-CA")}
            />
          </label>
        </div>
        <label>
          Imagem JPEG ou PNG (até 5 MB)
          <input
            type="file"
            accept="image/jpeg,image/png"
            name="file"
            required
          />
        </label>
        <small>
          Evite exposição desnecessária. Somente fotos autorizadas pelo aluno
          podem ser armazenadas. Metadados da imagem são removidos no
          processamento.
        </small>
        <button
          className="primary"
          disabled={busy || (data.actor.role === "student" && !granted)}
        >
          Enviar foto privada
        </button>
      </form>
      {items?.photos.length ? (
        <div className="list">
          {items.photos.map((p) => (
            <article className="list-item" key={p.id}>
              <strong>
                {data.students.find((s) => s.id === p.student_id)?.name} ·{" "}
                {{ front: "Frente", side: "Perfil", back: "Costas" }[
                  p.category
                ] || p.category}
              </strong>
              <p className="muted">
                {p.measured_on.split("-").reverse().join("/")}
              </p>
              <div className="flex">
                <button
                  disabled={busy}
                  onClick={async () => {
                    const result = await action("link", { photoId: p.id });
                    if (result?.url)
                      window.open(result.url, "_blank", "noopener,noreferrer");
                  }}
                >
                  Abrir acesso temporário (60s)
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Excluir esta foto do armazenamento ativo?"))
                      action("delete", { photoId: p.id });
                  }}
                >
                  Excluir foto
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Nenhuma foto enviada. Isso não bloqueia os ciclos.
        </p>
      )}
    </section>
  );
}
