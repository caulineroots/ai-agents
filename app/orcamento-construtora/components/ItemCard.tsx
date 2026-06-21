import type { ItemOrcamento } from '@/lib/orcamento-construtora/types';
import { CATEGORIA_LABEL, CATEGORIA_COLOR, STATUS_LABEL } from '@/lib/orcamento-construtora/ui-constants';

export function ItemCard({
  item,
  qtdEdit,
  onEditQtd,
  onRemove,
  isActive = false,
  onRevisado,
}: {
  item:        ItemOrcamento;
  qtdEdit:     number | undefined;
  onEditQtd:   (id: number, v: number) => void;
  onRemove:    (id: number) => void;
  isActive?:   boolean;
  onRevisado?: () => void;
}) {
  const st         = STATUS_LABEL[item.status];
  const catColor   = CATEGORIA_COLOR[item.categoria] ?? CATEGORIA_COLOR.outro;
  const curQtd     = qtdEdit ?? item.quantidade ?? 0;
  const isEdited   = qtdEdit !== undefined;
  const raciocinio = (item as ItemOrcamento & { raciocinio?: string }).raciocinio;
  const unidade    = (item as ItemOrcamento & { unidade?: string }).unidade;
  const showAmb    = item.ambiente && item.ambiente !== 'Geral';

  return (
    <div className={`rounded-lg border p-3 transition-all ${st.color} ${
      isActive ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-zinc-900' : ''
    }`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />

        <div className="flex-1 min-w-0">
          {/* Title + badges */}
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-100 leading-snug">{item.descricao}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${catColor}`}>
              {CATEGORIA_LABEL[item.categoria]}
            </span>
            {item.status !== 'confirmado' && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${
                item.status === 'parcial'
                  ? 'text-amber-300 bg-amber-900/30 border-amber-700/60'
                  : 'text-red-300 bg-red-900/30 border-red-700/60'
              }`}>
                {st.label}
              </span>
            )}
            {isEdited && <span className="text-blue-400 text-xs font-medium">editado</span>}
          </div>

          {/* Qty row */}
          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
            {showAmb && (
              <>
                <span className="text-zinc-500">{item.ambiente}</span>
                <span className="text-zinc-700">·</span>
              </>
            )}
            <label className="flex items-center gap-1 font-medium text-zinc-400">
              Qtd:
              <input
                type="number" step="0.01" min="0"
                value={curQtd}
                onChange={(e) => onEditQtd(item.id, parseFloat(e.target.value) || 0)}
                className={`w-18 px-1.5 py-0.5 rounded border text-right font-mono ${
                  isEdited
                    ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                    : 'border-zinc-600 bg-zinc-900 text-zinc-200'
                }`}
                style={{ width: '5rem' }}
              />
              <span className="text-zinc-500">{unidade}</span>
            </label>
          </div>

          {/* Raciocínio */}
          {raciocinio && (
            <p className="mt-1.5 text-sm text-zinc-300 italic leading-snug">{raciocinio}</p>
          )}

          {/* Pendências */}
          {(item.pendencias ?? []).length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {item.pendencias.map((p, i) => (
                <li key={i} className="text-sm flex gap-1 items-start text-zinc-300">
                  <span className="text-zinc-400 shrink-0">⚠</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Actions row */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <button
              onClick={() => onRemove(item.id)}
              className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
            >
              ✕ remover
            </button>
            {onRevisado && (
              <button
                onClick={onRevisado}
                className="flex items-center gap-1 px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium rounded-lg transition-colors active:scale-95"
              >
                Revisado →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
