'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { MapsJobResponse, MapsLead, RegionsResponse } from '@/lib/leads-maps/types';

const NICHE_CHIPS = ['marcenaria', 'dentista', 'imobiliária', 'clínica', 'restaurante'];

export default function LeadsMapsPage() {
  const [keyword, setKeyword] = useState('marcenaria');
  const [regions, setRegions] = useState<RegionsResponse | null>(null);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [selectedStates, setSelectedStates] = useState<string[]>(['sp']);
  const [skipExtracted, setSkipExtracted] = useState(true);
  const [perCityLimit, setPerCityLimit] = useState(20);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<MapsJobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRegions = useCallback(async (kw: string) => {
    setRegionsLoading(true);
    try {
      const res = await fetch(`/api/leads-maps/regions?keyword=${encodeURIComponent(kw.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setRegions(data as RegionsResponse);
      }
    } catch {
      /* ignore — regions refresh is best-effort */
    } finally {
      setRegionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadRegions(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword, loadRegions]);

  const selectedStateData = useMemo(
    () => regions?.states.filter((s) => selectedStates.includes(s.code)) ?? [],
    [regions, selectedStates],
  );

  const pendingCount = useMemo(() => {
    if (!skipExtracted) {
      return selectedStateData.reduce((n, s) => n + s.city_count, 0);
    }
    return selectedStateData.reduce(
      (n, s) => n + s.cities.filter((c) => !c.extracted).length,
      0,
    );
  }, [selectedStateData, skipExtracted]);

  const extractedCount = useMemo(
    () => selectedStateData.reduce((n, s) => n + s.extracted_count, 0),
    [selectedStateData],
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/leads-maps/status/${id}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Erro ao consultar status');
          stopPolling();
          setRunning(false);
          return;
        }
        setJob(data as MapsJobResponse);
        if (data.status === 'completed' || data.status === 'failed') {
          stopPolling();
          setRunning(false);
          loadRegions(keyword);
          if (data.status === 'failed') {
            setError(data.error ?? 'Extração falhou');
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro de rede');
        stopPolling();
        setRunning(false);
      }
    },
    [keyword, loadRegions, stopPolling],
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  function toggleState(code: string) {
    setSelectedStates((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function handleStart() {
    setError(null);
    setJob(null);
    if (!keyword.trim()) {
      setError('Informe o nicho de busca.');
      return;
    }
    if (selectedStates.length === 0) {
      setError('Selecione pelo menos um estado.');
      return;
    }
    if (pendingCount === 0) {
      setError('Nenhum município pendente nos estados selecionados.');
      return;
    }

    setRunning(true);
    try {
      const res = await fetch('/api/leads-maps/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          state_codes: selectedStates,
          per_city_limit: perCityLimit,
          skip_extracted: skipExtracted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.detail ?? 'Falha ao iniciar');
        setRunning(false);
        return;
      }
      const id = data.job_id as string;
      setJobId(id);
      setJob(data as MapsJobResponse);
      stopPolling();
      pollRef.current = setInterval(() => pollStatus(id), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar');
      setRunning(false);
    }
  }

  function handleDownload() {
    if (!jobId) return;
    window.open(`/api/leads-maps/download/${jobId}`, '_blank');
  }

  const leads: MapsLead[] = job?.businesses ?? [];
  const progressPct =
    job && job.cities_total > 0
      ? Math.round((job.cities_done / job.cities_total) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <Link href="/" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold mt-1">Extrator de Leads — Google Maps</h1>
          <p className="text-sm text-white/50 mt-0.5">
            Estados e municípios pré-configurados · histórico em banco local
          </p>
          <p className="text-xs text-white/35 mt-1">
            Leads salvos em <code className="text-white/45">data/maps_exports/</code> (CSV) e histórico em{' '}
            <code className="text-white/45">data/maps_leads.db</code>
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Nicho</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ex: marcenaria, dentista"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50"
              disabled={running}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {NICHE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setKeyword(chip)}
                  disabled={running}
                  className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-violet-600/20 hover:border-violet-500/40 transition-colors disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

            <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <label className="text-sm font-medium text-white/80">
                Estados
                {regions && (
                  <span className="text-white/40 font-normal ml-2">
                    {regions.states.length} UF ·{' '}
                    {regions.states.reduce((n, s) => n + s.city_count, 0)} municípios
                  </span>
                )}
              </label>
              {regionsLoading && (
                <span className="text-xs text-white/40">Atualizando histórico…</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(regions?.states ?? []).map((state) => {
                const active = selectedStates.includes(state.code);
                return (
                  <button
                    key={state.code}
                    type="button"
                    onClick={() => toggleState(state.code)}
                    disabled={running}
                    className={`text-sm px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                      active
                        ? 'bg-violet-600/30 border-violet-500/50 text-white'
                        : 'bg-black/30 border-white/10 text-white/60 hover:border-white/20'
                    }`}
                  >
                    {state.name}
                    <span className="text-xs text-white/40 ml-1.5">
                      ({state.extracted_count}/{state.city_count})
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/40 mt-2">
              {selectedStates.length} estado(s) · {pendingCount} município(s) para extrair
              {skipExtracted && extractedCount > 0 && (
                <span> · {extractedCount} já no banco</span>
              )}
            </p>
          </div>

          {selectedStateData.length > 0 && (
            <div className="space-y-4">
              {selectedStateData.map((state) => (
                <div
                  key={state.code}
                  className="bg-black/30 border border-white/5 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-sm font-medium">
                      {state.name}
                      <span className="text-white/40 font-normal ml-2">
                        busca: {keyword} + município + {state.parent_city}
                      </span>
                    </h3>
                    <span className="text-xs text-white/40">
                      {state.extracted_count}/{state.city_count} extraídos
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.cities.map((city) => (
                      <span
                        key={city.name}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          city.extracted
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400/90'
                            : 'bg-white/5 border-white/10 text-white/50'
                        }`}
                        title={
                          city.extracted
                            ? `Extraído ${city.extracted_at ?? ''} · ${city.leads_count} leads`
                            : 'Pendente'
                        }
                      >
                        {city.name}
                        {city.extracted && ' ✓'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Empresas por município
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={perCityLimit}
                onChange={(e) => setPerCityLimit(Number(e.target.value) || 20)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50"
                disabled={running}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 text-sm text-white/70 cursor-pointer pb-2.5">
                <input
                  type="checkbox"
                  checked={skipExtracted}
                  onChange={(e) => setSkipExtracted(e.target.checked)}
                  disabled={running}
                  className="rounded border-white/20 accent-violet-500"
                />
                Pular municípios já extraídos
              </label>
            </div>
          </div>

          {error && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={handleStart}
              disabled={running || pendingCount === 0}
              className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {running ? 'Extraindo…' : `Extrair ${pendingCount} município(s)`}
            </button>
            {jobId && (job?.csv_ready || leads.length > 0) && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2.5 rounded-lg border border-white/15 hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Baixar CSV
              </button>
            )}
          </div>
        </section>

        {(running || job) && (
          <section className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">Progresso</h2>
              <span className="text-xs text-white/50 capitalize">
                {job?.status ?? 'iniciando'}
              </span>
            </div>

            {job && job.cities_total > 0 && (
              <>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-sm text-white/60">
                  Município {job.cities_done}/{job.cities_total}
                  {job.current_city ? ` — ${job.current_city}` : ''}
                  · {job.leads_count} leads coletados
                </p>
              </>
            )}

            {job?.logs && job.logs.length > 0 && (
              <div className="bg-black/40 border border-white/5 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-xs text-white/50 space-y-0.5">
                {job.logs.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
          </section>
        )}

        {leads.length > 0 && (
          <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold">Resultados ({leads.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/40 border-b border-white/10">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Telefone</th>
                    <th className="px-4 py-3 font-medium">Site</th>
                    <th className="px-4 py-3 font-medium">Município</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/90">{lead.name ?? '—'}</td>
                      <td className="px-4 py-3 text-white/70">{lead.phone ?? '—'}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:underline"
                          >
                            {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {lead.city_name ?? lead.search_location ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
      <div className="h-8" />
    </div>
  );
}
