'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FolhaMedicao, ItemMedicao, Servico } from '@/lib/orcamento/types';

// ─── Zoom Modal ───────────────────────────────────────────────────────────────

export function ZoomModal({ url, label, onClose, onPrev, onNext, hasPrev, hasNext }: {
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
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: '12px', backgroundColor: 'rgba(24,24,27,0.9)', borderBottom: '1px solid rgb(39,39,42)' }}>
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
              <button key={p} onClick={() => zoomTo(p)} style={{ fontSize: '13px', borderRadius: '2px', padding: '4px 10px', fontVariantNumeric: 'tabular-nums', backgroundColor: active ? 'rgb(139,92,246)' : 'transparent', color: active ? 'white' : 'rgb(212,212,216)', fontWeight: active ? 600 : 400, border: active ? 'none' : '1px solid rgb(63,63,70)', cursor: 'pointer' }}>
                {Math.round(p * 100)}%
              </button>
            );
          })}
          <span style={{ color: 'rgb(161,161,170)', fontSize: '13px', fontVariantNumeric: 'tabular-nums', marginLeft: '4px' }}>{Math.round(scale * 100)}%</span>
          <button onClick={onClose} style={{ marginLeft: '12px', color: 'rgb(212,212,216)', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: scale > 1 ? 'grab' : 'default' }} onMouseDown={handleMouseDown} onDoubleClick={reset}>
        <img src={url} alt={label} draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`, transformOrigin: 'center center', cursor: scale > 1 ? 'grab' : 'default' }} />
      </div>
    </div>,
    document.body
  );
}

// ─── Step 3 helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ItemMedicao['status'], { label: string; color: string; icon: string; badge: string }> = {
  confirmado: { label: 'confirmado', color: 'text-zinc-300', icon: '✓', badge: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
  parcial:    { label: 'Estimativa', color: 'text-zinc-400', icon: '−', badge: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
  aguardando: { label: 'Não identificado', color: 'text-zinc-300', icon: '✕', badge: 'text-zinc-300 bg-zinc-800 border-zinc-700' },
};

type DimEdit = { c: number; l: number };

const SERVICE_CATALOG: { nome: string; unidade: 'un' | 'ml' }[] = [
  { nome: 'Rebaixo Italiano cozinha',      unidade: 'un' },
  { nome: 'Rebaixo Italiano lavanderia',   unidade: 'un' },
  { nome: 'Rebaixo Italiano outros',       unidade: 'un' },
  { nome: 'Recorte cooktop',               unidade: 'un' },
  { nome: 'Furo cuba embutir',             unidade: 'un' },
  { nome: 'Furo torneira',                 unidade: 'un' },
  { nome: 'Furo dispenser',               unidade: 'un' },
  { nome: 'Furo para torre de tomada',     unidade: 'un' },
  { nome: 'Borda Reta Meia Esquadria',     unidade: 'ml' },
  { nome: 'Acabamento Slim',               unidade: 'un' },
  { nome: 'Instalacao tampo sobre base',   unidade: 'ml' },
  { nome: 'Instalacao rodape',             unidade: 'ml' },
  { nome: 'Instalacao sobre movel',        unidade: 'ml' },
  { nome: 'Instalacao revestimento',       unidade: 'ml' },
  { nome: 'Canaleta LED',                  unidade: 'ml' },
  { nome: 'Cuba esculpida simples',        unidade: 'un' },
  { nome: 'Cuba esculpida com bandeja',    unidade: 'un' },
  { nome: 'Champanheira',                  unidade: 'un' },
  { nome: 'Tampa removivel',              unidade: 'un' },
];

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item, dimEdit, servicoEdit, statusEdit, tipoEdit, onEditDims, onEditServicos, onConfirm, onMarkPartial, onEditTipo, onEditModulo, onRemove, demoHint,
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
  demoHint?: string;
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
  const TIPO_OPTIONS = ['tampo', 'rodape', 'saia', 'revestimento', 'prateleira', 'painel', 'outro'];
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
        <span className="mt-0.5 flex-shrink-0 text-base font-bold text-violet-400 w-4 text-center leading-none">{st.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            {editingModulo ? (
              <input autoFocus type="text" value={moduloInput} onChange={(e) => setModuloInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onEditModulo(item.id, moduloInput || item.modulo); setEditingModulo(false); } if (e.key === 'Escape') setEditingModulo(false); }}
                onBlur={() => { onEditModulo(item.id, moduloInput || item.modulo); setEditingModulo(false); }}
                className="text-lg font-semibold bg-zinc-800 border border-violet-500 rounded px-2 py-0.5 text-zinc-100 focus:outline-none flex-1 min-w-0" />
            ) : (
              <button onClick={() => { setModuloInput(item.modulo); setEditingModulo(true); }} className="text-lg font-semibold text-zinc-100 leading-snug hover:text-zinc-300 transition-colors text-left" title="Clique para editar">
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
                    <button onClick={() => onConfirm(item.id)} className="text-sm px-2 py-0.5 rounded border font-medium bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors">Validar</button>
                  )}
                  <button onClick={() => setConfirmRemoveCard(true)} className="text-zinc-400 hover:text-red-400 transition-colors text-base leading-none" title="Remover item">✕</button>
                </>
              )}
            </div>
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {editingTipo ? (
              <div className="relative">
                <input autoFocus type="text" value={tipoInput}
                  onChange={(e) => { setTipoInput(e.target.value); setShowTipoDropdown(true); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { onEditTipo(item.id, tipoInput || effectiveTipo); setEditingTipo(false); } if (e.key === 'Escape') setEditingTipo(false); }}
                  onBlur={() => { setTimeout(() => { onEditTipo(item.id, tipoInput || effectiveTipo); setEditingTipo(false); setShowTipoDropdown(false); }, 150); }}
                  className="bg-zinc-800 border border-violet-500 rounded px-2 py-0.5 text-sm text-zinc-100 focus:outline-none w-32" />
                {showTipoDropdown && (
                  <ul className="absolute z-20 left-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl text-sm dark-scroll" style={{ minWidth: '130px' }}>
                    {TIPO_OPTIONS.filter(t => t.includes(tipoInput.toLowerCase())).map(t => (
                      <li key={t}><button type="button" onMouseDown={() => { onEditTipo(item.id, t); setEditingTipo(false); setShowTipoDropdown(false); }} className="w-full text-left px-3 py-1.5 hover:bg-zinc-700 text-zinc-200">{t}</button></li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <button onClick={() => { setTipoInput(effectiveTipo); setEditingTipo(true); setShowTipoDropdown(true); }} className="text-base text-zinc-400 hover:text-zinc-200 transition-colors text-left" title="Clique para editar">
                {effectiveTipo}
              </button>
            )}
            {effectiveStatus !== 'confirmado' && (
              <>
                <span className="text-zinc-600 text-sm">·</span>
                <span className={`text-sm px-2 py-0.5 rounded border font-medium ${st.badge}`}>{st.label}</span>
              </>
            )}
            {isEdited && <span className="text-violet-400 text-sm font-medium">editado</span>}
          </div>

          <ul className="mt-2.5 flex flex-col gap-0.5">
            {currentServicos.map((s, i) => (
              <li key={i} className="text-base">
                {editingSvcIdx === i ? (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <div className="relative flex-1 min-w-0">
                        <input autoFocus type="text" value={editNome}
                          onChange={(e) => { setEditNome(e.target.value); setShowEditDropdown(true); }}
                          onFocus={() => setShowEditDropdown(true)}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmEditSvc(); if (e.key === 'Escape') setEditingSvcIdx(null); }}
                          className="w-full bg-zinc-800 border border-violet-500 rounded px-2 py-1 text-base text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                        {showEditDropdown && filteredEditCatalog.length > 0 && (
                          <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl max-h-44 overflow-y-auto text-base dark-scroll">
                            {filteredEditCatalog.map((opt) => (
                              <li key={opt.nome}><button type="button" onMouseDown={(e) => { e.preventDefault(); setEditNome(opt.nome); setEditUnit(opt.unidade); setShowEditDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-zinc-700 flex items-center justify-between gap-2 text-zinc-200"><span>{opt.nome}</span><span className="text-sm text-zinc-300 flex-shrink-0">{opt.unidade}</span></button></li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <input type="number" value={editQtd} onChange={(e) => setEditQtd(e.target.value)} className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-base text-right text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                      <select value={editUnit} onChange={(e) => setEditUnit(e.target.value as 'un' | 'ml')} className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-base text-zinc-200 focus:outline-none">
                        <option value="un">un</option><option value="ml">ml</option>
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
                    <button onClick={() => setConfirmRemoveIdx(i)} title="Remover" className="text-zinc-400 hover:text-red-400 transition-all flex-shrink-0">✕</button>
                    <button onClick={() => startEditSvc(i)} title="Editar" className="text-zinc-400 hover:text-violet-400 transition-all flex-shrink-0">✎</button>
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
                    <input autoFocus type="text" placeholder="Nome do serviço" value={newNome}
                      onChange={(e) => { setNewNome(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmAddSvc(); if (e.key === 'Escape') { setShowDropdown(false); setShowAddSvc(false); } }}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-base text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500" />
                    {showDropdown && filteredCatalog.length > 0 && (
                      <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl max-h-52 overflow-y-auto text-base dark-scroll">
                        {filteredCatalog.map((s) => (
                          <li key={s.nome}><button type="button" onMouseDown={(e) => { e.preventDefault(); pickCatalogItem(s); }} className="w-full text-left px-3 py-2 hover:bg-zinc-700 flex items-center justify-between gap-2 text-zinc-200"><span>{s.nome}</span><span className="text-sm text-zinc-300 flex-shrink-0">{s.unidade}</span></button></li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <input type="number" placeholder="Qtd" value={newQtd} onChange={(e) => setNewQtd(e.target.value)} className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-base text-right text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                  <select value={newUnit} onChange={(e) => setNewUnit(e.target.value as 'un' | 'ml')} className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-base text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500">
                    <option value="un">un</option><option value="ml">ml</option>
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={confirmAddSvc} className="px-3 py-1 bg-violet-500 text-white rounded text-sm font-medium hover:bg-violet-400 transition-colors">Adicionar</button>
                  <button onClick={() => { setShowAddSvc(false); setShowDropdown(false); }} className="px-3 py-1 border border-zinc-700 text-zinc-400 rounded text-sm hover:bg-zinc-800 transition-colors">Cancelar</button>
                </div>
              </li>
            ) : (
              <li><button onClick={() => setShowAddSvc(true)} className="mt-1 text-sm text-zinc-400 hover:text-violet-400 transition-colors flex items-center gap-1">+ Adicionar serviço</button></li>
            )}
          </ul>

          {(item.pendencias ?? []).length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1">
              {item.pendencias.map((p, i) => (
                <li key={i} className="text-base flex gap-1.5 items-start text-zinc-300"><span>{p}</span></li>
              ))}
            </ul>
          )}

          {demoHint && (
            <div className="mt-3 flex items-start gap-2 rounded bg-amber-950/40 border border-amber-500/25 px-3 py-2.5">
              <span className="text-amber-400 text-sm font-bold flex-shrink-0 mt-px">!</span>
              <p className="text-sm text-amber-300/90 leading-snug">{demoHint}</p>
            </div>
          )}

          {hasDims ? (
            <div className="mt-3 pt-3 border-t border-zinc-700/50 flex items-center gap-1.5 flex-wrap text-base">
              <span className="text-zinc-400">{item.material} · {item.espessura_cm ?? '?'}cm</span>
              <span className="text-zinc-600 mx-0.5">|</span>
              <label className="flex items-center gap-1 text-zinc-400">C:
                <input type="number" step="0.01" min="0" value={curC} onChange={(e) => onEditDims(item.id, { c: parseFloat(e.target.value) || 0, l: curL })} className={`w-16 ${inputBase} ${isEdited ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-700'}`} />
                <span className="text-zinc-400">m</span>
              </label>
              <span className="text-zinc-500">×</span>
              <label className="flex items-center gap-1 text-zinc-400">L:
                <input type="number" step="0.01" min="0" value={curL} onChange={(e) => onEditDims(item.id, { c: curC, l: parseFloat(e.target.value) || 0 })} className={`w-16 ${inputBase} ${isEdited ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-zinc-700'}`} />
                <span className="text-zinc-400">m</span>
              </label>
              <span className="text-zinc-500">=</span>
              <span className={`font-mono font-semibold ${isEdited ? 'text-violet-400' : 'text-zinc-300'}`}>{computedArea} m²</span>
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

// ─── Next ID helper ───────────────────────────────────────────────────────────

let _nextId = Date.now();
function nextId() { return ++_nextId; }

// ─── AddItemForm ──────────────────────────────────────────────────────────────

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
  const [tipo, setTipo] = useState('tampo');
  const [comp, setComp] = useState('');
  const [larg, setLarg] = useState('');
  const [showAmbienteList, setShowAmbienteList] = useState(false);
  const [showTipoList, setShowTipoList] = useState(false);
  const TIPO_OPTIONS = ['tampo', 'rodape', 'saia', 'revestimento', 'prateleira', 'outro'];

  const applyDecimalMask = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return '';
    const padded = digits.padStart(3, '0');
    const intPart = padded.slice(0, padded.length - 2).replace(/^0+(?=\d)/, '') || '0';
    const decPart = padded.slice(-2);
    return `${intPart}.${decPart}`;
  };
  const handleDimChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { setter(applyDecimalMask(e.target.value)); };
  const parseNum = (v: string) => parseFloat(v.replace(',', '.')) || 0;
  const computedArea = parseFloat((parseNum(comp) * parseNum(larg)).toFixed(4));

  const handleAdd = () => {
    if (!modulo || !comp || !larg) return;
    const c = parseNum(comp); const l = parseNum(larg);
    onAdd({ id: nextId(), prancha_idx: null, status: 'confirmado', ambiente: ambiente || 'Outros', modulo, tipo, material: defaultMaterial, espessura_cm: 3, comprimento_m: c, largura_m: l, area_m2: parseFloat((c * l).toFixed(4)), servicos: [], pendencias: [] } as ItemMedicao);
    setModulo(''); setComp(''); setLarg('');
  };

  const inputCls = 'bg-zinc-800 border border-zinc-700 rounded-sm px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500';
  const filteredAmbientes = ambientes.filter(a => a.toLowerCase().includes(ambiente.toLowerCase()));
  const filteredTipos = TIPO_OPTIONS.filter(t => t.toLowerCase().includes(tipo.toLowerCase()));

  return (
    <div className="rounded border-2 border-dashed border-violet-500/30 bg-violet-500/5 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-violet-400 flex items-center gap-1.5">+ Adicionar item</p>
      <div className="flex gap-2 flex-wrap">
        <input type="text" placeholder="Nome do módulo" value={modulo} onChange={(e) => setModulo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} className={`flex-1 min-w-32 ${inputCls}`} />
        <div className="relative w-36">
          <input type="text" placeholder="Ambiente" value={ambiente} onChange={(e) => { setAmbiente(e.target.value); setShowAmbienteList(true); }} onFocus={() => setShowAmbienteList(true)} onBlur={() => setTimeout(() => setShowAmbienteList(false), 150)} className={`w-full ${inputCls}`} />
          {showAmbienteList && filteredAmbientes.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl max-h-40 overflow-y-auto text-sm dark-scroll">
              {filteredAmbientes.map(a => (<li key={a}><button type="button" onMouseDown={() => { setAmbiente(a); setShowAmbienteList(false); }} className="w-full text-left px-3 py-2 hover:bg-zinc-700 text-zinc-200">{a}</button></li>))}
            </ul>
          )}
        </div>
        <div className="relative w-36">
          <input type="text" placeholder="Tipo" value={tipo} onChange={(e) => { setTipo(e.target.value); setShowTipoList(true); }} onFocus={() => setShowTipoList(true)} onBlur={() => setTimeout(() => setShowTipoList(false), 150)} className={`w-full ${inputCls}`} />
          {showTipoList && filteredTipos.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 bg-zinc-800 border border-zinc-700 rounded-sm shadow-xl max-h-40 overflow-y-auto text-sm dark-scroll">
              {filteredTipos.map(t => (<li key={t}><button type="button" onMouseDown={() => { setTipo(t); setShowTipoList(false); }} className="w-full text-left px-3 py-2 hover:bg-zinc-700 text-zinc-200">{t}</button></li>))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-center text-sm font-medium text-zinc-400">
        <label className="flex items-center gap-1">C:
          <input type="text" inputMode="decimal" placeholder="0.00" value={comp} onChange={handleDimChange(setComp)} onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} className="w-20 bg-zinc-800 border border-zinc-700 rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 text-right font-mono text-zinc-100" />
          <span className="text-zinc-400">m</span>
        </label>
        <span className="text-zinc-500">×</span>
        <label className="flex items-center gap-1">L:
          <input type="text" inputMode="decimal" placeholder="0.00" value={larg} onChange={handleDimChange(setLarg)} onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} className="w-20 bg-zinc-800 border border-zinc-700 rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 text-right font-mono text-zinc-100" />
          <span className="text-zinc-400">m</span>
        </label>
        <span className="text-zinc-500">=</span>
        <span className="font-mono font-semibold text-violet-400">{computedArea} m²</span>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-sm border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors">Cancelar</button>
        <button onClick={handleAdd} disabled={!modulo || !comp || !larg} className="text-sm px-3 py-1.5 rounded-sm bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40 transition-colors">Adicionar</button>
      </div>
    </div>
  );
}

