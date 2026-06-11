'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type LinhaRel = {
  item: string; descricao: string; status: string; qde_final: number | null;
  unidade: string | null; metodo: string | null; fonte: string | null;
  flags: string[];
};
type Resumo = { n_itens: number; por_status: Record<string, number>; n_para_revisao: number; total_orcado: number };
type Job = {
  id: string; status: string; filename: string; progress: string | null; error: string | null;
  result: { resumo: Resumo; work_list: LinhaRel[]; n_pranchas: number; use_llm: boolean } | null;
};

const ITEM_COR: Record<string, string> = {
  confirmado: 'bg-emerald-500/15 text-emerald-300', encontrado: 'bg-sky-500/15 text-sky-300',
  divergente: 'bg-amber-500/15 text-amber-300', manual: 'bg-rose-500/15 text-rose-300',
  lump_sum: 'bg-zinc-500/15 text-zinc-300',
};
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await fetch(`/api/orcamento-construtora/jobs/${id}`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        setJob(j);
        if (j.status !== 'completed' && j.status !== 'failed') t = setTimeout(load, 3000); // poll até terminar
      } catch {
        if (alive) t = setTimeout(load, 3000);
      }
    };
    load();
    return () => { alive = false; clearTimeout(t); };
  }, [id]);

  if (!job) return <Shell><p className="text-zinc-500 text-sm">Carregando…</p></Shell>;

  const running = job.status === 'pending' || job.status === 'in_progress';

  return (
    <Shell>
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{job.filename}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {running ? <span className="text-sky-300">{job.progress ?? 'na fila'}…</span>
              : job.status === 'failed' ? <span className="text-rose-400">falhou: {job.error}</span>
              : <span className="text-emerald-400">concluído</span>}
          </p>
        </div>
        {job.status === 'completed' && (
          <a href={`/api/orcamento-construtora/jobs/${job.id}/download`}
            className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium">
            Baixar planilha preenchida
          </a>
        )}
      </header>

      {running && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">
          Processando em segundo plano. Esta página atualiza sozinha — pode recarregar ou sair
          e voltar pela lista de jobs sem perder o trabalho.
        </div>
      )}

      {job.result && (
        <>
          <section className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 uppercase">Total orçado</div>
              <div className="text-3xl font-semibold text-emerald-400">{brl(job.result.resumo.total_orcado)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(job.result.resumo.por_status).map(([s, n]) => (
                <span key={s} className={`rounded-md px-2.5 py-1 text-xs ${ITEM_COR[s] ?? 'bg-zinc-700/40'}`}>{s}: <strong>{n}</strong></span>
              ))}
              <span className="rounded-md px-2.5 py-1 text-xs bg-zinc-800 text-zinc-300">
                {job.result.n_pranchas} pranchas · {job.result.use_llm ? 'IA' : 'determinístico'}
              </span>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-300">Revisão humana — {job.result.work_list.length} linha(s)</h2>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/70 text-zinc-400 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Qtd</th>
                    <th className="px-3 py-2 font-medium">Fonte</th>
                    <th className="px-3 py-2 font-medium">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {job.result.work_list.map((l) => (
                    <tr key={l.item} className="hover:bg-zinc-900/40">
                      <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{l.item}</td>
                      <td className="px-3 py-2">{l.descricao}</td>
                      <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${ITEM_COR[l.status] ?? ''}`}>{l.status}</span></td>
                      <td className="px-3 py-2 whitespace-nowrap">{l.qde_final != null ? `${l.qde_final} ${l.unidade ?? ''}` : '—'}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500 max-w-xs truncate" title={l.fonte ?? ''}>{l.fonte ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-amber-300/80">{l.flags.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/orcamento-construtora/jobs" className="text-indigo-400 hover:text-indigo-300 text-sm">← Jobs</Link>
        {children}
      </div>
    </div>
  );
}
