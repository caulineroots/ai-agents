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

  /** Substitui toda a seleção pelos arquivos recebidos. */
  const handleReplace = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    if (arr.length === 0) return;
    setError('');
    const grouped = groupFilesByStem(arr);
    if (grouped.length === 0) {
      setError('Nenhum arquivo válido reconhecido (PNG, JPG, PDF, DXF, DWG).');
      return;
    }
    setGroups(grouped);
  };

  /** Mescla novos arquivos com os grupos já existentes.
   *  - Mesmo stem: atualiza só os campos enviados (ex: adicionar PDF a um grupo que já tem PNG).
   *  - Stem novo: adiciona como novo grupo.
   */
  const handleAddMore = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    if (arr.length === 0) return;
    setError('');
    const newGroups = groupFilesByStem(arr);
    if (newGroups.length === 0) {
      setError('Nenhum arquivo válido reconhecido (PNG, JPG, PDF, DXF, DWG).');
      return;
    }
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

  const handleConfirm = () => {
    if (groups.length > 0) onDone(groups);
  };

  const totalMB = groups.reduce((s, g) =>
    s + (g.imageFile?.size ?? 0) + (g.pdfFile?.size ?? 0) + (g.dxfFile?.size ?? 0), 0
  ) / (1024 * 1024);

  // Modo idle — nada selecionado
  if (groups.length === 0 && existingStems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-xl font-semibold text-gray-800">Passo 1 — Upload das Pranchas</h2>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Selecione todos os arquivos do projeto: PNG, PDF e DXF/DWG.
          Eles são agrupados automaticamente pelo nome.
        </p>
        <div
          className={`w-full max-w-lg border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length > 0) handleReplace(e.dataTransfer.files); }}
          onClick={() => replaceRef.current?.click()}
        >
          <span className="text-5xl">📂</span>
          <p className="text-sm text-gray-600 font-medium text-center">
            Arraste os arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-gray-400">PNG · JPG · PDF · DXF · DWG — múltiplos arquivos</p>
          <input ref={replaceRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleReplace(e.target.files); e.target.value = ''; }} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
      </div>
    );
  }

  // Grupos já selecionados
  const displayGroups = groups.length > 0 ? groups : existingStems.map((s) => ({ stem: s }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Passo 1 — Upload das Pranchas</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayGroups.length} {displayGroups.length === 1 ? 'prancha agrupada' : 'pranchas agrupadas'}
            {groups.length > 0 && ` · ${totalMB.toFixed(1)} MB`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Adicionar mais — mescla com os grupos existentes */}
          <button
            type="button"
            onClick={() => addMoreRef.current?.click()}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            + Adicionar arquivos
          </button>
          <input ref={addMoreRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleAddMore(e.target.files); e.target.value = ''; }} />

          {/* Trocar tudo — substitui toda a seleção */}
          <button
            type="button"
            onClick={() => replaceRef.current?.click()}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
          >
            Trocar tudo
          </button>
          <input ref={replaceRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleReplace(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      {/* Zona de drop — comporta-se como "adicionar" quando já há grupos */}
      <div
        className={`border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-2 cursor-pointer transition-colors text-sm ${
          dragging ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400 hover:border-gray-300'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length > 0) handleAddMore(e.dataTransfer.files); }}
        onClick={() => addMoreRef.current?.click()}
      >
        <span className="text-base">📎</span>
        <span>Arraste mais arquivos aqui para adicionar ao projeto</span>
      </div>

      {/* Tabela de grupos */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prancha</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">PNG</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">PDF</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">DXF/DWG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayGroups.map((g, i) => (
              <tr key={g.stem} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-4 py-2 font-mono text-xs text-gray-700 truncate max-w-xs">{g.stem}</td>
                <td className="px-3 py-2 text-center">
                  {'imageFile' in g && g.imageFile ? (
                    <span className="text-green-600 font-bold">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {'pdfFile' in g && g.pdfFile ? (
                    <span className="text-green-600 font-bold">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {'dxfFile' in g && g.dxfFile ? (
                    <span className="text-green-600 font-bold">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={groups.length === 0 && existingStems.length === 0}
        className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
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
