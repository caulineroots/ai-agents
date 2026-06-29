'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type Competitor = {
  id: string;
  name: string;
  instagram_handle: string;
  website_url: string | null;
};

type Snapshot = {
  followers: number;
  following: number;
  posts_count: number;
  scraped_at: string;
};

type Post = {
  id: string;
  shortcode: string;
  media_type: string;
  caption: string;
  posted_at: string;
  views: number;
  likes: number;
  comments: number;
  viralization_score: number;
  last_scraped_at: string;
};

type PostMetric = {
  post_id: string;
  views: number;
  likes: number;
  viralization_score: number;
  scraped_at: string;
};

type SeoSnapshot = {
  page_title: string | null;
  meta_description: string | null;
  h1: string | null;
  performance_score: number | null;
  lcp: number | null;
  tbt: number | null;
  cls: number | null;
  scraped_at: string;
};

type DashboardData = {
  competitors: Competitor[];
  current: {
    id: string;
    name: string;
    instagram_handle: string;
    website_url: string | null;
    latestSnapshot: Snapshot | null;
    snapshots: Snapshot[];
    posts: Post[];
    postMetrics: PostMetric[];
    seoSnapshots: SeoSnapshot[];
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function mediaIcon(type: string) {
  if (type === 'GraphVideo') return '🎥';
  if (type === 'GraphSidecar') return '📱';
  return '🖼';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompetitorMonitorPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [days, setDays] = useState(30);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(
    async (compId?: string, d?: number) => {
      setLoading(true);
      setError('');
      const id = compId ?? selectedId;
      const daysVal = d ?? days;
      const params = new URLSearchParams({ days: String(daysVal) });
      if (id) params.set('competitor_id', id);
      try {
        const res = await fetch(`/api/competitor/data?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar dados');
        setData(json as DashboardData);
        if (json.current && !selectedId) setSelectedId(json.current.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [selectedId, days],
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerScrape = async () => {
    setScraping(true);
    setScrapeMsg('');
    try {
      const res = await fetch('/api/competitor/scrape', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro ao iniciar scrape');

      // Resposta pode ser scrape único ou array de múltiplos concorrentes
      if (json.scraped) {
        const results = json.scraped as Array<{handle: string; status: string; instagram?: {followers: number; new_posts: number}; errors?: string[]}>;
        const summary = results
          .map((r) => {
            if (r.status === 'error') return `✗ @${r.handle}: ${r.errors?.[0] ?? 'erro'}`;
            return `✓ @${r.handle}: ${r.instagram?.followers ?? '?'} seguidores | ${r.instagram?.new_posts ?? 0} novos`;
          })
          .join(' · ');
        setScrapeMsg(summary);
      } else {
        const { instagram, elapsed_seconds, status } = json;
        setScrapeMsg(
          `✓ Concluído em ${elapsed_seconds}s — status: ${status} | ` +
            `${instagram?.followers ?? '?'} seguidores | ` +
            `${instagram?.new_posts ?? 0} posts novos`,
        );
      }
      await loadData(selectedId, days);
    } catch (e) {
      setScrapeMsg(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setScraping(false);
    }
  };

  // ── Chart data ──────────────────────────────────────────────────────────────

  const followersChartData = useMemo(() => {
    return (
      data?.current?.snapshots.map((s) => ({
        date: fmtDate(s.scraped_at),
        seguidores: s.followers,
      })) ?? []
    );
  }, [data]);

  const postsPerWeekData = useMemo(() => {
    if (!data?.current?.posts) return [];
    const weeks: Record<string, number> = {};
    data.current.posts.forEach((p) => {
      if (!p.posted_at) return;
      const d = new Date(p.posted_at);
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      const key = startOfWeek.toISOString().slice(0, 10);
      weeks[key] = (weeks[key] ?? 0) + 1;
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, posts]) => ({ semana: fmtDate(week), posts }));
  }, [data]);

  const viralizationChartData = useMemo(() => {
    if (!data?.current?.postMetrics) return [];
    const byDate: Record<string, number[]> = {};
    data.current.postMetrics.forEach((m) => {
      const key = fmtDate(m.scraped_at);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(m.viralization_score);
    });
    return Object.entries(byDate).map(([date, scores]) => ({
      date,
      viralização: parseFloat(
        (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3),
      ),
    }));
  }, [data]);

  const seoChartData = useMemo(() => {
    return (
      data?.current?.seoSnapshots.map((s) => ({
        date: fmtDate(s.scraped_at),
        performance: s.performance_score,
      })) ?? []
    );
  }, [data]);

  // ── Summary metrics ─────────────────────────────────────────────────────────
  const snap = data?.current?.latestSnapshot;
  const posts = data?.current?.posts ?? [];

  const postsThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    return posts.filter((p) => p.posted_at && new Date(p.posted_at).getTime() > cutoff).length;
  }, [posts]);

  const videoPosts = posts.filter((p) => p.media_type === 'GraphVideo');
  const avgViews =
    videoPosts.length > 0
      ? Math.round(videoPosts.reduce((s, p) => s + (p.views ?? 0), 0) / videoPosts.length)
      : null;

  const avgViralization = useMemo(() => {
    if (posts.length === 0) return null;
    const avg = posts.reduce((s, p) => s + (p.viralization_score ?? 0), 0) / posts.length;
    return avg.toFixed(2);
  }, [posts]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">Carregando dados do concorrente…</p>
      </div>
    );
  }

  const noData = !data?.current || posts.length === 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors text-sm">
            ← Home
          </Link>
          <h1 className="text-lg font-semibold">Competitor Monitor</h1>
          {data?.current && (
            <a
              href={`https://instagram.com/${data.current.instagram_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 hover:text-white"
            >
              @{data.current.instagram_handle}
            </a>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Competitor selector */}
          {(data?.competitors?.length ?? 0) > 1 && (
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                loadData(e.target.value, days);
              }}
              className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5"
            >
              {data!.competitors.map((c) => (
                <option key={c.id} value={c.id}>
                  @{c.instagram_handle}
                </option>
              ))}
            </select>
          )}

          {/* Days selector */}
          <select
            value={days}
            onChange={(e) => {
              const d = parseInt(e.target.value);
              setDays(d);
              loadData(selectedId, d);
            }}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} dias
              </option>
            ))}
          </select>

          {/* Manual scrape trigger */}
          <button
            onClick={triggerScrape}
            disabled={scraping}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 text-white text-sm rounded-lg px-4 py-1.5 transition-colors"
          >
            {scraping ? 'Raspando…' : '↻ Atualizar agora'}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-8">
        {/* Error / scrape messages */}
        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
            {error}
          </div>
        )}
        {scrapeMsg && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-zinc-300 text-sm">
            {scrapeMsg}
          </div>
        )}

        {/* Empty state */}
        {noData && !loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
            <p className="text-zinc-400 mb-2">Nenhum dado coletado ainda.</p>
            <p className="text-zinc-600 text-sm mb-4">
              Clique em &ldquo;Atualizar agora&rdquo; para fazer o primeiro scrape, ou aguarde o
              cron diário (8h).
            </p>
            <button
              onClick={triggerScrape}
              disabled={scraping}
              className="bg-white text-black text-sm font-medium px-6 py-2 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {scraping ? 'Raspando…' : 'Iniciar primeira coleta'}
            </button>
          </div>
        )}

        {!noData && (
          <>
            {/* ── Metric cards ─────────────────────────────────────────────── */}
            <div>
              <SectionTitle>Visão geral</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Seguidores"
                  value={fmtNum(snap?.followers)}
                  sub={
                    followersChartData.length > 1
                      ? (() => {
                          const diff =
                            (snap?.followers ?? 0) -
                            (data?.current?.snapshots[0]?.followers ?? snap?.followers ?? 0);
                          return diff >= 0
                            ? `+${fmtNum(diff)} últimos ${days}d`
                            : `${fmtNum(diff)} últimos ${days}d`;
                        })()
                      : undefined
                  }
                  color="text-blue-400"
                />
                <MetricCard
                  label="Posts esta semana"
                  value={String(postsThisWeek)}
                  sub="orgânico"
                  color={postsThisWeek >= 3 ? 'text-green-400' : 'text-yellow-400'}
                />
                <MetricCard
                  label="Média de views"
                  value={avgViews != null ? fmtNum(avgViews) : '—'}
                  sub="reels/vídeos"
                  color="text-purple-400"
                />
                <MetricCard
                  label="Viralização média"
                  value={avgViralization != null ? `${avgViralization}%` : '—'}
                  sub="(likes+views) / seguidores"
                  color="text-orange-400"
                />
              </div>
            </div>

            {/* ── Charts grid ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Followers over time */}
              {followersChartData.length > 1 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <SectionTitle>Crescimento de seguidores</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={followersChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 11 }} width={50} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #3f3f46' }}
                        labelStyle={{ color: '#a1a1aa' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="seguidores"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Posts per week */}
              {postsPerWeekData.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <SectionTitle>Frequência de posts (por semana)</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={postsPerWeekData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="semana" tick={{ fill: '#71717a', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 11 }} width={30} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #3f3f46' }}
                        labelStyle={{ color: '#a1a1aa' }}
                      />
                      <Bar dataKey="posts" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Avg viralization over time */}
              {viralizationChartData.length > 1 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <SectionTitle>Fator de viralização médio (dia)</SectionTitle>
                  <p className="text-xs text-zinc-600 mb-3">
                    views ou (likes+comments) ÷ seguidores × 100
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={viralizationChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 11 }} width={40} unit="%" />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #3f3f46' }}
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(v: number) => [`${v}%`, 'Viralização']}
                      />
                      <Line
                        type="monotone"
                        dataKey="viralização"
                        stroke="#fb923c"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* SEO performance over time */}
              {seoChartData.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <SectionTitle>SEO — performance score (PageSpeed)</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={seoChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 11 }} width={35} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #3f3f46' }}
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(v: number) => [`${v}`, 'Score']}
                      />
                      <Line
                        type="monotone"
                        dataKey="performance"
                        stroke="#4ade80"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#4ade80' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {/* Latest SEO metadata */}
                  {data?.current?.seoSnapshots.at(-1) && (
                    <div className="mt-3 space-y-1 text-xs text-zinc-500">
                      <p>
                        <span className="text-zinc-400">Title:</span>{' '}
                        {data.current.seoSnapshots.at(-1)?.page_title ?? '—'}
                      </p>
                      <p>
                        <span className="text-zinc-400">H1:</span>{' '}
                        {data.current.seoSnapshots.at(-1)?.h1 ?? '—'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Posts table ──────────────────────────────────────────────── */}
            <div>
              <SectionTitle>Últimos posts ({posts.length})</SectionTitle>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Caption</th>
                      <th className="px-4 py-3 text-right">Views</th>
                      <th className="px-4 py-3 text-right">Likes</th>
                      <th className="px-4 py-3 text-right">Coment.</th>
                      <th className="px-4 py-3 text-right">Viral %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.slice(0, 50).map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                          {p.posted_at ? fmtDate(p.posted_at) : '—'}
                        </td>
                        <td className="px-4 py-3 text-lg">{mediaIcon(p.media_type)}</td>
                        <td className="px-4 py-3 text-zinc-300 max-w-xs truncate">
                          <a
                            href={`https://instagram.com/p/${p.shortcode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-white"
                          >
                            {p.caption || '(sem legenda)'}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-right text-purple-400">
                          {p.media_type === 'GraphVideo' ? fmtNum(p.views) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {fmtNum(p.likes)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400">
                          {fmtNum(p.comments)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono text-xs ${
                            (p.viralization_score ?? 0) > 1
                              ? 'text-green-400'
                              : (p.viralization_score ?? 0) > 0.3
                                ? 'text-yellow-400'
                                : 'text-zinc-500'
                          }`}
                        >
                          {p.viralization_score != null
                            ? `${p.viralization_score.toFixed(2)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Last updated */}
        {snap && (
          <p className="text-xs text-zinc-700 text-center">
            Última atualização: {new Date(snap.scraped_at).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </div>
  );
}
