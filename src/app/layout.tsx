import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "FitCore — Sua metodologia, em movimento",
    template: "%s | FitCore",
  },
  description:
    "Plataforma de acompanhamento para personal trainers. Alunos, avaliações, programas versionados e ciclos com validação.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
