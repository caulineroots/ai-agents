'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { PranchaGroup } from '@/lib/orcamento-construtora/image-store';
import type { PranchaExtractResult, Step } from '@/hooks/useOrcamentoSession';
import { ExtractionDebugModal, type ExtractionDebug } from './ExtractionDebugModal';

const CLASS_LABEL: Record<string, string> = {
  DIRETO:        'Extração direta',
  IA_AUDITORIA:  'IA recomendada',
  IA_NECESSARIA: 'IA obrigatória',
  SEM_CONTEUDO:  'Sem conteúdo',
};
const CLASS_COLOR: Record<string, string> = {
  DIRETO:        'bg-green-100 text-green-700 border-green-300',
  IA_AUDITORIA:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  IA_NECESSARIA: 'bg-red-100 text-red-700 border-red-300',
  SEM_CONTEUDO:  'bg-gray-100 text-gray-500 border-gray-300',
};

/**
 * Cria Object URLs e força o decode de cada imagem no background
 * via img.decode() — quando o modal abrir, a imagem já está na cache
 * de pixels do browser e aparece instantaneamente.
 */
function useImageUrls(groups: PranchaGroup[]) {
  const [urls,  setUrls]  = useState<Record<string, string>>({});
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const prevUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    Object.values(prevUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));

    const next: Record<string, string> = {};
    const isPng: Record<string, boolean> = {};

    for (const g of groups) {
      if (g.imageFile) {
        next[g.stem]  = URL.createObjectURL(g.imageFile);
        isPng[g.stem] = true;
      } else if (g.pdfFile) {
        next[g.stem]  = URL.createObjectURL(g.pdfFile);
        isPng[g.stem] = false;
      }
    }

    prevUrlsRef.current = next;
    setUrls(next);

    // Força decode de todas as imagens PNG em paralelo, uma a uma,
    // para não explodir a memória com 27 imagens simultâneas
    const stems = Object.keys(next).filter((s) => isPng[s]);
    let cancelled = false;

    (async () => {
      for (const stem of stems) {
        if (cancelled) break;
        const img = new window.Image();
        img.src = next[stem];
        try {
          await img.decode();         // decode completo antes de continuar
          if (!cancelled) setReady((r) => ({ ...r, [stem]: true }));
        } catch {
          if (!cancelled) setReady((r) => ({ ...r, [stem]: true })); // falhou mas mostra mesmo assim
        }
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


// ─── Compilar Tudo ─────────────────────────────────────────────────────────────

interface CompileEntry {
  stem: string;
  debug: ExtractionDebug;
}

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

    // PDF Bruto
    if (debug.pdf_raw_lines?.length) {
      lines.push('--- PDF BRUTO ---');
      lines.push(...debug.pdf_raw_lines);
      lines.push('');
    }

    // Itens Confirmados
    if (debug.pdf_items_confirmados?.length) {
      lines.push(`--- ITENS CONFIRMADOS (${debug.pdf_items_confirmados.length}) ---`);
      for (const it of debug.pdf_items_confirmados) {
        const qty = it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}`.trim() : '?';
        lines.push(`  ${it.descricao ?? '—'}  |  ${qty}  |  ${it.categoria ?? ''}  |  ${Math.round((it.confianca ?? 0) * 100)}%`);
      }
      lines.push('');
    } else {
      lines.push('--- ITENS CONFIRMADOS (0) ---');
      lines.push('  Nenhum item');
      lines.push('');
    }

    // Itens Aguardando
    if (debug.pdf_items_parciais?.length) {
      lines.push(`--- ITENS AGUARDANDO (${debug.pdf_items_parciais.length}) ---`);
      for (const it of debug.pdf_items_parciais) {
        const qty = it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}`.trim() : '?';
        lines.push(`  ${it.descricao ?? '—'}  |  ${qty}  |  ${it.categoria ?? ''}  |  ${Math.round((it.confianca ?? 0) * 100)}%`);
      }
      lines.push('');
    } else {
      lines.push('--- ITENS AGUARDANDO (0) ---');
      lines.push('  Nenhum item');
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? entries.filter((e) => e.stem.toLowerCase().includes(q)) : entries;
  }, [entries, search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = () => {
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const totalConf = entries.reduce((s, e) => s + (e.debug.n_itens_confirmados ?? 0), 0);
  const totalAgu  = entries.reduce((s, e) => s + (e.debug.n_itens_aguardando ?? 0), 0);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[93vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-gray-800">Compilar Tudo</span>
            <span className="text-xs text-gray-400">{entries.length} pranchas · {totalConf} conf · {totalAgu} agu</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              {copied ? '✓ Copiado' : '⎘ Copiar tudo'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1">✕</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 shrink-0 flex-wrap">
          <input
            type="text"
            placeholder="Filtrar por prancha…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex gap-1">
            {(['tudo', 'bruto', 'confirmados', 'aguardando'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  activeSection === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'tudo' ? 'Tudo' : s === 'bruto' ? 'PDF Bruto' : s === 'confirmados' ? 'Confirmados' : 'Aguardando'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {filtered.map(({ stem, debug }) => {
            const nConf = debug.n_itens_confirmados ?? 0;
            const nAgu  = debug.n_itens_aguardando ?? 0;
            return (
              <div key={stem} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Prancha header */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-mono font-bold text-gray-700 truncate">{stem}</span>
                  <div className="flex gap-2 text-xs shrink-0">
                    <span className="bg-green-100 text-green-700 rounded px-2 py-0.5 font-medium">{nConf} conf</span>
                    <span className="bg-amber-100 text-amber-700 rounded px-2 py-0.5 font-medium">{nAgu} agu</span>
                    <span className="bg-gray-100 text-gray-500 rounded px-2 py-0.5">{debug.pdf_n_raw_lines ?? 0} linhas</span>
                  </div>
                </div>

                <div className="p-3 flex flex-col gap-3">
                  {/* PDF Bruto */}
                  {(activeSection === 'tudo' || activeSection === 'bruto') && (
                    <details open={activeSection === 'bruto'}>
                      <summary className="text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-700 mb-1.5">
                        PDF Bruto ({debug.pdf_n_raw_lines ?? 0} linhas)
                      </summary>
                      <pre className="text-[11px] font-mono bg-gray-950 text-gray-100 rounded-lg p-3 overflow-x-auto max-h-60 leading-relaxed">
                        {debug.pdf_raw_lines?.join('\n') || '(vazio)'}
                      </pre>
                    </details>
                  )}

                  {/* Confirmados */}
                  {(activeSection === 'tudo' || activeSection === 'confirmados') && (
                    <details open={activeSection === 'confirmados' || nConf > 0}>
                      <summary className="text-xs font-semibold text-green-700 cursor-pointer select-none hover:text-green-900 mb-1.5">
                        Itens Confirmados ({nConf})
                      </summary>
                      {debug.pdf_items_confirmados?.length ? (
                        <div className="flex flex-col gap-1">
                          {debug.pdf_items_confirmados.map((it, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs bg-green-50 rounded-lg px-3 py-1.5">
                              <span className="font-medium text-gray-800 flex-1 min-w-0">{it.descricao ?? '—'}</span>
                              <span className="text-gray-500 shrink-0">{it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}`.trim() : '?'}</span>
                              <span className="text-gray-400 shrink-0">{it.categoria ?? ''}</span>
                              <span className="text-green-600 font-medium shrink-0">{Math.round((it.confianca ?? 0) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic pl-2">Nenhum item</p>
                      )}
                    </details>
                  )}

                  {/* Aguardando */}
                  {(activeSection === 'tudo' || activeSection === 'aguardando') && (
                    <details open={activeSection === 'aguardando'}>
                      <summary className="text-xs font-semibold text-amber-700 cursor-pointer select-none hover:text-amber-900 mb-1.5">
                        Itens Aguardando ({nAgu})
                      </summary>
                      {debug.pdf_items_parciais?.length ? (
                        <div className="flex flex-col gap-1">
                          {debug.pdf_items_parciais.map((it, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs bg-amber-50 rounded-lg px-3 py-1.5">
                              <span className="font-medium text-gray-800 flex-1 min-w-0">{it.descricao ?? '—'}</span>
                              <span className="text-gray-500 shrink-0">{it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}`.trim() : '?'}</span>
                              <span className="text-gray-400 shrink-0">{it.categoria ?? ''}</span>
                              <span className="text-amber-600 font-medium shrink-0">{Math.round((it.confianca ?? 0) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic pl-2">Nenhum item</p>
                      )}
                    </details>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">Nenhuma prancha encontrada</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preview modal ──────────────────────────────────────────────────────────────

function PreviewModal({ url, stem, isPdf, onClose }: { url: string; stem: string; isPdf: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-mono text-gray-700 truncate">{stem}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">✕</button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-2">
          {isPdf ? (
            <iframe src={url} className="w-full h-[75vh] border-0" title={stem} />
          ) : (
            <img src={url} alt={stem} className="max-w-full object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

function PranchaCard({
  group,
  result,
  loading,
  index,
  previewUrl,
  previewReady,
  onDebug,
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
  // Usa sempre o stem do grupo (client-side), não o retornado pelo Python
  const displayStem = group?.stem ?? result?.stem ?? `prancha-${index + 1}`;
  const isPdf = !group?.imageFile && !!group?.pdfFile;

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-blue-200 bg-blue-50 rounded-xl">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-sm text-blue-700 font-medium font-mono truncate">{displayStem}</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl opacity-40">
        <span className="w-4 h-4 rounded-full border border-gray-300 inline-block flex-shrink-0" />
        <span className="text-sm text-gray-400 font-mono truncate">{displayStem}</span>
      </div>
    );
  }

  return (
    <>
      {showPreview && previewUrl && (
        <PreviewModal url={previewUrl} stem={displayStem} isPdf={isPdf} onClose={() => setShowPreview(false)} />
      )}

      <div className={`px-4 py-3 border rounded-xl ${result.ok ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">

          {/* Nome + fontes */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`text-sm font-bold flex-shrink-0 ${result.ok ? 'text-green-600' : 'text-red-500'}`}>
              {result.ok ? '✓' : '✕'}
            </span>
            <span className="font-mono text-xs text-gray-700 truncate max-w-xs">{displayStem}</span>
            {result.fontes.pdf   && <span className="px-1.5 py-0.5 text-xs rounded border bg-green-50 border-green-300 text-green-700 font-medium">PDF</span>}
            {result.fontes.dxf   && <span className="px-1.5 py-0.5 text-xs rounded border bg-blue-50 border-blue-300 text-blue-700 font-medium">DXF</span>}
            {result.fontes.image && <span className="px-1.5 py-0.5 text-xs rounded border bg-purple-50 border-purple-300 text-purple-700 font-medium">PNG</span>}
          </div>

          {/* Ações + classificação */}
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            {result.n_itens_extraidos > 0 && (
              <span className="text-xs text-gray-500">
                {result.n_itens_extraidos} {result.n_itens_extraidos === 1 ? 'item' : 'itens'}
              </span>
            )}
            {onDebug && (
              <button
                onClick={onDebug}
                className="px-2 py-0.5 text-xs rounded border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                title="Ver extração detalhada"
              >
                🔍 Debug
              </button>
            )}
            {previewUrl && (
              <button
                onClick={() => setShowPreview(true)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  previewReady || isPdf
                    ? 'border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer'
                    : 'border-gray-200 text-gray-300 cursor-wait'
                }`}
                title={previewReady || isPdf ? 'Ver imagem' : 'Carregando…'}
              >
                {isPdf ? 'Ver PDF' : (previewReady ? 'Ver Imagem' : 'Carregando…')}
              </button>
            )}
            <span className={`px-2 py-0.5 text-xs rounded-full border font-semibold ${CLASS_COLOR[result.classificacao] ?? 'bg-gray-100 text-gray-500'}`}>
              {CLASS_LABEL[result.classificacao] ?? result.classificacao}
            </span>
          </div>
        </div>

        {result.error && (
          <p className="mt-2 text-xs text-red-600 font-mono bg-red-50 rounded px-2 py-1">{result.error}</p>
        )}
      </div>
    </>
  );
}

export function StepExtract({
  groups,
  existingResults,
  onExtractDone,
  onRunAI,
  onNavigate,
  onExportSession,
}: {
  groups: PranchaGroup[];
  existingResults: PranchaExtractResult[];
  onExtractDone: (results: PranchaExtractResult[]) => void;
  onRunAI: () => void;
  onNavigate: (step: Step) => void;
  onExportSession?: () => void;
}) {
  const hasExisting = existingResults.length > 0;
  const [phase,     setPhase]    = useState<'idle' | 'running' | 'done' | 'error'>(hasExisting ? 'done' : 'idle');
  const [results,   setResults]  = useState<(PranchaExtractResult | null)[]>(
    hasExisting ? existingResults : Array(groups.length).fill(null),
  );
  const [current,   setCurrent]  = useState(-1);

  const [debugTarget,   setDebugTarget]   = useState<{ stem: string; debug: ExtractionDebug } | null>(null);
  const [compileOpen,   setCompileOpen]   = useState(false);

  // Pré-carrega e decodifica todas as imagens no background
  const { urls: previewUrls, ready: previewReady } = useImageUrls(groups);

  const run = async () => {
    if (groups.length === 0) return;
    setPhase('running');
    const fresh: (PranchaExtractResult | null)[] = Array(groups.length).fill(null);
    setResults([...fresh]);

    for (let i = 0; i < groups.length; i++) {
      setCurrent(i);
      const g = groups[i];

      // Grupo sem arquivos reconhecidos — registra como sem conteúdo
      if (!g.imageFile && !g.pdfFile && !g.dxfFile) {
        fresh[i] = {
          stem: g.stem, ok: true,
          classificacao: 'SEM_CONTEUDO', precisa_ia: false,
          n_itens_extraidos: 0,
          fontes: { pdf: false, dxf: false, image: false },
          debug: { motivo: 'Nenhum arquivo reconhecido neste grupo' },
        };
        setResults([...fresh]);
        continue;
      }

      try {
        const fd = new FormData();
        if (g.imageFile) fd.append('image', g.imageFile, g.imageFile.name);
        if (g.pdfFile)   fd.append('pdf',   g.pdfFile,   g.pdfFile.name);
        if (g.dxfFile)   fd.append('dxf',   g.dxfFile,   g.dxfFile.name);

        const res = await fetch('/api/orcamento-construtora/extrair-codigo', {
          method: 'POST',
          body: fd,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
          fresh[i] = {
            stem: g.stem, ok: false,
            classificacao: 'SEM_CONTEUDO', precisa_ia: true,
            n_itens_extraidos: 0,
            fontes: { pdf: !!g.pdfFile, dxf: !!g.dxfFile, image: !!g.imageFile },
            debug: {}, error: err.error ?? `HTTP ${res.status}`,
          };
        } else {
          const data = await res.json() as Omit<PranchaExtractResult, 'ok' | 'stem'>;
          // Mantém o stem do cliente para consistência
          fresh[i] = { ...data, stem: g.stem, ok: true };
        }
      } catch (e) {
        fresh[i] = {
          stem: g.stem, ok: false,
          classificacao: 'SEM_CONTEUDO', precisa_ia: true,
          n_itens_extraidos: 0,
          fontes: { pdf: !!g.pdfFile, dxf: !!g.dxfFile, image: !!g.imageFile },
          debug: {}, error: e instanceof Error ? e.message : String(e),
        };
      }

      setResults([...fresh]);
    }

    setCurrent(-1);
    setPhase('done');
    onExtractDone(fresh.filter(Boolean) as PranchaExtractResult[]);
  };

  // Auto-executa ao montar se não há resultados ainda
  useEffect(() => {
    if (!hasExisting && groups.length > 0) {
      run();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDone = phase === 'done';
  const finalResults = isDone ? (results.filter(Boolean) as PranchaExtractResult[]) : [];
  const needsAI    = finalResults.filter((r) => r.precisa_ia).length;
  const noAI       = finalResults.filter((r) => !r.precisa_ia).length;
  const withErrors = finalResults.filter((r) => !r.ok).length;

  return (
    <div className="flex flex-col gap-5">
      {debugTarget && (
        <ExtractionDebugModal
          stem={debugTarget.stem}
          debug={debugTarget.debug}
          onClose={() => setDebugTarget(null)}
        />
      )}

      {compileOpen && (
        <CompileAllModal
          entries={results
            .filter((r): r is PranchaExtractResult => !!r?.debug)
            .map((r) => ({ stem: r.stem, debug: r.debug as ExtractionDebug }))}
          onClose={() => setCompileOpen(false)}
        />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Passo 2 — Extração por Código</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {groups.length} {groups.length === 1 ? 'prancha' : 'pranchas'} · sem chamada de IA
          </p>
        </div>

        {/* Barra de progresso */}
        {phase === 'running' && (
          <div className="flex flex-col gap-1 items-end">
            <span className="text-xs text-gray-500">{current + 1} / {groups.length}</span>
            <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${((current + 1) / groups.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cards por prancha */}
      <div className="flex flex-col gap-2">
        {results.map((r, i) => {
          const g = groups[i];
          const stem = g?.stem ?? r?.stem ?? `prancha-${i + 1}`;
          return (
            <PranchaCard
              key={i}
              group={g ?? null}
              result={r}
              loading={phase === 'running' && i === current}
              index={i}
              previewUrl={g ? previewUrls[g.stem] : undefined}
              previewReady={g ? !!previewReady[g.stem] : false}
              onDebug={r?.debug ? () => setDebugTarget({ stem, debug: r.debug as ExtractionDebug }) : undefined}
            />
          );
        })}
      </div>

      {/* Resumo após conclusão */}
      {isDone && finalResults.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-sm">
          <span className="text-green-700">
            <span className="font-bold">{finalResults.length}</span> pranchas extraídas por código
          </span>
          {withErrors > 0 && (
            <span className="text-red-600">
              <span className="font-bold">{withErrors}</span> com erro
            </span>
          )}
          <span className="text-gray-500">· IA vai analisar todas no Passo 3</span>
        </div>
      )}

      {/* Banner de salvar — aparece após extração concluída */}
      {isDone && finalResults.length > 0 && onExportSession && (
        <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-blue-800">
              💾 Salve antes de continuar
            </p>
            <p className="text-xs text-blue-600">
              Baixa um arquivo JSON com os {finalResults.length} resultados de extração.
              Você pode importá-lo depois e ir direto para a análise com IA — sem reprocessar.
            </p>
          </div>
          <button
            onClick={onExportSession}
            className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap"
          >
            Salvar sessão ↓
          </button>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3 items-center pt-1">
        <button
          onClick={run}
          disabled={phase === 'running' || groups.length === 0}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {phase === 'running'
            ? `Extraindo ${current + 1}/${groups.length}…`
            : isDone
              ? 'Re-extrair por Código'
              : 'Extrair por Código →'}
        </button>

        {isDone && (
          <button
            onClick={onRunAI}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 active:scale-95 transition-all"
          >
            {`Analisar com IA (${finalResults.length} ${finalResults.length === 1 ? 'prancha' : 'pranchas'}) →`}
          </button>
        )}

        {isDone && needsAI === 0 && noAI > 0 && (
          <button
            onClick={() => onNavigate(4)}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Pular IA → Revisão
          </button>
        )}

        {results.some((r) => !!r?.debug) && (
          <button
            onClick={() => setCompileOpen(true)}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all"
            title="Ver PDF Bruto + Itens Confirmados + Aguardando de todas as pranchas numa janela só"
          >
            Compilar debug
          </button>
        )}
      </div>
    </div>
  );
}
