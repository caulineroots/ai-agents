import { useState, useMemo, useEffect } from 'react';
import type { FolhaOrcamento, ItemOrcamento } from '@/lib/orcamento-construtora/types';
import { ZoomModal } from './ZoomModal';
import { ItemCard } from './ItemCard';
import { AddItemForm } from './AddItemForm';

export function StepReview({
  folha,
  imageBlobs,
  onDone,
}: {
  folha: FolhaOrcamento;
  imageBlobs: Blob[];
  onDone: (updated: FolhaOrcamento) => void;
}) {
  const [edits, setEdits]                 = useState<Record<number, number>>({});
  const [removedIds, setRemovedIds]       = useState<Set<number>>(new Set());
  const [addedItems, setAddedItems]       = useState<ItemOrcamento[]>([]);
  const [showAddFormFor, setShowAddFormFor] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl]             = useState<string | null>(null);
  const [zoomLabel, setZoomLabel]         = useState('');
  const [saving, setSaving]               = useState(false);
  const [viewingImageIdx, setViewingImageIdx] = useState(0);
  const [imageUrls, setImageUrls]         = useState<string[]>([]);

  useEffect(() => {
    const urls = imageBlobs.map((b) => {
      const blob = b.type ? b : new Blob([b], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    });
    setImageUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageBlobs]);

  const currentViewUrl = imageUrls[viewingImageIdx] ?? null;

  const applyEdit      = (id: number, v: number) => setEdits((prev) => ({ ...prev, [id]: v }));
  const removeItem     = (id: number) => setRemovedIds((prev) => new Set([...prev, id]));
  const addItemToGroup = (item: ItemOrcamento) => { setAddedItems((prev) => [...prev, item]); setShowAddFormFor(null); };

  const visibleItems = useMemo(
    () => [...folha.itens, ...addedItems].filter((i) => !removedIds.has(i.id)),
    [folha.itens, addedItems, removedIds],
  );

  const grouped = useMemo(() => {
    const byAmbiente = new Map<string, ItemOrcamento[]>();
    for (const item of visibleItems) {
      const amb = item.ambiente ?? 'Sem ambiente';
      if (!byAmbiente.has(amb)) byAmbiente.set(amb, []);
      byAmbiente.get(amb)!.push(item);
    }
    return [...byAmbiente.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleItems]);

  const countByStatus = {
    confirmado: visibleItems.filter((i) => i.status === 'confirmado').length,
    parcial:    visibleItems.filter((i) => i.status === 'parcial').length,
    aguardando: visibleItems.filter((i) => i.status === 'aguardando').length,
  };

  const hasChanges = Object.keys(edits).length > 0 || removedIds.size > 0 || addedItems.length > 0;

  const buildUpdatedFolha = (): FolhaOrcamento => ({
    ...folha,
    itens: visibleItems.map((item) => {
      const q = edits[item.id];
      return q !== undefined ? { ...item, quantidade: q } : item;
    }),
  });

  const handleApply = async () => {
    setSaving(true);
    onDone(buildUpdatedFolha());
    setSaving(false);
  };

  return (
    <div className="flex gap-5 w-full items-start">
      {zoomUrl && <ZoomModal url={zoomUrl} label={zoomLabel} onClose={() => setZoomUrl(null)} />}

      {/* LEFT: items */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Passo 3 — Revisão</h2>
          <p className="text-sm text-gray-500 mt-0.5">{folha.projeto}{folha.cliente ? ` · ${folha.cliente}` : ''}</p>
          <div className="mt-2 flex gap-3 flex-wrap text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{countByStatus.confirmado} confirmados</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{countByStatus.parcial} estimativas</span>
            {countByStatus.aguardando > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{countByStatus.aguardando} não identificados</span>}
            {removedIds.size > 0 && <span className="text-red-500">✕ {removedIds.size} removido(s)</span>}
            {addedItems.length > 0 && <span className="text-blue-600">+ {addedItems.length} adicionado(s)</span>}
          </div>
        </div>

        {grouped.map(([ambiente, items]) => (
          <div key={ambiente} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full inline-block" />
                {ambiente}
                <span className="text-gray-400 font-normal">({items.length})</span>
              </h3>
              <button
                onClick={() => setShowAddFormFor(showAddFormFor === ambiente ? null : ambiente)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                + Adicionar
              </button>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} qtdEdit={edits[item.id]} onEditQtd={applyEdit} onRemove={removeItem} />
              ))}
              {showAddFormFor === ambiente ? (
                <AddItemForm defaultAmbiente={ambiente} onAdd={addItemToGroup} onCancel={() => setShowAddFormFor(null)} />
              ) : (
                <button
                  onClick={() => setShowAddFormFor(ambiente)}
                  className="w-full py-2 rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                >
                  + Adicionar item em {ambiente}
                </button>
              )}
            </div>
          </div>
        ))}

        {(folha.divergencias ?? []).length > 0 && (
          <div className="border border-amber-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
              <span className="text-amber-600 text-sm">⚠</span>
              <h3 className="text-sm font-semibold text-amber-800">
                Divergências encontradas ({folha.divergencias!.length})
              </h3>
            </div>
            <div className="divide-y divide-amber-100">
              {folha.divergencias!.map((d, i) => (
                <div key={i} className="px-4 py-3 flex flex-col gap-1 bg-amber-50/50">
                  <p className="text-sm font-medium text-gray-800">{d.campo}</p>
                  <div className="flex gap-4 flex-wrap text-xs text-gray-600">
                    {d.valor_pdf && <span><span className="font-medium text-green-700">PDF:</span> {d.valor_pdf}</span>}
                    {d.valor_dxf && <span><span className="font-medium text-blue-700">DXF:</span> {d.valor_dxf}</span>}
                    {d.valor_ia  && <span><span className="font-medium text-purple-700">IA:</span> {d.valor_ia}</span>}
                  </div>
                  {d.recomendacao && <p className="text-xs text-amber-700 italic">{d.recomendacao}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {(folha.erros_ia ?? []).length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600">
                Limitações reportadas pela IA ({folha.erros_ia!.length})
              </h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {folha.erros_ia!.map((e, i) => (
                <li key={i} className="px-4 py-2 text-xs text-gray-500 flex gap-2">
                  <span className="text-gray-300 shrink-0">·</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 items-center justify-end pt-1 flex-wrap">
          {hasChanges && (
            <span className="text-xs text-blue-600 mr-auto">
              {Object.keys(edits).length > 0 && `${Object.keys(edits).length} quantidade(s) editada(s)`}
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

      {/* RIGHT: sticky image panel */}
      <div className="flex-shrink-0 sticky top-0 self-start" style={{ width: '1000px' }}>
        <div className="rounded-xl overflow-hidden bg-gray-900 shadow-xl flex flex-col" style={{ height: 'calc(100vh - 32px)' }}>
          <div
            className="relative bg-gray-950 flex items-center justify-center cursor-zoom-in flex-1 min-h-0"
            onClick={() => { if (currentViewUrl) { setZoomUrl(currentViewUrl); setZoomLabel(`Prancha ${viewingImageIdx + 1}`); } }}
          >
            {currentViewUrl ? (
              <img key={viewingImageIdx} src={currentViewUrl} alt={`Prancha ${viewingImageIdx + 1}`} className="max-w-full max-h-full object-contain" style={{ display: 'block' }} />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <span className="text-5xl">🖼</span>
                <p className="text-sm text-center px-8">
                  {imageBlobs.length === 0 ? 'Re-faça o upload do PDF para ver as imagens' : `Prancha ${viewingImageIdx + 1} sem imagem`}
                </p>
              </div>
            )}
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
            {currentViewUrl && (
              <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">🔍 zoom</div>
            )}
          </div>
          <div className="h-11 bg-gray-800 px-2 flex items-center gap-1">
            <div className="flex-1 flex gap-1 overflow-x-auto py-1">
              {imageUrls.map((url, i) => (
                <button key={i} onClick={() => setViewingImageIdx(i)} title={`Prancha ${i + 1}`}
                  className={`flex-shrink-0 rounded overflow-hidden border-2 transition-all ${i === viewingImageIdx ? 'border-blue-400' : 'border-transparent opacity-40 hover:opacity-75'}`}>
                  <img src={url} alt={`p${i + 1}`} className="h-7 w-10 object-cover" />
                </button>
              ))}
            </div>
            <span className="text-gray-500 text-xs ml-2 flex-shrink-0">{viewingImageIdx + 1}/{imageUrls.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
