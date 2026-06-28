# -*- coding: utf-8 -*-
"""
tabela_common.py — helpers compartilhados entre dedup e mapeamento.

Normalização de nomes de seção CEA, filtros de lixo, e utilitários de prancha
(zona, prioridade) usados tanto por `table_dedup` quanto por `xlsx_mapping`.
"""

from __future__ import annotations

import re

from extractors.loja_config import ADM_PRANCHAS_BLN, PRANCHA_PRIORITY
from extractors.mapping_rules import _parse_prancha_num

_RE_DOOR_CODE = re.compile(r"^(PA|PD|PM|PF|PV)\s*\d", re.IGNORECASE)
_RE_ALCAPAO = re.compile(r"ALÇAPÃO", re.IGNORECASE)
_RE_PORTA_CODE = re.compile(r"^(PA|PD|PM|PF|PV)\s*0?(\d+)", re.IGNORECASE)
_RE_JUNK_NUM = re.compile(r"^[\d\s.,]+$")
_RE_JUNK_HEADER = re.compile(r"CÓDIGO\s+DESCRIÇÃO|DESCRIÇÃO\s+ÁREA\s+PERIM", re.IGNORECASE)


def _normalize_tabela_key(tabela: str, descricao: str = "") -> str:
    """Normaliza nome de seção CEA para deduplicação."""
    t = (tabela or "").upper()
    desc = (descricao or "").strip()
    if t in ("GLOBAL_SCAN", "SEM_TABELA", "EXCLUDE"):
        return "EXCLUDE"
    if _RE_DOOR_CODE.match(desc) or _RE_ALCAPAO.search(desc):
        return "PORTAS"
    if t == "GERAL" and (_RE_DOOR_CODE.search(desc) or _RE_ALCAPAO.search(desc)):
        return "PORTAS"
    if "PINTURA" in t or "CERÂMICA_PAREDE" in t or "CERAMICA_PAREDE" in t:
        return "PINTURA"
    if "PAREDES" in t or t.startswith("RFID_"):
        return "PAREDES"
    if "FORRO" in t:
        return "FORROS"
    if "PISO" in t and "RODAP" not in t:
        return "PISOS"
    if "RODAP" in t:
        return "RODAPES"
    if "SOLEIR" in t:
        return "SOLEIRAS"
    if "TAPUME" in t:
        return "TAPUMES"
    if t.startswith("LINEAR_") or t.startswith("QNTD_"):
        return t
    return t


def _is_junk_orcar_line(desc: str) -> bool:
    """Fragmentos numéricos, cabeçalhos de tabela e linhas sem conteúdo útil."""
    d = (desc or "").strip()
    if not d:
        return True
    if _RE_JUNK_NUM.match(d):
        return True
    if _RE_JUNK_HEADER.search(d):
        return True
    if re.match(r"^ACARTONADO\s+[\d.,]+\s*$", d, re.IGNORECASE):
        return True
    if len(d) < 8 and not _RE_DOOR_CODE.match(d):
        return True
    return False


def filter_orcar_items(items: list[dict]) -> list[dict]:
    """Remove GLOBAL_SCAN e linhas não orçamentáveis antes do dedup."""
    import logging as _logging
    _log = _logging.getLogger("extractor")
    out: list[dict] = []
    for it in items:
        tab  = it.get("tabela") or ""
        desc = it.get("descricao") or ""
        pid  = it.get("prancha_id", "")
        key  = _normalize_tabela_key(tab, desc)
        if key == "EXCLUDE":
            _log.debug("[filter] EXCLUDE pid=%s tab=%r desc=%.40s", pid, tab, desc)
            continue
        if _is_junk_orcar_line(desc):
            _log.debug("[filter] JUNK    pid=%s tab=%r desc=%.40s", pid, tab, desc)
            continue
        out.append(it)
    return out


def _stem_has_prancha(stem: str, num: str) -> bool:
    return _parse_prancha_num(stem) == num


def _item_zona(item: dict) -> str:
    """Zona do item: campo explícito, ou derivada do número da prancha (BLN)."""
    zona = (item.get("zona") or "").strip().lower()
    if zona in ("adm", "vendas"):
        return zona
    prancha = _parse_prancha_num(item.get("prancha_id") or "")
    if prancha:
        return "adm" if prancha in ADM_PRANCHAS_BLN else "vendas"
    return "vendas"


def _porta_item_key(desc: str) -> str:
    m = _RE_PORTA_CODE.match((desc or "").strip())
    if m:
        return f"{m.group(1).upper()}_{int(m.group(2))}"
    if _RE_ALCAPAO.search(desc or ""):
        return "ALCAPAO"
    return (desc or "")[:40].upper()


def _normalize_tabela_group(tabela: str) -> str:
    t = (tabela or "").upper()
    if t == "PORTAS" or "PAREDES" in t or "PINTURA" in t:
        return "MASTER_CIVIL"
    if "FORRO" in t:
        return "MASTER_FORRO"
    if "PISO" in t or "RODAP" in t or "SOLEIR" in t:
        return "MASTER_PISO"
    return t


def _block_priority_score(pid: str, tabela: str) -> int:
    num = _parse_prancha_num(pid)
    group = _normalize_tabela_group(tabela)
    return PRANCHA_PRIORITY.get(group, {}).get(num, 0)


def _pick_best_block(cluster: list[dict], tabela: str) -> dict:
    """Escolhe bloco por (revisão, prioridade de prancha BLN)."""
    return max(
        cluster,
        key=lambda x: (x["rev"], _block_priority_score(x["pid"], tabela)),
    )


def _parse_revisao(stem: str) -> tuple[str, int]:
    """
    Extrai revisão de um stem, ex:
      'CEA-BLK-ARQ_R02-301' → ('R02', 2)
      'CEA-254-BLN-ARQ_R03-302' → ('R03', 3)
    """
    m = re.search(r"[_\-]R(\d{2})[_\-]", stem, re.IGNORECASE)
    if m:
        n = int(m.group(1))
        return f"R{m.group(1)}", n
    return "R00", 0