// ─── StepReview ───────────────────────────────────────────────────────────────

export function StepReview({
  folha, imageBlobs, imageUrls: imageUrlsProp, flushRef, onDone, imagePlaceholder, demoHints,
}: {
  folha: FolhaMedicao;
  imageBlobs: Blob[];
  imageUrls?: string[];
  flushRef: React.MutableRefObject<() => void>;
  onDone: (updated: FolhaMedicao) => void;
  imagePlaceholder?: string;
  demoHints?: Record<number, string>;
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
    if (imageUrlsProp) {
      setImageUrls(imageUrlsProp);
      return;
    }
    const urls = imageBlobs.map((b) => {
      const blob = b.type ? b : new Blob([b], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    });
    setImageUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageBlobs, imageUrlsProp]);

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

  const buildUpdatedFolha = useCallback((): FolhaMedicao => ({
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
  }), [folha, visibleItems, edits, servicoEdits, statusEdits, tipoEdits, moduloEdits]);

  useEffect(() => {
    flushRef.current = () => onDone(buildUpdatedFolha());
  });

  const defaultMaterial = folha.itens[0]?.material ?? 'Granito';

  return (
    <div className="flex gap-5 w-full items-start animate-fade-in">
      {zoomUrl && (
        <ZoomModal url={zoomUrl} label={zoomLabel} onClose={() => setZoomUrl(null)}
          hasPrev={viewingImageIdx > 0} hasNext={viewingImageIdx < imageUrls.length - 1}
          onPrev={() => { const idx = viewingImageIdx - 1; setViewingImageIdx(idx); setZoomUrl(imageUrls[idx]); setZoomLabel(`Prancha ${idx + 1}`); }}
          onNext={() => { const idx = viewingImageIdx + 1; setViewingImageIdx(idx); setZoomUrl(imageUrls[idx]); setZoomLabel(`Prancha ${idx + 1}`); }}
        />
      )}

      {/* LEFT: items list */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Revisão do Projeto</h2>
              <p className="text-base text-zinc-300 mt-0.5">{folha.projeto}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400"><span className="text-violet-400 font-bold text-sm">✓</span>{countByStatus.confirmado} confirmados</span>
            <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400"><span className="text-violet-400 font-bold text-sm">−</span>{countByStatus.parcial} estimativas</span>
            <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400"><span className="text-violet-400 font-bold text-sm">✕</span>{countByStatus.aguardando} não identificados</span>
            {totalPendencias > 0 && <span className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">{totalPendencias} pendências</span>}
            {removedIds.size > 0 && <span className="text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">✕ {removedIds.size} removidos</span>}
            {addedItems.length > 0 && <span className="text-sm px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">+ {addedItems.length} adicionados</span>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {grouped.map(([ambiente, items]) => {
            const totalArea = items.reduce((s, i) => { const d = edits[i.id]; const area = d ? parseFloat((d.c * d.l).toFixed(4)) : (i.area_m2 ?? 0); return s + area; }, 0);
            return (
              <div key={ambiente}>
                <div className="flex items-center gap-3 px-1 pb-2 mb-1">
                  <span className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">{ambiente}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-sm text-zinc-400">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                  <span className="text-sm text-zinc-500 font-mono">{totalArea.toFixed(2)} m²</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} dimEdit={edits[item.id]} servicoEdit={servicoEdits[item.id]} statusEdit={statusEdits[item.id]} tipoEdit={tipoEdits[item.id]}
                      onEditDims={applyEdit} onEditServicos={applyServicos} onConfirm={confirmItem} onMarkPartial={markPartial} onEditTipo={applyTipo} onEditModulo={applyModulo} onRemove={removeItem}
                      demoHint={demoHints?.[item.id]} />
                  ))}
                </div>
              </div>
            );
          })}

          {showAddFormFor === 'global' ? (
            <AddItemForm defaultAmbiente="" defaultMaterial={defaultMaterial} ambientes={grouped.map(([env]) => env)} onAdd={addItemToGroup} onCancel={() => setShowAddFormFor(null)} />
          ) : (
            <button onClick={() => setShowAddFormFor('global')} className="w-full py-2.5 rounded border border-dashed border-zinc-700 text-sm text-zinc-400 hover:border-violet-500/40 hover:text-violet-400 transition-all flex items-center justify-center gap-1.5">
              + Adicionar item
            </button>
          )}
        </div>

        <div className="flex gap-3 items-center justify-end pt-1">
          <button onClick={() => onDone(buildUpdatedFolha())} className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 text-white rounded text-base font-medium hover:bg-violet-400 active:scale-95 transition-all">
            Ver Orçamento →
          </button>
        </div>
      </div>

      {/* RIGHT: sticky image panel */}
      <div className="flex-shrink-0 sticky top-0 self-start" style={{ width: '1020px' }}>
        <div className="rounded-sm overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col" style={{ height: 'calc(100vh - 32px)' }}>
          <div className="relative bg-zinc-950 flex items-center justify-center cursor-zoom-in flex-1 min-h-0" onClick={() => { if (currentViewUrl) { setZoomUrl(currentViewUrl); setZoomLabel(`Prancha ${viewingImageIdx + 1}`); } }}>
            {currentViewUrl ? (
              <img key={viewingImageIdx} src={currentViewUrl} alt={`Prancha ${viewingImageIdx + 1}`} className="max-w-full max-h-full object-contain" style={{ display: 'block' }} />
            ) : (
              <div className="flex flex-col items-center gap-3 text-zinc-400">
                <p className="text-base text-center px-8">
                  {imagePlaceholder ?? (imageBlobs.length === 0 ? 'Re-faça o upload do PDF para ver as imagens' : `Prancha ${viewingImageIdx + 1} sem imagem`)}
                </p>
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); setViewingImageIdx((i) => Math.max(0, i - 1)); }} disabled={viewingImageIdx === 0} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-16 flex items-center justify-center rounded bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 transition-all backdrop-blur-sm">←</button>
            <button onClick={(e) => { e.stopPropagation(); setViewingImageIdx((i) => Math.min(imageUrls.length - 1, i + 1)); }} disabled={viewingImageIdx >= imageUrls.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-16 flex items-center justify-center rounded bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 transition-all backdrop-blur-sm">→</button>
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              {[{ icon: '✓', label: 'confirmado' }, { icon: '−', label: 'estimativa' }, { icon: '✕', label: 'não id.' }].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 bg-black/60 text-white text-sm px-2 py-1 rounded backdrop-blur-sm"><span className="text-violet-400 font-bold">{icon}</span> {label}</div>
              ))}
            </div>
            {currentViewUrl && <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white text-sm px-2 py-0.5 rounded pointer-events-none flex items-center gap-1">zoom</div>}
          </div>
          <div className="h-12 bg-zinc-900 border-t border-zinc-800 px-2 flex items-center gap-1">
            <div className="flex-1 flex gap-1 overflow-x-auto py-1 dark-scroll">
              {imageUrls.map((url, i) => (
                <button key={i} onClick={() => setViewingImageIdx(i)} title={`Prancha ${i + 1}`} className={`flex-shrink-0 rounded-sm overflow-hidden border-2 transition-all ${i === viewingImageIdx ? 'border-violet-500' : 'border-transparent opacity-40 hover:opacity-70'}`}>
                  <img src={url} alt={`p${i + 1}`} className="h-7 w-10 object-cover" />
                </button>
              ))}
            </div>
            <span className="text-zinc-400 text-sm ml-2 flex-shrink-0 tabular-nums">{viewingImageIdx + 1}/{imageUrls.length || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
