import type { ItemOrcamento, FonteItem } from '@/lib/orcamento-construtora/types';
import { CATEGORIA_LABEL, CATEGORIA_COLOR, STATUS_LABEL, FONTE_BADGE } from '@/lib/orcamento-construtora/ui-constants';
import { ConfidenceDot } from './ConfidenceDot';

export function ItemCard({
  item,
  qtdEdit,
  onEditQtd,
  onRemove,
}: {
  item: ItemOrcamento;
  qtdEdit: number | undefined;
  onEditQtd: (id: number, v: number) => void;
  onRemove: (id: number) => void;
}) {
  const st       = STATUS_LABEL[item.status];
  const catColor = CATEGORIA_COLOR[item.categoria] ?? CATEGORIA_COLOR.outro;
  const curQtd   = qtdEdit ?? item.quantidade ?? 0;
  const isEdited = qtdEdit !== undefined;
  const fonteKey = (item.fonte ?? 'IA') as FonteItem;

  return (
    <div className={`rounded-lg border p-3 ${st.color}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{item.descricao}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${catColor}`}>
              {CATEGORIA_LABEL[item.categoria]}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${FONTE_BADGE[fonteKey] ?? FONTE_BADGE.IA}`}>
              {fonteKey}
            </span>
            {item.confianca !== undefined && <ConfidenceDot value={item.confianca} />}
            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${st.color}`}>{st.label}</span>
            {isEdited && <span className="text-blue-600 text-xs font-medium">editado</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs font-medium">
            <span className="opacity-60">{item.ambiente}</span>
            <span className="opacity-40">·</span>
            <label className="flex items-center gap-1">
              Qtd:
              <input
                type="number" step="0.01" min="0"
                value={curQtd}
                onChange={(e) => onEditQtd(item.id, parseFloat(e.target.value) || 0)}
                className={`w-16 px-1.5 py-0.5 rounded border text-right font-mono ${
                  isEdited ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-800'
                }`}
              />
              <span className="opacity-50">{item.unidade}</span>
            </label>
          </div>
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
