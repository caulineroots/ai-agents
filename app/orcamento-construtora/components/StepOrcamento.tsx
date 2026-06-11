import { useState } from 'react';
import type { FolhaOrcamento, ResultadoOrcamento } from '@/lib/orcamento-construtora/types';
import { fmtBRL } from '@/lib/orcamento-construtora/ui-constants';
import { buildPlanilha, downloadPlanilha, unidadeLabel } from '@/lib/orcamento-construtora/export-planilha';
import { TokenLogPanel } from './TokenLogPanel';
import type { TokenLog } from '@/hooks/useOrcamentoSession';

const fmtQtd = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const today = () => new Date().toLocaleDateString('pt-BR');

export function StepOrcamento({
  folha,
  resultado,
  tokenLogs,
  onReset,
}: {
  folha: FolhaOrcamento;
  resultado: ResultadoOrcamento;
  tokenLogs: TokenLog[];
  onReset: () => void;
}) {
  const [hideZeros, setHideZeros] = useState(false);
  const planilha = buildPlanilha(folha, resultado, { hideZeros });
  const zeroCount = resultado.itens.filter((i) => i.vlrTotal === 0).length;
  const fallbackItems = resultado.itens.filter((i) => i.erros.length > 0);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-gray-800">
          Passo 5 — Orçamento{folha.projeto ? ` — ${folha.projeto}` : ''}
        </h2>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideZeros}
              onChange={(e) => setHideZeros(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            Ocultar itens R$ 0,00{zeroCount > 0 ? ` (${zeroCount})` : ''}
          </label>
          <button
            onClick={() => downloadPlanilha(folha, resultado, { hideZeros })}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 active:scale-95 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12l-4-4h2.5V3h3v5H14l-4 4z" />
              <path d="M4 14h12v2H4z" />
            </svg>
            Baixar planilha (.xls)
          </button>
        </div>
      </div>

      {/* Planilha — emula o documento enviado ao cliente */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
        {/* Cabeçalho da proposta */}
        <div className="bg-[#1e3a5f] text-white px-5 py-4">
          <p className="text-lg font-bold tracking-wide">PROPOSTA DE ORÇAMENTO</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm text-blue-100">
            <p><span className="text-blue-300">Projeto:</span> <span className="font-medium text-white">{folha.projeto || '—'}</span></p>
            {folha.cliente && <p><span className="text-blue-300">Cliente:</span> <span className="font-medium text-white">{folha.cliente}</span></p>}
            <p><span className="text-blue-300">Data:</span> <span className="font-medium text-white">{today()}</span></p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="border border-gray-300 px-2 py-2 text-left w-16">ITEM</th>
                <th className="border border-gray-300 px-3 py-2 text-left">DESCRIÇÃO</th>
                <th className="border border-gray-300 px-2 py-2 text-center w-14">UN</th>
                <th className="border border-gray-300 px-2 py-2 text-right w-20">QDE.</th>
                <th className="border border-gray-300 px-3 py-2 text-right w-32">VALOR UNIT.</th>
                <th className="border border-gray-300 px-3 py-2 text-right w-36">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {planilha.grupos.map((g) => (
                <GrupoRows key={String(g.categoria)} grupo={g} />
              ))}
              <tr className="bg-[#1e3a5f] text-white font-bold">
                <td className="border border-gray-400 px-3 py-2.5" colSpan={5}>TOTAL GERAL</td>
                <td className="border border-gray-400 px-3 py-2.5 text-right text-base">{fmtBRL(planilha.totalGeral)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {fallbackItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-1">
            Itens com preço não mapeado — usando fallback de categoria ({fallbackItems.length}):
          </h3>
          <ul className="flex flex-col gap-1">
            {fallbackItems.map((i) => (
              <li key={i.id} className="text-xs text-amber-700">· {i.descricao}: {i.erros.join('; ')}</li>
            ))}
          </ul>
        </div>
      )}

      <TokenLogPanel logs={tokenLogs} />

      <div className="flex gap-3 self-end">
        <button
          onClick={onReset}
          className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all"
        >
          Nova Análise
        </button>
        <button
          onClick={() => downloadPlanilha(folha, resultado, { hideZeros })}
          className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 active:scale-95 transition-all"
        >
          Baixar planilha
        </button>
      </div>
    </div>
  );
}

function GrupoRows({ grupo }: { grupo: ReturnType<typeof buildPlanilha>['grupos'][number] }) {
  return (
    <>
      {/* Cabeçalho do grupo (categoria) com subtotal */}
      <tr className="bg-[#dde6f0] text-gray-800 font-semibold">
        <td className="border border-gray-300 px-2 py-2">{grupo.numero}</td>
        <td className="border border-gray-300 px-3 py-2 uppercase tracking-wide" colSpan={4}>{grupo.label}</td>
        <td className="border border-gray-300 px-3 py-2 text-right">{fmtBRL(grupo.subtotal)}</td>
      </tr>
      {grupo.itens.map((it, i) => (
        <tr key={it.id} className="hover:bg-blue-50/40">
          <td className="border border-gray-200 px-2 py-2 text-gray-600 align-top">{grupo.numero}.{i + 1}</td>
          <td className="border border-gray-200 px-3 py-2 text-gray-800">
            {it.descricao}
            {it.ambiente && <span className="text-gray-400"> · {it.ambiente}</span>}
          </td>
          <td className="border border-gray-200 px-2 py-2 text-center text-gray-600">{unidadeLabel(it.unidade)}</td>
          <td className="border border-gray-200 px-2 py-2 text-right text-gray-700 tabular-nums">{fmtQtd(it.quantidade)}</td>
          <td className="border border-gray-200 px-3 py-2 text-right text-gray-700 tabular-nums">{fmtBRL(it.vlrUnit)}</td>
          <td className="border border-gray-200 px-3 py-2 text-right font-medium text-gray-900 tabular-nums">{fmtBRL(it.vlrTotal)}</td>
        </tr>
      ))}
    </>
  );
}
