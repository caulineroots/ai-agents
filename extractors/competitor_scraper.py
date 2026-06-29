# -*- coding: utf-8 -*-
"""
extractors/competitor_scraper.py

Scraper de concorrente: Instagram (instaloader) + SEO (requests + BS4 + PageSpeed).
Persiste dados diretamente no Supabase.

Dependências (requirements-competitor.txt):
  instaloader, beautifulsoup4, lxml, supabase
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

log = logging.getLogger("competitor")

# Caminho para salvar a sessão do Instagram (evita re-login a cada scrape)
_SESSION_DIR = Path(os.path.dirname(__file__)).parent / "data"
_SESSION_DIR.mkdir(exist_ok=True)


# ── Lazy imports para não quebrar o serviço se deps não estiverem instaladas ───

def _get_instaloader():
    try:
        import instaloader
        return instaloader
    except ImportError:
        raise RuntimeError(
            "instaloader não instalado. Execute: pip install -r requirements-competitor.txt"
        )


def _get_supabase_client():
    try:
        from supabase import create_client
    except ImportError:
        raise RuntimeError(
            "supabase-py não instalado. Execute: pip install -r requirements-competitor.txt"
        )
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar no .env.local")
    return create_client(url, key)


# ─────────────────────────────────────────────────────────────────────────────
# Instagram scraper
# ─────────────────────────────────────────────────────────────────────────────

def _build_loader():
    """
    Cria uma instância do Instaloader.
    - Se INSTAGRAM_USERNAME + INSTAGRAM_PASSWORD estiverem configurados:
        tenta carregar sessão salva; se não existir, faz login e salva.
    - Caso contrário, tenta anônimo (funciona apenas para perfis com acesso público relaxado).
    """
    il = _get_instaloader()
    L = il.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
    )

    username = os.getenv("INSTAGRAM_USERNAME", "").strip()
    password = os.getenv("INSTAGRAM_PASSWORD", "").strip()

    if not username or not password:
        log.warning(
            "[instagram] INSTAGRAM_USERNAME/PASSWORD não configurados — "
            "tentando anônimo (pode falhar com 403)"
        )
        return L

    session_file = _SESSION_DIR / f"ig_session_{username}"

    # Tenta carregar sessão existente
    if session_file.exists():
        try:
            L.load_session_from_file(username, str(session_file))
            log.info("[instagram] sessão carregada: %s", session_file)
            return L
        except Exception as e:
            log.warning("[instagram] sessão inválida (%s) — refazendo login", e)
            session_file.unlink(missing_ok=True)

    # Login com credenciais
    try:
        L.login(username, password)
        L.save_session_to_file(str(session_file))
        log.info("[instagram] login OK, sessão salva em %s", session_file)
    except il.TwoFactorAuthRequiredException:
        raise RuntimeError(
            "Conta Instagram exige 2FA. Use uma conta sem autenticação de dois fatores."
        )
    except il.BadCredentialsException:
        raise RuntimeError(
            "Credenciais Instagram inválidas. Verifique INSTAGRAM_USERNAME e INSTAGRAM_PASSWORD no .env.local"
        )
    except Exception as e:
        raise RuntimeError(f"Erro ao logar no Instagram: {e}")

    return L


def scrape_instagram(handle: str, max_posts: int = 20) -> dict:
    """
    Raspa o perfil público do Instagram.
    Retorna: { profile: {...}, posts: [{...}] }
    """
    il = _get_instaloader()
    L = _build_loader()

    log.info("[instagram] scraping perfil: @%s (max %d posts)", handle, max_posts)

    try:
        profile = il.Profile.from_username(L.context, handle)
    except il.ProfileNotExistsException:
        raise ValueError(f"Perfil @{handle} não encontrado ou privado")
    except Exception as e:
        raise RuntimeError(f"Erro ao buscar perfil @{handle}: {e}")

    followers = profile.followers
    following = profile.followees
    posts_count = profile.mediacount

    log.info("[instagram] @%s — %d seguidores, %d posts", handle, followers, posts_count)

    posts = []
    collected = 0
    for post in profile.get_posts():
        if collected >= max_posts:
            break
        try:
            views = post.video_view_count if post.is_video else 0
            likes = post.likes
            comments = post.comments
            # Fator de viralização: views/seguidores (vídeo) ou engagement/seguidores (foto)
            if followers > 0:
                if views:
                    viralization = round(views / followers * 100, 4)
                else:
                    viralization = round((likes + comments) / followers * 100, 4)
            else:
                viralization = 0.0

            posts.append({
                "shortcode": post.shortcode,
                "media_type": post.typename,  # GraphImage | GraphVideo | GraphSidecar
                "caption": (post.caption or "")[:500],
                "posted_at": post.date_utc.isoformat(),
                "views": views,
                "likes": likes,
                "comments": comments,
                "viralization_score": viralization,
            })
            collected += 1
            # Pausa para não ser bloqueado
            time.sleep(1.5)
        except Exception as e:
            log.warning("[instagram] erro ao processar post %s: %s", getattr(post, "shortcode", "?"), e)
            continue

    return {
        "profile": {
            "handle": handle,
            "followers": followers,
            "following": following,
            "posts_count": posts_count,
        },
        "posts": posts,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SEO scraper
# ─────────────────────────────────────────────────────────────────────────────

def scrape_seo(url: str) -> dict:
    """
    Raspa sinais on-page do site do concorrente + PageSpeed Insights (free).
    """
    log.info("[seo] scraping: %s", url)
    result: dict = {
        "page_title": None,
        "meta_description": None,
        "h1": None,
        "performance_score": None,
        "lcp": None,
        "tbt": None,
        "cls": None,
    }

    # ── On-page SEO ───────────────────────────────────────────────────────────
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (compatible; CompetitorMonitor/1.0; +https://caulineroots.com)"
            )
        }
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        title_tag = soup.find("title")
        result["page_title"] = title_tag.get_text(strip=True)[:300] if title_tag else None

        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            result["meta_description"] = str(meta_desc["content"])[:500]

        h1_tag = soup.find("h1")
        result["h1"] = h1_tag.get_text(strip=True)[:300] if h1_tag else None

        log.info("[seo] on-page: title=%s | h1=%s", result["page_title"], result["h1"])
    except Exception as e:
        log.warning("[seo] on-page scrape falhou: %s", e)

    # ── PageSpeed Insights (free, sem API key) ────────────────────────────────
    try:
        ps_url = (
            "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
            f"?url={requests.utils.quote(url, safe='')}&strategy=mobile&category=performance"
        )
        ps_resp = requests.get(ps_url, timeout=30)
        ps_data = ps_resp.json()

        lr = ps_data.get("lighthouseResult", {})
        cats = lr.get("categories", {})
        perf = cats.get("performance", {})
        if perf:
            result["performance_score"] = round((perf.get("score") or 0) * 100, 1)

        audits = lr.get("audits", {})
        lcp_audit = audits.get("largest-contentful-paint", {})
        if lcp_audit.get("numericValue"):
            result["lcp"] = round(lcp_audit["numericValue"], 1)

        tbt_audit = audits.get("total-blocking-time", {})
        if tbt_audit.get("numericValue"):
            result["tbt"] = round(tbt_audit["numericValue"], 1)

        cls_audit = audits.get("cumulative-layout-shift", {})
        if cls_audit.get("numericValue") is not None:
            result["cls"] = round(cls_audit["numericValue"], 4)

        log.info(
            "[seo] pagespeed: perf=%s lcp=%sms tbt=%sms cls=%s",
            result["performance_score"], result["lcp"], result["tbt"], result["cls"],
        )
    except Exception as e:
        log.warning("[seo] PageSpeed falhou: %s", e)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Supabase persistence
# ─────────────────────────────────────────────────────────────────────────────

def _ensure_competitor(client, handle: str, website_url: Optional[str]) -> str:
    """
    Retorna o competitor_id existente ou cria um novo registro.
    """
    res = (
        client.table("competitors")
        .select("id")
        .eq("instagram_handle", handle)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]["id"]

    # Cria novo concorrente
    ins = (
        client.table("competitors")
        .insert({"name": handle, "instagram_handle": handle, "website_url": website_url})
        .execute()
    )
    competitor_id = ins.data[0]["id"]
    log.info("[db] competitor criado: id=%s handle=@%s", competitor_id, handle)
    return competitor_id


def _save_instagram_data(client, competitor_id: str, ig_data: dict) -> dict:
    """Salva snapshot do perfil + upsert de posts + histórico diário."""
    now = datetime.now(timezone.utc).isoformat()
    profile = ig_data["profile"]
    followers = profile["followers"]

    # Snapshot diário do perfil
    client.table("competitor_snapshots").insert({
        "competitor_id": competitor_id,
        "followers": followers,
        "following": profile["following"],
        "posts_count": profile["posts_count"],
        "scraped_at": now,
    }).execute()
    log.info("[db] snapshot salvo: %d seguidores", followers)

    new_posts = 0
    updated_posts = 0

    for p in ig_data["posts"]:
        post_row = {
            "competitor_id": competitor_id,
            "shortcode": p["shortcode"],
            "media_type": p["media_type"],
            "caption": p["caption"],
            "posted_at": p["posted_at"],
            "views": p["views"],
            "likes": p["likes"],
            "comments": p["comments"],
            "viralization_score": p["viralization_score"],
            "last_scraped_at": now,
        }

        # Verifica se o post já existe
        existing = (
            client.table("competitor_posts")
            .select("id")
            .eq("shortcode", p["shortcode"])
            .limit(1)
            .execute()
        )

        if existing.data:
            post_id = existing.data[0]["id"]
            # Atualiza métricas (views podem crescer)
            client.table("competitor_posts").update({
                "views": p["views"],
                "likes": p["likes"],
                "comments": p["comments"],
                "viralization_score": p["viralization_score"],
                "last_scraped_at": now,
            }).eq("id", post_id).execute()
            updated_posts += 1
        else:
            ins = client.table("competitor_posts").insert({
                **post_row,
                "first_scraped_at": now,
            }).execute()
            post_id = ins.data[0]["id"]
            new_posts += 1

        # Histórico diário de métricas para gráfico de evolução
        client.table("competitor_post_metrics").insert({
            "post_id": post_id,
            "competitor_id": competitor_id,
            "views": p["views"],
            "likes": p["likes"],
            "comments": p["comments"],
            "viralization_score": p["viralization_score"],
            "scraped_at": now,
        }).execute()

    log.info("[db] posts: %d novos, %d atualizados", new_posts, updated_posts)
    return {"new_posts": new_posts, "updated_posts": updated_posts}


def _save_seo_data(client, competitor_id: str, seo_data: dict) -> None:
    """Salva snapshot de SEO."""
    client.table("competitor_seo_snapshots").insert({
        "competitor_id": competitor_id,
        **seo_data,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    log.info("[db] seo snapshot salvo: score=%s", seo_data.get("performance_score"))


# ─────────────────────────────────────────────────────────────────────────────
# Entry point principal
# ─────────────────────────────────────────────────────────────────────────────

def run_all_from_db(max_posts: int = 20) -> list[dict]:
    """
    Raspa todos os concorrentes cadastrados na tabela `competitors` do Supabase.
    Retorna lista de summaries, um por concorrente.
    """
    client = _get_supabase_client()
    res = client.table("competitors").select("id, name, instagram_handle, website_url").execute()
    competitors = res.data or []

    if not competitors:
        log.warning("[run_all_from_db] nenhum concorrente encontrado na tabela competitors")
        return []

    log.info("[run_all_from_db] %d concorrente(s) para raspar", len(competitors))
    results = []
    for comp in competitors:
        handle = comp.get("instagram_handle")
        website_url = comp.get("website_url") or None
        if not handle:
            log.warning("[run_all_from_db] concorrente %s sem instagram_handle — pulando", comp.get("id"))
            continue
        log.info("[run_all_from_db] iniciando: @%s", handle)
        try:
            summary = run_competitor_scrape(
                handle=handle,
                website_url=website_url,
                max_posts=max_posts,
            )
            results.append(summary)
        except Exception as e:
            log.error("[run_all_from_db] @%s falhou: %s", handle, e)
            results.append({"handle": handle, "status": "error", "error": str(e)})

    return results


def run_competitor_scrape(
    handle: str,
    website_url: Optional[str] = None,
    max_posts: int = 20,
) -> dict:
    """
    Executa o ciclo completo de scraping para um concorrente:
      1. Instagram: perfil + posts
      2. SEO: on-page + PageSpeed (se website_url fornecida)
      3. Persiste tudo no Supabase

    Retorna um dict com resumo do que foi coletado.
    """
    start = time.time()
    client = _get_supabase_client()

    # Garante que o concorrente existe no banco
    competitor_id = _ensure_competitor(client, handle, website_url)
    log.info("[scrape] iniciando: @%s (id=%s)", handle, competitor_id)

    summary: dict = {
        "competitor_id": competitor_id,
        "handle": handle,
        "status": "ok",
        "instagram": {},
        "seo": {},
        "errors": [],
    }

    # ── Instagram ──────────────────────────────────────────────────────────────
    try:
        ig_data = scrape_instagram(handle, max_posts=max_posts)
        post_stats = _save_instagram_data(client, competitor_id, ig_data)
        summary["instagram"] = {
            "followers": ig_data["profile"]["followers"],
            "posts_scraped": len(ig_data["posts"]),
            **post_stats,
        }
    except Exception as e:
        log.error("[scrape] instagram falhou: %s", e)
        summary["errors"].append(f"instagram: {e}")
        summary["status"] = "partial"

    # ── SEO ────────────────────────────────────────────────────────────────────
    if website_url:
        try:
            seo_data = scrape_seo(website_url)
            _save_seo_data(client, competitor_id, seo_data)
            summary["seo"] = {
                "performance_score": seo_data.get("performance_score"),
                "page_title": seo_data.get("page_title"),
            }
        except Exception as e:
            log.error("[scrape] seo falhou: %s", e)
            summary["errors"].append(f"seo: {e}")
            if summary["status"] == "ok":
                summary["status"] = "partial"

    elapsed = round(time.time() - start, 1)
    summary["elapsed_seconds"] = elapsed
    log.info("[scrape] concluído em %.1fs — status=%s", elapsed, summary["status"])
    return summary
