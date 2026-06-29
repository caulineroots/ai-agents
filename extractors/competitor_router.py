# -*- coding: utf-8 -*-
"""FastAPI router — Competitor Monitor."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

log = logging.getLogger("competitor")

router = APIRouter(prefix="/competitor", tags=["competitor"])


class ScrapeRequest(BaseModel):
    handle: Optional[str] = None
    website_url: Optional[str] = None
    max_posts: int = 20


@router.post("/scrape")
async def competitor_scrape(body: ScrapeRequest):
    """
    Dispara scraping completo.

    - Se `handle` fornecido no body: raspa apenas esse concorrente.
    - Se omitido: raspa TODOS os concorrentes cadastrados no Supabase.
      Cada um usa o website_url salvo no banco (coluna website_url).
    """
    from extractors.competitor_scraper import run_competitor_scrape, run_all_from_db

    try:
        loop = asyncio.get_running_loop()

        if body.handle:
            # Scrape específico
            website_url = body.website_url or None
            result = await loop.run_in_executor(
                None,
                lambda: run_competitor_scrape(
                    handle=body.handle,
                    website_url=website_url,
                    max_posts=body.max_posts,
                ),
            )
            return JSONResponse(result)
        else:
            # Scrape de todos no banco
            results = await loop.run_in_executor(
                None,
                lambda: run_all_from_db(max_posts=body.max_posts),
            )
            return JSONResponse({"scraped": results})

    except Exception as e:
        log.error("[competitor_scrape] erro: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
def competitor_health():
    """Verifica dependências disponíveis e concorrentes cadastrados no banco."""
    checks: dict = {}

    try:
        import instaloader  # noqa: F401
        checks["instaloader"] = "ok"
    except ImportError:
        checks["instaloader"] = "missing — pip install instaloader"

    try:
        import bs4  # noqa: F401
        checks["beautifulsoup4"] = "ok"
    except ImportError:
        checks["beautifulsoup4"] = "missing — pip install beautifulsoup4"

    try:
        import supabase  # noqa: F401
        checks["supabase"] = "ok"
    except ImportError:
        checks["supabase"] = "missing — pip install supabase"

    ig_user = os.getenv("INSTAGRAM_USERNAME", "")
    checks["instagram_login"] = (
        f"configurado ({ig_user})" if ig_user else "NOT SET — scraping anônimo (pode dar 403)"
    )

    # Lista concorrentes cadastrados
    try:
        from extractors.competitor_scraper import _get_supabase_client
        client = _get_supabase_client()
        res = client.table("competitors").select("name, instagram_handle, website_url").execute()
        checks["competitors_in_db"] = [
            f"@{c['instagram_handle']} — {c.get('website_url') or 'sem site'}"
            for c in (res.data or [])
        ]
    except Exception as e:
        checks["competitors_in_db"] = f"erro: {e}"

    deps_ok = all(v == "ok" for k, v in checks.items() if k not in ("competitors_in_db",))
    return JSONResponse(
        {"status": "ok" if deps_ok else "degraded", "checks": checks},
        status_code=200 if deps_ok else 503,
    )
