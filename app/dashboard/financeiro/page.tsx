'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { ViewToggle, ViewMode } from '@/components/dashboard/ViewToggle';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { DataTable, Column } from '@/components/dashboard/DataTable';
import { CreateDrawer } from '@/components/dashboard/CreateDrawer';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';

interface Lancamento {
  id: string;
  title: string;
  content: string | null;
  metadata: {
    valor: number;
    tipo: 'receita' | 'despesa';
    projeto?: string;
    data?: string;
  };
  created_at: string;
}

function fmtBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getMonthKey(iso: string) {
  return iso.slice(0, 7); // "2026-06"
}

function getMonthLabel(key: string) {
  const [year, month] = key.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}

export default function FinanceiroPage() {
  const [items, setItems] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('resumo');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lancamento | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/items?type=financial&limit=500')
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      list = list.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()));
    }
    if (filters.tipo) list = list.filter((i) => i.metadata.tipo === filters.tipo);
    if (filters.periodo) {
      const now = new Date();
      if (filters.periodo === 'mes') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        list = list.filter((i) => (i.metadata.data ?? i.created_at.slice(0, 10)) >= start);
      }
      if (filters.periodo === '3meses') {
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10);
        list = list.filter((i) => (i.metadata.data ?? i.created_at.slice(0, 10)) >= start);
      }
    }
    return list;
  }, [items, search, filters]);

  // Metrics
  const totalReceita = filtered.filter((i) => i.metadata.tipo === 'receita').reduce((s, i) => s + i.metadata.valor, 0);
  const totalDespesa = filtered.filter((i) => i.metadata.tipo === 'despesa').reduce((s, i) => s + i.metadata.valor, 0);
  const saldo = totalReceita - totalDespesa;

  // Monthly chart data (last 6 months)
  const chartData = useMemo(() => {
    const monthMap: Record<string, { receita: number; despesa: number }> = {};
    items.forEach((i) => {
      const key = getMonthKey(i.metadata.data ?? i.created_at.slice(0, 10));
      if (!monthMap[key]) monthMap[key] = { receita: 0, despesa: 0 };
      if (i.metadata.tipo === 'receita') monthMap[key].receita += i.metadata.valor;
      else monthMap[key].despesa += i.metadata.valor;
    });
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, vals]) => ({ month: getMonthLabel(key), ...vals }));
  }, [items]);

  function optimistic(id: string, patch: Record<string, unknown>) {
    setItems((prev) =>
      prev.map((i) => i.id === id ? { ...i, metadata: { ...i.metadata, ...patch } } : i),
    );
  }

  async function deleteItem(item: Lancamento) {
    setDeleteTarget(item);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    await fetch(`/api/dashboard/items/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
  }

  const columns: Column<Lancamento>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      render: (i) => <StatusBadge value={i.metadata.tipo} />,
    },
    {
      key: 'title',
      header: 'Descrição',
      render: (i) => <span className="text-zinc-200">{i.title}</span>,
    },
    {
      key: 'valor',
      header: 'Valor',
      editable: true,
      editType: 'number',
      render: (i) => (
        <span className={`font-semibold ${i.metadata.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {i.metadata.tipo === 'receita' ? '+' : '-'}{fmtBRL(i.metadata.valor)}
        </span>
      ),
      getValue: (i) => i.metadata.valor,
      onSave: async (i, value) => {
        const num = parseFloat(value);
        if (isNaN(num)) return;
        optimistic(i.id, { valor: num });
        await fetch(`/api/dashboard/items/${i.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: { ...i.metadata, valor: num } }),
        });
      },
    },
    {
      key: 'projeto',
      header: 'Projeto',
      editable: true,
      editType: 'text',
      render: (i) => <span className="text-zinc-400">{i.metadata.projeto || '—'}</span>,
      getValue: (i) => i.metadata.projeto ?? '',
      onSave: async (i, value) => {
        optimistic(i.id, { projeto: value });
        await fetch(`/api/dashboard/items/${i.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: { ...i.metadata, projeto: value } }),
        });
      },
    },
    {
      key: 'data',
      header: 'Data',
      render: (i) => (
        <span className="text-zinc-500 text-xs">
          {fmtDate(i.metadata.data ?? i.created_at.slice(0, 10))}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-500 text-sm animate-pulse">
        Carregando financeiro...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Financeiro</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} lançamento(s)</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-95 text-sm font-medium text-white transition-all"
        >
          <Plus size={16} />
          Novo Lançamento
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          search={search}
          onSearch={setSearch}
          filters={[
            {
              key: 'tipo',
              label: 'Tipo',
              options: [
                { value: 'receita', label: 'Receita' },
                { value: 'despesa', label: 'Despesa' },
              ],
            },
            {
              key: 'periodo',
              label: 'Período',
              options: [
                { value: 'mes', label: 'Este mês' },
                { value: '3meses', label: 'Últimos 3 meses' },
              ],
            },
          ]}
          filterValues={filters}
          onFilter={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
          placeholder="Buscar lançamento..."
        />
        <ViewToggle
          current={view}
          onChange={setView}
          options={[
            { id: 'resumo', label: 'Resumo' },
            { id: 'table', label: 'Tabela' },
          ]}
        />
      </div>

      {view === 'resumo' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Receitas</p>
              <p className="text-2xl font-bold text-emerald-400">{fmtBRL(totalReceita)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Despesas</p>
              <p className="text-2xl font-bold text-rose-400">{fmtBRL(totalDespesa)}</p>
            </div>
            <div className={`bg-zinc-900 border rounded-lg p-4 ${saldo >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Saldo</p>
              <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {saldo >= 0 ? '+' : ''}{fmtBRL(saldo)}
              </p>
            </div>
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Histórico por mês</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={4} barCategoryGap="30%">
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#f4f4f5', fontSize: 12 }}
                    formatter={(value: number, name: string) => [fmtBRL(value), name === 'receita' ? 'Receita' : 'Despesa']}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Receita
                </span>
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <span className="w-3 h-3 rounded-sm bg-rose-500" /> Despesa
                </span>
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-300">Lançamentos</h2>
            </div>
            {filtered.length === 0 ? (
              <p className="text-center py-12 text-zinc-600 text-sm">Nenhum lançamento</p>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {filtered.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 group transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200 truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge value={item.metadata.tipo} />
                        {item.metadata.projeto && (
                          <span className="text-xs text-zinc-500">{item.metadata.projeto}</span>
                        )}
                        <span className="text-xs text-zinc-600">
                          {fmtDate(item.metadata.data ?? item.created_at.slice(0, 10))}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className={`text-sm font-semibold ${item.metadata.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.metadata.tipo === 'receita' ? '+' : '-'}{fmtBRL(item.metadata.valor)}
                      </span>
                      <button
                        onClick={() => deleteItem(item)}
                        className="text-zinc-700 hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'table' && (
        <DataTable
          columns={columns}
          data={filtered}
          onDelete={deleteItem}
          emptyMessage="Nenhum lançamento encontrado."
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Deletar lançamento"
        message={deleteTarget ? `Tem certeza que quer deletar "${deleteTarget.title}"? Essa ação não pode ser desfeita.` : ''}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <CreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        type="financial"
        onCreated={(item) => setItems((prev) => [item, ...prev])}
      />
    </div>
  );
}
