'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { ViewToggle, ViewMode } from '@/components/dashboard/ViewToggle';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { DataTable, Column } from '@/components/dashboard/DataTable';
import { CreateDrawer } from '@/components/dashboard/CreateDrawer';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';

interface Projeto {
  id: string;
  title: string;
  metadata: {
    cliente?: string;
    status?: string;
    valor_estimado?: number;
  };
  created_at: string;
}

function fmtBRL(value?: number) {
  if (!value) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

async function updateProjeto(id: string, meta: Projeto['metadata'], patch: Record<string, unknown>) {
  await fetch(`/api/dashboard/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata: { ...meta, ...patch } }),
  });
}

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('cards');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Projeto | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/items?type=project&limit=200')
      .then((r) => r.json())
      .then((data) => { setProjetos(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let list = projetos;
    if (search) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          (p.metadata.cliente ?? '').toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (filters.status) list = list.filter((p) => p.metadata.status === filters.status);
    return list;
  }, [projetos, search, filters]);

  function optimistic(id: string, patch: Record<string, unknown>) {
    setProjetos((prev) =>
      prev.map((p) => p.id === id ? { ...p, metadata: { ...p.metadata, ...patch } } : p),
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setProjetos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    await fetch(`/api/dashboard/items/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
  }

  const columns: Column<Projeto>[] = [
    {
      key: 'title',
      header: 'Nome',
      editable: true,
      editType: 'text',
      render: (p) => <span className="text-zinc-200 font-medium">{p.title}</span>,
      getValue: (p) => p.title,
      onSave: async (p, value) => {
        setProjetos((prev) => prev.map((x) => x.id === p.id ? { ...x, title: value } : x));
        await fetch(`/api/dashboard/items/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: value }),
        });
      },
    },
    {
      key: 'cliente',
      header: 'Cliente',
      editable: true,
      editType: 'text',
      render: (p) => <span className="text-zinc-400">{p.metadata.cliente || '—'}</span>,
      getValue: (p) => p.metadata.cliente ?? '',
      onSave: async (p, value) => {
        optimistic(p.id, { cliente: value });
        await updateProjeto(p.id, p.metadata, { cliente: value });
      },
    },
    {
      key: 'status',
      header: 'Status',
      editable: true,
      editType: 'select',
      editOptions: [
        { value: 'ativo', label: 'Ativo' },
        { value: 'pausado', label: 'Pausado' },
        { value: 'concluido', label: 'Concluído' },
      ],
      render: (p) => <StatusBadge value={p.metadata.status ?? 'ativo'} />,
      getValue: (p) => p.metadata.status ?? 'ativo',
      onSave: async (p, value) => {
        optimistic(p.id, { status: value });
        await updateProjeto(p.id, p.metadata, { status: value });
      },
    },
    {
      key: 'valor_estimado',
      header: 'Valor est.',
      editable: true,
      editType: 'number',
      render: (p) => (
        <span className={p.metadata.valor_estimado ? 'text-emerald-400' : 'text-zinc-600'}>
          {fmtBRL(p.metadata.valor_estimado)}
        </span>
      ),
      getValue: (p) => p.metadata.valor_estimado ?? '',
      onSave: async (p, value) => {
        const num = value ? parseFloat(value) : null;
        optimistic(p.id, { valor_estimado: num });
        await updateProjeto(p.id, p.metadata, { valor_estimado: num });
      },
    },
    {
      key: 'created_at',
      header: 'Criado',
      render: (p) => (
        <span className="text-zinc-500 text-xs">{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-500 text-sm animate-pulse">
        Carregando projetos...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Projetos</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} projeto(s)</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-95 text-sm font-medium text-white transition-all"
        >
          <Plus size={16} />
          Novo Projeto
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'ativo', label: 'Ativo' },
                { value: 'pausado', label: 'Pausado' },
                { value: 'concluido', label: 'Concluído' },
              ],
            },
          ]}
          filterValues={filters}
          onFilter={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
          placeholder="Buscar projeto ou cliente..."
        />
        <ViewToggle
          current={view}
          onChange={setView}
          options={[
            { id: 'cards', label: 'Cards' },
            { id: 'table', label: 'Tabela' },
          ]}
        />
      </div>

      {view === 'cards' && <CardsView projetos={filtered} onDelete={deleteProjeto} />}
      {view === 'table' && (
        <DataTable
          columns={columns}
          data={filtered}
          onDelete={setDeleteTarget}
          emptyMessage="Nenhum projeto encontrado."
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Deletar projeto"
        message={deleteTarget ? `Tem certeza que quer deletar "${deleteTarget.title}"? Essa ação não pode ser desfeita.` : ''}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <CreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        type="project"
        onCreated={(item) => setProjetos((prev) => [item, ...prev])}
      />
    </div>
  );
}

function CardsView({
  projetos,
  onDelete,
}: {
  projetos: Projeto[];
  onDelete: (p: Projeto) => void;
}) {
  if (projetos.length === 0) {
    return <div className="text-center py-16 text-zinc-500 text-sm">Nenhum projeto encontrado.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {projetos.map((p) => {
        const status = p.metadata.status ?? 'ativo';
        const borderColor =
          status === 'ativo' ? 'border-emerald-500/20 hover:border-emerald-500/40' :
          status === 'pausado' ? 'border-amber-500/20 hover:border-amber-500/40' :
          'border-zinc-800 hover:border-zinc-700';

        return (
          <div
            key={p.id}
            className={`bg-zinc-900 border ${borderColor} rounded-lg p-4 transition-colors group`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{p.title}</p>
                {p.metadata.cliente && (
                  <p className="text-xs text-zinc-500 mt-0.5">👤 {p.metadata.cliente}</p>
                )}
              </div>
              <button
                onClick={() => onDelete(p)}
                className="text-zinc-700 hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between mt-3">
              <StatusBadge value={status} />
              {p.metadata.valor_estimado ? (
                <span className="text-sm font-semibold text-emerald-400">
                  {fmtBRL(p.metadata.valor_estimado)}
                </span>
              ) : null}
            </div>

            <p className="text-xs text-zinc-600 mt-3">
              {new Date(p.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        );
      })}
    </div>
  );
}
