# -*- coding: utf-8 -*-
"""FastAPI router — Google Maps lead extractor."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from extractors.maps_db import get_extractions_for_keyword, init_db
from extractors.maps_jobs import get_csv_path, get_job, start_maps_job
from extractors.maps_regions import expand_state_targets, list_states, reload_states
from extractors.maps_scraper import CityTarget, probe_driver

router = APIRouter(prefix="/maps", tags=["maps"])


def build_regions_payload(keyword: str) -> dict:
    init_db()
    reload_states()
    extracted = get_extractions_for_keyword(keyword.strip())
    states_out = []
    for state in list_states():
        cities_out = []
        extracted_in_state = 0
        for city in state.cities:
            ex = extracted.get((state.code, city))
            if ex:
                extracted_in_state += 1
            cities_out.append(
                {
                    "name": city,
                    "extracted": ex is not None,
                    "extracted_at": ex["extracted_at"] if ex else None,
                    "leads_count": ex["leads_count"] if ex else 0,
                }
            )
        states_out.append(
            {
                "code": state.code,
                "name": state.name,
                "parent_city": state.parent_city,
                "cities": cities_out,
                "city_count": len(cities_out),
                "extracted_count": extracted_in_state,
            }
        )
    return {"keyword": keyword.strip(), "states": states_out}


class MapsScrapeRequest(BaseModel):
    keyword: str
    state_codes: list[str] = Field(min_length=1)
    per_city_limit: int = 20
    city_names: Optional[list[str]] = None
    skip_extracted: bool = True


@router.get("/regions")
def maps_regions(keyword: str = "marcenaria"):
    return build_regions_payload(keyword)


@router.get("/health")
def maps_health():
    try:
        ok = probe_driver(headless=True)
        return {"status": "ok" if ok else "degraded", "selenium": ok}
    except Exception as e:
        return JSONResponse(
            {"status": "error", "selenium": False, "error": str(e)},
            status_code=503,
        )


@router.post("/scrape")
def maps_scrape(body: MapsScrapeRequest):
    raw_targets = expand_state_targets(
        state_codes=body.state_codes,
        keyword=body.keyword,
        city_names=body.city_names,
        skip_extracted=body.skip_extracted,
    )
    if not raw_targets:
        raise HTTPException(
            status_code=400,
            detail="Nenhum município pendente para extrair (todos já processados ou lista vazia)",
        )

    targets = [
        CityTarget(
            state_code=t["state_code"],
            city_name=t["city_name"],
            parent_city=t.get("parent_city"),
        )
        for t in raw_targets
    ]

    try:
        job = start_maps_job(
            keyword=body.keyword,
            targets=targets,
            per_city_limit=body.per_city_limit,
            state_codes=[c.strip().lower() for c in body.state_codes],
        )
        return job.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/jobs/{job_id}")
def maps_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    return job.to_dict()


@router.get("/jobs/{job_id}/csv")
def maps_job_csv(job_id: str):
    path = get_csv_path(job_id)
    if not path:
        raise HTTPException(status_code=404, detail="CSV não disponível")
    return FileResponse(
        path,
        media_type="text/csv",
        filename=path.name,
    )
