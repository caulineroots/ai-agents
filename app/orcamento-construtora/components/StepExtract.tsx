'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { PranchaGroup } from '@/lib/orcamento-construtora/image-store';
import { imageStore } from '@/lib/orcamento-construtora/image-store';
import type { PranchaExtractResult, Step } from '@/hooks/useOrcamentoSession';
import { ExtractionDebugModal, type ExtractionDebug } from './ExtractionDebugModal';

const CLASS_LABEL: Record<string, string> = {
  DIRETO:        'Extração direta',
  IA_AUDITORIA:  'IA recomendada',
  IA_NECESSARIA: 'IA obrigatória',
  SEM_CONTEUDO:  'Sem conteúdo',
};
const CLASS_COLOR: Record<string, string> = {
  DIRETO:        'bg-green-900/50 text-green-300 border-green-700',
  IA_AUDITORIA:  'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  IA_NECESSARIA: 'bg-red-900/50 text-red-300 border-red-700',
  SEM_CONTEUDO:  'bg-zinc-800 text-zinc-400 border-zinc-600',
};

function useImageUrls(groups: PranchaGroup[]) {
  const [urls,  setUrls]  = useState<Record<string, string>>({});
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const prevUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    Object.values(prevUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    const next: Record<string, string> = {};
    const isPng: Record<string, boolean> = {};
    for (const g of groups) {
      if (g.imageFile) { next[g.stem] = URL.createObjectURL(g.imageFile); isPng[g.stem] = true; }
      else if (g.pdfFile) { next[g.stem] = URL.createObjectURL(g.pdfFile); isPng[g.stem] = false; }
    }
    prevUrlsRef.current = next;
    setUrls(next);
    const stems = Object.keys(next).filter((s) => isPng[s]);
    let cancelled = false;
    (async () => {
      for (const stem of stems) {
        if (cancelled) break;
        const img = new window.Image();
        img.src = next[stem];
        try { await img.decode(); } catch {}
        if (!cancelled) setReady((r) => ({ ...r, [stem]: true }));
      }
    })();
    return () => {
      cancelled = true;
      Object.values(next).forEach((u) => URL.revokeObjectURL(u));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  return { urls, ready };
}

// ─── Compile all modal ────────────────────────────────────────────────────────

interface CompileEntry { stem: string; debug: ExtractionDebug; }

function buildPlainText(entries: CompileEntry[]): string {
  const lines: string[] = [];
  for (const { stem, debug } of entries) {
    lines.push(`${'='.repeat(80)}`);
    lines.push(`PRANCHA: ${stem}`);
    lines.push(`${'='.repeat(80)}`);
    const nConf = debug.n_itens_confirmados ?? 0;
    const nAgu  = debug.n_itens_aguardando ?? 0;
    lines.push(`Confirmados: ${nConf}  |  Aguardando: ${nAgu}  |  PDF bruto: ${debug.pdf_n_raw_lines ?? 0} linhas`);
    lines.push('');
    if (debug.pdf_raw_lines?.length) {
      lines.push('--- PDF BRUTO ---');
      lines.push(...debug.pdf_raw_lines);
      lines.push('');
    }
    if (debug.pdf_items_confirmados?.length) {
      lines.push(`--- ITENS CONFIRMADOS (${debug.pdf_items_confirmados.length}) ---`);
      for (const it of debug.pdf_items_confirmados) {
        const qty = it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}`.trim() : '?';
        lines.push(`  ${it.descricao ?? '—'}  |  ${qty}  |  ${it.categoria ?? ''}  |  ${Math.round((it.confianca ?? 0) * 100)}%`);
      }
      lines.push('');
    }
    if (debug.pdf_items_parciais?.length) {
      lines.push(`--- ITENS AGUARDANDO (${debug.pdf_items_parciais.length}) ---`);
      for (const it of debug.pdf_items_parciais) {
        const qty = it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}`.trim() : '?';
        lines.push(`  ${it.descricao ?? '—'}  |  ${qty}  |  ${it.categoria ?? ''}  |  ${Math.round((it.confianca ?? 0) * 100)}%`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function CompileAllModal({ entries, onClose }: { entries: CompileEntry[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<'bruto' | 'confirmados' | 'aguardando' | 'tudo'>('tudo');
  const plainText = useMemo(() => buildPlainText(entries), [entries]);
  const filtered  = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? entries.filter((e) => e.stem.toLowerCase().includes(q)) : entries;
  }, [entries, search]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const totalConf = entries.reduce((s, e) => s + (e.debug.n_itens_confirmados ?? 0), 0);
  const totalAgu  = entries.reduce((s, e) => s + (e.debug.n_itens_aguardando ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[93vh]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-white">Compilar Tudo</span>
            <span className="text-xs text-zinc-500">{entries.length} pranchas · {totalConf} conf · {totalAgu} agu</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { navigator.clipboard.writeText(plainText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition-colors"
            >
              {copied ? '✓ Copiado' : '⎘ Copiar tudo'}
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none px-1">✕</button>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-zinc-800 shrink-0 flex-wrap">
          <input
            type="text" placeholder="Filtrar por prancha…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-600 text-zinc-200 placeholder-zinc-500 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-1">
            {(['tudo', 'bruto', 'confirmados', 'aguardando'] as const).map((s) => (
              <button key={s} onClick={() => setActiveSection(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  activeSection === s ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}>
                {s === 'tudo' ? 'Tudo' : s === 'bruto' ? 'PDF Bruto' : s === 'confirmados' ? 'Confirmados' : 'Aguardando'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {filtered.map(({ stem, debug }) => {
            const nConf = debug.n_itens_confirmados ?? 0;
            const nAgu  = debug.n_itens_aguardando ?? 0;
            return (
              <div key={stem} className="border border-zinc-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-zinc-800 border-b border-zinc-700">
                  <span className="text-xs font-mono font-bold text-zinc-200 truncate">{stem}</span>
                  <div className="flex gap-2 text-xs shrink-0">
                    <span className="bg-green-900/50 text-green-300 rounded px-2 py-0.5 font-medium">{nConf} conf</span>
                    <span className="bg-amber-900/50 text-amber-300 rounded px-2 py-0.5 font-medium">{nAgu} agu</span>
                    <span className="bg-zinc-700 text-zinc-400 rounded px-2 py-0.5">{debug.pdf_n_raw_lines ?? 0} linhas</span>
                  </div>
                </div>
                <div className="p-3 flex flex-col gap-3 bg-zinc-900">
                  {(activeSection === 'tudo' || activeSection === 'bruto') && (
                    <details open={activeSection === 'bruto'}>
                      <summary className="text-xs font-semibold text-zinc-400 cursor-pointer select-none hover:text-zinc-200 mb-1.5">
                        PDF Bruto ({debug.pdf_n_raw_lines ?? 0} linhas)
                      </summary>
                      <pre className="text-[11px] font-mono bg-zinc-950 text-zinc-300 rounded-lg p-3 overflow-x-auto max-h-60 leading-relaxed">
                        {debug.pdf_raw_lines?.join('\n') || '(vazio)'}
                      </pre>
                    </details>
                  )}
                  {(activeSection === 'tudo' || activeSection === 'confirmados') && (
                    <details open={activeSection === 'confirmados' || nConf > 0}>
                      <summary className="text-xs font-semibold text-green-400 cursor-pointer select-none hover:text-green-300 mb-1.5">
                        Itens Confirmados ({nConf})
                      </summary>
                      {debug.pdf_items_confirmados?.length ? (
                        <div className="flex flex-col gap-1">
                          {debug.pdf_items_confirmados.map((it, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs bg-green-950/40 border border-green-900/40 rounded-lg px-3 py-1.5">
                              <span className="font-medium text-zinc-200 flex-1 min-w-0">{it.descricao ?? '—'}</span>
                              <span className="text-zinc-400 shrink-0">{it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}`.trim() : '?'}</span>
                              <span className="text-zinc-500 shrink-0">{it.categoria ?? ''}</span>
                              <span className="text-green-400 font-medium shrink-0">{Math.round((it.confianca ?? 0) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-zinc-500 italic pl-2">Nenhum item</p>}
                    </details>
                  )}
                  {(activeSection === 'tudo' || activeSection === 'aguardando') && (
                    <details open={activeSection === 'aguardando'}>
                      <summary className="text-xs font-semibold text-amber-400 cursor-pointer select-none hover:text-amber-300 mb-1.5">
                        Itens Aguardando ({nAgu})
                      </summary>
                      {debug.pdf_items_parciais?.length ? (
                        <div className="flex flex-col gap-1">
                          {debug.pdf_items_parciais.map((it, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs bg-amber-950/40 border border-amber-900/40 rounded-lg px-3 py-1.5">
                              <span className="font-medium text-zinc-200 flex-1 min-w-0">{it.descricao ?? '—'}</span>
                              <span className="text-zinc-400 shrink-0">{it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}`.trim() : '?'}</span>
                              <span className="text-zinc-500 shrink-0">{it.categoria ?? ''}</span>
                              <span className="text-amber-400 font-medium shrink-0">{Math.round((it.confianca ?? 0) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-zinc-500 italic pl-2">Nenhum item</p>}
                    </details>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-10">Nenhuma prancha encontrada</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({ url, stem, isPdf, onClose }: { url: string; stem: string; isPdf: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <span className="text-sm font-mono text-zinc-300 truncate">{stem}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none px-2">✕</button>
        </div>
        <div className="flex-1 overflow-auto bg-zinc-950 flex items-start justify-center p-2">
          {isPdf
            ? <iframe src={url} className="w-full h-[75vh] border-0" title={stem} />
            : <img src={url} alt={stem} className="max-w-full object-contain" />}
        </div>
      </div>
    </div>
  );
}

// ─── Prancha card ──────────────────────────────────────────────────────────────

function PranchaCard({
  group, result, loading, index, previewUrl, previewReady, onDebug,
}: {
  group: PranchaGroup | null;
  result: PranchaExtractResult | null;
  loading: boolean;
  index: number;
  previewUrl?: string;
  previewReady?: boolean;
  onDebug?: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const displayStem = group?.stem ?? result?.stem ?? `prancha-${index + 1}`;
  const isPdf = !group?.imageFile && !!group?.pdfFile;

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-blue-700/50 bg-blue-950/30 rounded-xl">
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-sm text-blue-300 font-medium font-mono truncate">{displayStem}</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-zinc-700 bg-zinc-800/30 rounded-xl opacity-40">
        <span className="w-4 h-4 rounded-full border border-zinc-600 inline-block flex-shrink-0" />
        <span className="text-sm text-zinc-500 font-mono truncate">{displayStem}</span>
      </div>
    );
  }

  return (
    <>
      {showPreview && previewUrl && (
        <PreviewModal url={previewUrl} stem={displayStem} isPdf={isPdf} onClose={() => setShowPreview(false)} />
      )}
      <div className={`px-4 py-3 border rounded-xl ${result.ok ? 'bg-zinc-800/50 border-zinc-700' : 'bg-red-950/30 border-red-800/60'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`text-sm font-bold flex-shrink-0 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
              {result.ok ? '✓' : '✕'}
            </span>
            <span className="font-mono text-xs text-zinc-300 truncate max-w-xs">{displayStem}</span>
            {result.fontes.pdf   && <span className="px-1.5 py-0.5 text-xs rounded border bg-green-900/40 border-green-700 text-green-300 font-medium">PDF</span>}
            {result.fontes.dxf   && <span className="px-1.5 py-0.5 text-xs rounded border bg-blue-900/40 border-blue-700 text-blue-300 font-medium">DXF</span>}
            {result.fontes.image && <span className="px-1.5 py-0.5 text-xs rounded border bg-purple-900/40 border-purple-700 text-purple-300 font-medium">PNG</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {result.n_itens_extraidos > 0 && (
              <span className="text-xs text-zinc-400">
                {result.n_itens_extraidos} {result.n_itens_extraidos === 1 ? 'item' : 'itens'}
              </span>
            )}
            {onDebug && (
              <button onClick={onDebug}
                className="px-2 py-0.5 text-xs rounded border border-purple-700/60 bg-purple-900/30 text-purple-300 hover:bg-purple-900/60 transition-colors"
                title="Ver extração detalhada">
                🔍 Debug
              </button>
            )}
            {previewUrl && (
              <button onClick={() => setShowPreview(true)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  previewReady || isPdf
                    ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-700 cursor-pointer'
                    : 'border-zinc-700 text-zinc-600 cursor-wait'
                }`}
                title={previewReady || isPdf ? 'Ver imagem' : 'Carregando…'}>
                {isPdf ? 'Ver PDF' : (previewReady ? 'Ver Imagem' : 'Carregando…')}
              </button>
            )}
            <span className={`px-2 py-0.5 text-xs rounded-full border font-semibold ${CLASS_COLOR[result.classificacao] ?? CLASS_COLOR.SEM_CONTEUDO}`}>
              {CLASS_LABEL[result.classificacao] ?? result.classificacao}
            </span>
          </div>
        </div>
        {result.error && (
          <p className="mt-2 text-xs text-red-400 font-mono bg-red-950/40 rounded px-2 py-1">{result.error}</p>
        )}
      </div>
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function StepExtract({
  groups, existingResults, onExtractDone, onRunAI, onNavigate, onExportSession,
}: {
  groups: PranchaGroup[];
  existingResults: PranchaExtractResult[];
  onExtractDone: (results: PranchaExtractResult[]) => void;
  onRunAI: () => void;
  onNavigate: (step: Step) => void;
  onExportSession?: () => void;
}) {
  const hasExisting = existingResults.length > 0;
  const [phase,   setPhase]   = useState<'idle' | 'running' | 'done' | 'error'>(hasExisting ? 'done' : 'idle');
  const [results, setResults] = useState<(PranchaExtractResult | null)[]>(
    hasExisting ? existingResults : Array(groups.length).fill(null),
  );
  const [current, setCurrent] = useState(-1);
  const [debugTarget, setDebugTarget] = useState<{ stem: string; debug: ExtractionDebug } | null>(null);
  const [compileOpen, setCompileOpen] = useState(false);
  const { urls: previewUrls, ready: previewReady } = useImageUrls(groups);

  const run = async () => {
    if (groups.length === 0) return;
    setPhase('running');
    const fresh: (PranchaExtractResult | null)[] = Array(groups.length).fill(null);
    setResults([...fresh]);

    for (let i = 0; i < groups.length; i++) {
      setCurrent(i);
      const g = groups[i];
      if (!g.imageFile && !g.pdfFile && !g.dxfFile) {
        fresh[i] = { stem: g.stem, ok: true, classificacao: 'SEM_CONTEUDO', precisa_ia: false,
          n_itens_extraidos: 0, fontes: { pdf: false, dxf: false, image: false },
          debug: { motivo: 'Nenhum arquivo reconhecido neste grupo' } };
        setResults([...fresh]);
        continue;
      }
      try {
        const fd = new FormData();
        if (g.imageFile) fd.append('image', g.imageFile, g.imageFile.name);
        if (g.pdfFile)   fd.append('pdf',   g.pdfFile,   g.pdfFile.name);
        if (g.dxfFile)   fd.append('dxf',   g.dxfFile,   g.dxfFile.name);
        const res = await fetch('/api/orcamento-construtora/extrair-codigo', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
          fresh[i] = { stem: g.stem, ok: false, classificacao: 'SEM_CONTEUDO', precisa_ia: true,
            n_itens_extraidos: 0, fontes: { pdf: !!g.pdfFile, dxf: !!g.dxfFile, image: !!g.imageFile },
            debug: {}, error: err.error ?? `HTTP ${res.status}` };
        } else {
          const data = await res.json() as Omit<PranchaExtractResult, 'ok' | 'stem'> & { png_base64?: string };

          // Se o backend converteu o PDF para PNG e o grupo não tem imagem, armazena
          if (data.png_base64 && !g.imageFile) {
            try {
              const bin  = atob(data.png_base64);
              const arr  = new Uint8Array(bin.length);
              for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
              const blob = new Blob([arr], { type: 'image/png' });
              const file = new File([blob], `${g.stem}.png`, { type: 'image/png' });
              imageStore.setImageFile(g.stem, file);
            } catch {
              // falha silenciosa — grupo continua sem imagem
            }
          }

          const { png_base64: _, ...rest } = data;
          fresh[i] = { ...rest, stem: g.stem, ok: true };
        }
      } catch (e) {
        fresh[i] = { stem: g.stem, ok: false, classificacao: 'SEM_CONTEUDO', precisa_ia: true,
          n_itens_extraidos: 0, fontes: { pdf: !!g.pdfFile, dxf: !!g.dxfFile, image: !!g.imageFile },
          debug: {}, error: e instanceof Error ? e.message : String(e) };
      }
      setResults([...fresh]);
    }

    setCurrent(-1);
    setPhase('done');
    onExtractDone(fresh.filter(Boolean) as PranchaExtractResult[]);
  };

  useEffect(() => {
    if (!hasExisting && groups.length > 0) run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDone        = phase === 'done';
  const finalResults  = isDone ? (results.filter(Boolean) as PranchaExtractResult[]) : [];
  const needsAI       = finalResults.filter((r) => r.precisa_ia).length;
  const noAI          = finalResults.filter((r) => !r.precisa_ia).length;
  const withErrors    = finalResults.filter((r) => !r.ok).length;

  return (
    <div className="flex flex-col gap-5">
      {debugTarget && (
        <ExtractionDebugModal stem={debugTarget.stem} debug={debugTarget.debug} onClose={() => setDebugTarget(null)} />
      )}
      {compileOpen && (
        <CompileAllModal
          entries={results.filter((r): r is PranchaExtractResult => !!r?.debug)
            .map((r) => ({ stem: r.stem, debug: r.debug as ExtractionDebug }))}
          onClose={() => setCompileOpen(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-white">Passo 2 — Extração por Código</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {groups.length} {groups.length === 1 ? 'prancha' : 'pranchas'} · sem chamada de IA
          </p>
        </div>
        {phase === 'running' && (
          <div className="flex flex-col gap-1 items-end">
            <span className="text-xs text-zinc-400">{current + 1} / {groups.length}</span>
            <div className="w-40 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${((current + 1) / groups.length) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Lista de pranchas */}
      <div className="flex flex-col gap-2">
        {results.map((r, i) => {
          const g = groups[i];
          const stem = g?.stem ?? r?.stem ?? `prancha-${i + 1}`;
          return (
            <PranchaCard key={i} group={g ?? null} result={r} loading={phase === 'running' && i === current}
              index={i} previewUrl={g ? previewUrls[g.stem] : undefined}
              previewReady={g ? !!previewReady[g.stem] : false}
              onDebug={r?.debug ? () => setDebugTarget({ stem, debug: r.debug as ExtractionDebug }) : undefined}
            />
          );
        })}
      </div>

      {/* Resumo */}
      {isDone && finalResults.length > 0 && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-sm">
          <span className="text-green-400">
            <span className="font-bold">{finalResults.length}</span> pranchas extraídas por código
          </span>
          {withErrors > 0 && <span className="text-red-400"><span className="font-bold">{withErrors}</span> com erro</span>}
          <span className="text-zinc-500">· IA vai analisar todas no Passo 3</span>
        </div>
      )}

      {/* Banner salvar */}
      {isDone && finalResults.length > 0 && onExportSession && (
        <div className="flex items-center justify-between gap-4 bg-indigo-950/50 border border-indigo-800/60 rounded-xl px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-indigo-200">💾 Salve antes de continuar</p>
            <p className="text-xs text-indigo-400">
              Baixa um arquivo JSON com os {finalResults.length} resultados. Pode importar depois e ir direto para a IA.
            </p>
          </div>
          <button onClick={onExportSession}
            className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 active:scale-95 transition-all whitespace-nowrap">
            Salvar sessão ↓
          </button>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3 items-center pt-1">
        <button onClick={run} disabled={phase === 'running' || groups.length === 0}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          {phase === 'running' ? `Extraindo ${current + 1}/${groups.length}…` : isDone ? 'Re-extrair por Código' : 'Extrair por Código →'}
        </button>
        {isDone && (
          <button onClick={onRunAI}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 active:scale-95 transition-all">
            {`Analisar com IA (${finalResults.length} ${finalResults.length === 1 ? 'prancha' : 'pranchas'}) →`}
          </button>
        )}
        {isDone && needsAI === 0 && noAI > 0 && (
          <button onClick={() => onNavigate(4)}
            className="px-5 py-2.5 border border-zinc-600 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800 active:scale-95 transition-all">
            Pular IA → Revisão
          </button>
        )}
        {results.some((r) => !!r?.debug) && (
          <button onClick={() => setCompileOpen(true)}
            className="px-5 py-2.5 border border-zinc-600 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800 active:scale-95 transition-all">
            Compilar debug
          </button>
        )}
      </div>
    </div>
  );
}
