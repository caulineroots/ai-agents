'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FolhaMedicao, ItemMedicao, ResultadoOrcamento, Servico } from '@/lib/orcamento-marcenaria/types';
import { getPdfjs } from '@/lib/orcamento-marcenaria/pdfjs';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface WaJob {
  id: string;
  phone: string;
  status: string;
  pdf_filename: string | null;
  folha: FolhaMedicao | null;
  resultado: ResultadoOrcamento | null;
  error_msg: string | null;
  created_at: string;
}

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

const IS_DEV =
  process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_DEV_MODE !== 'false'
    : process.env.NEXT_PUBLIC_DEV_MODE === 'true';

function fmtBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Zoom Modal ───────────────────────────────────────────────────────────────

function ZoomModal({ url, label, onClose, onPrev, onNext, hasPrev, hasNext }: {
  url: string; label: string; onClose: () => void;
  onPrev?: () => void; onNext?: () => void; hasPrev?: boolean; hasNext?: boolean;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Bloqueia scroll da página por trás
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
      const factor = Math.exp(-delta * 0.003);
      setScale(prev => Math.min(Math.max(prev * factor, 1), 8));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (scale <= 1) setPan({ x: 0, y: 0 });
  }, [scale]);

  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }); };
  const zoomTo = (s: number) => { setScale(s); if (s <= 1) setPan({ x: 0, y: 0 }); };
  const PRESETS = [1, 1.5, 2, 2.5, 3] as const;
  const didDragRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    didDragRef.current = false;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    didDragRef.current = true;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.sx),
      y: dragRef.current.py + (e.clientY - dragRef.current.sy),
    });
  };

  const endDrag = () => { dragRef.current = null; };

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'black', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      {/* Toolbar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: '12px', backgroundColor: 'rgba(24,24,27,0.9)', borderBottom: '1px solid rgb(39,39,42)' }}>
        {/* Label + nav arrows */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
          {(onPrev || onNext) && (
            <>
              <button onClick={onPrev} disabled={!hasPrev}
                style={{ flexShrink: 0, fontSize: '18px', background: 'none', border: 'none', color: hasPrev ? 'rgb(212,212,216)' : 'rgb(63,63,70)', cursor: hasPrev ? 'pointer' : 'default', lineHeight: 1, padding: '0 4px' }}>
                ←
              </button>
              <button onClick={onNext} disabled={!hasNext}
                style={{ flexShrink: 0, fontSize: '18px', background: 'none', border: 'none', color: hasNext ? 'rgb(212,212,216)' : 'rgb(63,63,70)', cursor: hasNext ? 'pointer' : 'default', lineHeight: 1, padding: '0 4px' }}>
                →
              </button>
            </>
          )}
          <span style={{ color: 'rgb(228,228,231)', fontSize: '15px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {PRESETS.map((p) => {
            const active = Math.round(scale * 100) === Math.round(p * 100);
            return (
              <button
                key={p}
                onClick={() => zoomTo(p)}
                style={{
                  fontSize: '13px',
                  borderRadius: '2px',
                  padding: '4px 10px',
                  fontVariantNumeric: 'tabular-nums',
                  backgroundColor: active ? 'rgb(139,92,246)' : 'transparent',
                  color: active ? 'white' : 'rgb(212,212,216)',
                  fontWeight: active ? 600 : 400,
                  border: active ? 'none' : '1px solid rgb(63,63,70)',
                  cursor: 'pointer',
                }}
              >
                {Math.round(p * 100)}%
              </button>
            );
          })}
          <span style={{ color: 'rgb(161,161,170)', fontSize: '13px', fontVariantNumeric: 'tabular-nums', marginLeft: '4px' }}>{Math.round(scale * 100)}%</span>
          <button
            onClick={onClose}
            style={{ marginLeft: '12px', color: 'rgb(212,212,216)', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: scale > 1 ? 'grab' : 'default' }}
        onMouseDown={handleMouseDown}
        onDoubleClick={reset}
      >
        <img
          src={url}
          alt={label}
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`,
            transformOrigin: 'center center',
            cursor: scale > 1 ? 'grab' : 'default',
          }}
        />
      </div>
    </div>,
    document.body
  );
}

// ─── Step 1 — Upload ─────────────────────────────────────────────────────────

type UploadPhase = 'idle' | 'loading' | 'reviewing' | 'confirming' | 'converting';

function StepUpload({ onConversionStart, onDone }: { onConversionStart: () => void; onDone: (blobs: Blob[], texts: string[]) => void }) {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pageDataUrl, setPageDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [cachedPages, setCachedPages] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const pageCacheRef = useRef<Map<number, string>>(new Map());
  const currentPageRef = useRef(0);
  const bgRenderingRef = useRef(false);
  const pdfFileRef = useRef<File | null>(null);

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
      setCachedPages((prev) => { const next = new Set(prev); next.add(idx); return next; });
      return url;
    } catch { return null; }
  }, []);

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

  const goTo = useCallback((idx: number, total: number) => {
    displayPage(idx);
    [-1, 1, 2, 3].forEach((offset) => {
      const n = idx + offset;
      if (n >= 0 && n < total && !pageCacheRef.current.has(n)) {
        setTimeout(() => renderToCache(n), Math.abs(offset) * 30);
      }
    });
  }, [displayPage, renderToCache]);

  const startBgRender = useCallback(async (total: number) => {
    if (bgRenderingRef.current) return;
    bgRenderingRef.current = true;
    const BATCH = 3;
    // Páginas em ordem (0,1,2,3,...) processadas em batches paralelos de BATCH
    for (let i = 0; i < total; i += BATCH) {
      const batch = Array.from({ length: Math.min(BATCH, total - i) }, (_, k) => i + k)
        .filter((idx) => !pageCacheRef.current.has(idx));
      if (batch.length > 0) await Promise.all(batch.map(renderToCache));
    }
    bgRenderingRef.current = false;
  }, [renderToCache]);

  const loadPDF = useCallback(async (file: File) => {
    setPhase('loading');
    setError('');
    pageCacheRef.current.clear();
    setCachedPages(new Set());
    bgRenderingRef.current = false;
    try {
      const buffer = await file.arrayBuffer();
      const pdfjsLib = await getPdfjs();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      pdfDocRef.current = pdf;
      const total = pdf.numPages;
      setTotalPages(total);
      setSelected(new Set(Array.from({ length: total }, (_, i) => i)));
      currentPageRef.current = 0;
      setCurrentPage(0);
      setIsRendering(true);
      const url = await renderToCache(0);
      setPageDataUrl(url);
      setIsRendering(false);
      setPhase('reviewing');
      for (let i = 1; i <= Math.min(4, total - 1); i++) {
        await renderToCache(i);
      }
      startBgRender(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar PDF');
      setPhase('idle');
    }
  }, [renderToCache, startBgRender]);

  const convertSelected = useCallback(() => { setPhase('confirming'); }, []);

  const startConversion = useCallback(async () => {
    setError('');
    onConversionStart(); // vai direto pro step 2
    try {
      const sortedSelected = [...selected].sort((a, b) => a - b);

      // Obtém o ArrayBuffer do PDF original para enviar ao worker
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) throw new Error('PDF não carregado');

      const file = pdfFileRef.current;
      if (!file) throw new Error('Arquivo PDF não encontrado');
      const pdfData = await file.arrayBuffer();

      const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url));

      await new Promise<void>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data as { type: string; current?: number; total?: number; buffers?: ArrayBuffer[]; texts?: string[]; message?: string };
          if (msg.type === 'progress') {
            setProgress(`Convertendo ${msg.current} de ${msg.total}...`);
          } else if (msg.type === 'done') {
            const blobs = (msg.buffers ?? []).map((buf) => new Blob([buf], { type: 'image/jpeg' }));
            worker.terminate();
            onDone(blobs, msg.texts ?? []);
            resolve();
          } else if (msg.type === 'error') {
            worker.terminate();
            reject(new Error(msg.message ?? 'Erro no worker'));
          }
        };
        worker.onerror = (ev) => { worker.terminate(); reject(new Error(ev.message)); };
        worker.postMessage({ pdfData, selectedPages: sortedSelected }, [pdfData]);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na conversão');
      setPhase('confirming');
    }
  }, [selected, onDone]);

  const decide = useCallback((include: boolean) => {
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
    pdfFileRef.current = file;
    if (process.env.NODE_ENV !== 'production') { loadPDF(file); return; }
    fetch(`/api/orcamento-marcenaria/salvar-pdf?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST', body: file, headers: { 'Content-Type': 'application/pdf' },
    })
      .then((r) => r.json())
      .then((d) => { if (IS_DEV) console.log('[S3] PDF salvo:', d.key); })
      .catch((e) => { if (IS_DEV) console.warn('[S3] Falha ao salvar PDF:', e); });
    loadPDF(file);
  };

  // ── Phase: idle — Hero ────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-10 animate-fade-in">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div>
            <h1 className="text-4xl font-semibold text-zinc-50 tracking-tight flex flex-wrap gap-x-[0.35em] justify-center">
              {['Orçamento', 'de', 'Marcenaria', 'por', 'IA'].map((word, i) => (
                <span key={word} className={`word-in-${i} inline-block`}>{word}</span>
              ))}
            </h1>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`w-full max-w-md border-2 border-dashed rounded-sm p-10 flex flex-col items-center gap-5 cursor-pointer transition-all duration-200 ${
            dragging
              ? 'border-violet-500 bg-violet-500/10 scale-[1.01]'
              : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800/40'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <p className="text-base font-medium text-zinc-200">Clique aqui para subir o PDF do projeto.</p>
          <input ref={inputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-base text-red-400 bg-red-500/10 border border-red-500/20 rounded px-4 py-3">
            
            {error}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center gap-5 py-20 animate-fade-in">
        <div className="spinner-gradient" />
        <p className="text-base text-zinc-300">Carregando PDF...</p>
      </div>
    );
  }

  // ── Phase: confirming ─────────────────────────────────────────────────────
  if (phase === 'confirming') {
    const sortedSelected = [...selected].sort((a, b) => a - b);
    const excluded = totalPages - selected.size;
    return (
      <div className="flex flex-col items-center gap-7 py-8 animate-fade-in">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold text-zinc-50">Pronto para analisar</h2>
          <p className="text-base text-zinc-300">
            <span className="font-semibold text-zinc-200">{selected.size}</span> pranchas selecionadas
            {excluded > 0 && <span className="text-zinc-400"> · {excluded} ignoradas</span>}
          </p>
        </div>

        {/* Thumbnail strip */}
        <div className="flex gap-2 flex-wrap justify-center max-w-sm">
          {sortedSelected.map((idx) => {
            const thumb = pageCacheRef.current.get(idx);
            return (
              <div key={idx} className="relative">
                {thumb
                  ? <img src={thumb} alt={`p${idx + 1}`} className="h-16 w-20 object-cover rounded-sm border-2 border-violet-500/60" />
                  : <div className="h-16 w-20 rounded-sm border-2 border-zinc-700 bg-zinc-800 flex items-center justify-center"><div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" /></div>
                }
                <span className="absolute bottom-1 right-1 bg-violet-500 text-white text-sm font-bold px-1 rounded">
                  {idx + 1}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 w-full max-w-sm">
          <button
            onClick={startConversion}
            className="w-full py-3.5 bg-violet-500 text-white rounded text-base font-semibold hover:bg-violet-400 active:scale-[0.98] transition-all"
          >
            Iniciar análise com IA →
          </button>
          <button
            onClick={() => setPhase('reviewing')}
            className="w-full py-2.5 border border-zinc-700 text-zinc-400 rounded text-base hover:bg-zinc-800 hover:text-zinc-200 transition-all"
          >
            ← Voltar e ajustar seleção
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-sm px-4 py-2.5">
            
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Phase: reviewing — full-screen ────────────────────────────────────────
  const isIncluded = selected.has(currentPage);

  return (
    <div className="fixed inset-0 z-50 flex bg-zinc-950">
      {/* LEFT — full image */}
      <div className="relative flex-1 flex items-center justify-center bg-zinc-950 overflow-hidden p-10">
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
        {pageDataUrl && (
          <div className="relative h-full flex items-center justify-center">
            <div className="absolute -inset-3 rounded-sm border border-zinc-700/60 shadow-[0_0_60px_-10px_rgba(0,0,0,0.8)]" />
            <img
              key={currentPage}
              src={pageDataUrl}
              alt={`Página ${currentPage + 1}`}
              className="relative h-full max-h-full w-auto object-contain rounded-sm shadow-2xl"
            />
          </div>
        )}
        <div className="absolute top-4 left-4 bg-zinc-900/80 backdrop-blur-sm text-zinc-200 text-base font-semibold px-3 py-1.5 rounded border border-zinc-700">
          {currentPage + 1} / {totalPages}
        </div>
      </div>

      {/* RIGHT — decision panel */}
      <div className="w-[360px] flex-shrink-0 flex flex-col bg-zinc-900 border-l border-zinc-800">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-zinc-100 font-semibold text-lg">Selecionar Pranchas</h2>
            <button
              onClick={() => { setPhase('idle'); pdfDocRef.current = null; pageCacheRef.current.clear(); }}
              className="text-zinc-300 hover:text-zinc-300 text-sm border border-zinc-700 rounded-sm px-2.5 py-1 transition-colors"
            >
              ← Voltar
            </button>
          </div>
          <p className="text-zinc-300 text-sm mt-1">
            Página {currentPage + 1} de {totalPages} · {selected.size} selecionadas
          </p>
          <div className={`mt-3 flex items-center gap-2 text-base font-medium ${
            isIncluded ? 'text-violet-400' : 'text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isIncluded ? 'bg-violet-400' : 'bg-red-400'}`} />
            {isIncluded ? 'Esta prancha será analisada' : 'Esta prancha será ignorada'}
          </div>
        </div>

        {/* Dot progress */}
        <div className="px-6 py-3 flex flex-wrap gap-1.5 border-b border-zinc-800">
          {Array.from({ length: totalPages }, (_, i) => {
            const isActive = i === currentPage;
            const isSelected = selected.has(i);
            const isCached = cachedPages.has(i);
            return (
              <button
                key={i}
                onClick={() => goTo(i, totalPages)}
                title={`Página ${i + 1}`}
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? 'w-3 h-3 bg-zinc-50'
                    : isSelected && isCached
                    ? 'w-2 h-2 bg-violet-400 hover:bg-violet-300'
                    : isSelected
                    ? 'w-2 h-2 bg-violet-800 hover:bg-violet-600 animate-pulse'
                    : isCached
                    ? 'w-2 h-2 bg-zinc-600 hover:bg-zinc-400'
                    : 'w-2 h-2 bg-zinc-800 hover:bg-zinc-600 animate-pulse'
                }`}
              />
            );
          })}
        </div>

        {/* Main buttons */}
        <div className="flex-1 flex flex-col gap-3 px-6 py-6">
          <button
            onClick={() => decide(false)}
            className="flex-1 rounded-sm bg-red-500/5 border-2 border-red-500/30 text-red-400 font-bold text-xl hover:bg-red-500/10 hover:border-red-500/50 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-2"
          >
            
            Excluir
          </button>
          <button
            onClick={() => decide(true)}
            className="flex-1 rounded-sm bg-violet-500/5 border-2 border-violet-500/30 text-violet-400 font-bold text-xl hover:bg-violet-500/10 hover:border-violet-500/50 active:scale-[0.97] transition-all flex flex-col items-center justify-center gap-2"
          >
            
            Incluir
          </button>
        </div>

        {/* Bottom nav */}
        <div className="px-6 pb-6 flex flex-col gap-2 border-t border-zinc-800 pt-4">
          <button
            onClick={convertSelected}
            disabled={selected.size === 0}
            className="w-full py-3 bg-violet-500 text-white rounded text-base font-semibold hover:bg-violet-400 active:scale-95 transition-all disabled:opacity-30"
          >
            Confirmar {selected.size} pranchas →
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => goTo(currentPage - 1, totalPages)}
              disabled={currentPage === 0}
              className="flex-1 py-2 rounded-sm border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 transition-all"
            >
              ← Anterior
            </button>
            <button
              onClick={() => goTo(currentPage + 1, totalPages)}
              disabled={currentPage === totalPages - 1}
              className="flex-1 py-2 rounded-sm border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 transition-all"
            >
              Pular →
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-6 mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-sm px-3 py-2">{error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Step 2 — Processing ──────────────────────────────────────────────────────

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
  imageBlobs, pageTexts, stage1Output, stage2Output, folha, resultado, tokenLogs, onUpdate, onNavigate, converting,
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
  converting: boolean;
}) {
  const [phase, setPhase] = useState<ProcessingPhase>(resultado ? 'done' : 'idle');
  const [callStep, setCallStep] = useState<1 | 2 | null>(null);
  const [error, setError] = useState('');
  const [openLog, setOpenLog] = useState<1 | 2 | null>(null);

  useEffect(() => {
    if (imageBlobs.length > 0 && !resultado && phase === 'idle') { run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageBlobs.length]);

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
      const r = await fetch('/api/orcamento-marcenaria/chamada-controlada', { method: 'POST', body: fd });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Erro ${r.status}`);
      }
      setCallStep(2 as 1 | 2);
      const data = await r.json() as {
        output1: string; output2: string;
        folha: FolhaMedicao | null; resultado: ResultadoOrcamento | null;
        parseError: string | null; usage1: ApiUsage; usage2: ApiUsage;
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
      onNavigate(data.folha ? 3 : 4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setPhase('error');
    } finally { setCallStep(null); }
  }, [imageBlobs, pageTexts, onUpdate]);

  const isDone = phase === 'done' || !!resultado;

  // Loading screen
  if ((converting || phase === 'idle' || phase === 'running') && !resultado) {
    const label = converting
      ? 'Preparando imagens...'
      : callStep === 1 ? 'Analisando projeto...'
      : callStep === 2 ? 'Gerando orçamento...'
      : 'Processando...';
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-24 animate-fade-in">
        {/* Gradient spinner */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="spinner-gradient absolute inset-0" style={{ width: 64, height: 64 }} />
          
        </div>
        <div className="text-center">
          <p className="text-xl font-medium text-zinc-100">{label}</p>
          <p className="text-base text-zinc-300 mt-2 max-w-xs leading-relaxed">
            Pode levar de 2 a 5 minutos, a depender do tamanho do projeto
          </p>
        </div>
        {!converting && callStep && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Etapa {callStep} de 2
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Análise do Projeto</h2>
        {imageBlobs.length > 0 ? (
          <p className="text-base text-zinc-300 mt-1">
            {imageBlobs.length} {imageBlobs.length === 1 ? 'prancha carregada' : 'pranchas carregadas'}
          </p>
        ) : (
          <p className="text-base text-amber-400 mt-1 flex items-center gap-1.5">
            
            PDF não carregado — você pode navegar para Revisão ou Orçamento se tiver dados anteriores.
          </p>
        )}
      </div>

      {/* Token summary — dev only */}
      {IS_DEV && isDone && tokenLogs.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded px-4 py-3">
          <p className="text-base font-semibold text-green-400 mb-2 flex items-center gap-1.5">
             Análise concluída
          </p>
          <div className="flex gap-4 flex-wrap text-sm text-zinc-400">
            {tokenLogs.map((log) => {
              const cost = log.usage.input_tokens * PRICE_IN + log.usage.output_tokens * PRICE_OUT;
              return (
                <span key={log.stage} className="text-zinc-300">
                  <span className="font-medium text-zinc-300">{log.stage}:</span>{' '}
                  {(log.usage.input_tokens + log.usage.output_tokens).toLocaleString('pt-BR')} tk · ${cost.toFixed(4)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Call Logs — dev only */}
      {IS_DEV && (stage1Output || stage2Output) && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Logs das chamadas</p>
          {([
            { n: 1 as const, label: 'Chamada 1 — Análise inicial', output: stage1Output,
              inputDesc: imageBlobs.length > 0 ? `${imageBlobs.length} imagem(ns) + prompt scanner de peças` : 'Imagens + prompt' },
            { n: 2 as const, label: 'Chamada 2 — Revisão + JSON', output: stage2Output,
              inputDesc: 'Imagens + output da chamada 1 + prompt de revisão/dimensionamento' },
          ] as const).map(({ n, label, output, inputDesc }) =>
            output ? (
              <div key={n} className="border border-zinc-800 rounded overflow-hidden">
                <button
                  onClick={() => setOpenLog((prev) => (prev === n ? null : n))}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
                >
                  <span className="text-base font-medium text-zinc-300">{label}</span>
                  <span className="text-sm text-zinc-400">
                    {openLog === n ? '▲ fechar' : `▼ ver log · ${output.length.toLocaleString('pt-BR')} chars`}
                  </span>
                </button>
                {openLog === n && (
                  <div className="flex flex-col gap-3 px-4 py-3 bg-zinc-950 border-t border-zinc-800">
                    <div>
                      <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-1">Input</p>
                      <p className="text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded px-3 py-2">{inputDesc}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                        Output · {output.length.toLocaleString('pt-BR')} chars
                      </p>
                      <pre className="text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded px-3 py-2.5 whitespace-pre-wrap break-words max-h-72 overflow-y-auto font-mono leading-relaxed dark-scroll">
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
        <div className="flex flex-col gap-3">
          <pre className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-4 py-3 whitespace-pre-wrap break-all max-h-40 overflow-y-auto dark-scroll">
            {error}
          </pre>
          <button
            onClick={run}
            disabled={imageBlobs.length === 0}
            className="self-start flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-sm text-base font-medium hover:bg-violet-400 active:scale-95 transition-all disabled:opacity-40"
          >
             Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 3 — Review ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ItemMedicao['status'], { label: string; color: string; icon: string; badge: string }> = {
  confirmado: {
    label: 'confirmado',
    color: 'text-zinc-300',
    icon: '✓',
    badge: 'text-zinc-400 bg-zinc-800 border-zinc-700',
  },
  parcial: {
    label: 'Estimativa',
    color: 'text-zinc-400',
    icon: '−',
    badge: 'text-zinc-400 bg-zinc-800 border-zinc-700',
  },
  aguardando: {
    label: 'Não identificado',
    color: 'text-zinc-300',
    icon: '✕',
    badge: 'text-zinc-300 bg-zinc-800 border-zinc-700',
  },
};

type DimEdit = { c: number; l: number };

const SERVICE_CATALOG: { nome: string; unidade: 'un' | 'ml' }[] = [
  { nome: 'Instalacao movel',       unidade: 'ml' },
  { nome: 'Ferragens dobradica',    unidade: 'un' },
  { nome: 'Ferragens corredica',    unidade: 'un' },
  { nome: 'Fita de borda',          unidade: 'ml' },
  { nome: 'Porta de correr',        unidade: 'un' },
  { nome: 'Montagem in loco',       unidade: 'un' },
  { nome: 'Puxadores',              unidade: 'un' },
  { nome: 'Projeto executivo',      unidade: 'un' },
];

function ItemCard({
  item, dimEdit, servicoEdit, statusEdit, tipoEdit, onEditDims, onEditServicos, onConfirm, onMarkPartial, onEditTipo, onEditModulo, onRemove,
}: {
  item: ItemMedicao;
  dimEdit: DimEdit | undefined;
  servicoEdit: Servico[] | undefined;
  statusEdit: ItemMedicao['status'] | undefined;
  tipoEdit: string | undefined;
  onEditDims: (id: number, d: DimEdit) => void;
  onEditServicos: (id: number, svcs: Servico[]) => void;
  onConfirm: (id: number) => void;
  onMarkPartial: (id: number) => void;
  onEditTipo: (id: number, tipo: string) => void;
  onEditModulo: (id: number, modulo: string) => void;
  onRemove: (id: number) => void;
}) {
  const [showAddSvc, setShowAddSvc] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newQtd, setNewQtd] = useState('1');
  const [newUnit, setNewUnit] = useState<'un' | 'ml'>('un');
  const [showDropdown, setShowDropdown] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);
  const [confirmRemoveCard, setConfirmRemoveCard] = useState(false);
  const [editingTipo, setEditingTipo] = useState(false);
  const [tipoInput, setTipoInput] = useState('');
  const [showTipoDropdown, setShowTipoDropdown] = useState(false);
  const [editingModulo, setEditingModulo] = useState(false);
  const [moduloInput, setModuloInput] = useState('');
  const TIPO_OPTIONS = ['armario_alto', 'armario_baixo', 'gaveteiro', 'painel', 'prateleira', 'bancada', 'ilha', 'arremate', 'outro'];
  const [editingSvcIdx, setEditingSvcIdx] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editQtd, setEditQtd] = useState('');
  const [editUnit, setEditUnit] = useState<'un' | 'ml'>('un');
  const [showEditDropdown, setShowEditDropdown] = useState(false);

  const effectiveStatus = statusEdit ?? item.status;
  const effectiveTipo = tipoEdit ?? item.tipo;
  const st = STATUS_LABEL[effectiveStatus];
  const hasDims = item.comprimento_m != null && item.largura_m != null;
  const curC = dimEdit?.c ?? item.comprimento_m ?? 0;
  const curL = dimEdit?.l ?? item.largura_m ?? 0;
  const computedArea = hasDims ? parseFloat((curC * curL).toFixed(4)) : (item.area_m2 ?? 0);
  const isEdited = dimEdit !== undefined;
  const currentServicos = servicoEdit ?? item.servicos ?? [];

  const startEditSvc = (i: number) => {
    const s = currentServicos[i];
    setEditingSvcIdx(i); setEditNome(s.nome); setEditQtd(String(s.qtd)); setEditUnit(s.unidade); setShowEditDropdown(false);
  };

  const confirmEditSvc = () => {
    if (editingSvcIdx === null || !editNome.trim()) return;
    const updated = currentServicos.map((s, i) =>
      i === editingSvcIdx ? { nome: editNome.trim(), qtd: parseFloat(editQtd) || 1, unidade: editUnit } : s
    );
    onEditServicos(item.id, updated);
    setEditingSvcIdx(null);
  };

  const filteredEditCatalog = SERVICE_CATALOG.filter((s) => s.nome.toLowerCase().includes(editNome.toLowerCase()));
  const removeServico = (idx: number) => onEditServicos(item.id, currentServicos.filter((_, i) => i !== idx));
  const filteredCatalog = SERVICE_CATALOG.filter((s) => s.nome.toLowerCase().includes(newNome.toLowerCase()));

  const pickCatalogItem = (s: { nome: string; unidade: 'un' | 'ml' }) => {
    setNewNome(s.nome); setNewUnit(s.unidade); setShowDropdown(false);
  };

  const confirmAddSvc = () => {
    if (!newNome.trim()) return;
    const svc: Servico = { nome: newNome.trim(), qtd: parseFloat(newQtd) || 1, unidade: newUnit };
    onEditServicos(item.id, [...currentServicos, svc]);
    setNewNome(''); setNewQtd('1'); setNewUnit('un'); setShowAddSvc(false); setShowDropdown(false);
  };

  const inputBase = 'bg-zinc-800 border rounded text-right font-mono text-base focus:outline-none focus:ring-1 focus:ring-violet-500 text-zinc-100 px-1.5 py-0.5';

  return (
    <div id={`item-${item.id}`} className="rounded border bg-zinc-800/60 border-zinc-700/50 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-all hover:border-zinc-600/60 hover:-translate-y-px animate-fade-in">
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <span className="mt-0.5 flex-shrink-0 text-base font-bold text-violet-400 w-4 text-center leading-none">{st.icon}</span>

        <div className="flex-1 min-w-0">
          {/* Header row — module name + actions */}
          <div className="flex items-start justify-between gap-2">
            {editingModulo ? (
              <input
                autoFocus
                type="text"
                value={moduloInput}
                onChange={(e) => setModuloInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onEditModulo(item.id, moduloInput || item.modulo); setEditingModulo(false); }
                  if (e.key === 'Escape') setEditingModulo(false);
                }}
                onBlur={() => { onEditModulo(item.id, moduloInput || item.modulo); setEditingModulo(false); }}
                className="text-lg font-semibold bg-zinc-800 border border-violet-500 rounded px-2 py-0.5 text-zinc-100 focus:outline-none flex-1 min-w-0"
              />
            ) : (
              <button
                onClick={() => { setModuloInput(item.modulo); setEditingModulo(true); }}
                className="text-lg font-semibold text-zinc-100 leading-snug hover:text-zinc-300 transition-colors text-left"
                title="Clique para editar"
              >
                {item.modulo}
              </button>
            )}
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              {confirmRemoveCard ? (
                <>
                  <span className="text-sm text-red-400 font-medium">Remover?</span>
                  <button onClick={() => { onRemove(item.id); setConfirmRemoveCard(false); }} className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors">Sim</button>
                  <button onClick={() => setConfirmRemoveCard(false)} className="text-sm text-zinc-300 hover:text-zinc-200 transition-colors">Não</button>
                </>
              ) : (
                <>
                  {effectiveStatus !== 'confirmado' && (
                    <button
                      onClick={() => onConfirm(item.id)}
                      className="text-sm px-2 py-0.5 rounded border font-medium bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                    >
                      Validar
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmRemoveCard(true)}
                    className="text-zinc-400 hover:text-red-400 transition-colors text-base leading-none"
                    title="Remover item"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-row — tipo editável + status badge */}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {editingTipo ? (
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  value={tipoInput}
                  onChange={(e) => { setTipoInput(e.target.value); setShowTipoDropdown(true); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { onEditTipo(item.id, tipoInput || effectiveTipo); setEditingTipo(false); }
                    if (e.key === 'Escape') setEditingTipo(false);
                  }}
                  onBlur={() => { setTimeout(() => { onEditTipo(item.id, tipoInput || effectiveTipo); setEditingTipo(false); setShowTipoDropdown(false); }, 150); }}
                  className="bg-zinc-800 border border-violet-500 rounded px-2 py-0.5 text-sm text-zinc-100 focus:outline-none w-32"
                />
                {showTipoDropdown && (
                  <ul className="absolute z-20 left-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl text-sm dark-scroll" style={{ minWidth: '130px' }}>
                    {TIPO_OPTIONS.filter(t => t.includes(tipoInput.toLowerCase())).map(t => (
                      <li key={t}>
                        <button type="button" onMouseDown={() => { onEditTipo(item.id, t); setEditingTipo(false); setShowTipoDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 hover:bg-zinc-700 text-zinc-200">
                          {t}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <button
                onClick={() => { setTipoInput(effectiveTipo); setEditingTipo(true); setShowTipoDropdown(true); }}
                className="text-base text-zinc-400 hover:text-zinc-200 transition-colors text-left"
                title="Clique para editar"
              >
                {effectiveTipo}
              </button>
            )}
            {effectiveStatus !== 'confirmado' && (
              <>
                <span className="text-zinc-600 text-sm">·</span>
                <span className={`text-sm px-2 py-0.5 rounded border font-medium ${st.badge}`}>
                  {st.label}
                </span>
              </>
            )}
            {isEdited && <span className="text-violet-400 text-sm font-medium">editado</span>}
          </div>

          {/* Services */}
          <ul className="mt-2.5 flex flex-col gap-0.5">
            {currentServicos.map((s, i) => (
              <li key={i} className="text-base">
                {editingSvcIdx === i ? (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <div className="relative flex-1 min-w-0">
                        <input
                          autoFocus type="text" value={editNome}
                          onChange={(e) => { setEditNome(e.target.value); setShowEditDropdown(true); }}
                          onFocus={() => setShowEditDropdown(true)}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmEditSvc(); if (e.key === 'Escape') setEditingSvcIdx(null); }}
                          className="w-full bg-zinc-800 border border-violet-500 rounded px-2 py-1 text-base text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        {showEditDropdown && filteredEditCatalog.length > 0 && (
                          <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl max-h-44 overflow-y-auto text-base dark-scroll">
                            {filteredEditCatalog.map((opt) => (
                              <li key={opt.nome}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => { e.preventDefault(); setEditNome(opt.nome); setEditUnit(opt.unidade); setShowEditDropdown(false); }}
                                  className="w-full text-left px-3 py-2 hover:bg-zinc-700 flex items-center justify-between gap-2 text-zinc-200"
                                >
                                  <span>{opt.nome}</span>
                                  <span className="text-sm text-zinc-300 flex-shrink-0">{opt.unidade}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <input type="number" value={editQtd} onChange={(e) => setEditQtd(e.target.value)}
                        className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-base text-right text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                      <select value={editUnit} onChange={(e) => setEditUnit(e.target.value as 'un' | 'ml')}
                        className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-base text-zinc-200 focus:outline-none">
                        <option value="un">un</option>
                        <option value="ml">ml</option>
                      </select>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={confirmEditSvc} className="px-3 py-1 bg-violet-500 text-white rounded text-sm font-medium hover:bg-violet-400 transition-colors">Salvar</button>
                      <button onClick={() => setEditingSvcIdx(null)} className="px-3 py-1 border border-zinc-700 text-zinc-400 rounded text-sm hover:bg-zinc-800 transition-colors">Cancelar</button>
                    </div>
                  </div>
                ) : confirmRemoveIdx === i ? (
                  <div className="flex items-center gap-1.5 py-0.5">
                    <span className="text-sm text-red-400 font-medium">Remover?</span>
                    <button onClick={() => { removeServico(i); setConfirmRemoveIdx(null); }} className="text-sm font-semibold text-red-400 hover:text-red-300 transition-colors">Sim</button>
                    <button onClick={() => setConfirmRemoveIdx(null)} className="text-sm text-zinc-300 hover:text-zinc-300 transition-colors">Não</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <button onClick={() => setConfirmRemoveIdx(i)} title="Remover"
                      className="text-zinc-400 hover:text-red-400 transition-all flex-shrink-0">✕</button>
                    <button onClick={() => startEditSvc(i)} title="Editar"
                      className="text-zinc-400 hover:text-violet-400 transition-all flex-shrink-0">✎</button>
                    <span className="w-1 h-1 rounded-full bg-zinc-600 flex-shrink-0" />
                    <span className="text-base text-zinc-400">{s.nome}{s.unidade === 'ml' ? ` ${s.qtd}ml` : ''}</span>
                  </div>
                )}
              </li>
            ))}
            {showAddSvc ? (
              <li className="mt-2 flex flex-col gap-1.5">
                <div className="flex gap-1.5 flex-wrap items-center">
                  <div ref={comboRef} className="relative flex-1 min-w-0">
                    <input
                      autoFocus type="text" placeholder="Nome do serviço" value={newNome}
                      onChange={(e) => { setNewNome(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmAddSvc(); if (e.key === 'Escape') { setShowDropdown(false); setShowAddSvc(false); } }}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-base text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
                    />
                    {showDropdown && filteredCatalog.length > 0 && (
                      <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl max-h-52 overflow-y-auto text-base dark-scroll">
                        {filteredCatalog.map((s) => (
                          <li key={s.nome}>
                            <button
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); pickCatalogItem(s); }}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-700 flex items-center justify-between gap-2 text-zinc-200"
                            >
                              <span>{s.nome}</span>
                              <span className="text-sm text-zinc-300 flex-shrink-0">{s.unidade}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <input type="number" placeholder="Qtd" value={newQtd} onChange={(e) => setNewQtd(e.target.value)}
                    className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-base text-right text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                  <select value={newUnit} onChange={(e) => setNewUnit(e.target.value as 'un' | 'ml')}
                    className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-base text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500">
                    <option value="un">un</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={confirmAddSvc} className="px-3 py-1 bg-violet-500 text-white rounded text-sm font-medium hover:bg-violet-400 transition-colors">
                    Adicionar
                  </button>
                  <button onClick={() => { setShowAddSvc(false); setShowDropdown(false); }}
                    className="px-3 py-1 border border-zinc-700 text-zinc-400 rounded text-sm hover:bg-zinc-800 transition-colors">
                    Cancelar
                  </button>
                </div>
              </li>
            ) : (
              <li>
                <button onClick={() => setShowAddSvc(true)} className="mt-1 text-sm text-zinc-400 hover:text-violet-400 transition-colors flex items-center gap-1">
                  + Adicionar serviço
                </button>
              </li>
            )}
          </ul>

          {/* Pendências */}
          {(item.pendencias ?? []).length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1">
              {item.pendencias.map((p, i) => (
                <li key={i} className="text-base flex gap-1.5 items-start text-zinc-300">
                  
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Dimensions — material + C/L abaixo dos serviços */}
          {hasDims ? (
            <div className="mt-3 pt-3 border-t border-zinc-700/50 flex items-center gap-1.5 flex-wrap text-base">
              <span className="text-zinc-400">{item.material} · {item.espessura_cm ?? '?'}cm</span>
              <span className="text-zinc-600 mx-0.5">|</span>
              <label className="flex items-center gap-1 text-zinc-400">
                C:
                <input
                  type="number" step="0.01" min="0" value={curC}
                  onChange={(e) => onEditDims(item.id, { c: parseFloat(e.target.value) || 0, l: curL })}
                  className={`w-16 ${inputBase} ${isEdited ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-700'}`}
                />
                <span className="text-zinc-400">m</span>
              </label>
              <span className="text-zinc-500">×</span>
              <label className="flex items-center gap-1 text-zinc-400">
                L:
                <input
                  type="number" step="0.01" min="0" value={curL}
                  onChange={(e) => onEditDims(item.id, { c: curC, l: parseFloat(e.target.value) || 0 })}
                  className={`w-16 ${inputBase} ${isEdited ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-700'}`}
                />
                <span className="text-zinc-400">m</span>
              </label>
              <span className="text-zinc-500">=</span>
              <span className={`font-mono font-semibold ${isEdited ? 'text-violet-400' : 'text-zinc-300'}`}>
                {computedArea} m²
              </span>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-zinc-700/50 flex items-center gap-3 flex-wrap text-base">
              <span className="text-zinc-400">{item.material} · {item.espessura_cm ?? '?'}cm</span>
              <span className="font-mono text-zinc-300">{computedArea} m²</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Next available ID helper
let _nextId = Date.now();
function nextId() { return ++_nextId; }

function AddItemForm({
  defaultAmbiente, defaultMaterial, ambientes, onAdd, onCancel,
}: {
  defaultAmbiente: string;
  defaultMaterial: string;
  ambientes: string[];
  onAdd: (item: ItemMedicao) => void;
  onCancel: () => void;
}) {
  const [modulo, setModulo] = useState('');
  const [ambiente, setAmbiente] = useState(defaultAmbiente);
  const [tipo, setTipo] = useState('armario_baixo');
  const [comp, setComp] = useState('');
  const [larg, setLarg] = useState('');
  const [showAmbienteList, setShowAmbienteList] = useState(false);
  const [showTipoList, setShowTipoList] = useState(false);

  const TIPO_OPTIONS = ['armario_alto', 'armario_baixo', 'gaveteiro', 'painel', 'prateleira', 'bancada', 'ilha', 'arremate', 'outro'];

  // ATM-style mask: digits fill right-to-left, always 2 decimal places
  // "2" → "0.02", "20" → "0.20", "200" → "2.00", "2914" → "29.14"
  const applyDecimalMask = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, padded.length - 2).replace(/^0+(?=\d)/, '') || '0';
    const decPart = padded.slice(-2);
    return `${intPart}.${decPart}`;
  };
  const handleDimChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(applyDecimalMask(e.target.value));
  };

  const parseNum = (v: string) => parseFloat(v.replace(',', '.')) || 0;
  const computedArea = parseFloat((parseNum(comp) * parseNum(larg)).toFixed(4));

  const handleAdd = () => {
    if (!modulo || !comp || !larg) return;
    const c = parseNum(comp);
    const l = parseNum(larg);
    onAdd({
      id: nextId(),
      prancha_idx: null,
      status: 'confirmado',
      ambiente: ambiente || 'Outros',
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
    setModulo(''); setComp(''); setLarg('');
  };

  const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-sm px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500';

  const filteredAmbientes = ambientes.filter(a => a.toLowerCase().includes(ambiente.toLowerCase()));
  const filteredTipos = TIPO_OPTIONS.filter(t => t.toLowerCase().includes(tipo.toLowerCase()));

  return (
    <div className="rounded border-2 border-dashed border-violet-500/30 bg-violet-500/5 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-violet-400 flex items-center gap-1.5">
        + Adicionar item
      </p>
      <div className="flex gap-2 flex-wrap">
        <input type="text" placeholder="Nome do módulo" value={modulo} onChange={(e) => setModulo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          className={`flex-1 min-w-32 ${inputCls}`} />

        {/* Ambiente com lista */}
        <div className="relative w-36">
          <input
            type="text" placeholder="Ambiente" value={ambiente}
            onChange={(e) => { setAmbiente(e.target.value); setShowAmbienteList(true); }}
            onFocus={() => setShowAmbienteList(true)}
            onBlur={() => setTimeout(() => setShowAmbienteList(false), 150)}
            className={`w-full ${inputCls}`}
          />
          {showAmbienteList && filteredAmbientes.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl max-h-40 overflow-y-auto text-sm dark-scroll">
              {filteredAmbientes.map(a => (
                <li key={a}>
                  <button type="button" onMouseDown={() => { setAmbiente(a); setShowAmbienteList(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-700 text-zinc-200">
                    {a}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tipo com lista */}
        <div className="relative w-36">
          <input
            type="text" placeholder="Tipo" value={tipo}
            onChange={(e) => { setTipo(e.target.value); setShowTipoList(true); }}
            onFocus={() => setShowTipoList(true)}
            onBlur={() => setTimeout(() => setShowTipoList(false), 150)}
            className={`w-full ${inputCls}`}
          />
          {showTipoList && filteredTipos.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl max-h-40 overflow-y-auto text-sm dark-scroll">
              {filteredTipos.map(t => (
                <li key={t}>
                  <button type="button" onMouseDown={() => { setTipo(t); setShowTipoList(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-zinc-700 text-zinc-200">
                    {t}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-center text-sm font-medium text-zinc-400">
        <label className="flex items-center gap-1">
          C:
          <input
            type="text" inputMode="decimal" placeholder="0.00" value={comp}
            onChange={handleDimChange(setComp)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 text-right font-mono text-zinc-100"
          />
          <span className="text-zinc-400">m</span>
        </label>
        <span className="text-zinc-500">×</span>
        <label className="flex items-center gap-1">
          L:
          <input
            type="text" inputMode="decimal" placeholder="0.00" value={larg}
            onChange={handleDimChange(setLarg)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 text-right font-mono text-zinc-100"
          />
          <span className="text-zinc-400">m</span>
        </label>
        <span className="text-zinc-500">=</span>
        <span className="font-mono font-semibold text-violet-400">{computedArea} m²</span>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="text-sm px-3 py-1.5 rounded-sm border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors">
          Cancelar
        </button>
        <button onClick={handleAdd} disabled={!modulo || !comp || !larg}
          className="text-sm px-3 py-1.5 rounded-sm bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40 transition-colors">
          Adicionar
        </button>
      </div>
    </div>
  );
}

function StepReview({
  folha, imageBlobs, flushRef, onDone,
}: {
  folha: FolhaMedicao;
  imageBlobs: Blob[];
  flushRef: React.MutableRefObject<() => void>;
  onDone: (updated: FolhaMedicao) => void;
}) {
  const [edits, setEdits] = useState<Record<number, DimEdit>>({});
  const [servicoEdits, setServicosEdits] = useState<Record<number, Servico[]>>({});
  const [statusEdits, setStatusEdits] = useState<Record<number, ItemMedicao['status']>>({});
  const [tipoEdits, setTipoEdits] = useState<Record<number, string>>({});
  const [moduloEdits, setModuloEdits] = useState<Record<number, string>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [addedItems, setAddedItems] = useState<ItemMedicao[]>([]);
  const [showAddFormFor, setShowAddFormFor] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [zoomLabel, setZoomLabel] = useState('');
  const [viewingImageIdx, setViewingImageIdx] = useState(0);

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
  const applyServicos = (id: number, svcs: Servico[]) => setServicosEdits((prev) => ({ ...prev, [id]: svcs }));
  const applyTipo = (id: number, tipo: string) => setTipoEdits((prev) => ({ ...prev, [id]: tipo }));
  const applyModulo = (id: number, modulo: string) => setModuloEdits((prev) => ({ ...prev, [id]: modulo }));
  const confirmItem = (id: number) => setStatusEdits((prev) => ({ ...prev, [id]: 'confirmado' }));
  const markPartial = (id: number) => setStatusEdits((prev) => ({ ...prev, [id]: 'parcial' }));
  const removeItem = (id: number) => setRemovedIds((prev) => new Set([...prev, id]));
  const addItemToGroup = (item: ItemMedicao) => { setAddedItems((prev) => [...prev, item]); setShowAddFormFor(null); };

  const visibleItems = useMemo(
    () => [...folha.itens, ...addedItems].filter((i) => !removedIds.has(i.id)),
    [folha.itens, addedItems, removedIds]
  );

  // Group by ambiente
  const grouped = useMemo(() => {
    const map = new Map<string, ItemMedicao[]>();
    for (const item of visibleItems) {
      const env = item.ambiente || 'Outros';
      if (!map.has(env)) map.set(env, []);
      map.get(env)!.push(item);
    }
    return [...map.entries()];
  }, [visibleItems]);

  const countByStatus = {
    confirmado: visibleItems.filter((i) => (statusEdits[i.id] ?? i.status) === 'confirmado').length,
    parcial: visibleItems.filter((i) => (statusEdits[i.id] ?? i.status) === 'parcial').length,
    aguardando: visibleItems.filter((i) => (statusEdits[i.id] ?? i.status) === 'aguardando').length,
  };
  const totalPendencias = visibleItems.reduce((s, i) => s + (i.pendencias?.length ?? 0), 0);

  const buildUpdatedFolha = (): FolhaMedicao => ({
    ...folha,
    itens: visibleItems.map((item) => {
      const d = edits[item.id];
      const svcs = servicoEdits[item.id];
      const st = statusEdits[item.id];
      const tp = tipoEdits[item.id];
      const mod = moduloEdits[item.id];
      return {
        ...item,
        ...(d ? { comprimento_m: d.c, largura_m: d.l, area_m2: parseFloat((d.c * d.l).toFixed(4)) } : {}),
        ...(svcs ? { servicos: svcs } : {}),
        ...(st ? { status: st } : {}),
        ...(tp ? { tipo: tp as ItemMedicao['tipo'] } : {}),
        ...(mod ? { modulo: mod } : {}),
      };
    }),
  });

  useEffect(() => {
    flushRef.current = () => onDone(buildUpdatedFolha());
  });

  const defaultMaterial = folha.itens[0]?.material ?? 'MDF Branco';

  return (
    <div className="flex gap-5 w-full items-start animate-fade-in">
      {zoomUrl && (
        <ZoomModal
          url={zoomUrl}
          label={zoomLabel}
          onClose={() => setZoomUrl(null)}
          hasPrev={viewingImageIdx > 0}
          hasNext={viewingImageIdx < imageUrls.length - 1}
          onPrev={() => {
            const idx = viewingImageIdx - 1;
            setViewingImageIdx(idx);
            setZoomUrl(imageUrls[idx]);
            setZoomLabel(`Prancha ${idx + 1}`);
          }}
          onNext={() => {
            const idx = viewingImageIdx + 1;
            setViewingImageIdx(idx);
            setZoomUrl(imageUrls[idx]);
            setZoomLabel(`Prancha ${idx + 1}`);
          }}
        />
      )}

      {/* ── LEFT: items list ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Revisão do Projeto</h2>
              <p className="text-base text-zinc-300 mt-0.5">{folha.projeto}</p>
            </div>
          </div>
          {/* Status summary */}
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
              <span className="text-violet-400 font-bold text-sm">✓</span>
              {countByStatus.confirmado} confirmados
            </span>
            <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
              <span className="text-violet-400 font-bold text-sm">−</span>
              {countByStatus.parcial} estimativas
            </span>
            <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
              <span className="text-violet-400 font-bold text-sm">✕</span>
              {countByStatus.aguardando} não identificados
            </span>
            {totalPendencias > 0 && (
              <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                 {totalPendencias} pendências
              </span>
            )}
            {removedIds.size > 0 && (
              <span className="text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                ✕ {removedIds.size} removidos
              </span>
            )}
            {addedItems.length > 0 && (
              <span className="text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                + {addedItems.length} adicionados
              </span>
            )}
          </div>
        </div>

        {/* Items grouped by ambiente */}
        <div className="flex flex-col gap-4">
          {grouped.map(([ambiente, items]) => {
            const totalArea = items.reduce((s, i) => {
              const d = edits[i.id];
              const area = d ? parseFloat((d.c * d.l).toFixed(4)) : (i.area_m2 ?? 0);
              return s + area;
            }, 0);

            return (
              <div key={ambiente}>
                {/* Ambiente header */}
                <div className="flex items-center gap-3 px-1 pb-2 mb-1">
                  <span className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">{ambiente}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-sm text-zinc-400">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                  <span className="text-sm text-zinc-500 font-mono">{totalArea.toFixed(2)} m²</span>
                </div>
                {/* Items */}
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      dimEdit={edits[item.id]}
                      servicoEdit={servicoEdits[item.id]}
                      statusEdit={statusEdits[item.id]}
                      tipoEdit={tipoEdits[item.id]}
                      onEditDims={applyEdit}
                      onEditServicos={applyServicos}
                      onConfirm={confirmItem}
                      onMarkPartial={markPartial}
                      onEditTipo={applyTipo}
                      onEditModulo={applyModulo}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Add item */}
          {showAddFormFor === 'global' ? (
            <AddItemForm
              defaultAmbiente=""
              defaultMaterial={defaultMaterial}
              ambientes={grouped.map(([env]) => env)}
              onAdd={addItemToGroup}
              onCancel={() => setShowAddFormFor(null)}
            />
          ) : (
            <button
              onClick={() => setShowAddFormFor('global')}
              className="w-full py-2.5 rounded border border-dashed border-zinc-700 text-sm text-zinc-400 hover:border-violet-500/40 hover:text-violet-400 transition-all flex items-center justify-center gap-1.5"
            >
              + Adicionar item
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center justify-end pt-1">
          <button
            onClick={() => onDone(buildUpdatedFolha())}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 text-white rounded text-base font-medium hover:bg-violet-400 active:scale-95 transition-all"
          >
            Ver Orçamento ?
          </button>
        </div>
      </div>

      {/* ── RIGHT: sticky image panel ── */}
      <div className="flex-shrink-0 sticky top-0 self-start" style={{ width: '1020px' }}>
        <div className="rounded-sm overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col" style={{ height: 'calc(100vh - 32px)' }}>
          {/* Image */}
          <div
            className="relative bg-zinc-950 flex items-center justify-center cursor-zoom-in flex-1 min-h-0"
            onClick={() => {
              if (currentViewUrl) { setZoomUrl(currentViewUrl); setZoomLabel(`Prancha ${viewingImageIdx + 1}`); }
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
              <div className="flex flex-col items-center gap-3 text-zinc-400">
                
                <p className="text-base text-center px-8">
                  {imageBlobs.length === 0
                    ? 'Re-faça o upload do PDF para ver as imagens'
                    : `Prancha ${viewingImageIdx + 1} sem imagem`}
                </p>
              </div>
            )}
            {/* Nav arrows */}
            <button
              onClick={(e) => { e.stopPropagation(); setViewingImageIdx((i) => Math.max(0, i - 1)); }}
              disabled={viewingImageIdx === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-16 flex items-center justify-center rounded bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 transition-all backdrop-blur-sm"
            >
              ←
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewingImageIdx((i) => Math.min(imageUrls.length - 1, i + 1)); }}
              disabled={viewingImageIdx >= imageUrls.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-16 flex items-center justify-center rounded bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 transition-all backdrop-blur-sm"
            >
              →
            </button>
            {/* Legends */}
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              {[
                { icon: '✓', label: 'confirmado' },
                { icon: '−', label: 'estimativa' },
                { icon: '✕', label: 'não id.' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 bg-black/60 text-white text-sm px-2 py-1 rounded backdrop-blur-sm">
                  <span className="text-violet-400 font-bold">{icon}</span> {label}
                </div>
              ))}
            </div>
            {currentViewUrl && (
              <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white text-sm px-2 py-0.5 rounded pointer-events-none flex items-center gap-1">
                 zoom
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          <div className="h-12 bg-zinc-900 border-t border-zinc-800 px-2 flex items-center gap-1">
            <div className="flex-1 flex gap-1 overflow-x-auto py-1 dark-scroll">
              {imageUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setViewingImageIdx(i)}
                  title={`Prancha ${i + 1}`}
                  className={`flex-shrink-0 rounded-sm overflow-hidden border-2 transition-all ${
                    i === viewingImageIdx ? 'border-violet-500' : 'border-transparent opacity-40 hover:opacity-70'
                  }`}
                >
                  <img src={url} alt={`p${i + 1}`} className="h-7 w-10 object-cover" />
                </button>
              ))}
            </div>
            <span className="text-zinc-400 text-sm ml-2 flex-shrink-0 tabular-nums">
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

function StepOrcamento({
  folha, resultado, tokenLogs, onRestart, onGoToReview,
}: {
  folha: FolhaMedicao;
  resultado: ResultadoOrcamento;
  tokenLogs: TokenLog[];
  onRestart: () => void;
  onGoToReview: (itemId: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expandedAmbiente, setExpandedAmbiente] = useState<string | null>(null);

  const totalItems = folha.itens.length;
  const confirmados = folha.itens.filter((i) => i.status === 'confirmado').length;
  const estimativas = folha.itens.filter((i) => i.status === 'parcial').length;
  const naoIdentificados = folha.itens.filter((i) => i.status === 'aguardando').length;
  const totalPendencias = folha.itens.reduce((s, i) => s + (i.pendencias?.length ?? 0), 0);
  const totalArea = folha.itens.reduce((s, i) => s + (i.area_m2 ?? 0), 0);
  const confidenceScore = totalItems > 0 ? Math.round((confirmados / totalItems) * 100) : 0;

  const confidenceColor = confidenceScore >= 80 ? 'text-zinc-200' : confidenceScore >= 50 ? 'text-zinc-300' : 'text-zinc-400';
  const confidenceBg = 'bg-zinc-800 border-zinc-700';

  // Group resultado.itens by ambiente
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

      {/* ── Hero ── */}
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

      {/* ── Resumo da IA ── */}
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

      {/* ── Itens por ambiente ── */}
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
                              <p className="text-sm text-zinc-400">{item.tipo}</p>
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

      {/* ── Por material ── */}
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

      {/* ── Pendências ── */}
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

      {IS_DEV && <TokenLogPanel logs={tokenLogs} />}

      {/* ── Actions ── */}
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
    </div>
  );
}

// ─── Stepper (hidden on step 1) ───────────────────────────────────────────────

function Stepper({
  current, accessible, onNavigate, onReset,
}: {
  current: Step;
  accessible: Set<Step>;
  onNavigate: (s: Step) => void;
  onReset: () => void;
}) {
  if (current === 1) return null;

  // Steps 3 & 4: compact bar with only Revisão/Orçamento + Novo Projeto button
  if (current >= 3) {
    const lateSteps: { num: Step; label: string }[] = [
      { num: 3, label: 'Revisão' },
      { num: 4, label: 'Orçamento' },
    ];
    return (
      <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto mb-8">
        {lateSteps.map(({ num, label }, idx) => {
          const done = current > num;
          const active = current === num;
          const clickable = (accessible?.has(num) ?? false) && num !== current;
          return (
            <div key={num} className="flex items-center flex-1">
              <button
                onClick={() => clickable && onNavigate(num)}
                disabled={!clickable}
                className={`flex flex-col items-center flex-shrink-0 transition-all ${clickable ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
              >
                <span className={`text-sm font-medium ${
                  active ? 'text-violet-400' : done ? 'text-violet-500' : 'text-zinc-400'
                }`}>{label}</span>
              </button>
              {idx < lateSteps.length - 1 && (
                <div className={`h-px flex-1 mx-2 transition-colors ${done ? 'bg-violet-900/40' : 'bg-zinc-800'}`} />
              )}
            </div>
          );
        })}
        <div className="ml-6 flex-shrink-0">
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-sm border border-zinc-700 text-zinc-400 rounded hover:border-zinc-500 hover:text-zinc-200 transition-all"
          >
            Novo Projeto
          </button>
        </div>
      </div>
    );
  }

  const steps = ['Upload', 'Análise IA', 'Revisão', 'Orçamento'];

  return (
    <div className="flex items-center gap-0 w-full max-w-lg mx-auto mb-8">
      {steps.map((label, idx) => {
        const num = (idx + 1) as Step;
        const done = current > num;
        const active = current === num;
        const clickable = (accessible?.has(num) ?? false) && num !== current;
        return (
          <div key={num} className="flex items-center flex-1">
            <button
              onClick={() => clickable && onNavigate(num)}
              disabled={!clickable}
              className={`flex flex-col items-center flex-shrink-0 transition-all ${clickable ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
            >
              <span className={`text-xl font-bold ${
                done ? 'text-violet-500' : active ? 'text-violet-400' : 'text-zinc-400'
              }`}>{num}</span>
              <span className={`text-sm mt-1 font-medium ${
                active ? 'text-violet-400' : done ? 'text-violet-500' : 'text-zinc-400'
              }`}>
                {label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div className={`h-px flex-1 mx-2 mb-5 transition-colors ${done ? 'bg-violet-900/40' : 'bg-zinc-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── IndexedDB ────────────────────────────────────────────────────────────────

const IDB_NAME  = 'orcamento_marcenaria_idb_v1';
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

// ─── localStorage ─────────────────────────────────────────────────────────────

const LS_KEY      = 'orcamento_marcenaria_pipeline_v1';
const HISTORY_KEY = 'orcamento_marcenaria_history_v1';
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
  try { const raw = localStorage.getItem(LS_KEY); return raw ? (JSON.parse(raw) as PersistedState) : null; }
  catch { return null; }
}
function savePersisted(s: PersistedState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* quota */ }
}
function clearPersisted() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}
function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? (JSON.parse(raw) as HistoryEntry[]) : []; }
  catch { return []; }
}
function saveToHistory(
  folha: FolhaMedicao, resultado: ResultadoOrcamento,
  stage1Output: string | null, stage2Output: string | null, tokenLogs: TokenLog[]
) {
  try {
    const history = loadHistory();
    const totalPendencias = folha.itens.reduce((s, i) => s + (i.pendencias?.length ?? 0), 0);
    const existing = history.findIndex((e) => e.projeto === folha.projeto);
    const entry: HistoryEntry = {
      id: existing >= 0 ? history[existing].id : `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      savedAt: Date.now(), projeto: folha.projeto, totalGeral: resultado.totalGeral, totalPendencias,
      stage1Output, stage2Output, folha, resultado, tokenLogs,
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
  history, onLoad, onDelete, onClose,
}: {
  history: HistoryEntry[];
  onLoad: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-sm p-6 text-center">
        <p className="text-base text-zinc-300">Nenhum orçamento salvo ainda.</p>
        <button onClick={onClose} className="mt-3 text-sm text-zinc-400 hover:text-zinc-400 underline transition-colors">
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 border-b border-zinc-800">
        <h3 className="text-base font-semibold text-zinc-300 flex items-center gap-2">
          
          Histórico — {history.length} orçamentos
        </h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-400 transition-colors">
          ✕
        </button>
      </div>
      <div className="divide-y divide-zinc-800">
        {history.map((entry) => (
          <div key={entry.id} className="flex items-start gap-4 px-5 py-4 hover:bg-zinc-800/50 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-zinc-200 truncate">{entry.projeto}</p>
              <p className="text-sm text-zinc-400 mt-0.5">
                {new Date(entry.savedAt).toLocaleString('pt-BR')}
              </p>
              <div className="mt-1.5 flex gap-3 flex-wrap text-sm">
                <span className="font-semibold text-zinc-300">
                  {entry.totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                {entry.totalPendencias > 0 && (
                  <span className="text-amber-400 flex items-center gap-1">
                     {entry.totalPendencias} pendências
                  </span>
                )}
                <span className="text-zinc-400">{entry.folha.itens.length} itens</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => onLoad(entry)}
                className="text-sm px-3 py-1.5 bg-violet-500 text-white rounded-sm hover:bg-violet-400 active:scale-95 transition-all"
              >
                Carregar
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                className="text-sm px-2.5 py-1.5 border border-zinc-700 text-zinc-300 rounded-sm hover:bg-zinc-800 hover:text-red-400 active:scale-95 transition-all"
              >
                ?
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
  const reviewFlushRef = useRef<() => void>(() => {});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [imageBlobs, setImageBlobs] = useState<Blob[]>([]);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);
  const [stage1Output, setStage1Output] = useState<string | null>(null);
  const [stage2Output, setStage2Output] = useState<string | null>(null);
  const [folha, setFolha] = useState<FolhaMedicao | null>(null);
  const [resultado, setResultado] = useState<ResultadoOrcamento | null>(null);
  const [tokenLogs, setTokenLogs] = useState<TokenLog[]>([]);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [waJobs, setWaJobs] = useState<WaJob[]>([]);
  const [showWaInbox, setShowWaInbox] = useState(false);

  // Polling WhatsApp inbox a cada 10s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/whatsapp-jobs');
        if (!res.ok) return;
        const json = (await res.json()) as { jobs: WaJob[] };
        setWaJobs(json.jobs.filter((j) => j.status === 'done' && j.folha));
      } catch { /* silencioso */ }
    };
    poll();
    const interval = setInterval(poll, 10_000);
    return () => clearInterval(interval);
  }, []);

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
    loadIDBBlobs().then((blobs) => { if (blobs.length > 0) setImageBlobs(blobs); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (imageBlobs.length > 0) saveIDBBlobs(imageBlobs);
  }, [imageBlobs]);

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
        return idx >= 0 ? prev.map((l, i) => (i === idx ? u.tokenLog! : l)) : [...prev, u.tokenLog!];
      });
    }
  }, []);

  const carregarJobWa = useCallback(async (job: WaJob) => {
    if (!job.folha) return;
    handleUpdate({ folha: job.folha, resultado: job.resultado ?? undefined });
    setStep(3);
    setShowWaInbox(false);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    await fetch(`/api/whatsapp-jobs?id=${job.id}`, { method: 'PATCH' });
    setWaJobs((prev) => prev.filter((j) => j.id !== job.id));
  }, [handleUpdate]);

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
    setStep(1); setImageBlobs([]); setPageTexts([]);
    setStage1Output(null); setStage2Output(null);
    setFolha(null); setResultado(null);
    setTokenLogs([]); setRestoredAt(null);
  };

  const accessible = new Set<Step>([1]);
  if (imageBlobs.length > 0 || stage1Output) accessible.add(2);
  if (folha) accessible.add(3);
  if (resultado) accessible.add(4);

  return (
    <div ref={scrollContainerRef} className="h-screen overflow-y-auto bg-black py-10 px-4 dark-scroll">
      <div className={`mx-auto transition-all duration-300 ${step === 3 ? 'w-full max-w-[1800px] px-4' : 'max-w-2xl'}`}>

        {/* ── WhatsApp Inbox ─────────────────────────────────────────────── */}
        {waJobs.length > 0 && (
          <div className="mb-4 animate-fade-in">
            <button
              onClick={() => setShowWaInbox((o) => !o)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded border border-green-700/50 bg-green-950/40 hover:bg-green-950/60 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">📱</span>
                <span className="text-sm font-medium text-green-300">
                  {waJobs.length} orçamento{waJobs.length > 1 ? 's' : ''} do WhatsApp pronto{waJobs.length > 1 ? 's' : ''} para revisão
                </span>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-black text-xs font-bold">
                  {waJobs.length}
                </span>
              </div>
              <span className={`text-green-400 text-sm transition-transform inline-block ${showWaInbox ? 'rotate-90' : ''}`}>›</span>
            </button>

            {showWaInbox && (
              <div className="mt-1 rounded border border-green-800/40 bg-zinc-950 divide-y divide-zinc-800/60 overflow-hidden">
                {waJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-900/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {job.pdf_filename ?? 'arquivo.pdf'}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {new Date(job.created_at).toLocaleString('pt-BR')} · {job.phone}
                      </p>
                    </div>
                    <button
                      onClick={() => carregarJobWa(job)}
                      className="flex-shrink-0 text-sm px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-500 active:scale-95 transition-all font-medium"
                    >
                      Revisar →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Top bar — history button always visible (except step 1 hero) */}
        {step === 1 && (
          <div className="mb-2 flex justify-end animate-fade-in">
            <button
              onClick={() => setShowHistory((o) => !o)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm border bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300 transition-all"
            >
              Histórico
              {history.length > 0 && (
                <span className="text-sm px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{history.length}</span>
              )}
            </button>
          </div>
        )}

        {restoredAt && step !== 1 && !showHistory && (
          <div className="mb-4 flex items-center justify-between gap-3 text-sm bg-violet-500/10 border border-violet-500/20 rounded px-4 py-2.5 animate-fade-in">
            <span className="text-violet-400">
              Sessão restaurada — {new Date(restoredAt).toLocaleString('pt-BR')}
            </span>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button onClick={reset} className="text-violet-400/70 hover:text-violet-300 underline transition-colors">
                Limpar sessão
              </button>
              <button
                onClick={() => setShowHistory((o) => !o)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm border font-medium transition-all ${
                  showHistory
                    ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                Histórico
                {history.length > 0 && (
                  <span className={`text-sm px-1.5 py-0.5 rounded ${
                    showHistory ? 'bg-zinc-600 text-zinc-200' : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {history.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {!restoredAt && step !== 1 && (
          <div className="mb-4 flex justify-end animate-fade-in">
            <button
              onClick={() => setShowHistory((o) => !o)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-sm border font-medium transition-all ${
                showHistory
                  ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              Histórico
              {history.length > 0 && (
                <span className={`text-sm px-1.5 py-0.5 rounded ${
                  showHistory ? 'bg-zinc-600 text-zinc-200' : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {history.length}
                </span>
              )}
            </button>
          </div>
        )}

        {showHistory && (
          <HistoryPanel
            history={history}
            onLoad={loadFromHistory}
            onDelete={handleDeleteHistory}
            onClose={() => setShowHistory(false)}
          />
        )}

        <Stepper
          current={step}
          accessible={accessible}
          onNavigate={(s) => {
            if (s === 4 && step === 3) { reviewFlushRef.current(); }
            else setStep(s);
          }}
          onReset={reset}
        />

        {/* Step content */}
        <div className={step === 1 || step === 2 ? '' : 'bg-zinc-900 rounded-sm border border-zinc-800 p-8 shadow-2xl'}>
          {step === 1 && (
            <StepUpload
              onConversionStart={() => { setConverting(true); setStep(2); }}
              onDone={(blobs, texts) => {
                setImageBlobs(blobs);
                setPageTexts(texts);
                setConverting(false);
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
              converting={converting}
            />
          )}

          {step === 3 && folha && (
            <StepReview
              folha={folha}
              imageBlobs={imageBlobs}
              flushRef={reviewFlushRef}
              onDone={async (updated) => {
                if (updated !== folha) {
                  handleUpdate({ folha: updated });
                  const r = await fetch('/api/orcamento-marcenaria/calcular', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folha: updated }),
                  });
                  if (r.ok) handleUpdate({ resultado: await r.json() as ResultadoOrcamento });
                }
                setStep(4);
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {step === 4 && folha && resultado && (
            <StepOrcamento
              folha={folha}
              resultado={resultado}
              tokenLogs={tokenLogs}
              onRestart={reset}
              onGoToReview={(itemId) => {
                setStep(3);
                setTimeout(() => {
                  document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}





