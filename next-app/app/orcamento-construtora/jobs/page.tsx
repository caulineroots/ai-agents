'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type JobRow = {
  id: string; status: string; filename: string; nDesenhos: number;
  useLlm: boolean; progress: string | null; error: string | null;
  createdAt: string; finishedAt: string | null;
};

const STATUS: Record<string, string> = {
  pending: 'bg-zinc-500/15 text-zinc-300',
  in_progress: 'bg-sky-500/15 text-sky-300 animate-pulse',
  completed: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-rose-500/15 text-rose-300',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'na fila', in_progress: 'processando', completed: 'concluído', failed: 'falhou',
};

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR') : '—');

export default function JobsList() {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/orcamento-construtora/jobs', { cache: 'no-store' });
        const j = await r.json();
        if (alive) setJobs(j);
      } catch { /* mantém o estado anterior */ }
    };
    load();
    const t = setInterval(load, 3000);   // polling
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Jobs de orçamento</h1>
            <p className="text-zinc-400 text-sm mt-1">Atualiza automaticamente a cada 3s.</p>
          </div>
          <Link href="/orcamento-construtora"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium">
            + Novo orçamento
          </Link>
        </header>

        {jobs === null ? (
          <p className="text-zinc-500 text-sm">Carregando…</p>
        ) : jobs.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhum job ainda. Crie um orçamento para começar.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/70 text-zinc-400 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Planilha</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Progresso</th>
                  <th className="px-3 py-2 font-medium">Desenhos</th>
                  <th className="px-3 py-2 font-medium">IA</th>
                  <th className="px-3 py-2 font-medium">Criado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-zinc-900/40">
                    <td className="px-3 py-2 max-w-xs truncate" title={j.filename}>{j.filename}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS[j.status] ?? ''}`}>
                        {STATUS_LABEL[j.status] ?? j.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      {j.status === 'failed' ? <span className="text-rose-400" title={j.error ?? ''}>{j.error?.slice(0, 40)}</span>
                        : (j.progress ?? '—')}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{j.nDesenhos}</td>
                    <td className="px-3 py-2 text-zinc-400">{j.useLlm ? 'sim' : 'não'}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">{fmt(j.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/orcamento-construtora/jobs/${j.id}`}
                        className="text-indigo-400 hover:text-indigo-300 text-xs">abrir →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
