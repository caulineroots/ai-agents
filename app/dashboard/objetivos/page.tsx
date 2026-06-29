'use client';

import { useState, useEffect } from 'react';
import { Target, Plus, TrendingUp, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { CreateDrawer } from '@/components/dashboard/CreateDrawer';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface GoalMetadata {
  periodo: 'semanal' | 'mensal';
  unidade: string;
  meta_valor: number;
  progresso_atual: number;
  semana_ref?: string;
  mes_ref?: string;
  keywords?: string[];
  status: 'ativo' | 'concluido' | 'arquivado';
}

interface Goal {
  id: string;
  title: string;
  metadata: GoalMetadata;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  metadata: {
    status?: string;
    prazo?: string;
    urgencia?: string;
  };
}

// ── Components ────────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color =
    pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : pct >= 40 ? 'bg-sky-500' : 'bg-zinc-600';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>
          {value}/{max} {/* unidade injected by parent */}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TaskPill({ task }: { task: Task }) {
  const statusColor =
    task.metadata.status === 'concluida'
      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
      : task.metadata.status === 'em_andamento'
      ? 'text-sky-400 bg-sky-400/10 border-sky-400/20'
      : 'text-zinc-400 bg-zinc-800 border-zinc-700';

  const urgEmoji =
    task.metadata.urgencia === 'alta' ? '🔴 ' :
    task.metadata.urgencia === 'media' ? '🟡 ' : '';

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${statusColor}`}>
      {urgEmoji}{task.title}
    </span>
  );
}

function GoalCard({
  goal,
  tasks,
  onDelete,
  onIncrement,
}: {
  goal: Goal;
  tasks: Task[];
  onDelete: (goal: Goal) => void;
  onIncrement: (goal: Goal) => void;
}) {
  const m = goal.metadata;
  const pct = m.meta_valor > 0 ? Math.round((m.progresso_atual / m.meta_valor) * 100) : 0;
  const concluido = m.progresso_atual >= m.meta_valor;

  const periodoLabel =
    m.periodo === 'semanal'
      ? `Semana ${m.semana_ref ?? '—'}`
      : `Mês ${m.mes_ref ?? '—'}`;

  // Correlação visual: tasks cujo title contém alguma keyword
  const keywords = m.keywords ?? [];
  const related = keywords.length > 0
    ? tasks.filter((t) =>
        keywords.some((kw) => t.title.toLowerCase().includes(kw.toLowerCase())),
      )
    : [];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 hover:border-zinc-700 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Target size={16} className={concluido ? 'text-emerald-400' : 'text-amber-400'} />
          <h3 className="text-sm font-semibold text-zinc-100 truncate">{goal.title}</h3>
          {concluido && (
            <span className="flex-shrink-0 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
              ✓ Concluído
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!concluido && (
            <button
              onClick={() => onIncrement(goal)}
              title="Incrementar +1"
              className="text-xs text-zinc-500 hover:text-sky-400 transition-colors px-2 py-1 rounded bg-zinc-800 hover:bg-sky-400/10 border border-zinc-700 hover:border-sky-400/30"
            >
              +1
            </button>
          )}
          <button
            onClick={() => onDelete(goal)}
            title="Deletar objetivo"
            className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <ProgressBar value={m.progresso_atual} max={m.meta_valor} />
        <p className="text-xs text-zinc-500 mt-1">
          {m.unidade} · {periodoLabel} ·{' '}
          <span className={m.status === 'ativo' ? 'text-zinc-400' : 'text-zinc-600'}>
            {m.status}
          </span>
        </p>
      </div>

      {/* Tarefas relacionadas */}
      {related.length > 0 && (
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
            <TrendingUp size={11} /> Tarefas relacionadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {related.map((t) => (
              <TaskPill key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ObjetivosPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<'ativo' | 'concluido' | 'todos'>('ativo');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [gRes, tRes] = await Promise.all([
        fetch('/api/dashboard/items?type=goal'),
        fetch('/api/dashboard/items?type=task'),
      ]);
      if (gRes.ok) setGoals(await gRes.json());
      if (tRes.ok) setTasks(await tRes.json());
      setLoading(false);
    }
    load();
  }, []);

  async function handleIncrement(goal: Goal) {
    const m = goal.metadata;
    const novoProgresso = (m.progresso_atual ?? 0) + 1;
    const novoStatus = novoProgresso >= m.meta_valor ? 'concluido' : m.status;

    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id
          ? { ...g, metadata: { ...m, progresso_atual: novoProgresso, status: novoStatus } }
          : g,
      ),
    );

    await fetch(`/api/dashboard/items/${goal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata: { ...m, progresso_atual: novoProgresso, status: novoStatus },
      }),
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setGoals((prev) => prev.filter((g) => g.id !== deleteTarget.id));
    await fetch(`/api/dashboard/items/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
  }

  const filtered = goals.filter((g) => {
    if (filter === 'todos') return true;
    return g.metadata.status === filter;
  });

  const ativos = goals.filter((g) => g.metadata.status === 'ativo').length;
  const concluidos = goals.filter((g) => g.metadata.status === 'concluido').length;
  const totalMeta = goals.reduce((sum, g) => sum + (g.metadata.meta_valor ?? 0), 0);
  const totalProgresso = goals.reduce((sum, g) => sum + (g.metadata.progresso_atual ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Target size={20} className="text-amber-400" />
            Objetivos
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Metas e progresso do seu negócio
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-200 font-medium transition-all active:scale-95"
        >
          <Plus size={16} />
          Novo Objetivo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ativos', value: ativos, icon: Target, color: 'text-amber-400' },
          { label: 'Concluídos', value: concluidos, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Total de metas', value: totalMeta, icon: TrendingUp, color: 'text-sky-400' },
          { label: 'Progresso total', value: totalProgresso, icon: Clock, color: 'text-purple-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <stat.icon size={16} className={`${stat.color} mb-2`} />
            <p className="text-2xl font-bold text-zinc-100">{stat.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['ativo', 'concluido', 'todos'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'
            }`}
          >
            {f === 'ativo' ? 'Ativos' : f === 'concluido' ? 'Concluídos' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-3">
          <Target size={32} />
          <p className="text-sm">Nenhum objetivo cadastrado.</p>
          <p className="text-xs text-zinc-700">
            Crie um pelo WhatsApp: &quot;minha meta é fazer 5 vendas essa semana&quot;
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              tasks={tasks}
              onDelete={setDeleteTarget}
              onIncrement={handleIncrement}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Deletar objetivo"
        message={
          deleteTarget
            ? `Tem certeza que quer deletar "${deleteTarget.title}"? Essa ação não pode ser desfeita.`
            : ''
        }
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <CreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        type="goal"
        onCreated={(item) => setGoals((prev) => [item as Goal, ...prev])}
      />
    </div>
  );
}
