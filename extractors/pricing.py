# -*- coding: utf-8 -*-
"""
pricing.py — Fase 4: precifica um item (descrição + medida) contra precos.json.

Determinístico primeiro: exact -> keyword -> fuzzy -> fallback por categoria.
precos.json traz `vlr` = MAT + M.OBRA combinado (sem split); decisão v1: escrevemos
o combinado em TOTAL e deixamos MAT/M.OBRA em branco. Ver
docs/arquitetura/05-verificacao-precificacao.md (decisão #1).
"""

import os
import json
import logging
import unicodedata

log = logging.getLogger("extractor")

_PRECOS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "precos.json")
_STOP = {"de", "do", "da", "em", "para", "com", "sem", "e", "a", "o", "+",
         "mat", "obra", "mao", "material"}


def _norm(s: str) -> str:
    txt = unicodedata.normalize("NFKD", s or "")
    txt = "".join(c for c in txt if not unicodedata.combining(c)).lower()
    return " ".join(txt.replace("/", " ").split())


def _tokens(s: str) -> set[str]:
    return {t for t in _norm(s).split() if len(t) >= 3 and t not in _STOP}


class PriceTable:
    """Carrega e indexa precos.json (uma vez)."""

    def __init__(self, path: str = _PRECOS_PATH):
        data = json.load(open(path, encoding="utf-8"))
        self.entries = data.get("tabela_precos", [])
        self.fallback = data.get("fallback_por_categoria") or {}
        for e in self.entries:
            e["_norm"] = _norm(e["descricao"])
            e["_tokens"] = _tokens(e["descricao"])
            e["_kw_norm"] = [_norm(k) for k in e.get("keywords", [])]

    def match(self, descricao: str, categoria: str = "") -> dict | None:
        """Casa a descrição com uma entrada da tabela. Retorna a entrada + match_type."""
        dnorm = _norm(descricao)
        dtokens = _tokens(descricao)

        # 1) exact
        for e in self.entries:
            if e["_norm"] == dnorm:
                return {"vlr": e["vlr"], "ref": e["descricao"], "categoria": e["categoria"],
                        "match": "exact"}
        # 2) keyword (qualquer keyword da entrada aparece na descrição)
        best_kw = None
        for e in self.entries:
            for kw in e["_kw_norm"]:
                if kw and kw in dnorm:
                    cand = {"vlr": e["vlr"], "ref": e["descricao"], "categoria": e["categoria"],
                            "match": "keyword", "_score": len(kw)}
                    if best_kw is None or cand["_score"] > best_kw["_score"]:
                        best_kw = cand
        if best_kw:
            best_kw.pop("_score", None)
            return best_kw
        # 3) fuzzy por sobreposição de tokens (coeficiente de overlap)
        best, best_score = None, 0.0
        for e in self.entries:
            if not e["_tokens"]:
                continue
            inter = len(dtokens & e["_tokens"])
            if not inter:
                continue
            score = inter / min(len(dtokens), len(e["_tokens"]))
            if score > best_score:
                best_score, best = score, e
        if best and best_score >= 0.5:
            return {"vlr": best["vlr"], "ref": best["descricao"],
                    "categoria": best["categoria"], "match": "fuzzy"}
        # 4) fallback por categoria
        if categoria in self.fallback:
            return {"vlr": self.fallback[categoria], "ref": f"fallback:{categoria}",
                    "categoria": categoria, "match": "fallback"}
        return None


_default_table: PriceTable | None = None


def get_table() -> PriceTable:
    global _default_table
    if _default_table is None:
        _default_table = PriceTable()
    return _default_table


def price_item(item: dict, quantidade: float | None, table: PriceTable | None = None) -> dict | None:
    """Precifica o item. `quantidade` = medida resolvida (ou qde_inicial).

    v1: total = vlr_unit * quantidade no campo TOTAL; MAT/M.OBRA ficam None.
    MATERIAL_CLIENTE é sinalizado (precificar só mão de obra exige split do vlr — TODO).
    """
    table = table or get_table()
    m = table.match(item.get("descricao", ""), item.get("categoria", ""))
    if not m:
        return None

    vlr = float(m["vlr"])
    qty = quantidade if quantidade is not None else item.get("qde_inicial")
    total = round(vlr * qty, 2) if qty is not None else None

    out = {
        "vlr_unit": vlr,
        "mat": None,            # v1: combinado vai em total
        "mobra": None,
        "total": total,
        "match": m["match"],
        "price_ref": m["ref"],
        "flags": [],
    }
    if "MATERIAL_CLIENTE" in (item.get("class_flags") or []):
        out["flags"].append("PRECO_INCLUI_MATERIAL_CLIENTE")  # revisar: cobrar só M.O.
    if m["match"] in ("fuzzy", "fallback"):
        out["flags"].append("PRECO_INCERTO")                  # match fraco -> revisar
    return out
