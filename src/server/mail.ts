import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { config, AppError, requireEnv } from "./config";
export async function sendMail(to: string, subject: string, text: string) {
  if (process.env.MAIL_MODE === "outbox" && !config.production) {
    await mkdir(".local/mail", { recursive: true, mode: 0o700 });
    await writeFile(
      `.local/mail/${Date.now()}-${randomUUID()}.json`,
      JSON.stringify({ to, subject, text }, null, 2),
      { mode: 0o600 },
    );
    return;
  }
  const key = requireEnv("RESEND_API_KEY"),
    from = requireEnv("MAIL_FROM");
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!result.ok)
    throw new AppError(
      503,
      "email_unavailable",
      "O envio de e-mail falhou. Tente novamente.",
    );
}
