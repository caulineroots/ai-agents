# -*- coding: utf-8 -*-
"""Build data/maps_regions.json from data/maps_cities/*.txt files."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CITIES_DIR = ROOT / "data" / "maps_cities"
OUT = ROOT / "data" / "maps_regions.json"

STATE_META: dict[str, tuple[str, str]] = {
    "ac": ("Acre", "Acre"),
    "al": ("Alagoas", "Alagoas"),
    "ap": ("Amapá", "Amapá"),
    "am": ("Amazonas", "Amazonas"),
    "ba": ("Bahia", "Bahia"),
    "ce": ("Ceará", "Ceará"),
    "df": ("Distrito Federal", "Brasília"),
    "es": ("Espírito Santo", "Espírito Santo"),
    "go": ("Goiás", "Goiás"),
    "ma": ("Maranhão", "Maranhão"),
    "mg": ("Minas Gerais", "Minas Gerais"),
    "ms": ("Mato Grosso do Sul", "Mato Grosso do Sul"),
    "mt": ("Mato Grosso", "Mato Grosso"),
    "pa": ("Pará", "Pará"),
    "pb": ("Paraíba", "Paraíba"),
    "pe": ("Pernambuco", "Pernambuco"),
    "pi": ("Piauí", "Piauí"),
    "pr": ("Paraná", "Paraná"),
    "rj": ("Rio de Janeiro", "Rio de Janeiro"),
    "rn": ("Rio Grande do Norte", "Rio Grande do Norte"),
    "ro": ("Rondônia", "Rondônia"),
    "rr": ("Roraima", "Roraima"),
    "rs": ("Rio Grande do Sul", "Rio Grande do Sul"),
    "sc": ("Santa Catarina", "Santa Catarina"),
    "se": ("Sergipe", "Sergipe"),
    "sp": ("São Paulo", "São Paulo"),
    "to": ("Tocantins", "Tocantins"),
}


def parse_cities(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if text.count("\n") <= 2 and "," in text:
        raw = text.replace("\n", ",")
        parts = [p.strip() for p in raw.split(",")]
    else:
        parts = [line.strip() for line in text.splitlines()]
    seen: set[str] = set()
    cities: list[str] = []
    for part in parts:
        if not part or part.startswith("#"):
            continue
        if part not in seen:
            seen.add(part)
            cities.append(part)
    return cities


def main() -> None:
    CITIES_DIR.mkdir(parents=True, exist_ok=True)
    states: dict[str, dict] = {}
    for code, (name, parent_city) in STATE_META.items():
        path = CITIES_DIR / f"{code}.txt"
        if not path.exists():
            print(f"skip {code}: no file")
            continue
        cities = parse_cities(path.read_text(encoding="utf-8"))
        states[code] = {
            "code": code,
            "name": name,
            "parent_city": parent_city,
            "cities": cities,
        }
        print(f"{code}: {len(cities)} cities")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"states": states}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    total = sum(len(s["cities"]) for s in states.values())
    print(f"written {OUT} — {len(states)} states, {total} cities")


if __name__ == "__main__":
    main()
