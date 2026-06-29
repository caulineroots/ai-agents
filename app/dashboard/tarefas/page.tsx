'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { ViewToggle, ViewMode } from '@/components/dashboard/ViewToggle';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { DataTable, Column } from '@/components/dashboard/DataTable';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { CreateDrawer } from '@/components/dashboard/CreateDrawer';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';

interface Task {
  id: string;
  title: string;
  metadata: {
    prazo?: string;
    prazo_hora?: string;
    urgencia?: string;
    status?: string;
    projeto_id?: string | null;
  };
  created_at: string;
}

const URGENCY_DOT: Record<string, string> = {
  alta: 'bg-rose-500',
  media: 'bg-amber-400',
  baixa: 'bg-zinc-600',
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isVencida(prazo?: string): boolean {
  if (!prazo) return false;
  return prazo < new Date().toISOString().slice(0, 10);
}

async function updateTask(id: string, patch: Record<string, unknown>) {
  const task = await fetch(`/api/dashboard/items/${id}`).then((r) => r.json());
  await fetch(`/api/dashboard/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metadata: { ...task.metadata, ...patch },
    }),
  });
}

export default function TarefasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('cards');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/items?type=task&limit=200')
      .then((r) => r.json())
      .then((data) => { setTasks(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let list = tasks;
    if (search) {
      list = list.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
    }
    if (filters.status) list = list.filter((t) => t.metadata.status === filters.status);
    if (filters.urgencia) list = list.filter((t) => t.metadata.urgencia === filters.urgencia);
    if (filters.prazo === 'vencida') list = list.filter((t) => isVencida(t.metadata.prazo));
    if (filters.prazo === 'hoje') {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter((t) => t.metadata.prazo === today);
    }
    return list;
  }, [tasks, search, filters]);

  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function optimisticUpdate(id: string, patch: Record<string, unknown>) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, metadata: { ...t.metadata, ...patch } } : t,
      ),
    );
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    optimisticUpdate(taskId, { status: newStatus });
    await updateTask(taskId, { status: newStatus });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    await fetch(`/api/dashboard/items/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
  }

  const columns: Column<Task>[] = [
    {
      key: 'urgencia',
      header: '',
      width: '24px',
      render: (t) => (
        <span
          className={`block w-2 h-2 rounded-full ${URGENCY_DOT[t.metadata.urgencia ?? 'baixa'] ?? 'bg-zinc-600'}`}
        />
      ),
    },
    {
      key: 'title',
      header: 'Título',
      editable: true,
      editType: 'text',
      render: (t) => <span className="text-zinc-200">{t.title}</span>,
      getValue: (t) => t.title,
      onSave: async (t, value) => {
        optimisticUpdate(t.id, {});
        setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, title: value } : x));
        await fetch(`/api/dashboard/items/${t.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: value }),
        });
      },
    },
    {
      key: 'status',
      header: 'Status',
      editable: true,
      editType: 'select',
      editOptions: [
        { value: 'pendente', label: 'Pendente' },
        { value: 'em_andamento', label: 'Em andamento' },
        { value: 'concluida', label: 'Concluída' },
      ],
      render: (t) => <StatusBadge value={t.metadata.status ?? 'pendente'} />,
      getValue: (t) => t.metadata.status ?? 'pendente',
      onSave: async (t, value) => {
        optimisticUpdate(t.id, { status: value });
        await updateTask(t.id, { status: value });
      },
    },
    {
      key: 'urgencia',
      header: 'Urgência',
      editable: true,
      editType: 'select',
      editOptions: [
        { value: 'alta', label: 'Alta' },
        { value: 'media', label: 'Média' },
        { value: 'baixa', label: 'Baixa' },
      ],
      render: (t) => <StatusBadge value={t.metadata.urgencia ?? 'baixa'} />,
      getValue: (t) => t.metadata.urgencia ?? 'baixa',
      onSave: async (t, value) => {
        optimisticUpdate(t.id, { urgencia: value });
        await updateTask(t.id, { urgencia: value });
      },
    },
    {
      key: 'prazo',
      header: 'Prazo',
      editable: true,
      editType: 'date',
      render: (t) => (
        <span className={isVencida(t.metadata.prazo) && t.metadata.status !== 'concluida' ? 'text-rose-400' : 'text-zinc-400'}>
          {fmtDate(t.metadata.prazo)}
        </span>
      ),
      getValue: (t) => t.metadata.prazo ?? '',
      onSave: async (t, value) => {
        optimisticUpdate(t.id, { prazo: value || null });
        await updateTask(t.id, { prazo: value || null });
      },
    },
    {
      key: 'created_at',
      header: 'Criado em',
      render: (t) => (
        <span className="text-zinc-500 text-xs">
          {new Date(t.created_at).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-500 text-sm animate-pulse">
        Carregando tarefas...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Tarefas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} item(s)</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-95 text-sm font-medium text-white transition-all"
        >
          <Plus size={16} />
          Nova Tarefa
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'pendente', label: 'Pendente' },
                { value: 'em_andamento', label: 'Em andamento' },
                { value: 'concluida', label: 'Concluída' },
              ],
            },
            {
              key: 'urgencia',
              label: 'Urgência',
              options: [
                { value: 'alta', label: 'Alta' },
                { value: 'media', label: 'Média' },
                { value: 'baixa', label: 'Baixa' },
              ],
            },
            {
              key: 'prazo',
              label: 'Prazo',
              options: [
                { value: 'hoje', label: 'Hoje' },
                { value: 'vencida', label: 'Vencida' },
              ],
            },
          ]}
          filterValues={filters}
          onFilter={setFilter}
          placeholder="Buscar tarefa..."
        />
        <ViewToggle
          current={view}
          onChange={setView}
          options={[
            { id: 'cards', label: 'Cards' },
            { id: 'table', label: 'Tabela' },
            { id: 'kanban', label: 'Kanban' },
          ]}
        />
      </div>

      {/* Views */}
      {view === 'cards' && (
        <CardsView tasks={filtered} onStatusChange={handleStatusChange} onDelete={setDeleteTarget} />
      )}
      {view === 'table' && (
        <DataTable
          columns={columns}
          data={filtered}
          onDelete={setDeleteTarget}
          emptyMessage="Nenhuma tarefa encontrada."
        />
      )}
      {view === 'kanban' && (
        <KanbanBoard tasks={filtered} onStatusChange={handleStatusChange} />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Deletar tarefa"
        message={deleteTarget ? `Tem certeza que quer deletar "${deleteTarget.title}"? Essa ação não pode ser desfeita.` : ''}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <CreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        type="task"
        onCreated={(item) => setTasks((prev) => [item, ...prev])}
      />
    </div>
  );
}

function CardsView({
  tasks,
  onStatusChange,
  onDelete,
}: {
  tasks: Task[];
  onStatusChange: (id: string, status: string) => Promise<void>;
  onDelete: (task: Task) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500 text-sm">
        Nenhuma tarefa encontrada.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tasks.map((task) => {
        const urg = task.metadata.urgencia ?? 'baixa';
        const status = task.metadata.status ?? 'pendente';
        const vencida = isVencida(task.metadata.prazo) && status !== 'concluida';

        return (
          <div
            key={task.id}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 transition-colors group"
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${
                    URGENCY_DOT[urg] ?? 'bg-zinc-600'
                  }`}
                />
                <p className="text-sm text-zinc-100 leading-snug font-medium">{task.title}</p>
              </div>
              <button
                onClick={() => onDelete(task)}
                className="text-zinc-700 hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <StatusBadge value={status} />
              <StatusBadge value={urg} />
            </div>

            {/* Prazo */}
            {task.metadata.prazo && (
              <p className={`text-xs mb-3 ${vencida ? 'text-rose-400' : 'text-zinc-500'}`}>
                {vencida ? '⚠️ Vencida · ' : '📅 '}{fmtDate(task.metadata.prazo)}
              </p>
            )}

            {/* Quick status change */}
            <div className="flex gap-1 pt-2 border-t border-zinc-800">
              {(['pendente', 'em_andamento', 'concluida'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onStatusChange(task.id, s)}
                  disabled={status === s}
                  className={`flex-1 text-xs py-1 rounded transition-all ${
                    status === s
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                      : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {s === 'pendente' ? '⏳' : s === 'em_andamento' ? '🔄' : '✅'}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
