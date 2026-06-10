# -*- coding: utf-8 -*-
"""
classifier.py — Fase 1: classifica cada item de linha da planilha com a
ESTRATÉGIA de medição, unidade normalizada, categoria, se precisa de desenho e
quais pranchas são candidatas a conter a medida.

Determinístico primeiro (a maior parte é mecânica: unidade -> estratégia); a IA
só refina os casos ambíguos (unidade em branco, descrição que contradiz a
unidade). Ver docs/arquitetura/03-classificacao.md.
"""

import re
import logging
import unicodedata

from config import guess_categoria

log = logging.getLogger("extractor")

# ── Normalização de unidade (raw -> canônica) ─────────────────────────────────
_UNIT_CANON = {
    "m2": "m2", "m²": "m2", "m2.": "m2",
    "ml": "ml",
    "m": "m", "m.": "m", "mlinear": "m",
    "un": "un", "und": "un", "unid": "un", "unidade": "un", "uni": "un",
    "pç": "un", "pc": "un", "peca": "un", "peça": "un", "pcs": "un",
    "cj": "un", "conj": "un", "conjunto": "un", "jg": "un", "jogo": "un",
    "m3": "m3", "m³": "m3",
    "vb": "vb", "vb.": "vb", "verba": "vb", "gl": "vb",
    "dia": "dia", "dias": "dia", "diaria": "dia",
    "mes": "mes", "mês": "mes", "meses": "mes",
    "kg": "kg", "kgs": "kg",
    "hr": "hr", "h": "hr", "hora": "hr", "horas": "hr",
}

# ── Estratégia por unidade canônica ───────────────────────────────────────────
_STRATEGY_BY_UNIT = {
    "m2": "AREA",
    "ml": "LINEAR", "m": "LINEAR",
    "un": "COUNT",
    "m3": "VOLUME",
    "kg": "COUNT",         # massa tabelada — tratada como quantidade contável
    "vb": "LUMP_SUM",
    "dia": "TIME", "mes": "TIME", "hr": "TIME",
}

_NEEDS_DRAWING = {"AREA", "LINEAR", "COUNT", "VOLUME"}

# ── Detecção de fornecimento por terceiro / fora de escopo ────────────────────
_RE_FORNEC_TERCEIRO = re.compile(
    r"contrata[çc][ãa]o\s+direta|fornecid[oa]s?\s+(pela|pelo|e\s+instalad)|"
    r"pela\s+c&a|pela\s+instalador|por\s+conta\s+(da|do)\s+(c&a|cliente)",
    re.IGNORECASE,
)
# Linhas que são observações/notas, não itens priceáveis
_RE_NOTA = re.compile(r"^\s*(obs\.?:|nota\.?:|observa[çc][ãa]o)", re.IGNORECASE)

# ── Hints categoria -> tokens de tipo de prancha (para casar candidatos) ───────
_CAT_SHEET_HINTS = {
    "revestimento": {"piso", "revestimento", "forro", "civil", "acabamento"},
    "pintura":      {"pintura", "forro", "civil", "parede"},
    "civil":        {"civil", "divisoria", "parede", "alvenaria", "cremalheira",
                     "tapume", "escada", "descompressao", "cortes", "doca"},
    "marcenaria":   {"provador", "estante", "marcenaria", "painel", "lounge", "reunioes"},
    "eletrica":     {"iluminacao", "eletrica", "int", "luminaria"},
    "hidraulica":   {"sanitario", "copa", "doca", "hidraulica"},
    "vidros":       {"caixilho", "vitrine", "fachada", "vidro", "espelho"},
    "fachada":      {"fachada", "vitrine", "comunicacao", "cvs"},
    "climatizacao": {"climatizacao", "forro", "area", "tecnica"},
    "outro":        set(),
}

_STOP_TOKENS = {
    "cea", "bln", "arq", "int", "dec", "lay", "cvs", "old", "r01", "r02", "r03",
    "r04", "e", "de", "da", "do", "para", "com", "sem", "a", "o", "as", "os",
}


def _strip_accents(s: str) -> str:
    txt = unicodedata.normalize("NFKD", s)
    return "".join(c for c in txt if not unicodedata.combining(c))


