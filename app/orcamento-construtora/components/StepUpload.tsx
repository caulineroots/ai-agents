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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incoming: FileList | File[]) => {
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

  const handleConfirm = () => {
    if (groups.length > 0) {
      onDone(groups);
    }
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
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="text-5xl">📂</span>
          <p className="text-sm text-gray-600 font-medium text-center">
            Arraste os arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-gray-400">PNG · JPG · PDF · DXF · DWG — múltiplos arquivos</p>
          <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
      </div>
    );
  }

  // Grupos já selecionados
  const displayGroups = groups.length > 0 ? groups : existingStems.map((s) => ({ stem: s }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Passo 1 — Upload das Pranchas</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayGroups.length} {displayGroups.length === 1 ? 'prancha agrupada' : 'pranchas agrupadas'}
            {groups.length > 0 && ` · ${totalMB.toFixed(1)} MB total`}
          </p>
        </div>
        <div
          className="flex items-center gap-2 text-sm cursor-pointer px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          Trocar arquivos
          <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} />
        </div>
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
