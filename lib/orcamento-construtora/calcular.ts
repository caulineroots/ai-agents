// ─── Cálculo — Orçamento de Construtora ──────────────────────────────────────
// Lookup priority:
//   1. Código XLSX (ex: "14.1") → lookup O(1) em XLSX_POR_COD
//   2. Fallback por categoria (estimativa)

import type {
  FolhaOrcamento,
  ItemOrcamento,
  ItemOrcado,
  Categoria,
  ResultadoOrcamento,
} from './types';
import { XLSX_POR_COD } from './xlsx-checklist';

// ─── Fallback por categoria ───────────────────────────────────────────────────
// Usado apenas quando o item não tem cod XLSX — valores estimados da 1ª Proposta CELMAR BLN.
const FALLBACK_CATEGORIA: Record<Categoria, number> = {
  civil:        110,
  eletrica:     300,
  hidraulica:   280,
  marcenaria:   625,
  vidros:       650,
  revestimento:  85,
  pintura:       54,
  fachada:      640,
  climatizacao: 600,
  outro:        100,
};

function resolvePreco(item: ItemOrcamento): { vlr: number; fallback: boolean } {
  const cod = (item as ItemOrcamento & { cod?: string }).cod;
  if (cod) {
    const xlsxItem = XLSX_POR_COD[cod];
    if (xlsxItem) return { vlr: xlsxItem.vlrUnit, fallback: false };
  }
  return { vlr: FALLBACK_CATEGORIA[item.categoria] ?? 0, fallback: true };
}

function calcularItem(item: ItemOrcamento): ItemOrcado {
  const erros: string[] = [];
  const { vlr, fallback } = resolvePreco(item);
  if (fallback) {
    erros.push(`Preço de "${item.descricao}" não encontrado — usando fallback de categoria "${item.categoria}"`);
  }
  return {
    ...item,
    vlrUnit:  vlr,
    vlrTotal: parseFloat((vlr * item.quantidade).toFixed(2)),
    erros,
  };
}

/**
 * Itens que NÃO devem ser precificados:
 * - ABL/SV/AVL/ADM: áreas de referência espacial
 * - LAJE APARENTE: teto sem forro — custo zero
 * - PÉ-DIREITO: anotação de altura
 * - ILUMINÂNCIA: dado de simulação luminotécnica
 * - QUADRO DE ACABAMENTOS: tabela de especificação
 */
const NON_BILLABLE = /^(ABL\s|SV\s|AVL\s|ADM\s+[A-ZÁÉÍÓÚÀÃÕ]|CIRC[\.\s]|LAJE\s+APARENTE|PÉ-DIREITO|PÉ\s+DIREITO|ILUMINÂNCIA|QUADRO\s+DE\s+ACABAMENTOS\s+[–—-])/i;

function isNonBillable(item: ItemOrcamento): boolean {
  return NON_BILLABLE.test(item.descricao ?? '');
}

export function calcularOrcamento(folha: FolhaOrcamento): ResultadoOrcamento {
  const itens = folha.itens.filter((it) => !isNonBillable(it)).map(calcularItem);

  const confirmados = itens.filter((i) => i.status !== 'aguardando');

  const totalGeral = confirmados.reduce((s, i) => s + i.vlrTotal, 0);

  const porCategoria: Record<string, number> = {};
  for (const item of confirmados) {
    porCategoria[item.categoria] = (porCategoria[item.categoria] ?? 0) + item.vlrTotal;
  }

  const porAmbiente: Record<string, number> = {};
  for (const item of confirmados) {
    const amb = item.ambiente ?? '?';
    porAmbiente[amb] = (porAmbiente[amb] ?? 0) + item.vlrTotal;
  }

  return { itens, totalGeral, porCategoria, porAmbiente };
}
