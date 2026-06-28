import { useState, useMemo, useCallback } from 'react';
import type { FolhaOrcamento, ResultadoOrcamento, Categoria, ItemOrcamento } from '@/lib/orcamento-construtora/types';
import { CATEGORIA_LABEL, CATEGORIA_COLOR, fmtBRL } from '@/lib/orcamento-construtora/ui-constants';
import { XLSX_POR_COD } from '@/lib/orcamento-construtora/xlsx-checklist-bln';
import { divergenciaRef } from '@/lib/orcamento-construtora/grupo-categoria';
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
  onFolhaChange,
}: {
  folha:     FolhaOrcamento;
  resultado: ResultadoOrcamento;
  tokenLogs: TokenLog[];
  onReset:   () => void;
  onFolhaChange?: (folha: FolhaOrcamento) => void;
}) {
  const [copied,     setCopied]     = useState(false);
  const [copiedTsv,  setCopiedTsv]  = useState(false);
  const [activeTab,  setActiveTab]  = useState<'categoria' | 'ambiente' | 'itens'>('categoria');
  const [sortCol,    setSortCol]    = useState<'cod' | 'descricao' | 'categoria' | 'quantidade' | 'vlrTotal'>('cod');
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('asc');
  const [search,     setSearch]     = useState('');

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

  type ItemRow = typeof resultado.itens[0] & { cod?: string; iaSugestao?: ItemOrcamento['iaSugestao'] };

  const iaSugestaoByCod = useMemo(() => {
    const m = new Map<string, ItemOrcamento['iaSugestao']>();
    for (const it of folha.itens) {
      if (it.cod && it.iaSugestao) m.set(it.cod, it.iaSugestao);
    }
    return m;
  }, [folha.itens]);

  const applyIaDecisao = useCallback((cod: string, usarSugestao: boolean) => {
    if (!onFolhaChange) return;
    const updated: FolhaOrcamento = {
      ...folha,
      itens: folha.itens.map((it) => {
        if (it.cod !== cod || !it.iaSugestao) return it;
        return {
          ...it,
          quantidade: usarSugestao ? it.iaSugestao!.qty : it.quantidade,
          iaSugestao: {
            ...it.iaSugestao,
            decisao: usarSugestao ? 'aceita' as const : 'mantida' as const,
          },
        };
      }),
    };
    onFolhaChange(updated);
  }, [folha, onFolhaChange]);

  const prioritySugestoes = useMemo(() => {
    return (resultado.itens as ItemRow[])
      .filter((it) => {
        const sug = it.cod ? iaSugestaoByCod.get(it.cod) : undefined;
        if (!sug || sug.decisao) return false;
        const ref = it.cod ? XLSX_POR_COD[it.cod]?.qdeReferencia : undefined;
        const div = divergenciaRef(it.quantidade, ref);
        return div === 'bad' || div === 'warn' || sug.confianca >= 0.7;
      })
      .sort((a, b) => {
        const refA = a.cod ? XLSX_POR_COD[a.cod]?.qdeReferencia : undefined;
        const refB = b.cod ? XLSX_POR_COD[b.cod]?.qdeReferencia : undefined;
        const divA = divergenciaRef(a.quantidade, refA) === 'bad' ? 0 : 1;
        const divB = divergenciaRef(b.quantidade, refB) === 'bad' ? 0 : 1;
        if (divA !== divB) return divA - divB;
        return (a.cod ?? '').localeCompare(b.cod ?? '');
      });
  }, [resultado.itens, iaSugestaoByCod]);

  const sortedItems = useMemo(() => {
    const q = search.toLowerCase();
    const rows = (resultado.itens as ItemRow[]).filter((it) =>
      !q ||
      it.descricao.toLowerCase().includes(q) ||
      (it.cod ?? '').toLowerCase().includes(q) ||
      it.categoria.toLowerCase().includes(q)
    );
    const prio = (it: ItemRow) => {
      const sug = it.cod ? iaSugestaoByCod.get(it.cod) : undefined;
      const ref = it.cod ? XLSX_POR_COD[it.cod]?.qdeReferencia : undefined;
      const div = divergenciaRef(it.quantidade, ref);
      if (sug && !sug.decisao && div === 'bad') return 0;
      if (sug && !sug.decisao) return 1;
      if (div === 'bad') return 2;
      return 3;
    };
    return [...rows].sort((a, b) => {
      const pa = prio(a);
      const pb = prio(b);
      if (pa !== pb) return pa - pb;
      let va: string | number = '';
      let vb: string | number = '';
      if (sortCol === 'cod')        { va = a.cod ?? ''; vb = b.cod ?? ''; }
      if (sortCol === 'descricao')  { va = a.descricao; vb = b.descricao; }
      if (sortCol === 'categoria')  { va = a.categoria; vb = b.categoria; }
      if (sortCol === 'quantidade') { va = a.quantidade; vb = b.quantidade; }
      if (sortCol === 'vlrTotal')   { va = a.vlrTotal; vb = b.vlrTotal; }
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [resultado.itens, sortCol, sortDir, search, iaSugestaoByCod]);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const copyTsv = async () => {
    const header = ['Cód', 'Descrição', 'Categoria', 'Un', 'Qtd', 'Mat unit', 'MO unit', 'Vlr Mat', 'Vlr MO', 'Vlr Total'].join('\t');
    const rows = (resultado.itens as ItemRow[]).map((it) => [
      it.cod ?? '',
      it.descricao,
      CATEGORIA_LABEL[it.categoria as Categoria] ?? it.categoria,
      it.unidade,
      it.quantidade.toString().replace('.', ','),
      (it.mat ?? 0).toFixed(2).replace('.', ','),
      (it.mo ?? 0).toFixed(2).replace('.', ','),
      (it.vlrMat ?? 0).toFixed(2).replace('.', ','),
      (it.vlrMo ?? 0).toFixed(2).replace('.', ','),
      it.vlrTotal.toFixed(2).replace('.', ','),
    ].join('\t'));
    await navigator.clipboard.writeText([header, ...rows].join('\n'));
    setCopiedTsv(true);
    setTimeout(() => setCopiedTsv(false), 2000);
  };

  const residual = folha.orcarMeta?.residual ?? [];
  const divBad   = useMemo(() => {
    return (resultado.itens as ItemRow[]).filter((it) => {
      const ref = it.cod ? XLSX_POR_COD[it.cod]?.qdeReferencia : undefined;
      return divergenciaRef(it.quantidade, ref) === 'bad';
    }).length;
  }, [resultado.itens]);

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
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-blue-200">
          {folha.cliente && <span>{folha.cliente}</span>}
          {folha.cliente && <span className="opacity-40">·</span>}
          <span>{resultado.itens.filter(i => i.status !== 'aguardando').length} itens confirmados</span>
          <span className="opacity-40">·</span>
          <span>Mat {fmtBRL(resultado.totalMat)}</span>
          <span className="opacity-40">·</span>
          <span>MO {fmtBRL(resultado.totalMo)}</span>
          {divBad > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-amber-300">{divBad} divergências &gt;15%</span>
            </>
          )}
        </div>
      </div>

      {/* Sugestões IA prioritárias */}
      {prioritySugestoes.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-700/50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
            Sugestões IA — revisar quantidades ({prioritySugestoes.length} pendentes)
          </p>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {prioritySugestoes.map((it) => {
              const sug = it.cod ? iaSugestaoByCod.get(it.cod) : undefined;
              const ref = it.cod ? XLSX_POR_COD[it.cod]?.qdeReferencia : undefined;
              if (!sug) return null;
              return (
                <div
                  key={it.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-zinc-900/80 border border-amber-800/40 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-amber-200">{it.cod}</p>
                    <p className="text-xs text-zinc-400 truncate">{it.descricao}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Atual: <span className="text-zinc-300">{it.quantidade.toLocaleString('pt-BR')} {it.unidade}</span>
                      {ref != null && ref > 0 && (
                        <> · Ref gabarito: {ref.toLocaleString('pt-BR')}</>
                      )}
                      {' · '}
                      Sugestão IA: <span className="text-amber-300">{sug.qty.toLocaleString('pt-BR')} {it.unidade}</span>
                      {' '}({Math.round(sug.confianca * 100)}%)
                    </p>
                    {sug.motivo && (
                      <p className="text-xs text-zinc-600 mt-0.5 italic">{sug.motivo}</p>
                    )}
                  </div>
                  {onFolhaChange && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => it.cod && applyIaDecisao(it.cod, true)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors"
                      >
                        Usar sugestão
                      </button>
                      <button
                        type="button"
                        onClick={() => it.cod && applyIaDecisao(it.cod, false)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        Manter atual
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Residual + divergências */}
      {(residual.length > 0 || divBad > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {residual.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                Residual — {residual.length} códigos sem quantidade PDF
              </p>
              <ul className="flex flex-col gap-0.5 max-h-36 overflow-y-auto text-xs text-zinc-500">
                {residual.slice(0, 40).map((r) => (
                  <li key={r.cod} className="font-mono truncate">
                    {r.cod} · {r.descricao.slice(0, 50)}
                  </li>
                ))}
                {residual.length > 40 && (
                  <li className="text-zinc-600 italic">… +{residual.length - 40} itens</li>
                )}
              </ul>
            </div>
          )}
          {divBad > 0 && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-400 mb-2">
                Divergência &gt;15% vs qdeReferencia
              </p>
              <ul className="flex flex-col gap-0.5 max-h-36 overflow-y-auto text-xs">
                {(resultado.itens as ItemRow[]).filter((it) => {
                  const ref = it.cod ? XLSX_POR_COD[it.cod]?.qdeReferencia : undefined;
                  return divergenciaRef(it.quantidade, ref) === 'bad';
                }).slice(0, 15).map((it) => {
                  const ref = it.cod ? XLSX_POR_COD[it.cod]?.qdeReferencia : 0;
                  return (
                    <li key={it.id} className="text-red-300/90 font-mono">
                      {it.cod}: {it.quantidade.toLocaleString('pt-BR')} vs ref {ref?.toLocaleString('pt-BR')}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-700 rounded-xl self-start">
        {(['categoria', 'ambiente', 'itens'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-zinc-700 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab === 'categoria' ? 'Por Categoria' : tab === 'ambiente' ? 'Por Ambiente' : 'Itens'}
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

      {/* Planilha de itens */}
      {activeTab === 'itens' && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800">
            <input
              type="text"
              placeholder="Buscar descrição, código, categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-zinc-500 whitespace-nowrap">
              {sortedItems.length} {sortedItems.length === 1 ? 'item' : 'itens'}
            </span>
            <button
              onClick={copyTsv}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 active:scale-95 transition-all whitespace-nowrap"
            >
              {copiedTsv ? '✓ Copiado!' : 'Copiar planilha'}
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-800/60 text-zinc-400 uppercase tracking-wide text-left">
                  {([
                    ['cod',        'Cód',       'w-16'],
                    ['descricao',  'Descrição', 'min-w-[180px]'],
                    ['categoria',  'Categoria', 'w-24'],
                    [null,         'Un',        'w-10 text-center'],
                    ['quantidade', 'Qtd',       'w-20 text-right'],
                    [null,         'Mat',       'w-20 text-right'],
                    [null,         'MO',        'w-20 text-right'],
                    ['vlrTotal',   'Total',     'w-24 text-right'],
                  ] as [string | null, string, string][]).map(([col, label, cls]) => (
                    <th
                      key={label}
                      className={`px-3 py-2 font-semibold ${cls} ${col ? 'cursor-pointer hover:text-zinc-200 select-none' : ''}`}
                      onClick={() => col && toggleSort(col as typeof sortCol)}
                    >
                      {label}
                      {col && sortCol === col && (
                        <span className="ml-1 text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((it) => {
                    const catLabel = CATEGORIA_LABEL[it.categoria as Categoria] ?? it.categoria;
                    const catColor = CATEGORIA_COLOR[it.categoria as Categoria] ?? CATEGORIA_COLOR.outro;
                    const ref = it.cod ? XLSX_POR_COD[it.cod]?.qdeReferencia : undefined;
                    const div = divergenciaRef(it.quantidade, ref);
                    const divDot = div === 'ok' ? 'bg-green-500' : div === 'warn' ? 'bg-amber-500' : div === 'bad' ? 'bg-red-500' : '';
                    const sug = it.cod ? iaSugestaoByCod.get(it.cod) : undefined;
                    const rowBorder = sug && !sug.decisao ? 'ring-1 ring-inset ring-amber-700/40' : '';
                    return (
                      <tr key={it.id} className={`hover:bg-zinc-800/40 transition-colors ${rowBorder}`}>
                        <td className="px-3 py-2 font-mono text-zinc-500 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {divDot && <span className={`w-1.5 h-1.5 rounded-full ${divDot}`} title={ref ? `Ref: ${ref}` : undefined} />}
                            {it.cod ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-200 leading-snug">
                          {it.descricao}
                          {it.materialCliente && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-900/50 text-amber-400 border border-amber-700/50">
                              Mat. C&A
                            </span>
                          )}
                          {sug?.decisao === 'aceita' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-900/50 text-green-400 border border-green-700/50">
                              IA aceita
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${catColor}`}>
                            {catLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-400 text-center">{it.unidade}</td>
                        <td className="px-3 py-2 text-right text-zinc-200 tabular-nums">
                          {it.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500 tabular-nums">
                          {fmtBRL(it.vlrMat ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-500 tabular-nums">
                          {fmtBRL(it.vlrMo ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-white tabular-nums">
                          {fmtBRL(it.vlrTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {sortedItems.length > 0 && (
                <tfoot>
                  <tr className="bg-zinc-800/60 font-semibold text-zinc-200">
                    <td colSpan={5} className="px-3 py-2 text-right text-xs uppercase tracking-wide text-zinc-400">
                      Total ({sortedItems.length} itens)
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                      {fmtBRL(sortedItems.reduce((s, it) => s + (it.vlrMat ?? 0), 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                      {fmtBRL(sortedItems.reduce((s, it) => s + (it.vlrMo ?? 0), 0))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white">
                      {fmtBRL(sortedItems.reduce((s, it) => s + it.vlrTotal, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
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
