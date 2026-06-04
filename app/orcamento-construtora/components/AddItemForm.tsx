import { useState, useRef } from 'react';
import type { Categoria, Unidade, ItemOrcamento } from '@/lib/orcamento-construtora/types';
import { CATEGORIA_LABEL } from '@/lib/orcamento-construtora/ui-constants';

export function AddItemForm({
  defaultAmbiente,
  onAdd,
  onCancel,
}: {
  defaultAmbiente: string;
  onAdd: (item: ItemOrcamento) => void;
  onCancel: () => void;
}) {
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('civil');
  const [unidade, setUnidade]     = useState<Unidade>('m2');
  const [qtd, setQtd]             = useState('');
  const nextIdRef = useRef(Date.now());

  const handleAdd = () => {
    if (!descricao || !qtd) return;
    onAdd({
      id: ++nextIdRef.current,
      prancha_idx: null,
      status: 'confirmado',
      ambiente: defaultAmbiente,
      descricao,
      categoria,
      unidade,
      quantidade: parseFloat(qtd) || 0,
      pendencias: [],
    });
    setDescricao('');
    setQtd('');
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-blue-700">Adicionar item — {defaultAmbiente}</p>
      <input
        type="text"
        placeholder="Descrição do serviço"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        className="border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <div className="flex gap-2 flex-wrap">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as Categoria)}
          className="border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
        <select
          value={unidade}
          onChange={(e) => setUnidade(e.target.value as Unidade)}
          className="border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {(['m2', 'ml', 'un', 'm3', 'vb', 'kg', 'hr'] as Unidade[]).map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs font-medium">
          Qtd:
          <input
            type="number" step="0.01" min="0" placeholder="0.00"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            className="w-16 border border-gray-300 rounded-md px-2 py-1 text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </label>
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
          disabled={!descricao || !qtd}
          className="text-xs px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
