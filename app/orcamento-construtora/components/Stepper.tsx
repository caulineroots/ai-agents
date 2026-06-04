import type { Step } from '@/hooks/useOrcamentoSession';

const STEP_LABELS: Record<number, string> = {
  1: 'Upload',
  2: 'Extração',
  3: 'IA',
  4: 'Revisão',
  5: 'Orçamento',
};

export function Stepper({
  current,
  accessible,
  onNavigate,
}: {
  current: Step;
  accessible: Set<Step>;
  onNavigate: (s: Step) => void;
}) {
  const stepNums = [1, 2, 3, 4, 5] as Step[];
  return (
    <div className="flex items-center gap-0 w-full max-w-2xl mx-auto mb-8">
      {stepNums.map((num, idx) => {
        const done      = current > num;
        const active    = current === num;
        const clickable = (accessible?.has(num) ?? false) && num !== current;
        return (
          <div key={num} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <button
                onClick={() => clickable && onNavigate(num)}
                disabled={!clickable}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  done   ? 'bg-green-500 text-white' :
                  active ? 'bg-blue-600 text-white' :
                           'bg-gray-200 text-gray-500'
                } ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {done ? '✓' : num}
              </button>
              <span className={`text-xs mt-1 whitespace-nowrap ${active ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {STEP_LABELS[num]}
              </span>
            </div>
            {idx < stepNums.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
