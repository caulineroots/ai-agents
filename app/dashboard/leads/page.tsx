'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { ViewToggle, ViewMode } from '@/components/dashboard/ViewToggle';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { DataTable, Column } from '@/components/dashboard/DataTable';
import { CreateDrawer } from '@/components/dashboard/CreateDrawer';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';

interface Lead {
  id: string;
  title: string;
  metadata: {
    empresa?: string;
    telefone?: string;
    interesse?: string;
    qualificado?: boolean;
    status?: string;
  };
  created_at: string;
}

async function updateLead(id: string, meta: Lead, patch: Record<string, unknown>) {
  await fetch(`/api/dashboard/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata: { ...meta.metadata, ...patch } }),
  });
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('cards');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/items?type=lead&limit=200')
      .then((r) => r.json())
      .then((data) => { setLeads(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let list = leads;
    if (search) {
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(search.toLowerCase()) ||
          (l.metadata.empresa ?? '').toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (filters.status) list = list.filter((l) => l.metadata.status === filters.status);
    if (filters.qualificado === 'sim') list = list.filter((l) => l.metadata.qualificado === true);
    if (filters.qualificado === 'nao') list = list.filter((l) => !l.metadata.qualificado);
    return list;
  }, [leads, search, filters]);

  function optimistic(id: string, patch: Record<string, unknown>) {
    setLeads((prev) =>
      prev.map((l) => l.id === id ? { ...l, metadata: { ...l.metadata, ...patch } } : l),
    );
  }

  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setLeads((prev) => prev.filter((l) => l.id !== deleteTarget.id));
    await fetch(`/api/dashboard/items/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
  }

  const columns: Column<Lead>[] = [
    {
      key: 'title',
      header: 'Nome',
      editable: true,
      editType: 'text',
      render: (l) => <span className="text-zinc-200 font-medium">{l.title}</span>,
      getValue: (l) => l.title,
      onSave: async (l, value) => {
        setLeads((prev) => prev.map((x) => x.id === l.id ? { ...x, title: value } : x));
        await fetch(`/api/dashboard/items/${l.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: value }),
        });
      },
    },
    {
      key: 'empresa',
      header: 'Empresa',
      editable: true,
      editType: 'text',
      render: (l) => <span className="text-zinc-400">{l.metadata.empresa || '—'}</span>,
      getValue: (l) => l.metadata.empresa ?? '',
      onSave: async (l, value) => {
        optimistic(l.id, { empresa: value });
        await updateLead(l.id, l, { empresa: value });
      },
    },
    {
      key: 'telefone',
      header: 'Telefone',
      editable: true,
      editType: 'text',
      render: (l) => <span className="text-zinc-400">{l.metadata.telefone || '—'}</span>,
      getValue: (l) => l.metadata.telefone ?? '',
      onSave: async (l, value) => {
        optimistic(l.id, { telefone: value });
        await updateLead(l.id, l, { telefone: value });
      },
    },
    {
      key: 'interesse',
      header: 'Interesse',
      editable: true,
      editType: 'text',
      render: (l) => <span className="text-zinc-400 truncate">{l.metadata.interesse || '—'}</span>,
      getValue: (l) => l.metadata.interesse ?? '',
      onSave: async (l, value) => {
        optimistic(l.id, { interesse: value });
        await updateLead(l.id, l, { interesse: value });
      },
    },
    {
      key: 'status',
      header: 'Status',
      editable: true,
      editType: 'select',
      editOptions: [
        { value: 'novo', label: 'Novo' },
        { value: 'em_contato', label: 'Em contato' },
        { value: 'qualificado', label: 'Qualificado' },
        { value: 'perdido', label: 'Perdido' },
        { value: 'fechado', label: 'Fechado' },
      ],
      render: (l) => <StatusBadge value={l.metadata.status ?? 'novo'} />,
      getValue: (l) => l.metadata.status ?? 'novo',
      onSave: async (l, value) => {
        optimistic(l.id, { status: value });
        await updateLead(l.id, l, { status: value });
      },
    },
    {
      key: 'qualificado',
      header: 'Qualificado',
      editable: true,
      editType: 'select',
      editOptions: [
        { value: 'true', label: 'Sim' },
        { value: 'false', label: 'Não' },
      ],
      render: (l) => (
        <span className={l.metadata.qualificado ? 'text-emerald-400' : 'text-zinc-600'}>
          {l.metadata.qualificado ? '✓ Sim' : '— Não'}
        </span>
      ),
      getValue: (l) => String(l.metadata.qualificado ?? false),
      onSave: async (l, value) => {
        const qual = value === 'true';
        optimistic(l.id, { qualificado: qual });
        await updateLead(l.id, l, { qualificado: qual });
      },
    },
    {
      key: 'created_at',
      header: 'Criado',
      render: (l) => (
        <span className="text-zinc-500 text-xs">
          {new Date(l.created_at).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-500 text-sm animate-pulse">
        Carregando leads...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Leads / CRM</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} lead(s)</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-95 text-sm font-medium text-white transition-all"
        >
          <Plus size={16} />
          Novo Lead
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
                { value: 'novo', label: 'Novo' },
                { value: 'em_contato', label: 'Em contato' },
                { value: 'qualificado', label: 'Qualificado' },
                { value: 'perdido', label: 'Perdido' },
                { value: 'fechado', label: 'Fechado' },
              ],
            },
            {
              key: 'qualificado',
              label: 'Qualificado',
              options: [
                { value: 'sim', label: 'Sim' },
                { value: 'nao', label: 'Não' },
              ],
            },
          ]}
          filterValues={filters}
          onFilter={setFilter}
          placeholder="Buscar lead ou empresa..."
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

      {view === 'cards' && (
        <CardsView leads={filtered} onUpdate={optimistic} onDelete={setDeleteTarget} />
      )}
      {view === 'table' && (
        <DataTable
          columns={columns}
          data={filtered}
          onDelete={setDeleteTarget}
          emptyMessage="Nenhum lead encontrado."
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Deletar lead"
        message={deleteTarget ? `Tem certeza que quer deletar "${deleteTarget.title}"? Essa ação não pode ser desfeita.` : ''}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <CreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        type="lead"
        onCreated={(item) => setLeads((prev) => [item, ...prev])}
      />
    </div>
  );
}

const STATUS_FOLLOW_UP: Record<string, string> = {
  novo: 'Iniciar contato',
  em_contato: 'Qualificar',
  qualificado: 'Fechar negócio',
  perdido: 'Reativar',
  fechado: 'Pós-venda',
};

function CardsView({
  leads,
  onUpdate,
  onDelete,
}: {
  leads: Lead[];
  onUpdate: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (lead: Lead) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500 text-sm">
        Nenhum lead encontrado.
      </div>
    );
  }

  const STATUS_NEXT: Record<string, string> = {
    novo: 'em_contato',
    em_contato: 'qualificado',
    qualificado: 'fechado',
    perdido: 'novo',
    fechado: 'fechado',
  };

  async function advance(lead: Lead) {
    const current = lead.metadata.status ?? 'novo';
    const next = STATUS_NEXT[current];
    if (next === current) return;
    onUpdate(lead.id, { status: next });
    await fetch(`/api/dashboard/items/${lead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: { ...lead.metadata, status: next } }),
    });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {leads.map((lead) => {
        const status = lead.metadata.status ?? 'novo';
        const followUp = STATUS_FOLLOW_UP[status] ?? 'Follow-up';

        return (
          <div
            key={lead.id}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 transition-colors group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{lead.title}</p>
                {lead.metadata.empresa && (
                  <p className="text-xs text-zinc-500 mt-0.5">{lead.metadata.empresa}</p>
                )}
              </div>
              <button
                onClick={() => onDelete(lead)}
                className="text-zinc-700 hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Status */}
            <div className="mb-3">
              <StatusBadge value={status} />
              {lead.metadata.qualificado && (
                <span className="ml-2 text-xs text-emerald-400">✓ Qualificado</span>
              )}
            </div>

            {/* Details */}
            <div className="space-y-1 mb-3">
              {lead.metadata.telefone && (
                <p className="text-xs text-zinc-400">📞 {lead.metadata.telefone}</p>
              )}
              {lead.metadata.interesse && (
                <p className="text-xs text-zinc-400 truncate">💬 {lead.metadata.interesse}</p>
              )}
            </div>

            {/* Follow-up CTA */}
            {status !== 'fechado' && status !== 'perdido' && (
              <button
                onClick={() => advance(lead)}
                className="w-full mt-auto pt-2 border-t border-zinc-800 text-xs text-violet-400 hover:text-violet-300 transition-colors text-left"
              >
                → {followUp}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
