export const dynamic    = 'force-dynamic';
export const maxDuration = 300; // o pipeline (com IA) pode levar minutos

import { proxyToPython } from '../_python-service';

// Fluxo scope-driven: recebe planilha (.xlsx) + desenhos, roda o pipeline no
// serviço Python e devolve resumo + auditoria + work-list + planilha preenchida.
export async function POST(request: Request) {
  return proxyToPython(request, '/orcamento/processar');
}
