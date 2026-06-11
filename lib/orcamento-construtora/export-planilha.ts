// ─── Montagem e exportação da planilha de orçamento ─────────────────────────
// Reproduz o formato das propostas enviadas à construtora/arquitetura:
// itens agrupados por categoria (com numeração x.y), subtotais e total geral.

import type { Categoria, FolhaOrcamento, ItemOrcado, ResultadoOrcamento } from './types';
import { CATEGORIA_LABEL, UNIDADE_LABEL } from './ui-constants';

export interface GrupoPlanilha {
  categoria: Categoria | string;
  label: string;
  /** Número do grupo na proposta (1, 2, 3…), usado para numerar os itens (1.1, 1.2…). */
  numero: number;
  itens: ItemOrcado[];
  subtotal: number;
}

export interface Planilha {
  projeto: string;
  cliente: string;
  grupos: GrupoPlanilha[];
  totalGeral: number;
}

/** Ordem de exibição das categorias (mesma ordem dos rótulos). */
const ORDEM_CATEGORIA = Object.keys(CATEGORIA_LABEL) as Categoria[];

export function unidadeLabel(u: ItemOrcado['unidade']): string {
  return UNIDADE_LABEL[u] ?? String(u);
}

export interface PlanilhaOptions {
  /** Oculta itens com total R$ 0,00 (não altera os dados — só não exibe/exporta).
   *  Categorias que ficarem sem itens visíveis são removidas automaticamente. */
  hideZeros?: boolean;
}

/** Agrupa os itens orçados por categoria, preservando a ordem canônica. */
export function buildPlanilha(
  folha: FolhaOrcamento,
  resultado: ResultadoOrcamento,
  opts: PlanilhaOptions = {},
): Planilha {
  const porCat = new Map<string, ItemOrcado[]>();
  for (const item of resultado.itens) {
    if (opts.hideZeros && item.vlrTotal === 0) continue;   // oculta linhas zeradas
    const arr = porCat.get(item.categoria) ?? [];
    arr.push(item);
    porCat.set(item.categoria, arr);
  }

  // Categorias na ordem canônica primeiro; quaisquer extras no fim.
  const cats = [
    ...ORDEM_CATEGORIA.filter((c) => porCat.has(c)),
    ...[...porCat.keys()].filter((c) => !ORDEM_CATEGORIA.includes(c as Categoria)),
  ];

  const grupos: GrupoPlanilha[] = cats.map((cat, idx) => {
    const itens = porCat.get(cat)!;
    return {
      categoria: cat,
      label: CATEGORIA_LABEL[cat as Categoria] ?? cat,
      numero: idx + 1,
      itens,
      subtotal: itens.reduce((s, it) => s + it.vlrTotal, 0),
    };
  });

  return {
    projeto: folha.projeto,
    cliente: folha.cliente,
    grupos,
    totalGeral: resultado.totalGeral,
  };
}

// ─── Exportação para Excel (.xls via HTML, sem dependências) ─────────────────

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Célula numérica com formato de moeda brasileiro reconhecido pelo Excel. */
const num = (v: number, fmt = '#,##0.00') =>
  `<td style="mso-number-format:'${fmt}';text-align:right" align="right">${Number.isFinite(v) ? v : ''}</td>`;

const th = (txt: string, extra = '') =>
  `<td style="background:#1e3a5f;color:#fff;font-weight:bold;border:1px solid #999;${extra}">${esc(txt)}</td>`;

export function planilhaToHtml(p: Planilha): string {
  const today = new Date().toLocaleDateString('pt-BR');
  const rows: string[] = [];

  // Cabeçalho da proposta
  rows.push(`<tr><td colspan="6" style="font-size:16pt;font-weight:bold">PROPOSTA DE ORÇAMENTO</td></tr>`);
  rows.push(`<tr><td colspan="2" style="font-weight:bold">PROJETO</td><td colspan="4">${esc(p.projeto)}</td></tr>`);
  if (p.cliente) rows.push(`<tr><td colspan="2" style="font-weight:bold">CLIENTE</td><td colspan="4">${esc(p.cliente)}</td></tr>`);
  rows.push(`<tr><td colspan="2" style="font-weight:bold">DATA</td><td colspan="4">${esc(today)}</td></tr>`);
  rows.push(`<tr><td colspan="6"></td></tr>`);

  // Resumo por categoria
  rows.push(`<tr>${th('DESCRIÇÃO', 'width:340px')}${th('')}${th('')}${th('')}${th('')}${th('TOTAIS')}</tr>`);
  for (const g of p.grupos) {
    rows.push(
      `<tr><td colspan="5" style="border:1px solid #ccc">${esc(g.numero)} — ${esc(g.label)}</td>${num(g.subtotal)}</tr>`,
    );
  }
  rows.push(
    `<tr><td colspan="5" style="font-weight:bold;background:#eee;border:1px solid #999">TOTAL GERAL</td>` +
      `<td style="mso-number-format:'#,##0.00';text-align:right;font-weight:bold;background:#eee;border:1px solid #999" align="right">${p.totalGeral}</td></tr>`,
  );
  rows.push(`<tr><td colspan="6"></td></tr>`);

  // Detalhamento por categoria
  rows.push(
    `<tr>${th('ITEM')}${th('DESCRIÇÃO', 'width:420px')}${th('UN')}${th('QDE.')}${th('VALOR UNIT.')}${th('TOTAL')}</tr>`,
  );
  for (const g of p.grupos) {
    rows.push(
      `<tr><td style="font-weight:bold;background:#dde6f0;border:1px solid #999">${esc(g.numero)}</td>` +
        `<td colspan="4" style="font-weight:bold;background:#dde6f0;border:1px solid #999">${esc(
          g.label.toUpperCase(),
        )}</td>${num(g.subtotal)}</tr>`,
    );
    g.itens.forEach((it, i) => {
      rows.push(
        `<tr>` +
          `<td style="border:1px solid #ccc">${g.numero}.${i + 1}</td>` +
          `<td style="border:1px solid #ccc">${esc(it.descricao)}${it.ambiente ? ` (${esc(it.ambiente)})` : ''}</td>` +
          `<td style="border:1px solid #ccc">${esc(unidadeLabel(it.unidade))}</td>` +
          num(it.quantidade, '#,##0.##') +
          num(it.vlrUnit) +
          num(it.vlrTotal) +
          `</tr>`,
      );
    });
  }

  return (
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">` +
    `<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>` +
    `<x:Name>Orçamento</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>` +
    `</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>` +
    `<body><table border="1" style="border-collapse:collapse;font-family:Arial;font-size:10pt">${rows.join('')}</table></body></html>`
  );
}

/** Gera e dispara o download da planilha (.xls) no navegador. */
export function downloadPlanilha(
  folha: FolhaOrcamento,
  resultado: ResultadoOrcamento,
  opts: PlanilhaOptions = {},
): void {
  const p = buildPlanilha(folha, resultado, opts);
  const html = planilhaToHtml(p);
  const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (p.projeto || 'orcamento').replace(/[^\w\-]+/g, '_');
  a.href = url;
  a.download = `Proposta_${safe}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
