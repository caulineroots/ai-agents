'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { FolhaOrcamento, ItemOrcamento } from '@/lib/orcamento-construtora/types';
import type { PranchaGroup } from '@/lib/orcamento-construtora/image-store';
import { routeByFilename, GRUPO_LABELS } from '@/lib/orcamento-construtora/prancha-router';
import { XLSX_POR_COD } from '@/lib/orcamento-construtora/xlsx-checklist-bln';
import type { GrupoEspecialista } from '@/lib/orcamento-construtora/xlsx-checklist-bln';
import { AddItemForm } from './AddItemForm';
import { ItemCard } from './ItemCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PranchaEntry {
  stem:       string;
  grupo:      GrupoEspecialista | null;
  previewUrl: string | null;
  isPdf:      boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StepReview({
  folha,
  groups,
  onDone,
}: {
  folha:  FolhaOrcamento;
  groups: PranchaGroup[];
  onDone: (updated: FolhaOrcamento) => void;
}) {
  // ── Edit state ─────────────────────────────────────────────────────────────
  const [edits,      setEdits]      = useState<Record<number, number>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [addedItems, setAddedItems] = useState<ItemOrcamento[]>([]);
  const [showAddFor, setShowAddFor] = useState(false);
  const [revisedIds, setRevisedIds] = useState<Set<number>>(new Set());

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [pranchaIdx, setPranchaIdx] = useState(0);
  const [reviewIdx,  setReviewIdx]  = useState(0);

  // ── Panel drag state ───────────────────────────────────────────────────────
  // panelPos drives initial render; during drag we mutate the DOM directly (no re-render)
  const [panelPos,   setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const panelDragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const panelRef     = useRef<HTMLDivElement>(null);
  const cardRefs     = useRef<(HTMLDivElement | null)[]>([]);

  // Initialise panel position client-side (avoids SSR mismatch)
  useEffect(() => {
    setPanelPos({ x: window.innerWidth - 390, y: 60 });
  }, []);

  // ── Zoom / pan (image) ─────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const imgDragRef        = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  // Refs para leitura sem stale closure no handler de scroll
  const zoomRef = useRef(zoom);
  const panRef  = useRef(pan);
  const rafRef  = useRef<number | null>(null);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current  = pan;  }, [pan]);

  // ── Preview URLs (PNG ou PDF) ───────────────────────────────────────────────
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isPdfFlags,  setIsPdfFlags]  = useState<boolean[]>([]);

  useEffect(() => {
    const urls = groups.map((g) => {
      if (g.imageFile) return URL.createObjectURL(g.imageFile);
      if (g.pdfFile)   return URL.createObjectURL(g.pdfFile);
      return '';
    });
    const flags = groups.map((g) => !g.imageFile && !!g.pdfFile);
    setPreviewUrls(urls);
    setIsPdfFlags(flags);
    return () => urls.forEach((u) => { if (u) URL.revokeObjectURL(u); });
  }, [groups]);

  // ── Prancha entries ────────────────────────────────────────────────────────
  const pranchas = useMemo<PranchaEntry[]>(() => {
    const stems   = groups.map((g) => g.stem);
    const routing = routeByFilename(stems);
    const stemToGrupo = new Map<string, GrupoEspecialista>();
    for (const [g, ss] of Object.entries(routing) as [GrupoEspecialista, string[]][]) {
      for (const s of ss) { if (!stemToGrupo.has(s)) stemToGrupo.set(s, g); }
    }
    return groups.map((g, i) => ({
      stem:       g.stem,
      grupo:      stemToGrupo.get(g.stem) ?? null,
      previewUrl: previewUrls[i] || null,
      isPdf:      isPdfFlags[i] ?? false,
    }));
  }, [groups, previewUrls, isPdfFlags]);

  const current = pranchas[pranchaIdx] ?? null;

  // ── Visible items ──────────────────────────────────────────────────────────
  const visibleItems = useMemo(
    () => [...folha.itens, ...addedItems].filter((i) => !removedIds.has(i.id)),
    [folha.itens, addedItems, removedIds],
  );

  // Items for current prancha's grupo
  const stripItems = useMemo(() => {
    if (!current?.grupo) return visibleItems;
    return visibleItems.filter((item) => {
      const cod = (item as ItemOrcamento & { cod?: string }).cod;
      if (!cod) return true;
      return XLSX_POR_COD[cod]?.grupo === current.grupo;
    });
  }, [visibleItems, current]);

  const counts = useMemo(() => ({
    confirmado: visibleItems.filter((i) => i.status === 'confirmado').length,
    parcial:    visibleItems.filter((i) => i.status === 'parcial').length,
    aguardando: visibleItems.filter((i) => i.status === 'aguardando').length,
  }), [visibleItems]);

  // ── Auto-scroll panel to active review card ────────────────────────────────
  useEffect(() => {
    const el = cardRefs.current[reviewIdx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [reviewIdx]);

  // Reset review cursor when prancha changes
  useEffect(() => { setReviewIdx(0); }, [pranchaIdx]);

  // ── Image zoom / pan handlers ──────────────────────────────────────────────
  useEffect(() => {
    const el = imageContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const mx   = e.clientX - (rect.left + rect.width  / 2);
      const my   = e.clientY - (rect.top  + rect.height / 2);

      const factor  = e.deltaY < 0 ? 1.08 : 0.92;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(8, Math.max(0.25, oldZoom * factor));
      const { x: px, y: py } = panRef.current;
      const ratio   = newZoom / oldZoom;
      const newPan  = { x: mx - (mx - px) * ratio, y: my - (my - py) * ratio };

      // Atualiza refs imediatamente (sem re-render)
      zoomRef.current = newZoom;
      panRef.current  = newPan;

      // RAF: agrupa múltiplos eventos de scroll num único re-render por frame
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setZoom(zoomRef.current);
        setPan(panRef.current);
        rafRef.current = null;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onImgPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    imgDragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const onImgPointerMove = useCallback((e: React.PointerEvent) => {
    if (!imgDragRef.current) return;
    setPan({
      x: imgDragRef.current.panX + (e.clientX - imgDragRef.current.startX),
      y: imgDragRef.current.panY + (e.clientY - imgDragRef.current.startY),
    });
  }, []);

  const onImgPointerUp = useCallback(() => { imgDragRef.current = null; }, []);

  const navigate = useCallback((idx: number) => {
    setPranchaIdx(idx);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') navigate(Math.min(pranchas.length - 1, pranchaIdx + 1));
      if (e.key === 'ArrowLeft')  navigate(Math.max(0, pranchaIdx - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pranchas.length, pranchaIdx, navigate]);

  // ── Panel drag handlers (DOM-direct — zero React re-renders during drag) ───
  const onPanelHandleDown = (e: React.PointerEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LABEL', 'A'].includes(tag)) return;
    if ((e.target as HTMLElement).closest('button, input, textarea, select, label, a')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const el = panelRef.current;
    const curX = el ? parseInt(el.style.left || '0', 10) : (panelPos?.x ?? 0);
    const curY = el ? parseInt(el.style.top  || '0', 10) : (panelPos?.y ?? 0);
    panelDragRef.current = { startX: e.clientX, startY: e.clientY, posX: curX, posY: curY };
    if (el) el.style.cursor = 'grabbing';
  };

  const onPanelHandleMove = (e: React.PointerEvent) => {
    if (!panelDragRef.current || !panelRef.current) return;
    const x = panelDragRef.current.posX + (e.clientX - panelDragRef.current.startX);
    const y = panelDragRef.current.posY + (e.clientY - panelDragRef.current.startY);
    // Move panel via direct DOM style — no setState, no re-render
    panelRef.current.style.left = `${x}px`;
    panelRef.current.style.top  = `${y}px`;
  };

  const onPanelHandleUp = () => {
    if (!panelDragRef.current || !panelRef.current) { panelDragRef.current = null; return; }
    // Sync final position back to React state (single re-render on release)
    const x = parseInt(panelRef.current.style.left || '0', 10);
    const y = parseInt(panelRef.current.style.top  || '0', 10);
    setPanelPos({ x, y });
    panelDragRef.current = null;
    panelRef.current.style.cursor = '';
  };

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const applyEdit      = (id: number, v: number) => setEdits((p) => ({ ...p, [id]: v }));
  const removeItem     = (id: number) => setRemovedIds((p) => new Set([...p, id]));
  const addItemToGroup = (item: ItemOrcamento) => { setAddedItems((p) => [...p, item]); setShowAddFor(false); };

  const hasChanges = Object.keys(edits).length > 0 || removedIds.size > 0 || addedItems.length > 0;

  const buildUpdatedFolha = (): FolhaOrcamento => ({
    ...folha,
    itens: visibleItems.map((item) => {
      const q = edits[item.id];
      return q !== undefined ? { ...item, quantidade: q } : item;
    }),
  });

  const PANEL_W = 368;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 overflow-hidden">

      {/* ── PDF image layer ── */}
      <div
        ref={imageContainerRef}
        className="absolute inset-0"
        style={{ cursor: imgDragRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={onImgPointerDown}
        onPointerMove={onImgPointerMove}
        onPointerUp={onImgPointerUp}
        onPointerCancel={onImgPointerUp}
      >
        {current?.previewUrl ? (
          current.isPdf ? (
            <iframe
              src={current.previewUrl}
              title={current.stem}
              className="absolute inset-0 w-full h-full border-0 bg-zinc-900"
              style={{ pointerEvents: 'auto' }}
            />
          ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
            <img
              src={current.previewUrl}
              alt={current.stem}
              draggable={false}
              style={{
                transform:       `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'center center',
                maxWidth:        '100%',
                maxHeight:       '100%',
                objectFit:       'contain',
                userSelect:      'none',
              }}
            />
          </div>
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
            <span className="text-5xl select-none">🖼</span>
            <p className="text-sm select-none">
              {pranchas.length === 0 ? 'Nenhuma prancha disponível' : 'Sem imagem para esta prancha'}
            </p>
          </div>
        )}

        {/* Prev / Next */}
        <button onClick={() => navigate(Math.max(0, pranchaIdx - 1))} disabled={pranchaIdx === 0}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-20 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 backdrop-blur-sm text-3xl font-thin transition-all">
          ‹
        </button>
        <button onClick={() => navigate(Math.min(pranchas.length - 1, pranchaIdx + 1))} disabled={pranchaIdx >= pranchas.length - 1}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-20 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 backdrop-blur-sm text-3xl font-thin transition-all">
          ›
        </button>

        {/* Zoom hint */}
        <div className="absolute bottom-3 left-3 text-xs text-zinc-700 pointer-events-none select-none">
          {current?.isPdf ? 'Role para navegar no PDF' : 'Ctrl + scroll · arrastar'}
        </div>
        {zoom !== 1 && (
          <div className="absolute top-3 left-3 text-xs bg-black/50 text-zinc-300 px-2 py-0.5 rounded-full pointer-events-none">
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 z-20 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <span className="text-sm font-semibold text-white">Revisão</span>
          {current?.grupo && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800/80 text-zinc-300">
              {current.grupo} · {GRUPO_LABELS[current.grupo]}
            </span>
          )}
          <span className="text-xs text-zinc-500">{pranchaIdx + 1}/{pranchas.length}</span>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{counts.confirmado}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{counts.parcial}
          </span>
          {counts.aguardando > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{counts.aguardando} pendentes
            </span>
          )}
          {hasChanges && (
            <button onClick={() => onDone(buildUpdatedFolha())}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 active:scale-95 transition-all">
              Aplicar
            </button>
          )}
          <button onClick={() => onDone(buildUpdatedFolha())}
            className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all">
            Ver Orçamento →
          </button>
        </div>
      </div>

      {/* ── Floating panel ── */}
      {panelPos && (
        <div
          ref={panelRef}
          className="absolute z-30 flex flex-col rounded-xl border border-zinc-700/60 bg-zinc-900/50 backdrop-blur-md shadow-2xl overflow-hidden"
          style={{
            left:      panelPos.x,
            top:       panelPos.y,
            width:     PANEL_W,
            maxHeight: 'calc(100vh - 80px)',
            cursor:    'grab',
          }}
          onPointerDown={onPanelHandleDown}
          onPointerMove={onPanelHandleMove}
          onPointerUp={onPanelHandleUp}
          onPointerCancel={onPanelHandleUp}
        >
          {/* Panel header */}
          <div
            className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-zinc-700/60 bg-zinc-800/50 select-none"
          >
            <div className="flex items-center gap-2">
              {/* Drag indicator dots */}
              <span className="flex flex-col gap-0.5 opacity-40">
                <span className="flex gap-0.5">{[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-zinc-400" />)}</span>
                <span className="flex gap-0.5">{[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-zinc-400" />)}</span>
              </span>
              <span className="text-xs font-semibold text-zinc-200">
                {stripItems.length} itens
                {current?.grupo ? ` — ${current.grupo}` : ''}
              </span>
              {stripItems.filter((i) => i.status === 'aguardando').length > 0 && (
                <span className="text-xs text-red-400">
                  {stripItems.filter((i) => i.status === 'aguardando').length} pendentes
                </span>
              )}
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setShowAddFor((v) => !v)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
            >
              + item
            </button>
          </div>

          {/* Add item form */}
          {showAddFor && (
            <div className="flex-shrink-0 px-3 py-2 border-b border-zinc-700/60 bg-zinc-800/30">
              <AddItemForm
                defaultAmbiente={current?.grupo ?? 'Geral'}
                onAdd={addItemToGroup}
                onCancel={() => setShowAddFor(false)}
              />
            </div>
          )}

          {/* Prancha thumbnails */}
          <div className="flex-shrink-0 flex gap-1.5 px-3 py-2 border-b border-zinc-700/60 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}>
            {pranchas.map((p, i) => (
              <button key={p.stem} onClick={() => navigate(i)} title={p.stem}
                className={`flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                  i === pranchaIdx ? 'border-blue-400 opacity-100' : 'border-transparent opacity-40 hover:opacity-70'
                }`}>
                {p.previewUrl
                  ? p.isPdf
                    ? <div className="h-9 w-12 bg-red-900/60 flex items-center justify-center text-red-200 text-[10px] font-bold">PDF</div>
                    : <img src={p.previewUrl} alt={p.stem} className="h-9 w-12 object-cover" />
                  : <div className="h-9 w-12 bg-zinc-700 flex items-center justify-center text-zinc-500 text-xs">?</div>
                }
              </button>
            ))}
          </div>

          {/* Card list */}
          <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-2" style={{ scrollbarWidth: 'thin', cursor: 'default' }}>
            {stripItems.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">
                Nenhum item para esta prancha
              </p>
            ) : (
              stripItems.map((item, i) => (
                <div key={item.id} ref={(el) => { cardRefs.current[i] = el; }}>
                  <ItemCard
                    item={item}
                    qtdEdit={edits[item.id]}
                    onEditQtd={applyEdit}
                    onRemove={removeItem}
                    isActive={i === reviewIdx && !revisedIds.has(item.id)}
                    isRevised={revisedIds.has(item.id)}
                    onToggleRevised={() => setRevisedIds((prev) => {
                      const s = new Set(prev); s.delete(item.id); return s;
                    })}
                    onRevisado={() => {
                      setRevisedIds((prev) => new Set([...prev, item.id]));
                      const nextUnrevised = stripItems.findIndex(
                        (it, j) => j > i && !revisedIds.has(it.id)
                      );
                      if (nextUnrevised !== -1) setReviewIdx(nextUnrevised);
                    }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Panel footer */}
          <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-zinc-700/60 bg-zinc-800/30">
            <span className="text-xs text-zinc-500">
              {stripItems.filter((it) => revisedIds.has(it.id)).length}/{Math.max(1, stripItems.length)} revisados
            </span>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ↺ reset zoom
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
