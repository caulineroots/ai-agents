# -*- coding: utf-8 -*-
"""
Estados e municípios para extração de leads.
Dados em data/maps_regions.json (gerado por scripts/build_maps_regions.py).
Edite arquivos em data/maps_cities/<uf>.txt e rode o script de build.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from config import BASE_DIR

DATA_PATH = Path(BASE_DIR) / "data" / "maps_regions.json"


@dataclass(frozen=True)
class StateRegion:
    code: str
    name: str
    parent_city: str
    cities: List[str]


def _load_states() -> Dict[str, StateRegion]:
    if not DATA_PATH.exists():
        return {}
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    states: Dict[str, StateRegion] = {}
    for code, item in raw.get("states", {}).items():
        states[code] = StateRegion(
            code=code,
            name=item["name"],
            parent_city=item["parent_city"],
            cities=list(item.get("cities", [])),
        )
    return states


STATES: Dict[str, StateRegion] = _load_states()


def reload_states() -> None:
    """Recarrega JSON (útil após rebuild em dev)."""
    global STATES
    STATES = _load_states()


def list_states() -> List[StateRegion]:
    return sorted(STATES.values(), key=lambda s: s.name)


def get_state(code: str) -> StateRegion | None:
    return STATES.get(code.strip().lower())


def expand_state_targets(
    state_codes: list[str],
    keyword: str,
    city_names: list[str] | None = None,
    skip_extracted: bool = True,
) -> list[dict]:
    from extractors.maps_db import is_city_extracted

    targets: list[dict] = []
    wanted_cities = {c.strip() for c in (city_names or []) if c.strip()}

    for raw_code in state_codes:
        state = get_state(raw_code)
        if not state:
            continue
        for city in state.cities:
            if wanted_cities and city not in wanted_cities:
                continue
            if skip_extracted and is_city_extracted(state.code, city, keyword):
                continue
            targets.append(
                {
                    "state_code": state.code,
                    "city_name": city,
                    "parent_city": state.parent_city,
                }
            )
    return targets
