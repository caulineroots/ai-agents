# -*- coding: utf-8 -*-
"""SQLite persistence for Maps lead extraction history."""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from config import BASE_DIR

DB_PATH = Path(BASE_DIR) / "data" / "maps_leads.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS city_extractions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    state_code TEXT NOT NULL,
                    city_name TEXT NOT NULL,
                    keyword TEXT NOT NULL,
                    extracted_at TEXT NOT NULL,
                    leads_count INTEGER NOT NULL DEFAULT 0,
                    job_id TEXT,
                    UNIQUE(state_code, city_name, keyword)
                )
                """
            )
            conn.commit()
        finally:
            conn.close()


def is_city_extracted(state_code: str, city_name: str, keyword: str) -> bool:
    init_db()
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                """
                SELECT 1 FROM city_extractions
                WHERE state_code = ? AND city_name = ? AND keyword = ?
                """,
                (state_code.lower(), city_name.strip(), keyword.strip()),
            ).fetchone()
            return row is not None
        finally:
            conn.close()


def get_extraction(
    state_code: str, city_name: str, keyword: str
) -> Optional[dict]:
    init_db()
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                """
                SELECT state_code, city_name, keyword, extracted_at, leads_count, job_id
                FROM city_extractions
                WHERE state_code = ? AND city_name = ? AND keyword = ?
                """,
                (state_code.lower(), city_name.strip(), keyword.strip()),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def record_city_extraction(
    state_code: str,
    city_name: str,
    keyword: str,
    leads_count: int,
    job_id: str,
) -> None:
    init_db()
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO city_extractions
                    (state_code, city_name, keyword, extracted_at, leads_count, job_id)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(state_code, city_name, keyword) DO UPDATE SET
                    extracted_at = excluded.extracted_at,
                    leads_count = excluded.leads_count,
                    job_id = excluded.job_id
                """,
                (
                    state_code.lower(),
                    city_name.strip(),
                    keyword.strip(),
                    now,
                    leads_count,
                    job_id,
                ),
            )
            conn.commit()
        finally:
            conn.close()


def get_extractions_for_keyword(keyword: str) -> dict[tuple[str, str], dict]:
    """Map (state_code, city_name) -> extraction row for a keyword."""
    init_db()
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                """
                SELECT state_code, city_name, keyword, extracted_at, leads_count, job_id
                FROM city_extractions
                WHERE keyword = ?
                """,
                (keyword.strip(),),
            ).fetchall()
            return {(r["state_code"], r["city_name"]): dict(r) for r in rows}
        finally:
            conn.close()
