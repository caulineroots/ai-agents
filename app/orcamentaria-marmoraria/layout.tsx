import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Orçamento de Marmoraria por IA — em minutos, sem planilha",
  description: "Você sobe a prancha do projeto. A IA lê, mede e gera o orçamento item por item — pronto pra enviar pro cliente.",
};

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowY: "auto", overflowX: "hidden", width: "100%", height: "100%", position: "relative" }}>
      {children}
    </div>
  );
}
