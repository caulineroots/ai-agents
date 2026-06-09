'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { FolhaMedicao, ItemMedicao, ResultadoOrcamento } from '@/lib/orcamento/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface PipelineUpdate {
  stage1Output?: string;
  stage2Output?: string;
  folha?: FolhaMedicao;
  resultado?: ResultadoOrcamento;
  tokenLog?: TokenLog;
}

interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface TokenLog {
  stage: string;
  usage: ApiUsage;
  thinking?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Painéis de debug (tokens, logs de chamadas) só aparecem em dev ou quando
// NEXT_PUBLIC_DEV_MODE=true está configurado no ambiente (ex: Vercel env vars).
const IS_DEV =
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
  process.env.NODE_ENV === 'development';

function fmtBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function statusIcon(status: ItemMedicao['status']) {
  if (status === 'confirmado') return '✅';
  if (status === 'parcial') return '⚠';
  return '⛔';
}

// ─── Zoom Modal ───────────────────────────────────────────────────────────────

function ZoomModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-5xl flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium">{label}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none px-2"
          >
            ✕
          </button>
        </div>
        <img
          src={url}
          alt={label}
          className="w-full max-h-[85vh] object-contain rounded-lg"
        />
      </div>
    </div>
  );
}

// ─── Step 1 — Upload ─────────────────────────────────────────────────────────

type UploadPhase = 'idle' | 'loading' | 'reviewing' | 'confirming' | 'converting';