def _tokens(text: str) -> set[str]:
    """Tokens alfabéticos significativos, sem acento, minúsculos, sem stopwords."""
    words = re.findall(r"[a-zà-ú]+", _strip_accents(text).lower())
    return {w for w in words if len(w) >= 3 and w not in _STOP_TOKENS}


def normalize_unit(raw: str) -> str:
    """Unidade canônica ('' se desconhecida/em branco)."""
    key = _strip_accents((raw or "").strip().lower()).replace(" ", "")
    if not key:
        return ""
    return _UNIT_CANON.get(key, _UNIT_CANON.get(key.rstrip("."), ""))


def sheet_tipo_tokens(stem: str) -> set[str]:
    """Extrai tokens descritivos do nome da prancha (ex. 'ARQ CIVIL' -> {civil})."""
    return _tokens(stem)


def build_project_map(stems: list[str]) -> list[dict]:
    """Mapa de projeto determinístico a partir dos nomes de arquivo das pranchas.
    Cada entrada: {stem, tokens}. (A IA pode enriquecer com área/ambientes depois.)
    """
    return [{"stem": s, "tokens": sorted(sheet_tipo_tokens(s))} for s in stems]


def _candidatos(descricao: str, categoria: str, project_map: list[dict],
                max_n: int = 3) -> list[str]:
    """Pranchas mais prováveis de conter a medida do item, por sobreposição de tokens."""
    if not project_map:
        return []
    item_tokens = _tokens(descricao) | _CAT_SHEET_HINTS.get(categoria, set())
    scored: list[tuple[int, str]] = []
    for sheet in project_map:
        st = set(sheet.get("tokens", []))
        overlap = len(item_tokens & st)
        if overlap > 0:
            scored.append((overlap, sheet["stem"]))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [stem for _, stem in scored[:max_n]]


def classify_one(item: dict, project_map: list[dict] | None = None) -> dict:
    """Classifica um LineItem (dict do parser). Retorna o item enriquecido."""
    desc = item.get("descricao", "")
    unidade = normalize_unit(item.get("unidade_raw", ""))
    categoria = guess_categoria(desc)

    fornec_terceiro = bool(_RE_FORNEC_TERCEIRO.search(desc))
    is_nota = bool(_RE_NOTA.search(desc))

    if unidade:
        estrategia = _STRATEGY_BY_UNIT.get(unidade, "INDEFINIDO")
    elif is_nota:
        estrategia = "NOTA"          # linha de observação, não priceável
    elif fornec_terceiro:
        estrategia = "LUMP_SUM"      # fornecimento direto — sem medição
    else:
        estrategia = "INDEFINIDO"    # unidade em branco e sem pista — IA/humano decide

    # Itens fornecidos por terceiro não exigem medição mesmo com unidade geométrica
    needs_drawing = (estrategia in _NEEDS_DRAWING) and not fornec_terceiro and not is_nota

    flags: list[str] = []
    if fornec_terceiro:
        flags.append("FORNEC_TERCEIRO")
    if estrategia == "INDEFINIDO":
        flags.append("ESTRATEGIA_INDEFINIDA")
    if is_nota:
        flags.append("NOTA")

    out = dict(item)
    out.update({
        "unidade": unidade,
        "estrategia": estrategia,
        "categoria": categoria,
        "needs_drawing": needs_drawing,
        "candidatos": _candidatos(desc, categoria, project_map or []) if needs_drawing else [],
        "class_flags": flags,
    })
    return out


def classify_items(itens: list[dict], project_map: list[dict] | None = None) -> dict:
    """Classifica todos os itens. Retorna {itens, resumo}."""
    classified = [classify_one(it, project_map) for it in itens]
    resumo = {
        "n_total": len(classified),
        "n_needs_drawing": sum(1 for it in classified if it["needs_drawing"]),
        "por_estrategia": {},
        "n_indefinidos": sum(1 for it in classified if it["estrategia"] == "INDEFINIDO"),
    }
    for it in classified:
        e = it["estrategia"]
        resumo["por_estrategia"][e] = resumo["por_estrategia"].get(e, 0) + 1
    log.info("[classify] %d itens | needs_drawing=%d | estrategias=%s",
             resumo["n_total"], resumo["n_needs_drawing"], resumo["por_estrategia"])
    return {"itens": classified, "resumo": resumo}
