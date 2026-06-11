'use client';

import { useState } from 'react';

type Resumo = {
  n_itens: number;
  por_status: Record<string, number>;
  n_para_revisao: number;
  total_orcado: number;
};
type LinhaRel = {
  item: string; descricao: string; status: string; qde_final: number | null;
  unidade: string | null; metodo: string | null; fonte: string | null;
  confianca: number | null; preco_total: number | null; flags: string[];
};
type Resultado = {
  ok: boolean; arquivo: string; n_pranchas: number; use_llm: boolean;
  resumo: Resumo; work_list: LinhaRel[]; planilha_preenchida_b64: string;
};

const STATUS_COR: Record<string, string> = {
  confirmado: 'bg-emerald-500/15 text-emerald-300',
  encontrado: 'bg-sky-500/15 text-sky-300',
  divergente: 'bg-amber-500/15 text-amber-300',
  manual: 'bg-rose-500/15 text-rose-300',
  lump_sum: 'bg-zinc-500/15 text-zinc-300',
  nota: 'bg-zinc-700/30 text-zinc-400',
};

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PlanilhaPage() {
  const [planilha, setPlanilha] = useState<File | null>(null);
  const [desenhos, setDesenhos] = useState<File[]>([]);
  const [useLlm, setUseLlm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);

  async function run() {
    if (!planilha) { setErro('Selecione a planilha (.xlsx).'); return; }
    setErro(null); setLoading(true); setRes(null);
    try {
      const fd = new FormData();
      fd.append('planilha', planilha);
      desenhos.forEach((d) => fd.append('desenhos', d));
      fd.append('use_llm', String(useLlm));
      const r = await fetch('/api/orcamento-construtora/processar', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || 'Falha ao processar');
      setRes(j);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function baixar() {
    if (!res) return;
    const bytes = Uint8Array.from(atob(res.planilha_preenchida_b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = res.arquivo.replace(/\.xlsx$/i, '') + ' - preenchida.xlsx';
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">Orçamento a partir da planilha</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            A planilha inicial define o escopo. O sistema mede cada item nos desenhos
            (verifica os que já têm medida, encontra os que faltam), precifica e devolve
            a planilha preenchida — com a lista do que precisa de revisão humana.
          </p>
        </header>

        {/* Upload */}
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
            Usar IA na medição (desambiguação por ambiente; mais lento e com custo de API)
          </label>
          <div className="sm:col-span-2">
            <button onClick={run} disabled={loading || !planilha}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-medium">
              {loading ? 'Processando…' : 'Processar orçamento'}
            </button>
          </div>
          {erro && <p className="sm:col-span-2 text-sm text-rose-400">{erro}</p>}
        </section>

        {res && (
          <>
            {/* Resumo */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-zinc-500 uppercase">Total orçado</div>
                  <div className="text-3xl font-semibold text-emerald-400">{brl(res.resumo.total_orcado)}</div>
                </div>
                <button onClick={baixar}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium">
                  Baixar planilha preenchida
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(res.resumo.por_status).map(([s, n]) => (
                  <span key={s} className={`rounded-md px-2.5 py-1 text-xs ${STATUS_COR[s] ?? 'bg-zinc-700/40'}`}>
                    {s}: <strong>{n}</strong>
                  </span>
                ))}
                <span className="rounded-md px-2.5 py-1 text-xs bg-zinc-800 text-zinc-300">
                  {res.n_pranchas} pranchas · {res.use_llm ? 'IA on' : 'determinístico'}
                </span>
              </div>
            </section>

            {/* Work-list */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-300">
                Revisão humana — {res.work_list.length} linha(s)
              </h2>
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
                    {res.work_list.map((l) => (
                      <tr key={l.item} className="hover:bg-zinc-900/40">
                        <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{l.item}</td>
                        <td className="px-3 py-2">{l.descricao}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COR[l.status] ?? ''}`}>{l.status}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {l.qde_final != null ? `${l.qde_final} ${l.unidade ?? ''}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-500 max-w-xs truncate" title={l.fonte ?? ''}>
                          {l.fonte ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-amber-300/80">{l.flags.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