function StepUpload({ onDone }: { onDone: (blobs: Blob[], texts: string[]) => void }) {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pageDataUrl, setPageDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const pageCacheRef = useRef<Map<number, string>>(new Map());
  const currentPageRef = useRef(0);
  const bgRenderingRef = useRef(false);

  // Render a single page to cache (no UI side-effects)
  const renderToCache = useCallback(async (idx: number): Promise<string | null> => {
    if (!pdfDocRef.current || pageCacheRef.current.has(idx)) {
      return pageCacheRef.current.get(idx) ?? null;
    }
    try {
      const page = await pdfDocRef.current.getPage(idx + 1);
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      const url = canvas.toDataURL('image/jpeg', 0.82);
      pageCacheRef.current.set(idx, url);
      return url;
    } catch { return null; }
  }, []);

  // Display a specific page — instant if cached, otherwise render
  const displayPage = useCallback((idx: number) => {
    currentPageRef.current = idx;
    setCurrentPage(idx);
    const cached = pageCacheRef.current.get(idx);
    if (cached) {
      setPageDataUrl(cached);
      setIsRendering(false);
    } else {
      setPageDataUrl(null);
      setIsRendering(true);
      renderToCache(idx).then((url) => {
        if (currentPageRef.current === idx && url) {
          setPageDataUrl(url);
          setIsRendering(false);
        }
      });
    }
  }, [renderToCache]);

  // Navigate and pre-cache neighbours
  const goTo = useCallback((idx: number, total: number) => {
    displayPage(idx);
    // Eagerly pre-cache ±3 pages
    [-1, 1, 2, 3].forEach((offset) => {
      const n = idx + offset;
      if (n >= 0 && n < total && !pageCacheRef.current.has(n)) {
        setTimeout(() => renderToCache(n), Math.abs(offset) * 30);
      }
    });
  }, [displayPage, renderToCache]);

  // Background render all pages silently
  const startBgRender = useCallback(async (total: number) => {
    if (bgRenderingRef.current) return;
    bgRenderingRef.current = true;
    for (let i = 0; i < total; i++) {
      if (!pageCacheRef.current.has(i)) {
        await renderToCache(i);
        await new Promise((r) => setTimeout(r, 8)); // yield to UI thread
      }
    }
    bgRenderingRef.current = false;
  }, [renderToCache]);

  const loadPDF = useCallback(async (file: File) => {
    setPhase('loading');
    setError('');
    pageCacheRef.current.clear();
    bgRenderingRef.current = false;
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      pdfDocRef.current = pdf;
      const total = pdf.numPages;
      setTotalPages(total);
      setSelected(new Set(Array.from({ length: total }, (_, i) => i)));
      currentPageRef.current = 0;
      setCurrentPage(0);

      // Render page 0 synchronously before showing UI
      setIsRendering(true);
      const url = await renderToCache(0);
      setPageDataUrl(url);
      setIsRendering(false);
      setPhase('reviewing');

      // Pre-cache pages 1-4 immediately, then rest in background
      for (let i = 1; i <= Math.min(4, total - 1); i++) {
        await renderToCache(i);
      }
      startBgRender(total); // fire and forget
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar PDF');
      setPhase('idle');
    }
  }, [renderToCache, startBgRender]);

  const convertSelected = useCallback(() => {
    setPhase('confirming');
  }, []);

  const startConversion = useCallback(async () => {
    setPhase('converting');
    setError('');
    try {
      const pdf = pdfDocRef.current;
      const sortedSelected = [...selected].sort((a, b) => a - b);
      const blobs: Blob[] = [];
      const texts: string[] = [];
      for (let j = 0; j < sortedSelected.length; j++) {
        setProgress(`Convertendo ${j + 1} de ${sortedSelected.length}...`);
        const page = await pdf.getPage(sortedSelected[j] + 1);

        // Extract text layer (camada de texto do PDF — valores exatos das cotas)
        try {
          const textContent = await page.getTextContent();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const text = textContent.items.map((item: any) => item.str).filter((s: string) => s.trim()).join(' | ');
          texts.push(text);
        } catch {
          texts.push('');
        }

        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.82);
        });
        blobs.push(blob);
      }
      onDone(blobs, texts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na conversão');
      setPhase('confirming');
    }
  }, [selected, onDone]);

  // Action: decide for current page and advance
  const decide = useCallback((include: boolean) => {
    // Capture index NOW — goTo() below mutates currentPageRef before setSelected runs
    const pageIdx = currentPageRef.current;
    setSelected((prev) => {
      const next = new Set(prev);
      if (include) next.add(pageIdx);
      else next.delete(pageIdx);
      return next;
    });
    const next = pageIdx + 1;
    if (next < totalPages) goTo(next, totalPages);
  }, [totalPages, goTo]);

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Envie um arquivo PDF.'); return; }
    loadPDF(file);
  };

  // ── Phase: idle ──────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-xl font-semibold text-gray-800">Passo 1 — Upload do Projeto</h2>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Envie o caderno executivo em PDF. O arquivo será convertido no seu navegador — nenhum dado é armazenado.
        </p>
        <div
          className={`w-full max-w-md border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="text-4xl">📄</span>
          <p className="text-sm text-gray-600 font-medium">Arraste o PDF aqui ou clique para selecionar</p>
          <p className="text-xs text-gray-400">Apenas arquivos .pdf</p>
          <input ref={inputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Carregando PDF...</p>
      </div>
    );
  }

  if (phase === 'converting') {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-600">{progress || 'Preparando imagens...'}</p>
      </div>
    );
  }

  // ── Phase: confirming ────────────────────────────────────────────────────────
  if (phase === 'confirming') {
    const sortedSelected = [...selected].sort((a, b) => a - b);
    const excluded = totalPages - selected.size;
    return (
      <div className="flex flex-col items-center gap-6 py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-4xl">🔍</span>
          <h2 className="text-xl font-semibold text-gray-900">Pronto para analisar</h2>
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{selected.size}</span> pranchas selecionadas
            {excluded > 0 && <span className="text-gray-400"> · {excluded} ignoradas</span>}
          </p>
        </div>

        {/* Thumbnail strip of selected pages */}
        <div className="flex gap-2 flex-wrap justify-center max-w-md">
          {sortedSelected.map((idx) => {
            const thumb = pageCacheRef.current.get(idx);
            return (
              <div key={idx} className="relative">
                {thumb
                  ? <img src={thumb} alt={`p${idx + 1}`} className="h-16 w-20 object-cover rounded-lg border-2 border-blue-300" />
                  : <div className="h-16 w-20 rounded-lg border-2 border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400">{idx + 1}</div>
                }
                <span className="absolute bottom-1 right-1 bg-blue-500 text-white text-xs font-bold px-1 rounded">
                  {idx + 1}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={startConversion}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            Iniciar análise com IA →
          </button>
          <button
            onClick={() => setPhase('reviewing')}
            className="w-full py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-all"
          >
            ← Voltar e ajustar seleção
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
        )}
      </div>
    );
  }

  // ── Phase: reviewing — full-screen split layout ──────────────────────────────
  const isIncluded = selected.has(currentPage);

  return (
    <div className="fixed inset-0 z-50 flex bg-gray-950">
      {/* LEFT — full image */}
      <div className="relative flex-1 flex items-center justify-center bg-gray-950 overflow-hidden">
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-10 h-10 border-4 border-white/40 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {pageDataUrl && (
          <img
            key={currentPage}
            src={pageDataUrl}
            alt={`Página ${currentPage + 1}`}
            className="w-full h-full object-contain"
          />
        )}
        {/* Page badge */}
        <div className="absolute top-4 left-4 bg-black/60 text-white text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
          {currentPage + 1} / {totalPages}
        </div>
      </div>

      {/* RIGHT — decision panel */}
      <div className="w-[42%] max-w-sm flex flex-col bg-gray-900 border-l border-gray-800">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-semibold text-base">Selecionar Pranchas</h2>
            <button
              onClick={() => { setPhase('idle'); pdfDocRef.current = null; pageCacheRef.current.clear(); }}
              className="text-gray-500 hover:text-gray-300 text-xs border border-gray-700 rounded-lg px-2.5 py-1"
            >
              ← Voltar
            </button>
          </div>
          <p className="text-gray-400 text-xs">
            Página {currentPage + 1} de {totalPages} · {selected.size} selecionadas
          </p>

          {/* Status */}
          <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${
            isIncluded ? 'text-green-400' : 'text-red-400'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${isIncluded ? 'bg-green-400' : 'bg-red-400'}`} />
            {isIncluded ? 'Esta prancha será analisada' : 'Esta prancha será ignorada'}
          </div>
        </div>

        {/* Dot progress */}
        <div className="px-6 py-3 flex flex-wrap gap-1 border-b border-gray-800">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, totalPages)}
              title={`Página ${i + 1}`}
              className={`rounded-full transition-all ${
                i === currentPage
                  ? 'w-3 h-3 bg-white'
                  : selected.has(i)
                  ? 'w-2 h-2 bg-blue-400 hover:bg-blue-300'
                  : 'w-2 h-2 bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>

        {/* Main buttons */}
        <div className="flex-1 flex flex-col gap-4 px-6 py-6">
          <button
            onClick={() => decide(false)}
            className="flex-1 rounded-2xl bg-red-950 border-2 border-red-700 text-red-400 font-bold text-xl hover:bg-red-900 hover:border-red-500 hover:text-red-300 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-2"
          >
            <span className="text-3xl">✗</span>
            Excluir
          </button>
          <button
            onClick={() => decide(true)}
            className="flex-1 rounded-2xl bg-green-950 border-2 border-green-700 text-green-400 font-bold text-xl hover:bg-green-900 hover:border-green-500 hover:text-green-300 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-2"
          >
            <span className="text-3xl">✓</span>
            Incluir
          </button>
        </div>

        {/* Bottom nav */}
        <div className="px-6 pb-6 flex flex-col gap-2 border-t border-gray-800 pt-4">
          <button
            onClick={convertSelected}
            disabled={selected.size === 0}
            className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-40"
          >
            Confirmar {selected.size} pranchas →
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => goTo(currentPage - 1, totalPages)}
              disabled={currentPage === 0}
              className="flex-1 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30 transition-all"
            >
              ← Anterior
            </button>
            <button
              onClick={() => goTo(currentPage + 1, totalPages)}
              disabled={currentPage === totalPages - 1}
              className="flex-1 py-2 rounded-lg border border-gray-700 text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30 transition-all"
            >
              Pular →
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-6 mb-4 text-xs text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Step 2 — Pipeline ────────────────────────────────────────────────────────

async function apiFetchJSON<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const body = await r.json().catch(() => ({})) as { error?: string; detail?: unknown };
    const detail = body.detail ? ` | ${JSON.stringify(body.detail)}` : '';
    throw new Error(`${url} falhou (${r.status}): ${body.error ?? 'sem detalhes'}${detail}`);
  }
  return r.json() as Promise<T>;
}

type ProcessingPhase = 'idle' | 'running' | 'done' | 'error';

function StepProcessing({
  imageBlobs,
  pageTexts,
  stage1Output,
  stage2Output,
  folha,
  resultado,
  tokenLogs,
  onUpdate,
  onNavigate,
}: {
  imageBlobs: Blob[];
  pageTexts: string[];
  stage1Output: string | null;
  stage2Output: string | null;
  folha: FolhaMedicao | null;
  resultado: ResultadoOrcamento | null;
  tokenLogs: TokenLog[];
  onUpdate: (u: PipelineUpdate) => void;
  onNavigate: (step: 3 | 4) => void;
}) {
  const [phase, setPhase] = useState<ProcessingPhase>(resultado ? 'done' : 'idle');
  const [callStep, setCallStep] = useState<1 | 2 | null>(null);
  const [error, setError] = useState('');
  const [openLog, setOpenLog] = useState<1 | 2 | null>(null);

  const PRICE_IN = 3 / 1_000_000;
  const PRICE_OUT = 15 / 1_000_000;

  const run = useCallback(async () => {
    setPhase('running');
    setError('');
    setCallStep(1);
    try {
      const fd = new FormData();
      imageBlobs.forEach((b, i) => {
        fd.append('images', b, `page-${i}.jpg`);
        fd.append('pageTexts', pageTexts[i] ?? '');
      });

      const r = await fetch('/api/orcamento/chamada-controlada', { method: 'POST', body: fd });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Erro ${r.status}`);
      }
      setCallStep(2 as 1 | 2);
      const data = await r.json() as {
        output1: string;
        output2: string;
        folha: FolhaMedicao | null;
        resultado: ResultadoOrcamento | null;
        parseError: string | null;
        usage1: ApiUsage;
        usage2: ApiUsage;
      };
      setCallStep(null);

      onUpdate({ stage1Output: data.output1 });
      onUpdate({ stage2Output: data.output2 });
      if (data.folha) onUpdate({ folha: data.folha });
      if (data.resultado) onUpdate({ resultado: data.resultado });
      onUpdate({ tokenLog: { stage: 'Análise (1/2)', usage: data.usage1 } });
      onUpdate({ tokenLog: { stage: 'Revisão + JSON (2/2)', usage: data.usage2 } });

      if (data.parseError) setError(`Aviso: ${data.parseError}`);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setPhase('error');
    } finally {
      setCallStep(null);
    }
  }, [imageBlobs, pageTexts, onUpdate]);

  const isDone = phase === 'done' || !!resultado;

  const callLabels = [
    'Identificando elementos de mármore nas pranchas...',
    'Revisando medidas e gerando orçamento...',
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Passo 2 — Análise do Projeto</h2>
        {imageBlobs.length > 0 ? (
          <p className="text-sm text-gray-500 mt-1">
            {imageBlobs.length} {imageBlobs.length === 1 ? 'prancha carregada' : 'pranchas carregadas'}.
          </p>
        ) : (
          <p className="text-sm text-amber-600 mt-1">
            ⚠ PDF não carregado — você pode navegar para Revisão ou Orçamento se tiver dados anteriores.
          </p>
        )}
      </div>

      {/* Progress cards (only while running) */}
      {phase === 'running' && (
        <div className="flex flex-col gap-2">
          {([1, 2] as const).map((n) => {
            const done = callStep !== null && n < callStep;
            const active = callStep === n;
            return (
              <div
                key={n}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 border transition-colors ${
                  done
                    ? 'bg-green-50 border-green-200'
                    : active
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {done ? (
                  <span className="text-green-600 text-sm font-bold w-5 flex-shrink-0">✓</span>
                ) : active ? (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-gray-300 inline-block flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    done ? 'text-green-700' : active ? 'text-blue-700' : 'text-gray-400'
                  }`}>
                    Chamada {n}/2
                  </p>
                  {active && (
                    <p className="text-xs text-blue-500 mt-0.5">{callLabels[n - 1]}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Token summary (after done) — dev only */}
      {IS_DEV && isDone && tokenLogs.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-green-800 mb-2">✓ Análise concluída</p>
          <div className="flex gap-4 flex-wrap text-xs text-gray-600">
            {tokenLogs.map((log) => {
              const cost = log.usage.input_tokens * PRICE_IN + log.usage.output_tokens * PRICE_OUT;
              return (
                <span key={log.stage} className="text-gray-500">
                  <span className="font-medium text-gray-700">{log.stage}:</span>{' '}
                  {(log.usage.input_tokens + log.usage.output_tokens).toLocaleString('pt-BR')} tk
                  {' '}· ${cost.toFixed(4)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Call Logs — dev only ─────────────────────────────────────────────── */}
      {IS_DEV && (stage1Output || stage2Output) && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Logs das chamadas</p>
          {(
            [
              {
                n: 1 as const,
                label: 'Chamada 1 — Análise inicial',
                output: stage1Output,
                inputDesc: imageBlobs.length > 0
                  ? `${imageBlobs.length} imagem(ns) + prompt scanner de peças`
                  : 'Imagens + prompt scanner de peças',
              },
              {
                n: 2 as const,
                label: 'Chamada 2 — Revisão + JSON',
                output: stage2Output,
                inputDesc: 'Imagens + output da chamada 1 + prompt de revisão/dimensionamento',
              },
            ] as const
          ).map(({ n, label, output, inputDesc }) =>
            output ? (
              <div key={n} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenLog((prev) => (prev === n ? null : n))}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className="text-xs text-gray-400">
                    {openLog === n ? '▲ fechar' : `▼ ver log · ${output.length.toLocaleString('pt-BR')} chars`}
                  </span>
                </button>
                {openLog === n && (
                  <div className="flex flex-col gap-3 px-4 py-3 bg-white border-t border-gray-100">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Input</p>
                      <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                        {inputDesc}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Output · {output.length.toLocaleString('pt-BR')} chars
                      </p>
                      <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2.5 whitespace-pre-wrap break-words max-h-96 overflow-y-auto font-mono leading-relaxed">
                        {output}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>
      )}

      {error && (
        <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
          {error}
        </pre>
      )}

      <div className="flex flex-wrap gap-3 items-center pt-1">
        <button
          onClick={run}
          disabled={phase === 'running' || imageBlobs.length === 0}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {phase === 'running'
            ? 'Analisando...'
            : isDone
            ? 'Re-analisar'
            : 'Analisar Projeto →'}
        </button>
        {folha && (
          <button
            onClick={() => onNavigate(3)}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Ver Revisão →
          </button>
        )}
        {resultado && (
          <button
            onClick={() => onNavigate(4)}
            className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 active:scale-95 transition-all"
          >
            Ver Orçamento →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 3 — Review ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ItemMedicao['status'], { label: string; color: string; dot: string }> = {
  confirmado: { label: '100% confirmado',              color: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500' },
  parcial:    { label: 'Estimativa — confirmar in loco', color: 'text-blue-700 bg-blue-50 border-blue-200',   dot: 'bg-blue-400'  },
  aguardando: { label: 'Mármore não identificado',      color: 'text-red-700 bg-red-50 border-red-200',      dot: 'bg-red-400'   },
};

type DimEdit = { c: number; l: number };

function ItemCard({
  item,
  dimEdit,
  onEditDims,
  onRemove,
}: {
  item: ItemMedicao;
  dimEdit: DimEdit | undefined;
  onEditDims: (id: number, d: DimEdit) => void;
  onRemove: (id: number) => void;
}) {
  const st = STATUS_LABEL[item.status];
  const hasDims = item.comprimento_m != null && item.largura_m != null;

  const curC = dimEdit?.c ?? item.comprimento_m ?? 0;
  const curL = dimEdit?.l ?? item.largura_m ?? 0;
  const computedArea = hasDims ? parseFloat((curC * curL).toFixed(4)) : (item.area_m2 ?? 0);
  const isEdited = dimEdit !== undefined;

  return (
    <div className={`rounded-lg border p-3 ${st.color}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{item.modulo}</span>
            <span className="text-xs opacity-70">{item.tipo}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${st.color}`}>
              {st.label}
            </span>
            {isEdited && <span className="text-blue-600 text-xs font-medium">editado</span>}
          </div>

          {hasDims ? (
            /* C × L → area */
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs font-medium">
              <span className="opacity-60">{item.material} · {item.espessura_cm ?? '?'}cm</span>
              <span className="opacity-40 mx-0.5">|</span>
              <label className="flex items-center gap-1">
                C:
                <input
                  type="number" step="0.01" min="0"
                  value={curC}
                  onChange={(e) => onEditDims(item.id, { c: parseFloat(e.target.value) || 0, l: curL })}
                  className={`w-14 px-1.5 py-0.5 rounded border text-right font-mono ${
                    isEdited ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-800'
                  }`}
                />
                <span className="opacity-50">m</span>
              </label>
              <span className="opacity-40">×</span>
              <label className="flex items-center gap-1">
                L:
                <input
                  type="number" step="0.01" min="0"
                  value={curL}
                  onChange={(e) => onEditDims(item.id, { c: curC, l: parseFloat(e.target.value) || 0 })}
                  className={`w-14 px-1.5 py-0.5 rounded border text-right font-mono ${
                    isEdited ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-800'
                  }`}
                />
                <span className="opacity-50">m</span>
              </label>
              <span className="opacity-40">=</span>
              <span className={`font-mono font-semibold ${isEdited ? 'text-blue-700' : ''}`}>
                {computedArea} m²
              </span>
            </div>
          ) : (
            /* fallback: area only */
            <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs font-medium">
              <span className="opacity-60">{item.material} · {item.espessura_cm ?? '?'}cm</span>
              <span className="font-mono">{computedArea} m²</span>
            </div>
          )}

          {(item.servicos ?? []).length > 0 && (
            <p className="text-xs opacity-60 mt-1">
              {item.servicos.map((s) => `${s.nome}${s.unidade === 'ml' ? ` ${s.qtd}ml` : ''}`).join(' · ')}
            </p>
          )}
          {(item.pendencias ?? []).length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {item.pendencias.map((p, i) => (
                <li key={i} className="text-xs flex gap-1 items-start">
                  <span className="opacity-50 shrink-0">⚠</span>
                  <span className="opacity-80">{p}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          title="Remover item"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Next available ID helper
let _nextId = Date.now();
function nextId() { return ++_nextId; }

function AddItemForm({
  defaultAmbiente,
  defaultMaterial,
  onAdd,
  onCancel,
}: {
  defaultAmbiente: string;
  defaultMaterial: string;
  onAdd: (item: ItemMedicao) => void;
  onCancel: () => void;
}) {
  const [modulo, setModulo] = useState('');
  const [tipo, setTipo] = useState<ItemMedicao['tipo']>('tampo');
  const [comp, setComp] = useState('');
  const [larg, setLarg] = useState('');
  const computedArea = parseFloat(((parseFloat(comp) || 0) * (parseFloat(larg) || 0)).toFixed(4));

  const handleAdd = () => {
    if (!modulo || !comp || !larg) return;
    const c = parseFloat(comp) || 0;
    const l = parseFloat(larg) || 0;
    onAdd({
      id: nextId(),
      prancha_idx: null,
      status: 'confirmado',
      ambiente: defaultAmbiente,
      modulo,
      tipo,
      material: defaultMaterial,
      espessura_cm: 3,
      comprimento_m: c,
      largura_m: l,
      area_m2: parseFloat((c * l).toFixed(4)),
      servicos: [],
      pendencias: [],
    } as ItemMedicao);
    setModulo('');
    setComp('');
    setLarg('');
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-blue-700">Adicionar item — {defaultAmbiente}</p>
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Nome do módulo"
          value={modulo}
          onChange={(e) => setModulo(e.target.value)}
          className="flex-1 min-w-0 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as ItemMedicao['tipo'])}
          className="border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="tampo">tampo</option>
          <option value="rodape">rodape</option>
          <option value="saia">saia</option>
          <option value="revestimento">revestimento</option>
          <option value="prateleira">prateleira</option>
          <option value="outro">outro</option>
        </select>
      </div>
      <div className="flex gap-2 flex-wrap items-center text-xs font-medium">
        <label className="flex items-center gap-1">
          C:
          <input type="number" step="0.01" min="0" placeholder="0.00" value={comp}
            onChange={(e) => setComp(e.target.value)}
            className="w-16 border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 text-right font-mono"
          />
          <span className="opacity-50">m</span>
        </label>
        <span className="opacity-40">×</span>
        <label className="flex items-center gap-1">
          L:
          <input type="number" step="0.01" min="0" placeholder="0.00" value={larg}
            onChange={(e) => setLarg(e.target.value)}
            className="w-16 border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 text-right font-mono"
          />
          <span className="opacity-50">m</span>
        </label>
        <span className="opacity-40">=</span>
        <span className="font-mono font-semibold text-blue-700">{computedArea} m²</span>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          onClick={handleAdd}
          disabled={!modulo || !comp || !larg}
          className="text-xs px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

function StepReview({
  folha,
  imageBlobs,
  onDone,
}: {
  folha: FolhaMedicao;
  imageBlobs: Blob[];
  onDone: (updated: FolhaMedicao) => void;
}) {
  const [edits, setEdits] = useState<Record<number, DimEdit>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [addedItems, setAddedItems] = useState<ItemMedicao[]>([]);
  const [showAddFormFor, setShowAddFormFor] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewingImageIdx, setViewingImageIdx] = useState(0);

  // Create object URLs in an effect so they are properly revoked even in React Strict Mode
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = imageBlobs.map((b) => {
      const blob = b.type ? b : new Blob([b], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    });
    setImageUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageBlobs]);

  const currentViewUrl = imageUrls[viewingImageIdx] ?? null;

  const applyEdit = (id: number, d: DimEdit) => setEdits((prev) => ({ ...prev, [id]: d }));

  const removeItem = (id: number) => setRemovedIds((prev) => new Set([...prev, id]));

  const addItemToGroup = (item: ItemMedicao) => {
    setAddedItems((prev) => [...prev, item]);
    setShowAddFormFor(null);
  };

  // Group items by prancha_idx (excluding removed)
  const grouped = useMemo(() => {
    const allItems = [...folha.itens, ...addedItems];
    const visible = allItems.filter((i) => !removedIds.has(i.id));
    const byPage: Map<number, ItemMedicao[]> = new Map();
    const orphans: ItemMedicao[] = [];
    for (const item of visible) {
      const idx = item.prancha_idx;
      if (idx != null && idx >= 0 && idx < imageBlobs.length) {
        if (!byPage.has(idx)) byPage.set(idx, []);
        byPage.get(idx)!.push(item);
      } else {
        orphans.push(item);
      }
    }
    return {
      pages: [...byPage.entries()].sort((a, b) => a[0] - b[0]),
      orphans,
    };
  }, [folha.itens, addedItems, removedIds, imageBlobs.length]);

  const visibleItems = useMemo(
    () => [...folha.itens, ...addedItems].filter((i) => !removedIds.has(i.id)),
    [folha.itens, addedItems, removedIds]
  );

  const countByStatus = {
    confirmado: visibleItems.filter((i) => i.status === 'confirmado').length,
    parcial: visibleItems.filter((i) => i.status === 'parcial').length,
    aguardando: visibleItems.filter((i) => i.status === 'aguardando').length,
  };
  const totalPendencias = visibleItems.reduce((s, i) => s + (i.pendencias?.length ?? 0), 0);
  const hasChanges = Object.keys(edits).length > 0 || removedIds.size > 0 || addedItems.length > 0;

  const buildUpdatedFolha = (): FolhaMedicao => ({
    ...folha,
    itens: visibleItems.map((item) => {
      const d = edits[item.id];
      if (!d) return item;
      return {
        ...item,
        comprimento_m: d.c,
        largura_m: d.l,
        area_m2: parseFloat((d.c * d.l).toFixed(4)),
      };
    }),
  });

  const handleApply = async () => {
    setSaving(true);
    onDone(buildUpdatedFolha());
    setSaving(false);
  };

  // Default material from first item
  const defaultMaterial = folha.itens[0]?.material ?? 'Granito';

  return (
    <div className="flex gap-5 w-full items-start">
      {zoomUrl && (
        <ZoomModal url={zoomUrl} label={zoomLabel} onClose={() => setZoomUrl(null)} />
      )}

      {/* ── LEFT: items list ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Passo 3 — Revisão</h2>
          <p className="text-sm text-gray-500 mt-0.5">{folha.projeto}</p>
          <div className="mt-2 flex gap-3 flex-wrap text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {countByStatus.confirmado} confirmados
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              {countByStatus.parcial} estimativas
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              {countByStatus.aguardando} não identificados
            </span>
            {totalPendencias > 0 && (
              <span className="text-amber-600">⚠ {totalPendencias} pendências</span>
            )}
            {removedIds.size > 0 && <span className="text-red-500">✕ {removedIds.size} removidos</span>}
            {addedItems.length > 0 && <span className="text-blue-600">+ {addedItems.length} adicionados</span>}
          </div>
        </div>

        {/* Page groups */}
        {grouped.pages.map(([pageIdx, items]) => {
          const groupAmbiente = items[0]?.ambiente ?? 'Ambiente';
          return (
            <div key={pageIdx} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Page header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left"
                onClick={() => setViewingImageIdx(pageIdx < imageUrls.length ? pageIdx : viewingImageIdx)}
              >
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${pageIdx === viewingImageIdx ? 'bg-blue-500' : 'bg-gray-200'}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700">Prancha {pageIdx + 1}</p>
                  <p className="text-xs text-gray-500">{items.length} {items.length === 1 ? 'item' : 'itens'}</p>
                </div>
                {imageUrls[pageIdx] && (
                  <span className="text-xs text-blue-500">
                    {pageIdx === viewingImageIdx ? '← visível →' : 'Ver →'}
                  </span>
                )}
              </button>

              {/* Items */}
              <div className="p-3 flex flex-col gap-2">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    dimEdit={edits[item.id]}
                    onEditDims={applyEdit}
                    onRemove={removeItem}
                  />
                ))}
                {showAddFormFor === groupAmbiente ? (
                  <AddItemForm
                    defaultAmbiente={groupAmbiente}
                    defaultMaterial={defaultMaterial}
                    onAdd={addItemToGroup}
                    onCancel={() => setShowAddFormFor(null)}
                  />
                ) : (
                  <button
                    onClick={() => setShowAddFormFor(groupAmbiente)}
                    className="w-full py-2 rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    + Adicionar item em {groupAmbiente}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Orphans */}
        {grouped.orphans.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-600">Itens sem prancha associada</p>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {grouped.orphans.map((item) => (
                <ItemCard key={item.id} item={item} dimEdit={edits[item.id]} onEditDims={applyEdit} onRemove={removeItem} />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 items-center justify-end pt-1 flex-wrap">
          {hasChanges && (
            <span className="text-xs text-blue-600 mr-auto">
              {Object.keys(edits).length > 0 && `${Object.keys(edits).length} medida(s) editada(s)`}
              {removedIds.size > 0 && ` · ${removedIds.size} removido(s)`}
              {addedItems.length > 0 && ` · ${addedItems.length} adicionado(s)`}
            </span>
          )}
          <button
            onClick={() => onDone(buildUpdatedFolha())}
            disabled={saving}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Ver Orçamento →
          </button>
          {hasChanges && (
            <button
              onClick={handleApply}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"
            >
              {saving ? 'Salvando...' : 'Aplicar e recalcular →'}
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT: sticky image panel (fixed 1000px, full height) ── */}
      <div className="flex-shrink-0 sticky top-0 self-start" style={{ width: '1000px' }}>
        <div className="rounded-xl overflow-hidden bg-gray-900 shadow-xl flex flex-col" style={{ height: 'calc(100vh - 32px)' }}>
          {/* Image — fills everything */}
          <div
            className="relative bg-gray-950 flex items-center justify-center cursor-zoom-in flex-1 min-h-0"
            onClick={() => {
              if (currentViewUrl) {
                setZoomUrl(currentViewUrl);
                setZoomLabel(`Prancha ${viewingImageIdx + 1}`);
              }
            }}
          >
            {currentViewUrl ? (
              <img
                key={viewingImageIdx}
                src={currentViewUrl}
                alt={`Prancha ${viewingImageIdx + 1}`}
                className="max-w-full max-h-full object-contain"
                style={{ display: 'block' }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <span className="text-5xl">🖼</span>
                <p className="text-sm text-center px-8">
                  {imageBlobs.length === 0
                    ? 'Re-faça o upload do PDF para ver as imagens'
                    : `Prancha ${viewingImageIdx + 1} sem imagem`}
                </p>
              </div>
            )}
            {/* Large arrow buttons overlaid on image sides */}
            <button
              onClick={(e) => { e.stopPropagation(); setViewingImageIdx((i) => Math.max(0, i - 1)); }}
              disabled={viewingImageIdx === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-12 h-20 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 transition-all backdrop-blur-sm text-4xl font-thin select-none"
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewingImageIdx((i) => Math.min(imageUrls.length - 1, i + 1)); }}
              disabled={viewingImageIdx >= imageUrls.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-12 h-20 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 transition-all backdrop-blur-sm text-4xl font-thin select-none"
            >
              ›
            </button>
            {/* Overlays */}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <div className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-green-400" /> confirmado
              </div>
              <div className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-blue-400" /> estimativa
              </div>
              <div className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-red-400" /> não identificado
              </div>
            </div>
            {currentViewUrl && (
              <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
                🔍 zoom
              </div>
            )}
          </div>

          {/* Navigation bar — thumbnails + counter */}
          <div className="h-11 bg-gray-800 px-2 flex items-center gap-1">
            <div className="flex-1 flex gap-1 overflow-x-auto py-1">
              {imageUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setViewingImageIdx(i)}
                  title={`Prancha ${i + 1}`}
                  className={`flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                    i === viewingImageIdx ? 'border-blue-400' : 'border-transparent opacity-40 hover:opacity-75'
                  }`}
                >
                  <img src={url} alt={`p${i + 1}`} className="h-7 w-10 object-cover" />
                </button>
              ))}
            </div>
            <span className="text-gray-500 text-xs ml-2 flex-shrink-0">
              {viewingImageIdx + 1}/{imageUrls.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4 — Budget ─────────────────────────────────────────────────────────

const PRICE_INPUT = 3 / 1_000_000;
const PRICE_OUTPUT = 15 / 1_000_000;

function TokenLogPanel({ logs }: { logs: TokenLog[] }) {
  const [open, setOpen] = useState(false);

  const totalInput = logs.reduce((s, l) => s + l.usage.input_tokens, 0);
  const totalOutput = logs.reduce((s, l) => s + l.usage.output_tokens, 0);
  const totalCost = totalInput * PRICE_INPUT + totalOutput * PRICE_OUTPUT;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-medium text-gray-700">
          Uso de tokens — {(totalInput + totalOutput).toLocaleString('pt-BR')} total
        </span>
        <span className="text-xs text-gray-500 flex items-center gap-3">
          <span>≈ ${totalCost.toFixed(4)} USD</span>
          <span>{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {logs.map((log, idx) => {
            const cost = log.usage.input_tokens * PRICE_INPUT + log.usage.output_tokens * PRICE_OUTPUT;
            return (
              <div key={idx} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{log.stage}</span>
                  <span className="text-xs text-gray-400">${cost.toFixed(4)}</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Input: {log.usage.input_tokens.toLocaleString('pt-BR')} tk</span>
                  <span>Output: {log.usage.output_tokens.toLocaleString('pt-BR')} tk</span>
                  {(log.usage.cache_read_input_tokens ?? 0) > 0 && (
                    <span className="text-green-600">
                      Cache hit: {log.usage.cache_read_input_tokens!.toLocaleString('pt-BR')} tk
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 bg-gray-50 flex justify-between font-medium text-gray-700">
            <span>Total</span>
            <div className="flex gap-4 text-xs text-gray-600">
              <span>Input: {totalInput.toLocaleString('pt-BR')} tk</span>
              <span>Output: {totalOutput.toLocaleString('pt-BR')} tk</span>
              <span className="font-semibold">${totalCost.toFixed(4)} USD</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepOrcamento({
  folha,
  resultado,
  tokenLogs,
  onRestart,
}: {
  folha: FolhaMedicao;
  resultado: ResultadoOrcamento;
  tokenLogs: TokenLog[];
  onRestart: () => void;
}) {
  const [copied, setCopied] = useState(false);

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
    <div className="flex flex-col gap-6 w-full">
      <h2 className="text-xl font-semibold text-gray-800">
        Passo 4 — Orçamento — {folha.projeto}
      </h2>

      {/* Total card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <p className="text-sm text-blue-200 mb-1">Total Geral Estimado</p>
        <p className="text-4xl font-bold">{fmtBRL(resultado.totalGeral)}</p>
        <div className="mt-4 flex gap-6 text-sm text-blue-100">
          <span>Material: {fmtBRL(resultado.totalMaterial)}</span>
          <span>Serviços: {fmtBRL(resultado.totalServicos)}</span>
        </div>
      </div>

      {/* Por ambiente */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Por Ambiente</h3>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {Object.entries(resultado.porAmbiente).map(([amb, v]) => (
              <tr key={amb} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-700">{amb}</td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmtBRL(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Por material */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Por Material</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Material</th>
              <th className="px-4 py-2 text-right">Área m²</th>
              <th className="px-4 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Object.entries(resultado.porMaterial).map(([mat, v]) => (
              <tr key={mat} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-700">{mat}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{v.area.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmtBRL(v.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pendências */}
      {pendenciasAbertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">
            Pendências em Aberto ({pendenciasAbertas.length})
          </h3>
          <ul className="flex flex-col gap-1.5">
            {pendenciasAbertas.map((p, idx) => (
              <li key={idx} className="text-xs text-amber-700 flex gap-2">
                <span className="font-medium shrink-0">[{p.id}] {p.modulo}:</span>
                <span>{p.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {IS_DEV && <TokenLogPanel logs={tokenLogs} />}

      <div className="flex gap-3 self-end">
        <button
          onClick={onRestart}
          className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all"
        >
          Novo Projeto
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

// ─── Wizard Stepper ───────────────────────────────────────────────────────────

function Stepper({
  current,
  accessible,
  onNavigate,
}: {
  current: Step;
  accessible: Set<Step>;
  onNavigate: (s: Step) => void;
}) {
  const steps = ['Upload', 'Pipeline', 'Revisão', 'Orçamento'];
  return (
    <div className="flex items-center gap-0 w-full max-w-xl mx-auto mb-8">
      {steps.map((label, idx) => {
        const num = (idx + 1) as Step;
        const done = current > num;
        const active = current === num;
        const clickable = (accessible?.has(num) ?? false) && num !== current;
        return (
          <div key={num} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <button
                onClick={() => clickable && onNavigate(num)}
                disabled={!clickable}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  done ? 'bg-green-500 text-white' :
                  active ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-500'
                } ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {done ? '✓' : num}
              </button>
              <span className={`text-xs mt-1 ${active ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── IndexedDB — image blob persistence ──────────────────────────────────────

const IDB_NAME  = 'orcamento_idb_v1';
const IDB_STORE = 'blobs';
const IDB_KEY   = 'current_images';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveIDBBlobs(blobs: Blob[]): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blobs, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

async function loadIDBBlobs(): Promise<Blob[]> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx  = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as Blob[]) ?? []);
      req.onerror   = () => resolve([]);
    });
  } catch { return []; }
}

async function clearIDBBlobs(): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
    });
  } catch { /* ignore */ }
}

