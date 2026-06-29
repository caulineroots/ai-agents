type BadgeVariant =
  | 'pendente' | 'em_andamento' | 'concluida'
  | 'novo' | 'em_contato' | 'qualificado' | 'perdido' | 'fechado'
  | 'ativo' | 'pausado' | 'concluido'
  | 'receita' | 'despesa'
  | 'alta' | 'media' | 'baixa'
  | string;

const VARIANT_MAP: Record<string, string> = {
  // Tasks
  pendente: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  em_andamento: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  concluida: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  // Leads
  novo: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  em_contato: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  qualificado: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  perdido: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  fechado: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30',
  // Projects
  ativo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  pausado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  concluido: 'bg-zinc-600/30 text-zinc-400 border-zinc-600/30',
  // Financial
  receita: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  despesa: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  // Urgency
  alta: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  media: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  baixa: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
};

const LABEL_MAP: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  novo: 'Novo',
  em_contato: 'Em contato',
  qualificado: 'Qualificado',
  perdido: 'Perdido',
  fechado: 'Fechado',
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
  receita: 'Receita',
  despesa: 'Despesa',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

interface Props {
  value: BadgeVariant;
  className?: string;
}

export function StatusBadge({ value, className = '' }: Props) {
  const colorClass = VARIANT_MAP[value] ?? 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30';
  const label = LABEL_MAP[value] ?? value;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}
