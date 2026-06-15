'use client';

import { useState, useMemo } from 'react';
import type { FolhaMedicao, ResultadoOrcamento, TokenLog } from '@/lib/orcamento/types';

const PRICE_INPUT = 3 / 1_000_000;
const PRICE_OUTPUT = 15 / 1_000_000;

function fmtBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function TokenLogPanel({ logs }: { logs: TokenLog[] }) {
  const [open, setOpen] = useState(false);
  const totalInput = logs.reduce((s, l) => s + l.usage.input_tokens, 0);
  const totalOutput = logs.reduce((s, l) => s + l.usage.output_tokens, 0);
  const totalCost = totalInput * PRICE_INPUT + totalOutput * PRICE_OUTPUT;

  return (
    <div className="border border-zinc-800 rounded overflow-hidden text-base">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
      >
        <span className="font-medium text-zinc-400">
          Tokens — {(totalInput + totalOutput).toLocaleString('pt-BR')} total
        </span>
        <span className="text-sm text-zinc-400 flex items-center gap-3">
          <span>≈ ${totalCost.toFixed(4)} USD</span>
          <span>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="divide-y divide-zinc-800">
          {logs.map((log, idx) => {
            const cost = log.usage.input_tokens * PRICE_INPUT + log.usage.output_tokens * PRICE_OUTPUT;
            return (
              <div key={idx} className="px-4 py-3 flex flex-col gap-1 bg-zinc-950">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-300">{log.stage}</span>
                  <span className="text-sm text-zinc-400">${cost.toFixed(4)}</span>
                </div>
                <div className="flex gap-4 text-sm text-zinc-300">
                  <span>Input: {log.usage.input_tokens.toLocaleString('pt-BR')} tk</span>
                  <span>Output: {log.usage.output_tokens.toLocaleString('pt-BR')} tk</span>
                  {(log.usage.cache_read_input_tokens ?? 0) > 0 && (
                    <span className="text-green-400">Cache: {log.usage.cache_read_input_tokens!.toLocaleString('pt-BR')} tk</span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 bg-zinc-900 flex justify-between font-medium text-zinc-400 text-sm">
            <span>Total</span>
            <div className="flex gap-4">
              <span>In: {totalInput.toLocaleString('pt-BR')} tk</span>
              <span>Out: {totalOutput.toLocaleString('pt-BR')} tk</span>
              <span className="font-semibold text-zinc-300">${totalCost.toFixed(4)} USD</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StepOrcamento({
  folha,
  resultado,
  tokenLogs,
  onRestart,
  onGoToReview,
  showTokens = false,
  hideActions = false,
}: {
  folha: FolhaMedicao;
  resultado: ResultadoOrcamento;
  tokenLogs: TokenLog[];
  onRestart: () => void;
  onGoToReview: (itemId: number) => void;
  showTokens?: boolean;
  hideActions?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [expandedAmbiente, setExpandedAmbiente] = useState<string | null>(null);

  const totalItems = folha.itens.length;
  const confirmados = folha.itens.filter((i) => i.status === 'confirmado').length;
  const estimativas = folha.itens.filter((i) => i.status === 'parcial').length;
  const totalPendencias = folha.itens.reduce((s, i) => s + (i.pendencias?.length ?? 0), 0);
  const totalArea = folha.itens.reduce((s, i) => s + (i.area_m2 ?? 0), 0);

  const itemsByAmbiente = useMemo(() => {
    const map = new Map<string, typeof resultado.itens>();
    for (const item of resultado.itens) {
      const env = item.ambiente || 'Outros';
      if (!map.has(env)) map.set(env, []);
      map.get(env)!.push(item);
    }
    return [...map.entries()];
  }, [resultado.itens]);

  const pendenciasAbertas = folha.itens.flatMap((item) =>
    (item.pendencias ?? []).map((p) => ({ id: item.id, modulo: item.modulo, tipo: item.tipo, texto: p }))
  );

  const copyResumo = async () => {
    const lines = [
      `ORÇAMENTO — ${folha.projeto}`,
      '',
      `Total Material:  ${fmtBRL(resultado.totalMaterial)}`,
      `Total Serviços:  ${fmtBRL(resultado.totalServicos)}`,
      `TOTAL GERAL:     ${fmtBRL(resultado.totalGeral)}`,
      '',
      'Por Ambiente:',
      ...Object.entries(resultado.porAmbiente).map(([amb, v]) => `  ${amb}: ${fmtBRL(v)}`),
    ];
    if (pendenciasAbertas.length > 0) {
      lines.push('', 'Pendências:');
      pendenciasAbertas.forEach((p) => lines.push(`  [${p.id}] ${p.modulo} (${p.tipo}): ${p.texto}`));
    }
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">

      {/* Hero */}
      <div className="rounded-sm bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400 uppercase tracking-wider mb-2 font-medium">Estimativa total</p>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-medium text-zinc-300">R$</span>
              <span className="text-6xl font-bold text-zinc-50 tracking-tight tabular-nums">
                {resultado.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-3 flex gap-4 text-base text-zinc-300">
              <span>Material: <span className="text-zinc-300 font-medium">{fmtBRL(resultado.totalMaterial)}</span></span>
              <span>Serviços: <span className="text-zinc-300 font-medium">{fmtBRL(resultado.totalServicos)}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold text-zinc-300">Resumo</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Peças identificadas', value: totalItems },
            { label: 'Área total', value: `${totalArea.toFixed(1)} m²` },
            { label: 'Estimativas', value: estimativas },
            { label: 'Pendências', value: totalPendencias },
          ].map(({ label, value }) => (
            <div key={label} className="rounded border p-4 bg-zinc-800 border-zinc-700 animate-fade-in">
              <p className="text-2xl font-bold text-zinc-100 tabular-nums">{value}</p>
              <p className="text-sm text-zinc-300 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Itens por ambiente */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-semibold text-zinc-300">Itens por ambiente</h3>
        </div>
        <div className="flex flex-col gap-2">
          {itemsByAmbiente.map(([ambiente, items]) => {
            const totalAmbiente = items.reduce((s, i) => s + i.vlrTotal, 0);
            const isOpen = expandedAmbiente === ambiente;
            return (
              <div key={ambiente} className="rounded border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => setExpandedAmbiente(isOpen ? null : ambiente)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-zinc-200">{ambiente}</span>
                    <span className="text-sm text-zinc-400">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-zinc-200 tabular-nums">{fmtBRL(totalAmbiente)}</span>
                    <span className={`text-sm text-zinc-400 transition-transform inline-block ${isOpen ? 'rotate-90' : ''}`}>→</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="bg-zinc-950 border-t border-zinc-800">
                    <table className="w-full text-base">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="px-4 py-2 text-left text-sm font-medium text-zinc-400 uppercase tracking-wide">Item</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-zinc-400 uppercase tracking-wide">Material</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-zinc-400 uppercase tracking-wide">Área</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-zinc-400 uppercase tracking-wide">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {items.map((item) => (
                          <tr key={item.id} className="hover:bg-zinc-900/60">
                            <td className="px-4 py-2.5">
                              <p className="text-zinc-200 font-medium">{item.modulo}</p>
                              <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mt-0.5 pl-3 border-l-2 border-violet-500/60">{item.tipo}</p>
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400">{item.material}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-400 font-mono tabular-nums">
                              {(item.area_m2 ?? 0).toFixed(2)} m²
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-zinc-200 tabular-nums">
                              {fmtBRL(item.vlrTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Por material */}
      <div className="rounded border border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2">
          <h3 className="text-base font-semibold text-zinc-400">Por Material</h3>
        </div>
        <table className="w-full text-base bg-zinc-950">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-zinc-400 uppercase tracking-wide">Material</th>
              <th className="px-4 py-2 text-right text-sm font-medium text-zinc-400 uppercase tracking-wide">Área m²</th>
              <th className="px-4 py-2 text-right text-sm font-medium text-zinc-400 uppercase tracking-wide">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {Object.entries(resultado.porMaterial).map(([mat, v]) => (
              <tr key={mat} className="hover:bg-zinc-900/60">
                <td className="px-4 py-2.5 text-zinc-300">{mat}</td>
                <td className="px-4 py-2.5 text-right text-zinc-300 font-mono tabular-nums">{v.area.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-zinc-200 tabular-nums">{fmtBRL(v.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pendências */}
      {pendenciasAbertas.length > 0 && (
        <div className="rounded bg-zinc-900 border border-zinc-800 p-4">
          <h3 className="text-base font-semibold text-zinc-400 mb-3 flex items-center gap-1.5">
            Pendências em Aberto ({pendenciasAbertas.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {pendenciasAbertas.map((p, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3 group">
                <div className="flex gap-2 text-sm text-zinc-300 min-w-0">
                  <span className="font-medium shrink-0 text-zinc-400">{p.modulo}:</span>
                  <span className="truncate">{p.texto}</span>
                </div>
                <button
                  onClick={() => onGoToReview(p.id)}
                  className="flex-shrink-0 text-sm px-2.5 py-1 rounded border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200 transition-all"
                >
                  Corrigir →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showTokens && tokenLogs.length > 0 && <TokenLogPanel logs={tokenLogs} />}

      {/* Actions */}
      {!hideActions && (
        <div className="flex gap-3 self-end pt-1">
          <button onClick={onRestart}
            className="flex items-center gap-2 px-4 py-2.5 border border-zinc-700 text-zinc-400 rounded text-base hover:bg-zinc-800 hover:text-zinc-200 active:scale-95 transition-all">
            Novo Projeto
          </button>
          <button onClick={copyResumo}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded text-base hover:bg-zinc-700 active:scale-95 transition-all">
            {copied ? 'Copiado!' : 'Copiar Resumo'}
          </button>
        </div>
      )}
    </div>
  );
}
