'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBadge } from '@/components/dashboard/StatusBadge';

interface VaultDoc {
  id: string;
  type: string;
  title: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface OverviewData {
  tarefas: VaultDoc[];
  leads: VaultDoc[];
  projetos: VaultDoc[];
  financeiro: VaultDoc[];
}

function fmtBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData>({ tarefas: [], leads: [], projetos: [], financeiro: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, l, p, f] = await Promise.all([
        fetch('/api/dashboard/items?type=task&limit=100').then((r) => r.json()),
        fetch('/api/dashboard/items?type=lead&limit=100').then((r) => r.json()),
        fetch('/api/dashboard/items?type=project&limit=100').then((r) => r.json()),
        fetch('/api/dashboard/items?type=financial&limit=100').then((r) => r.json()),
      ]);
      setData({ tarefas: t, leads: l, projetos: p, financeiro: f });
      setLoading(false);
    }
    load();
  }, []);

  // --- compute metrics ---
  const tarefasPendentes = data.tarefas.filter(
    (t) => (t.metadata.status as string) !== 'concluida',
  );
  const tarefasUrgentes = tarefasPendentes.filter(
    (t) => t.metadata.urgencia === 'alta',
  );
  const leadsAtivos = data.leads.filter(
    (l) => !['perdido', 'fechado'].includes(l.metadata.status as string),
  );
  const projetosAtivos = data.projetos.filter(
    (p) => p.metadata.status === 'ativo',
  );

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const financeiroMes = data.financeiro.filter(
    (f) => (f.metadata.data as string) >= startOfMonth.slice(0, 10),
  );
  const totalReceita = financeiroMes
    .filter((f) => f.metadata.tipo === 'receita')
    .reduce((acc, f) => acc + (f.metadata.valor as number), 0);
  const totalDespesa = financeiroMes
    .filter((f) => f.metadata.tipo === 'despesa')
    .reduce((acc, f) => acc + (f.metadata.valor as number), 0);
  const saldo = totalReceita - totalDespesa;

  // --- recent 5 of each ---
  const recentes = [
    ...data.tarefas.slice(0, 3).map((d) => ({ ...d, _section: 'tarefas' })),
    ...data.leads.slice(0, 3).map((d) => ({ ...d, _section: 'leads' })),
    ...data.projetos.slice(0, 2).map((d) => ({ ...d, _section: 'projetos' })),
    ...data.financeiro.slice(0, 2).map((d) => ({ ...d, _section: 'financeiro' })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-500 text-sm animate-pulse">
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100">🚀 Visão Geral</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tarefas pendentes"
          value={tarefasPendentes.length}
          sub={tarefasUrgentes.length > 0 ? `${tarefasUrgentes.length} urgentes` : 'Tudo sob controle'}
          accent={tarefasUrgentes.length > 0 ? 'rose' : 'violet'}
          icon={<span className="text-lg">📋</span>}
        />
        <StatCard
          label="Leads ativos"
          value={leadsAtivos.length}
          sub={`${data.leads.filter((l) => l.metadata.status === 'qualificado').length} qualificados`}
          accent="violet"
          icon={<span className="text-lg">👥</span>}
        />
        <StatCard
          label="Saldo do mês"
          value={fmtBRL(saldo)}
          sub={`↑${fmtBRL(totalReceita)} ↓${fmtBRL(totalDespesa)}`}
          accent={saldo >= 0 ? 'emerald' : 'rose'}
          icon={<span className="text-lg">💰</span>}
        />
        <StatCard
          label="Projetos ativos"
          value={projetosAtivos.length}
          sub={`${data.projetos.length} total`}
          accent="emerald"
          icon={<span className="text-lg">🚀</span>}
        />
      </div>

      {/* Quick sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tarefas urgentes */}
        <Section
          title="Tarefas urgentes / em aberto"
          href="/dashboard/tarefas"
          empty={tarefasPendentes.length === 0}
        >
          {tarefasPendentes.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    t.metadata.urgencia === 'alta'
                      ? 'bg-rose-500'
                      : t.metadata.urgencia === 'media'
                      ? 'bg-amber-400'
                      : 'bg-zinc-600'
                  }`}
                />
                <span className="text-sm text-zinc-200 truncate">{t.title}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {t.metadata.prazo && (
                  <span className="text-xs text-zinc-500">{formatDate(t.metadata.prazo as string)}</span>
                )}
                <StatusBadge value={(t.metadata.status as string) ?? 'pendente'} />
              </div>
            </div>
          ))}
        </Section>

        {/* Leads recentes */}
        <Section
          title="Leads recentes"
          href="/dashboard/leads"
          empty={data.leads.length === 0}
        >
          {data.leads.slice(0, 5).map((l) => (
            <div key={l.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200 truncate">{l.title}</p>
                {l.metadata.empresa && (
                  <p className="text-xs text-zinc-500">{l.metadata.empresa as string}</p>
                )}
              </div>
              <StatusBadge value={(l.metadata.status as string) ?? 'novo'} />
            </div>
          ))}
        </Section>

        {/* Projetos ativos */}
        <Section
          title="Projetos ativos"
          href="/dashboard/projetos"
          empty={projetosAtivos.length === 0}
        >
          {projetosAtivos.slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200 truncate">{p.title}</p>
                {p.metadata.cliente && (
                  <p className="text-xs text-zinc-500">{p.metadata.cliente as string}</p>
                )}
              </div>
              {p.metadata.valor_estimado && (
                <span className="text-sm text-emerald-400 ml-2 flex-shrink-0">
                  {fmtBRL(p.metadata.valor_estimado as number)}
                </span>
              )}
            </div>
          ))}
        </Section>

        {/* Financeiro recente */}
        <Section
          title="Lançamentos recentes"
          href="/dashboard/financeiro"
          empty={data.financeiro.length === 0}
        >
          {data.financeiro.slice(0, 5).map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
              <p className="text-sm text-zinc-200 truncate">{f.title}</p>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <span
                  className={`text-sm font-medium ${
                    f.metadata.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {f.metadata.tipo === 'receita' ? '+' : '-'}{fmtBRL(f.metadata.valor as number)}
                </span>
                <span className="text-xs text-zinc-600">{fmtDate(f.created_at)}</span>
              </div>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        <Link href={href} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          Ver tudo →
        </Link>
      </div>
      {empty ? (
        <p className="text-sm text-zinc-600 py-4 text-center">Nenhum item ainda</p>
      ) : (
        children
      )}
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
