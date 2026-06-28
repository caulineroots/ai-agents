# -*- coding: utf-8 -*-
"""Background job runner for Google Maps lead extraction."""

from __future__ import annotations

import csv
import re
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from config import BASE_DIR

from extractors.maps_db import record_city_extraction
from extractors.maps_scraper import CityTarget, scrape_targets

JobStatus = Literal["pending", "running", "completed", "failed"]

EXPORTS_DIR = Path(BASE_DIR) / "data" / "maps_exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class MapsJob:
    job_id: str
    keyword: str
    targets: list[CityTarget]
    per_city_limit: int
    status: JobStatus = "pending"
    logs: list[str] = field(default_factory=list)
    businesses: list[dict] = field(default_factory=list)
    current_city: str = ""
    cities_done: int = 0
    cities_total: int = 0
    error: Optional[str] = None
    created_at: str = ""
    finished_at: Optional[str] = None
    csv_path: Optional[str] = None
    state_codes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "keyword": self.keyword,
            "status": self.status,
            "logs": self.logs[-30:],
            "businesses": self.businesses,
            "current_city": self.current_city,
            "cities_done": self.cities_done,
            "cities_total": self.cities_total,
            "leads_count": len(self.businesses),
            "error": self.error,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
            "csv_ready": bool(self.csv_path and Path(self.csv_path).exists()),
            "state_codes": self.state_codes,
        }


_jobs: dict[str, MapsJob] = {}
_lock = threading.Lock()


def _log(job: MapsJob, msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    job.logs.append(line)


def _date_id(job: MapsJob) -> str:
    if job.created_at:
        try:
            dt = datetime.fromisoformat(job.created_at.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d_%H%M%S")
        except ValueError:
            pass
    return datetime.now().strftime("%Y-%m-%d_%H%M%S")


def _state_codes_label(job: MapsJob) -> str:
    if job.state_codes:
        states = sorted({c.strip().upper() for c in job.state_codes if c.strip()})
        if states:
            return "-".join(states)
    from_targets = sorted({t.state_code.upper() for t in job.targets if t.state_code})
    return "-".join(from_targets) if from_targets else "BR"


def _csv_filename(job: MapsJob) -> Path:
    safe_kw = re.sub(r"[^\w\-]", "_", job.keyword.strip())[:40]
    states = _state_codes_label(job)
    date_id = _date_id(job)
    return EXPORTS_DIR / f"{states}_{safe_kw}_{date_id}.csv"


def _write_csv(job: MapsJob) -> str:
    path = _csv_filename(job)
    fields = [
        "name",
        "phone",
        "email",
        "website",
        "search_location",
        "maps_url",
        "state_code",
        "city_name",
    ]
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in job.businesses:
            writer.writerow({k: row.get(k) or "" for k in fields})
    return str(path)


def _lead_key(row: dict) -> str:
    return row.get("maps_url") or row.get("website") or row.get("name") or ""


def _run_job(job: MapsJob) -> None:
    job.status = "running"
    job.cities_total = len(job.targets)
    _log(job, f"Iniciando extração: {job.keyword} em {job.cities_total} município(s)")

    current_target: CityTarget | None = None

    def on_city_start(index: int, target: CityTarget, loc: str) -> None:
        nonlocal current_target
        current_target = target
        with _lock:
            job.current_city = f"{target.city_name} ({target.state_code.upper()})"
            job.cities_done = index

    def on_lead(row: dict) -> None:
        enriched = dict(row)
        if current_target and current_target.state_code:
            enriched["state_code"] = current_target.state_code
            enriched["city_name"] = current_target.city_name
        key = _lead_key(enriched)
        with _lock:
            if key and any(_lead_key(existing) == key for existing in job.businesses):
                return
            job.businesses.append(enriched)
            job.csv_path = _write_csv(job)

    def on_city_done(target: CityTarget, leads_count: int, loc: str) -> None:
        if target.state_code and target.city_name:
            record_city_extraction(
                state_code=target.state_code,
                city_name=target.city_name,
                keyword=job.keyword,
                leads_count=leads_count,
                job_id=job.job_id,
            )
            _log(job, f"Registrado: {target.city_name} — {leads_count} leads")

    try:
        scrape_targets(
            keyword=job.keyword,
            targets=job.targets,
            per_city_limit=job.per_city_limit,
            log=lambda m: _log(job, m),
            on_lead=on_lead,
            on_city_start=on_city_start,
            on_city_done=on_city_done,
        )

        with _lock:
            job.cities_done = job.cities_total
            job.status = "completed"
            job.finished_at = datetime.now(timezone.utc).isoformat()
            job.csv_path = _write_csv(job)
            _log(job, f"Concluído — {len(job.businesses)} leads · CSV salvo")
    except Exception as e:
        err = str(e).split("Stacktrace:")[0].strip() or str(e)
        with _lock:
            job.csv_path = _write_csv(job)
            job.status = "completed" if job.businesses else "failed"
            job.error = err[:500] if job.status == "failed" else None
            job.finished_at = datetime.now(timezone.utc).isoformat()
            _log(job, f"Interrompido: {err[:200]}")
            if job.businesses:
                _log(job, f"Parcial salvo — {len(job.businesses)} leads no CSV")


def start_maps_job(
    keyword: str,
    targets: list[CityTarget],
    per_city_limit: int = 20,
    state_codes: list[str] | None = None,
) -> MapsJob:
    keyword = keyword.strip()
    if not keyword:
        raise ValueError("keyword é obrigatório")
    if not targets:
        raise ValueError("Nenhum município para extrair")

    job_id = uuid.uuid4().hex[:12]
    job = MapsJob(
        job_id=job_id,
        keyword=keyword,
        targets=targets,
        per_city_limit=max(1, min(per_city_limit, 100)),
        created_at=datetime.now(timezone.utc).isoformat(),
        state_codes=state_codes or [],
    )

    with _lock:
        _jobs[job_id] = job

    thread = threading.Thread(target=_run_job, args=(job,), daemon=True)
    thread.start()
    return job


def get_job(job_id: str) -> Optional[MapsJob]:
    with _lock:
        return _jobs.get(job_id)


def get_csv_path(job_id: str) -> Optional[Path]:
    job = get_job(job_id)
    if not job or not job.csv_path:
        return None
    path = Path(job.csv_path)
    return path if path.exists() else None
