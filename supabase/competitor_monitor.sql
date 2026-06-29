-- ============================================================
-- Competitor Monitor — Supabase Migration
-- Execute no Supabase SQL Editor (dashboard.supabase.com)
-- ============================================================

-- ── 1. Tabela de concorrentes ─────────────────────────────────────────────────
create table if not exists competitors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  instagram_handle text,
  website_url   text,
  created_at    timestamptz default now()
);

-- ── 2. Posts do concorrente (master record, atualizado no upsert diário) ──────
create table if not exists competitor_posts (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  shortcode     text not null unique,
  media_type    text,   -- 'GraphImage' | 'GraphVideo' | 'GraphSidecar'
  caption       text,
  posted_at     timestamptz,
  -- métricas mais recentes (atualizadas a cada scrape)
  views         bigint default 0,
  likes         bigint default 0,
  comments      bigint default 0,
  viralization_score float default 0,
  first_scraped_at timestamptz default now(),
  last_scraped_at  timestamptz default now()
);

-- ── 3. Histórico diário de métricas por post ──────────────────────────────────
-- Uma linha nova por post por dia → permite ver evolução de views ao longo do tempo
create table if not exists competitor_post_metrics (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references competitor_posts(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  views         bigint default 0,
  likes         bigint default 0,
  comments      bigint default 0,
  viralization_score float default 0,
  scraped_at    timestamptz default now()
);

-- ── 4. Snapshot diário do perfil (seguidores, seguindo, total de posts) ───────
create table if not exists competitor_snapshots (
  id            uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  followers     bigint,
  following     bigint,
  posts_count   bigint,
  scraped_at    timestamptz default now()
);

-- ── 5. Snapshot diário de SEO ─────────────────────────────────────────────────
create table if not exists competitor_seo_snapshots (
  id              uuid primary key default gen_random_uuid(),
  competitor_id   uuid references competitors(id) on delete cascade,
  page_title      text,
  meta_description text,
  h1              text,
  performance_score float,  -- 0-100 (PageSpeed)
  lcp             float,    -- Largest Contentful Paint (ms)
  tbt             float,    -- Total Blocking Time (ms, substitui FID)
  cls             float,    -- Cumulative Layout Shift
  scraped_at      timestamptz default now()
);

-- ── Índices úteis ─────────────────────────────────────────────────────────────
create index if not exists idx_competitor_posts_competitor_id    on competitor_posts(competitor_id);
create index if not exists idx_competitor_posts_posted_at        on competitor_posts(posted_at desc);
create index if not exists idx_post_metrics_post_id              on competitor_post_metrics(post_id);
create index if not exists idx_post_metrics_scraped_at           on competitor_post_metrics(scraped_at desc);
create index if not exists idx_snapshots_competitor_scraped      on competitor_snapshots(competitor_id, scraped_at desc);
create index if not exists idx_seo_snapshots_competitor_scraped  on competitor_seo_snapshots(competitor_id, scraped_at desc);

-- ── INSERT dos concorrentes monitorados ───────────────────────────────────────
-- Execute após criar as tabelas (se ainda não cadastrou via dashboard):
--
-- insert into competitors (name, instagram_handle, website_url) values
--   ('Orçamento Inteligente', 'orcamento_inteligente', 'https://orcamento-inteligente.com/'),
--   ('Antonio Santanna', 'antoniovsantanna', null);
--
-- Para atualizar website_url de um já cadastrado:
-- update competitors set website_url = 'https://orcamento-inteligente.com/'
--   where instagram_handle = 'orcamento_inteligente';
-- update competitors set website_url = null
--   where instagram_handle = 'antoniovsantanna';
