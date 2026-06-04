# -*- coding: utf-8 -*-
"""
result_builder.py — normaliza itens da IA, faz dedup/merge com itens PDF e filtra ruído.
"""

import re
import logging
from typing import Optional

from config import VALID_CATS, VALID_UNITS, normalize_key, _MATERIAL_KEYWORDS
from schemas import ItemExtraido, Divergencia, Metadata, ExtractionResult

log = logging.getLogger("extractor")

_AREA_REF_PAT = re.compile(r"a\s*=\s*[\d,.]+\s*m[²2]?|área\s*\(a\s*=", re.IGNORECASE)


def norm_item(it: dict, idx: int) -> ItemExtraido:
    raw_status = str(it.get("status", "parcial")).lower()
    if raw_status not in ("confirmado", "parcial", "aguardando"):
        raw_status = "parcial"
    cat = str(it.get("categoria", "outro")).lower()
    if cat not in VALID_CATS:
        cat = "outro"
    unit = str(it.get("unidade", "un")).lower().replace("m²", "m2")
    if unit not in VALID_UNITS:
        unit = "un"
    qty  = float(it.get("quantidade") or 0)
    fonte = str(it.get("fonte", "IA"))
    if fonte == "PDF" and qty <= 0:
        raw_status = "aguardando"
    return ItemExtraido(
        id=idx + 1,
        ambiente=str(it.get("ambiente", "Geral")),
        descricao=str(it.get("descricao", "")),
        categoria=cat,
        unidade=unit,
        quantidade=qty,
        confianca=int(it.get("confianca") or 70),
        fonte=fonte,
        status=raw_status,
        pendencias=[str(p) for p in it.get("pendencias", [])],
    )


def build_items(
    parsed: dict,
    pdf_items: list[dict],
) -> tuple[list[ItemExtraido], list[Divergencia], list[str]]:
    """
    Merge IA response + PDF items com dedup, fallback de quantidade e filtragem.
    Retorna (itens, divergencias, erros_ia).
    """
    pdf_items_map = {it["descricao"].upper(): it for it in pdf_items}

    itens_raw = parsed.get("itens", [])
    itens: list[ItemExtraido] = []
    seen_descs_upper: set[str] = set()
    seen_keys: set[str]        = set()

    for it in itens_raw:
        desc_upper = str(it.get("descricao", "")).upper()
        item_key   = normalize_key(desc_upper)

        if item_key in seen_keys:
            existing_idx = next(
                (j for j, x in enumerate(itens) if normalize_key(x.descricao.upper()) == item_key),
                None,
            )
            qty_new = float(it.get("quantidade") or 0)
            if existing_idx is not None and qty_new > itens[existing_idx].quantidade:
                itens[existing_idx] = norm_item({**it, "quantidade": qty_new}, existing_idx)
            continue

        if desc_upper in pdf_items_map:
            pdf_it = pdf_items_map[desc_upper]
            if (it.get("quantidade") or 0) <= 0 and pdf_it["quantidade"] > 0:
                it["quantidade"] = pdf_it["quantidade"]
                it["unidade"]    = pdf_it["unidade"]
                it["confianca"]  = pdf_it["confianca"]
                it["fonte"]      = "PDF"
                it["status"]     = "confirmado"

        seen_descs_upper.add(desc_upper)
        seen_keys.add(item_key)
        itens.append(norm_item(it, len(itens)))

    def _is_already_covered(pdf_key: str) -> bool:
        if pdf_key in seen_keys:
            return True
        for sk in seen_keys:
            if sk.startswith(pdf_key) or pdf_key.startswith(sk):
                return True
        return False

    for pdf_it in pdf_items:
        pdf_key = normalize_key(pdf_it["descricao"])
        if (
            pdf_it["descricao"].upper() not in seen_descs_upper
            and not _is_already_covered(pdf_key)
        ):
            seen_keys.add(pdf_key)
            itens.append(norm_item(pdf_it, len(itens)))

    itens = [
        it for it in itens
        if not (
            it.categoria == "outro"
            and _AREA_REF_PAT.search(it.descricao)
            and not _MATERIAL_KEYWORDS.search(it.descricao)
        )
    ]
    for i, it in enumerate(itens):
        it.id = i + 1

    def _str_or_none(v) -> Optional[str]:
        return str(v) if v is not None else None

    divergencias = [
        Divergencia(
            campo=str(d.get("campo", "")),
            valor_pdf=_str_or_none(d.get("valor_pdf")),
            valor_dxf=_str_or_none(d.get("valor_dxf")),
            valor_ia=_str_or_none(d.get("valor_ia")),
            recomendacao=str(d.get("recomendacao", "")),
        )
        for d in parsed.get("divergencias", [])
        if isinstance(d, dict) and d.get("campo")
    ]

    erros_ia = [str(e) for e in parsed.get("erros_limitacoes", [])]

    return itens, divergencias, erros_ia
