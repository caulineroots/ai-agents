import { useState } from 'react';
import type { FolhaOrcamento, ResultadoOrcamento, Categoria } from '@/lib/orcamento-construtora/types';
import { CATEGORIA_LABEL, CATEGORIA_COLOR, fmtBRL } from '@/lib/orcamento-construtora/ui-constants';
import { TokenLogPanel } from './TokenLogPanel';
import type { TokenLog } from '@/hooks/useOrcamentoSession';

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
  const [copied, setCopied] = useState(false);

  const copyResumo = async () => {
    const lines = [
      `ORÇAMENTO — ${folha.projeto}${folha.cliente ? ` — ${folha.cliente}` : ''}`,
      '',
      ...Object.entries(resultado.porCategoria).map(([cat, v]) => `${cat.toUpperCase()}: ${fmtBRL(v)}`),
      '',
      `TOTAL GERAL: ${fmtBRL(resultado.totalGeral)}`,
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackItems = resultado.itens.filter((i) => i.erros.length > 0);

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2 className="text-xl font-semibold text-gray-800">
        Passo 4 — Orçamento{folha.projeto ? ` — ${folha.projeto}` : ''}
      </h2>

      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <p className="text-sm text-blue-200 mb-1">Total Geral Estimado</p>
        <p className="text-4xl font-bold">{fmtBRL(resultado.totalGeral)}</p>
        {folha.cliente && <p className="text-sm text-blue-200 mt-2">{folha.cliente}</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Por Categoria</h3>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {Object.entries(resultado.porCategoria).sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
              <tr key={cat} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORIA_COLOR[cat as Categoria] ?? CATEGORIA_COLOR.outro}`}>
                    {CATEGORIA_LABEL[cat as Categoria] ?? cat}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmtBRL(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(resultado.porAmbiente).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Por Ambiente</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {Object.entries(resultado.porAmbiente).sort((a, b) => b[1] - a[1]).map(([amb, v]) => (
                <tr key={amb} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-700">{amb}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmtBRL(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
          onClick={copyResumo}
          className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 active:scale-95 transition-all"
        >
          {copied ? '✓ Copiado!' : 'Copiar Resumo'}
        </button>
      </div>
    </div>
  );
}
