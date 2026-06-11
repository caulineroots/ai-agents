'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NovoOrcamento() {
  const router = useRouter();
  const [planilha, setPlanilha] = useState<File | null>(null);
  const [desenhos, setDesenhos] = useState<File[]>([]);
  const [useLlm, setUseLlm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (!planilha) { setErro('Selecione a planilha (.xlsx).'); return; }
    setErro(null); setLoading(true);
    try {
      const fd = new FormData();
      fd.append('planilha', planilha);
      desenhos.forEach((d) => fd.append('desenhos', d));
      fd.append('use_llm', String(useLlm));
      const r = await fetch('/api/orcamento-construtora/jobs', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Falha ao criar o job');
      router.push('/orcamento-construtora/jobs');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Novo orçamento</h1>
            <p className="text-zinc-400 mt-1 text-sm">
              A planilha inicial define o escopo. Ao enviar, criamos um job e o
              processamento roda em segundo plano — você acompanha na lista de jobs.
            </p>
          </div>
          <Link href="/orcamento-construtora/jobs"
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800">
            Ver jobs →
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Planilha inicial (.xlsx)</span>
            <input type="file" accept=".xlsx,.xlsm"
              onChange={(e) => setPlanilha(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-zinc-100" />
            {planilha && <span className="text-xs text-emerald-400">{planilha.name}</span>}
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Desenhos (PDF / DWG / DXF)</span>
            <input type="file" multiple accept=".pdf,.dwg,.dxf"
              onChange={(e) => setDesenhos(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-zinc-100" />
            {desenhos.length > 0 && <span className="text-xs text-emerald-400">{desenhos.length} arquivo(s)</span>}
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} />
            Usar IA na medição (desambiguação por ambiente + geometria; mais lento e com custo de API)
          </label>
          <div className="sm:col-span-2">
            <button onClick={criar} disabled={loading || !planilha}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-medium">
              {loading ? 'Enviando…' : 'Criar orçamento'}
            </button>
          </div>
          {erro && <p className="sm:col-span-2 text-sm text-rose-400">{erro}</p>}
        </section>
      </div>
    </div>
  );
}
