import { useState } from 'react';
import type { FolhaOrcamento, ResultadoOrcamento, Categoria } from '@/lib/orcamento-construtora/types';
import { CATEGORIA_LABEL, CATEGORIA_COLOR, fmtBRL } from '@/lib/orcamento-construtora/ui-constants';
import { TokenLogPanel } from './TokenLogPanel';
import type { TokenLog } from '@/hooks/useOrcamentoSession';

const CATEGORIA_DOT: Record<Categoria, string> = {
  civil:        'bg-stone-400',
  eletrica:     'bg-yellow-400',
  hidraulica:   'bg-blue-400',
  marcenaria:   'bg-amber-400',
  vidros:       'bg-cyan-400',
  revestimento: 'bg-purple-400',
  pintura:      'bg-pink-400',
  fachada:      'bg-orange-400',
  climatizacao: 'bg-teal-400',
  outro:        'bg-zinc-400',
};

export function StepOrcamento({
  folha,
  resultado,
  tokenLogs,
  onReset,
}: {
  folha:     FolhaOrcamento;
  resultado: ResultadoOrcamento;
  tokenLogs: TokenLog[];
  onReset:   () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'categoria' | 'ambiente'>('categoria');

  const copyResumo = async () => {
    const lines = [
      `ORÇAMENTO — ${folha.projeto}${folha.cliente ? ` — ${folha.cliente}` : ''}`,
      '',
      ...Object.entries(resultado.porCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, v]) => `${(CATEGORIA_LABEL[cat as Categoria] ?? cat).toUpperCase()}: ${fmtBRL(v)}`),
      '',
      `TOTAL GERAL: ${fmtBRL(resultado.totalGeral)}`,
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackItems  = resultado.itens.filter((i) => i.erros.length > 0);
  const categoriaRows  = Object.entries(resultado.porCategoria).sort((a, b) => b[1] - a[1]);
  const ambienteRows   = Object.entries(resultado.porAmbiente).sort((a, b) => b[1] - a[1]);
  const maxCatVal      = categoriaRows[0]?.[1] ?? 1;
  const maxAmbVal      = ambienteRows[0]?.[1] ?? 1;

  return (
    <div className="flex flex-col gap-5 w-full">

      {/* Título */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">
          Passo 4 — Orçamento{folha.projeto ? ` — ${folha.projeto}` : ''}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Nova Análise
          </button>
          <button
            onClick={copyResumo}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 active:scale-95 transition-all"
          >
            {copied ? '✓ Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Card total */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 p-6 shadow-xl">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }}
        />
        <p className="text-xs font-semibold tracking-widest text-blue-200 uppercase mb-1">
          Total Geral Estimado
        </p>
        <p className="text-5xl font-extrabold text-white tracking-tight">
          {fmtBRL(resultado.totalGeral)}
        </p>
        <div className="mt-3 flex items-center gap-3 text-sm text-blue-200">
          {folha.cliente && <span>{folha.cliente}</span>}
          {folha.cliente && <span className="opacity-40">·</span>}
          <span>{resultado.itens.filter(i => i.status !== 'aguardando').length} itens confirmados</span>
          <span className="opacity-40">·</span>
          <span>{resultado.itens.filter(i => i.status === 'aguardando').length} aguardando</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-700 rounded-xl self-start">
        {(['categoria', 'ambiente'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-zinc-700 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab === 'categoria' ? 'Por Categoria' : 'Por Ambiente'}
          </button>
        ))}
      </div>

      {/* Por Categoria */}
      {activeTab === 'categoria' && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
          <div className="divide-y divide-zinc-800">
            {categoriaRows.map(([cat, v]) => {
              const pct  = (v / maxCatVal) * 100;
              const label = CATEGORIA_LABEL[cat as Categoria] ?? cat;
              const color = CATEGORIA_COLOR[cat as Categoria] ?? CATEGORIA_COLOR.outro;
              const dot   = CATEGORIA_DOT[cat as Categoria]   ?? 'bg-zinc-400';
              return (
                <div key={cat} className="px-5 py-3.5 hover:bg-zinc-800/60 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${color}`}>
                      {label}
                    </span>
                    <span className="ml-auto text-sm font-bold text-white tabular-nums">
                      {fmtBRL(v)}
                    </span>
                    <span className="text-xs text-zinc-500 w-10 text-right tabular-nums">
                      {((v / resultado.totalGeral) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${dot}`}
                      style={{ width: `${pct}%`, opacity: 0.7 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Por Ambiente */}
      {activeTab === 'ambiente' && ambienteRows.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
          <div className="divide-y divide-zinc-800">
            {ambienteRows.map(([amb, v]) => {
              const pct = (v / maxAmbVal) * 100;
              return (
                <div key={amb} className="px-5 py-3.5 hover:bg-zinc-800/60 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="flex-1 text-sm text-zinc-200 font-medium">{amb}</span>
                    <span className="text-sm font-bold text-white tabular-nums">{fmtBRL(v)}</span>
                    <span className="text-xs text-zinc-500 w-10 text-right tabular-nums">
                      {((v / resultado.totalGeral) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${pct}%`, opacity: 0.7 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback warning */}
      {fallbackItems.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-400 mb-2">
            {fallbackItems.length} itens sem código XLSX — preço por fallback de categoria
          </p>
          <ul className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
            {fallbackItems.map((i) => (
              <li key={i.id} className="text-xs text-amber-500/80">· {i.descricao}</li>
            ))}
          </ul>
        </div>
      )}

      <TokenLogPanel logs={tokenLogs} />
    </div>
  );
}
