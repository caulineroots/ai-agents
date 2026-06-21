import { useState, useRef } from 'react';
import { groupFilesByStem, type PranchaGroup } from '@/lib/orcamento-construtora/image-store';

const ACCEPTED = '.png,.jpg,.jpeg,.webp,.pdf,.dxf,.dwg';

export function StepUpload({
  existingStems,
  onDone,
}: {
  existingStems: string[];
  onDone: (groups: PranchaGroup[]) => void;
}) {
  const [groups,   setGroups]   = useState<PranchaGroup[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState('');
  const replaceRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const handleReplace = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    if (arr.length === 0) return;
    setError('');
    const grouped = groupFilesByStem(arr);
    if (grouped.length === 0) { setError('Nenhum arquivo válido reconhecido (PNG, JPG, PDF, DXF, DWG).'); return; }
    setGroups(grouped);
  };

  const handleAddMore = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    if (arr.length === 0) return;
    setError('');
    const newGroups = groupFilesByStem(arr);
    if (newGroups.length === 0) { setError('Nenhum arquivo válido reconhecido (PNG, JPG, PDF, DXF, DWG).'); return; }
    setGroups((prev) => {
      const map = new Map<string, PranchaGroup>(prev.map((g) => [g.stem, { ...g }]));
      for (const ng of newGroups) {
        const existing = map.get(ng.stem);
        if (existing) {
          if (ng.imageFile) existing.imageFile = ng.imageFile;
          if (ng.pdfFile)   existing.pdfFile   = ng.pdfFile;
          if (ng.dxfFile)   existing.dxfFile   = ng.dxfFile;
        } else {
          map.set(ng.stem, ng);
        }
      }
      return Array.from(map.values()).sort((a, b) => a.stem.localeCompare(b.stem));
    });
  };

  const handleConfirm = () => { if (groups.length > 0) onDone(groups); };

  const totalMB = groups.reduce(
    (s, g) => s + (g.imageFile?.size ?? 0) + (g.pdfFile?.size ?? 0) + (g.dxfFile?.size ?? 0), 0
  ) / (1024 * 1024);

  // ── Tela inicial ─────────────────────────────────────────────────────────────
  if (groups.length === 0 && existingStems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white">Passo 1 — Upload das Pranchas</h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-md">
            Selecione todos os arquivos do projeto: PNG, PDF e DXF/DWG.
            Eles são agrupados automaticamente pelo nome.
          </p>
        </div>
        <div
          className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
            dragging
              ? 'border-indigo-500 bg-indigo-950/40'
              : 'border-zinc-600 bg-zinc-800/40 hover:border-zinc-500 hover:bg-zinc-800/60'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length > 0) handleReplace(e.dataTransfer.files); }}
          onClick={() => replaceRef.current?.click()}
        >
          <span className="text-5xl">📂</span>
          <p className="text-sm text-zinc-300 font-medium text-center">
            Arraste os arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-zinc-500">PNG · JPG · PDF · DXF · DWG — múltiplos arquivos</p>
          <input ref={replaceRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleReplace(e.target.files); e.target.value = ''; }} />
        </div>
        {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-4 py-2">{error}</p>}
      </div>
    );
  }

  // ── Com arquivos selecionados ─────────────────────────────────────────────────
  const displayGroups = groups.length > 0 ? groups : existingStems.map((s) => ({ stem: s }));

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-white">Passo 1 — Upload das Pranchas</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {displayGroups.length} {displayGroups.length === 1 ? 'prancha agrupada' : 'pranchas agrupadas'}
            {groups.length > 0 && ` · ${totalMB.toFixed(1)} MB`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => addMoreRef.current?.click()}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-indigo-700/60 bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/60 transition-colors">
            + Adicionar arquivos
          </button>
          <input ref={addMoreRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleAddMore(e.target.files); e.target.value = ''; }} />

          <button type="button" onClick={() => replaceRef.current?.click()}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-dashed border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors">
            Trocar tudo
          </button>
          <input ref={replaceRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleReplace(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors text-sm ${
          dragging
            ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
            : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length > 0) handleAddMore(e.dataTransfer.files); }}
        onClick={() => addMoreRef.current?.click()}
      >
        <span className="text-base">📎</span>
        <span>Arraste mais arquivos aqui para adicionar ao projeto</span>
      </div>

      {/* Tabela */}
      <div className="border border-zinc-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800 border-b border-zinc-700">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Prancha</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">PNG</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">PDF</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">DXF/DWG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {displayGroups.map((g, i) => (
              <tr key={g.stem} className={i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-800/40'}>
                <td className="px-4 py-2 font-mono text-xs text-zinc-300 truncate max-w-xs">{g.stem}</td>
                <td className="px-3 py-2 text-center">
                  {'imageFile' in g && g.imageFile
                    ? <span className="text-green-400 font-bold">✓</span>
                    : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {'pdfFile' in g && g.pdfFile
                    ? <span className="text-green-400 font-bold">✓</span>
                    : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {'dxfFile' in g && g.dxfFile
                    ? <span className="text-green-400 font-bold">✓</span>
                    : <span className="text-zinc-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-4 py-2">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={groups.length === 0 && existingStems.length === 0}
        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-base font-semibold hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {groups.length > 0
          ? `Prosseguir com ${groups.length} prancha${groups.length > 1 ? 's' : ''} →`
          : existingStems.length > 0
            ? `Prosseguir com ${existingStems.length} prancha${existingStems.length > 1 ? 's' : ''} →`
            : 'Selecione os arquivos acima'}
      </button>
    </div>
  );
}
