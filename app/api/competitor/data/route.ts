import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/competitor/data?competitor_id=<uuid>&days=60
 *
 * Retorna todos os dados necessários para o dashboard:
 *   - Lista de concorrentes cadastrados
 *   - Snapshots diários do perfil (seguidores)
 *   - Posts com métricas atuais
 *   - Histórico diário de métricas por post
 *   - Snapshots de SEO
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days = parseInt(searchParams.get('days') ?? '60', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // ── Lista de concorrentes ─────────────────────────────────────────────────
  const { data: competitors, error: compErr } = await supabase
    .from('competitors')
    .select('id, name, instagram_handle, website_url, created_at')
    .order('created_at', { ascending: true });

  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 });
  }

  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ competitors: [], current: null });
  }

  // Usa competitor_id da query ou o primeiro cadastrado
  const selectedId =
    searchParams.get('competitor_id') ?? competitors[0].id;

  const competitor = competitors.find((c) => c.id === selectedId) ?? competitors[0];

  // ── Snapshots do perfil ───────────────────────────────────────────────────
  const { data: snapshots } = await supabase
    .from('competitor_snapshots')
    .select('id, followers, following, posts_count, scraped_at')
    .eq('competitor_id', competitor.id)
    .gte('scraped_at', since)
    .order('scraped_at', { ascending: true });

  // ── Posts (métricas atuais) ───────────────────────────────────────────────
  const { data: posts } = await supabase
    .from('competitor_posts')
    .select(
      'id, shortcode, media_type, caption, posted_at, views, likes, comments, viralization_score, first_scraped_at, last_scraped_at',
    )
    .eq('competitor_id', competitor.id)
    .order('posted_at', { ascending: false })
    .limit(200);

  // ── Histórico de métricas por post ────────────────────────────────────────
  const { data: postMetrics } = await supabase
    .from('competitor_post_metrics')
    .select('post_id, views, likes, comments, viralization_score, scraped_at')
    .eq('competitor_id', competitor.id)
    .gte('scraped_at', since)
    .order('scraped_at', { ascending: true });

  // ── Snapshots de SEO ──────────────────────────────────────────────────────
  const { data: seoSnapshots } = await supabase
    .from('competitor_seo_snapshots')
    .select(
      'id, page_title, meta_description, h1, performance_score, lcp, tbt, cls, scraped_at',
    )
    .eq('competitor_id', competitor.id)
    .gte('scraped_at', since)
    .order('scraped_at', { ascending: true });

  return NextResponse.json({
    competitors,
    current: {
      ...competitor,
      latestSnapshot: snapshots?.at(-1) ?? null,
      snapshots: snapshots ?? [],
      posts: posts ?? [],
      postMetrics: postMetrics ?? [],
      seoSnapshots: seoSnapshots ?? [],
    },
  });
}