// ─── localStorage persistence ─────────────────────────────────────────────────

const LS_KEY      = 'orcamento_pipeline_v1';
const HISTORY_KEY = 'orcamento_history_v1';
const MAX_HISTORY = 30;

interface PersistedState {
  stage1Output: string | null;
  stage2Output: string | null;
  folha: FolhaMedicao | null;
  resultado: ResultadoOrcamento | null;
  tokenLogs: TokenLog[];
  pageTexts: string[];
  savedAt: number;
}

export interface HistoryEntry {
  id: string;
  savedAt: number;
  projeto: string;
  totalGeral: number;
  totalPendencias: number;
  stage1Output: string | null;
  stage2Output: string | null;
  folha: FolhaMedicao;
  resultado: ResultadoOrcamento;
  tokenLogs: TokenLog[];
}

function loadPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch { return null; }
}
function savePersisted(s: PersistedState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* quota */ }
}
function clearPersisted() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch { return []; }
}

function saveToHistory(
  folha: FolhaMedicao,
  resultado: ResultadoOrcamento,
  stage1Output: string | null,
  stage2Output: string | null,
  tokenLogs: TokenLog[]
) {
  try {
    const history = loadHistory();
    const totalPendencias = folha.itens.reduce((s, i) => s + (i.pendencias?.length ?? 0), 0);
    const existing = history.findIndex((e) => e.projeto === folha.projeto);
    const entry: HistoryEntry = {
      id: existing >= 0
        ? history[existing].id
        : `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      savedAt: Date.now(),
      projeto: folha.projeto,
      totalGeral: resultado.totalGeral,
      totalPendencias,
      stage1Output,
      stage2Output,
      folha,
      resultado,
      tokenLogs,
    };
    const updated = existing >= 0
      ? history.map((e, i) => (i === existing ? entry : e))
      : [entry, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch { /* quota */ }
}

function deleteFromHistory(id: string) {
  try {
    const updated = loadHistory().filter((e) => e.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

// ─── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  history,
  onLoad,
  onDelete,
  onClose,
}: {
  history: HistoryEntry[];
  onLoad: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="mb-6 bg-white border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500">Nenhum orçamento salvo ainda.</p>
        <button onClick={onClose} className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline">
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Histórico — {history.length} orçamentos</h3>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕ Fechar</button>
      </div>
      <div className="divide-y divide-gray-100">
        {history.map((entry) => (
          <div key={entry.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{entry.projeto}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(entry.savedAt).toLocaleString('pt-BR')}
              </p>
              <div className="mt-1.5 flex gap-3 flex-wrap text-xs">
                <span className="font-medium text-gray-700">
                  {entry.totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                {entry.totalPendencias > 0 && (
                  <span className="text-amber-600">⚠ {entry.totalPendencias} pendências</span>
                )}
                <span className="text-gray-400">{entry.folha.itens.length} itens</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => onLoad(entry)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 transition-all"
              >
                Carregar
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                className="text-xs px-2.5 py-1.5 border border-gray-300 text-gray-500 rounded-md hover:bg-gray-100 hover:text-red-600 active:scale-95 transition-all"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrcamentoPage() {
  const [step, setStep] = useState<Step>(1);
  const [imageBlobs, setImageBlobs] = useState<Blob[]>([]);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [stage1Output, setStage1Output] = useState<string | null>(null);
  const [stage2Output, setStage2Output] = useState<string | null>(null);
  const [folha, setFolha] = useState<FolhaMedicao | null>(null);
  const [resultado, setResultado] = useState<ResultadoOrcamento | null>(null);
  const [tokenLogs, setTokenLogs] = useState<TokenLog[]>([]);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load session + history + image blobs on mount
  useEffect(() => {
    const saved = loadPersisted();
    if (saved) {
      if (saved.stage1Output) setStage1Output(saved.stage1Output);
      if (saved.stage2Output) setStage2Output(saved.stage2Output);
      if (saved.folha) { setFolha(saved.folha); setStep(3); }
      if (saved.resultado) { setResultado(saved.resultado); setStep(4); }
      if (saved.tokenLogs?.length) setTokenLogs(saved.tokenLogs);
      if (saved.pageTexts?.length) setPageTexts(saved.pageTexts);
      setRestoredAt(saved.savedAt);
    }
    setHistory(loadHistory());
    // Restore image blobs from IndexedDB (async)
    loadIDBBlobs().then((blobs) => {
      if (blobs.length > 0) setImageBlobs(blobs);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist image blobs to IndexedDB whenever they change
  useEffect(() => {
    if (imageBlobs.length > 0) saveIDBBlobs(imageBlobs);
  }, [imageBlobs]);

  // Persist session + history whenever state changes
  useEffect(() => {
    if (!stage1Output && !stage2Output && !folha && !resultado) return;
    savePersisted({ stage1Output, stage2Output, folha, resultado, tokenLogs, pageTexts, savedAt: Date.now() });
    if (folha && resultado) {
      saveToHistory(folha, resultado, stage1Output, stage2Output, tokenLogs);
      setHistory(loadHistory());
    }
  }, [stage1Output, stage2Output, folha, resultado, tokenLogs, pageTexts]);

  const handleUpdate = useCallback((u: PipelineUpdate) => {
    if (u.stage1Output !== undefined) setStage1Output(u.stage1Output);
    if (u.stage2Output !== undefined) setStage2Output(u.stage2Output);
    if (u.folha !== undefined) setFolha(u.folha);
    if (u.resultado !== undefined) setResultado(u.resultado);
    if (u.tokenLog) {
      setTokenLogs((prev) => {
        const idx = prev.findIndex((l) => l.stage === u.tokenLog!.stage);
        return idx >= 0
          ? prev.map((l, i) => (i === idx ? u.tokenLog! : l))
          : [...prev, u.tokenLog!];
      });
    }
  }, []);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setStage1Output(entry.stage1Output);
    setStage2Output(entry.stage2Output);
    setFolha(entry.folha);
    setResultado(entry.resultado);
    setTokenLogs(entry.tokenLogs ?? []);
    setRestoredAt(entry.savedAt);
    setImageBlobs([]);
    setStep(4);
    setShowHistory(false);
  }, []);

  const handleDeleteHistory = useCallback((id: string) => {
    deleteFromHistory(id);
    setHistory(loadHistory());
  }, []);

  const reset = () => {
    clearPersisted();
    clearIDBBlobs();
    setStep(1);
    setImageBlobs([]);
    setPageTexts([]);
    setStage1Output(null);
    setStage2Output(null);
    setFolha(null);
    setResultado(null);
    setTokenLogs([]);
    setRestoredAt(null);
  };

  const accessible = new Set<Step>([1]);
  if (imageBlobs.length > 0 || stage1Output) accessible.add(2);
  if (folha) accessible.add(3);
  if (resultado) accessible.add(4);

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 py-12 px-4">
      <div className={`mx-auto transition-all ${step === 3 ? 'w-full px-4' : 'max-w-3xl'}`}>
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orçamento de Marmoraria</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Análise automática por IA a partir do projeto arquitetônico
            </p>
          </div>
          <button
            onClick={() => setShowHistory((o) => !o)}
            className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border font-medium transition-all flex-shrink-0 ${
              showHistory
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            📋 Histórico
            {history.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                showHistory ? 'bg-gray-600 text-gray-200' : 'bg-gray-100 text-gray-600'
              }`}>
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* History panel */}
        {showHistory && (
          <HistoryPanel
            history={history}
            onLoad={loadFromHistory}
            onDelete={handleDeleteHistory}
            onClose={() => setShowHistory(false)}
          />
        )}

        {restoredAt && !showHistory && (
          <div className="mb-4 flex items-center justify-between gap-3 text-xs bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <span className="text-blue-700">
              💾 Restaurado — {new Date(restoredAt).toLocaleString('pt-BR')}
            </span>
            <button onClick={reset} className="text-blue-500 hover:text-blue-700 underline flex-shrink-0">
              Limpar sessão
            </button>
          </div>
        )}

        <Stepper current={step} accessible={accessible} onNavigate={setStep} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === 1 && (
            <StepUpload
              onDone={(blobs, texts) => {
                setImageBlobs(blobs);
                setPageTexts(texts);
                setStep(2);
              }}
            />
          )}

          {step === 2 && (
            <StepProcessing
              imageBlobs={imageBlobs}
              pageTexts={pageTexts}
              stage1Output={stage1Output}
              stage2Output={stage2Output}
              folha={folha}
              resultado={resultado}
              tokenLogs={tokenLogs}
              onUpdate={handleUpdate}
              onNavigate={setStep}
            />
          )}

          {step === 3 && folha && (
            <StepReview
              folha={folha}
              imageBlobs={imageBlobs}
              onDone={async (updated) => {
                if (updated !== folha) {
                  handleUpdate({ folha: updated });
                  const r = await fetch('/api/orcamento/calcular', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folha: updated }),
                  });
                  if (r.ok) handleUpdate({ resultado: await r.json() as ResultadoOrcamento });
                }
                setStep(4);
              }}
            />
          )}

          {step === 4 && folha && resultado && (
            <StepOrcamento
              folha={folha}
              resultado={resultado}
              tokenLogs={tokenLogs}
              onRestart={reset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
