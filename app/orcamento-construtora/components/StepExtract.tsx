'use client';

import { useState, useEffect, useRef } from 'react';
import type { PranchaGroup } from '@/lib/orcamento-construtora/image-store';
import type { PranchaExtractResult, Step } from '@/hooks/useOrcamentoSession';

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

function DebugAccordion({ debug, error }: { debug: Record<string, unknown>; error?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
      >
        {open ? '▲ ocultar log' : '▼ ver log de debug'}
      </button>
      {open && (
        <pre className="mt-2 text-xs bg-gray-900 text-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {error && `ERRO: ${error}\n\n`}
          {JSON.stringify(debug, null, 2)}
        </pre>
      )}
    </div>
  );
}

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
}: {
  group: PranchaGroup | null;
  result: PranchaExtractResult | null;
  loading: boolean;
  index: number;
  previewUrl?: string;
  previewReady?: boolean;
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
                {result.n_itens_extraidos} {result.n_itens_extraidos === 1 ? 'item' : 'itens'} extraídos
              </span>
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

        <DebugAccordion debug={result.debug} error={result.error} />
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
          return (
            <PranchaCard
              key={i}
              group={g ?? null}
              result={r}
              loading={phase === 'running' && i === current}
              index={i}
              previewUrl={g ? previewUrls[g.stem] : undefined}
              previewReady={g ? !!previewReady[g.stem] : false}
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
      </div>
    </div>
  );
}
