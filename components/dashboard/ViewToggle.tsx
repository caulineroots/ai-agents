'use client';

export type ViewMode = 'cards' | 'table' | 'kanban' | 'resumo' | 'timeline';

interface ViewOption {
  id: ViewMode;
  label: string;
  icon?: string;
}

interface Props {
  current: ViewMode;
  options: ViewOption[];
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ current, options, onChange }: Props) {
  return (
    <div className="inline-flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
            current === opt.id
              ? 'bg-violet-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
        >
          {opt.icon && <span className="mr-1">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
