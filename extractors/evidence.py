# -*- coding: utf-8 -*-
"""
evidence.py — Fase 0b: monta o "pool de evidências" do projeto a partir das
pranchas (PDF/DXF), uma vez, para o Medidor consultar por item.

Hoje os extractors alimentam um firehose de descoberta; aqui eles viram um índice
consultável: por prancha (stem) guardamos os itens com quantidade já tabelados no
PDF (CEA-QNT, quadros, tabelas especiais), os area tags, e os dados DXF (para a
camada de geometria — M4). Ver docs/arquitetura/02-ingestao.md.
"""

import logging

from extractors.pdf_extractor import (
    extract_pdf, parse_cea_qnt_from_text, parse_cea_qnt_tables,
    parse_special_tables_from_text, classify_item_junk,
)

log = logging.getLogger("extractor")


def _stated_items_from_pdf(pdf_data: dict) -> list[dict]:
    """Itens com quantidade tabelada no PDF (a base da camada 'stated')."""
    if not pdf_data.get("ok"):
        return []
    items = parse_cea_qnt_from_text(pdf_data) or parse_cea_qnt_tables(pdf_data)
    seen = {it.get("descricao", "") for it in items}
    items = items + parse_special_tables_from_text(pdf_data, seen)
    # mesmo filtro de lixo determinístico usado no serviço
    return [it for it in items if not classify_item_junk(it.get("descricao", ""))]


def extract_sheet_evidence(stem: str, pdf_path: str | None = None,
                           dxf_path: str | None = None) -> dict:
    """Extrai a evidência de uma prancha. DXF é opcional (camada de geometria, M4)."""
    ev = {
        "stem": stem,
        "pdf_ok": False, "dxf_ok": False,
        "stated_items": [],   # [{descricao, quantidade, unidade, ambiente, categoria, ...}]
        "area_tags": [],
        "measure_lines": [],
        "dxf_data": None,
    }

    if pdf_path:
        try:
            d = extract_pdf(pdf_path)
            ev["pdf_ok"] = d.get("ok", False)
            stated = _stated_items_from_pdf(d)
            for it in stated:
                it["stem"] = stem
            ev["stated_items"] = stated
            ev["area_tags"] = d.get("area_tags", [])
            ev["measure_lines"] = d.get("measure_lines", [])
        except Exception as e:
            log.warning("[evidence] %s: erro PDF: %s", stem, e)

    if dxf_path:
        try:
            from extractors.dxf_extractor import extract_dxf
            ev["dxf_data"] = extract_dxf(dxf_path)
            ev["dxf_ok"] = ev["dxf_data"].get("ok", False)
        except Exception as e:
            log.warning("[evidence] %s: erro DXF: %s", stem, e)

    return ev


def build_evidence_pool(sheets: list[dict]) -> dict:
    """sheets: [{stem, pdf?, dxf?}] -> {stem: evidence}. Ignora DXF inexistente."""
    pool: dict[str, dict] = {}
    for s in sheets:
        stem = s["stem"]
        pool[stem] = extract_sheet_evidence(stem, s.get("pdf"), s.get("dxf"))
    n_items = sum(len(ev["stated_items"]) for ev in pool.values())
    log.info("[evidence] %d pranchas, %d itens stated no pool", len(pool), n_items)
    return pool


def all_stated_items(pool: dict, stems: list[str] | None = None) -> list[dict]:
    """Itens stated do pool, opcionalmente restritos a um conjunto de stems."""
    out: list[dict] = []
    for stem, ev in pool.items():
        if stems is not None and stem not in stems:
            continue
        out.extend(ev["stated_items"])
    return out
