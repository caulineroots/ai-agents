import { redirect } from "next/navigation";

// O único produto deste projeto é a ferramenta de orçamento.
export default function Home() {
  redirect("/orcamento-construtora");
}
