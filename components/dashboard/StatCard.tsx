interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'violet' | 'emerald' | 'amber' | 'rose';
  icon?: React.ReactNode;
}

const ACCENT_MAP = {
  violet: 'text-violet-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
};

export function StatCard({ label, value, sub, accent = 'violet', icon }: Props) {
  const accentClass = ACCENT_MAP[accent];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
        {icon && <span className={`${accentClass} opacity-70`}>{icon}</span>}
      </div>
      <p className={`text-3xl font-bold ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
