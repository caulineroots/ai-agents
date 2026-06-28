# -*- coding: utf-8 -*-
"""
derived_quantities.py — quantidades derivadas pós-mapeamento (BLN).

Itens que não existem como linha no PDF mas são calculáveis a partir
de outros códigos já mapeados.
"""

from __future__ import annotations

import logging

log = logging.getLogger("extractor")

# (cod_destino, unidade, função(mapped_by_cod) -> qty | None)
DERIVED_RULES_BLN: list[tuple] = [
    (
        "9.7",
        "m2",
        lambda m: round(2.0 * (float(m.get("9.5", 0)) + float(m.get("25.2", 0))), 4)
        if m.get("9.5") or m.get("25.2")
        else None,
        "Chapisco e emboço (2× alvenaria)",
    ),
    (
        "14.2",
        "m2",
        lambda m: float(m["14.1"]) if m.get("14.1") else None,
        "Autonivelante (= área piso vinílico)",
    ),
]


def apply_derived_quantities(
    mapped_items: list[dict],
    checklist_by_cod: dict[str, dict],
    obra: str = "BLN",
) -> list[dict]:
    """
    Adiciona itens derivados que ainda não existem em mapped_items.
    Retorna lista de novos itens (não muta mapped_items).
    """
    if obra.upper() not in ("BLN", "CEA-254", "254"):
        return []

    by_cod: dict[str, float] = {}
    for it in mapped_items:
        cod = it.get("cod")
        if cod:
            by_cod[cod] = by_cod.get(cod, 0.0) + float(it.get("quantidade", 0))

    existing = {it.get("cod") for it in mapped_items}
    derived: list[dict] = []

    for cod, un, fn, desc_default in DERIVED_RULES_BLN:
        if cod in existing:
            continue
        qty = fn(by_cod)
        if qty is None or qty <= 0:
            continue
        xl = checklist_by_cod.get(cod, {})
        derived.append({
            "cod":            cod,
            "descricao":      xl.get("descricao") or desc_default,
            "quantidade":     qty,
            "unidade":        un,
            "confianca":      0.7,
            "fonte_pranchas": ["derivado"],
            "fonte":          "derivado",
            "status":         "derivado",
        })
        log.info("[derived] %s = %.4f %s", cod, qty, un)

    return derived
