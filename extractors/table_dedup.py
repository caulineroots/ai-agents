# -*- coding: utf-8 -*-
"""
table_dedup.py — deduplicação de tabelas CEA-QNT (+ fachada de compatibilidade).

Resolve o problema de tabelas master (ex: CEA - QNT PAREDES) aparecerem
repetidas em múltiplas pranchas, levando a quantidades multiplicadas.

A lógica foi modularizada:
  - loja_config.py    → constantes por projeto (pranchas, prioridades, códigos)
  - mapping_rules.py  → MAPA_FIXO + _match_fixo (descrição → código)
  - tabela_common.py  → normalização/filtros/prancha compartilhados
  - xlsx_mapping.py   → map_rows_to_xlsx / agregação por código
  - table_dedup.py    → dedup_by_fingerprint (este arquivo) + reexports

Funções públicas (mantidas por compatibilidade):
  dedup_by_fingerprint(all_items, threshold) → (list[dict], list[dict])
  map_rows_to_xlsx(items, checklist, api_key) → (list[dict], ...)
  filter_orcar_items(items) → list[dict]
"""

from __future__ import annotations

import re
import logging
from collections import defaultdict

from extractors.loja_config import ZONE_SENSITIVE_KEYS
from extractors.tabela_common import (
    _normalize_tabela_key, _item_zona, _porta_item_key,
    _block_priority_score, _pick_best_block,
)

# ── Reexports de compatibilidade (imports legados de extractors.table_dedup) ──
from extractors.loja_config import (  # noqa: F401
    ADM_PRANCHAS_BLN, PRANCHA_PRIORITY, COD_PRIORITY_PRANCHA,
    COD_FALLBACK_PRANCHA, SOLEIRA_CODS, USE_MAX_CODS, ZONE_SENSITIVE_KEYS as _ZSK,
)
from extractors.mapping_rules import (  # noqa: F401
    MAPA_FIXO, _COMPILED_MAP, _match_fixo, _parse_prancha_num,
)
from extractors.tabela_common import (  # noqa: F401
    _is_junk_orcar_line, filter_orcar_items, _stem_has_prancha,
    _normalize_tabela_group, _parse_revisao,
)
from extractors.xlsx_mapping import (  # noqa: F401
    map_rows_to_xlsx, dedup_mapped_by_cod, _aggregate_mapped_rows,
    _rows_from_priority_prancha, _row_closest_to_ref, _haiku_map,
)

log = logging.getLogger("extractor")


def _norm_pintura_desc(desc: str) -> str:
    """Chave de cor de pintura: maiúsculas, sem números/pontuação de área."""
    d = (desc or "").upper()
    d = re.sub(r"[\d.,]+\s*M[²2]?", " ", d)
    d = re.sub(r"[^A-ZÀ-Ú ]", " ", d)
    return re.sub(r"\s+", " ", d).strip()


def _dedup_portas_by_item_code(
    tab_items: list[dict],
    dedup_log: list[dict],
) -> list[dict]:
    """Dedup PORTAS por código de porta (ALÇAPÃO, PD 031…) — 301 > 306."""
    by_key: dict[str, list[dict]] = defaultdict(list)
    for it in tab_items:
        by_key[_porta_item_key(it.get("descricao", ""))].append(it)

    result: list[dict] = []
    for key, items in by_key.items():
        por_prancha: dict[str, list[dict]] = defaultdict(list)
        for it in items:
            por_prancha[it.get("prancha_id") or "?"].append(it)

        if len(por_prancha) <= 1:
            result.extend(items)
            continue

        best_pid = max(
            por_prancha.keys(),
            key=lambda pid: (
                max(it.get("revisao_num", 0) for it in por_prancha[pid]),
                _block_priority_score(pid, "PORTAS"),
            ),
        )
        result.extend(por_prancha[best_pid])
        dropped = [p for p in por_prancha if p != best_pid]
        if dropped:
            dedup_log.append({
                "tabela": f"PORTAS_{key}",
                "kept": best_pid,
                "dropped": dropped,
                "gt": None,
                "motivo": "porta_item_code",
            })
            log.info("[dedup] PORTAS '%s': mantém %s, descarta %s", key, best_pid, dropped)

    return result


def _dedup_pintura_by_zona_desc(
    tab_items: list[dict],
    dedup_log: list[dict],
) -> list[dict]:
    """Dedup PINTURA por (zona, cor). Mantém a prancha de maior revisão/prioridade
    para cada combinação — vendas e ADM nunca colapsam entre si."""
    by_key: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for it in tab_items:
        by_key[(_item_zona(it), _norm_pintura_desc(it.get("descricao", "")))].append(it)

    result: list[dict] = []
    for (zona, cor), items in by_key.items():
        por_prancha: dict[str, list[dict]] = defaultdict(list)
        for it in items:
            por_prancha[it.get("prancha_id") or "?"].append(it)

        if len(por_prancha) <= 1:
            result.extend(items)
            continue

        best_pid = max(
            por_prancha.keys(),
            key=lambda pid: (
                max(it.get("revisao_num", 0) for it in por_prancha[pid]),
                _block_priority_score(pid, "PINTURA"),
            ),
        )
        result.extend(por_prancha[best_pid])
        dropped = [p for p in por_prancha if p != best_pid]
        if dropped:
            dedup_log.append({
                "tabela": f"PINTURA_{zona}_{cor[:20]}",
                "kept": best_pid,
                "dropped": dropped,
                "gt": None,
                "motivo": "pintura_zona_desc",
            })
            log.info("[dedup] PINTURA %s '%s': mantém %s, descarta %s",
                     zona, cor[:30], best_pid, dropped)

    return result


def _cluster_by_grand_total(
    blocos: list[dict], tabela: str, threshold: float, dedup_log: list[dict],
) -> list[dict]:
    """Blocos com grand_total: clusteriza por valor ± threshold, mantém o melhor."""
    kept_blocks: list[dict] = []
    used: set[int] = set()
    for i, b in enumerate(blocos):
        if i in used:
            continue
        cluster = [b]
        used.add(i)
        for j, b2 in enumerate(blocos):
            if j in used:
                continue
            ref = max(b["gt"], 1)
            if abs(b["gt"] - b2["gt"]) / ref < threshold:
                cluster.append(b2)
                used.add(j)
        best = _pick_best_block(cluster, tabela)
        kept_blocks.append(best)
        if len(cluster) > 1:
            dropped = [c["pid"] for c in cluster if c["pid"] != best["pid"]]
            dedup_log.append({
                "tabela": tabela, "kept": best["pid"], "dropped": dropped,
                "gt": best["gt"],
                "motivo": "priority" if best["rev"] == max(c["rev"] for c in cluster) else "rev",
            })
            log.info("[dedup] '%s': mantém %s (rev=%d), descarta %s",
                     tabela, best["pid"], best["rev"], dropped)
    return kept_blocks


def _cluster_by_jaccard(
    blocos: list[dict], tabela: str, dedup_log: list[dict],
) -> list[dict]:
    """Blocos sem grand_total: agrupa por Jaccard >= 0.75 das descrições.

    Tabelas como PISOS/RODAPÉS aparecem em várias pranchas com quantidades
    ligeiramente diferentes entre revisões, fazendo o fingerprint exato falhar.
    """
    def _jaccard(set_a: frozenset, set_b: frozenset) -> float:
        u = set_a | set_b
        return len(set_a & set_b) / len(u) if u else 0.0

    desc_sets = [frozenset(it["descricao"] for it in b["items"]) for b in blocos]
    kept_blocks: list[dict] = []
    used_idx: set[int] = set()
    for i in range(len(blocos)):
        if i in used_idx:
            continue
        cl = [i]
        used_idx.add(i)
        for j in range(i + 1, len(blocos)):
            if j not in used_idx and _jaccard(desc_sets[i], desc_sets[j]) >= 0.75:
                cl.append(j)
                used_idx.add(j)
        best = _pick_best_block([blocos[k] for k in cl], tabela)
        kept_blocks.append(best)
        if len(cl) > 1:
            dropped = [blocos[k]["pid"] for k in cl if blocos[k]["pid"] != best["pid"]]
            dedup_log.append({
                "tabela": tabela, "kept": best["pid"], "dropped": dropped,
                "gt": None, "motivo": "priority_jaccard",
            })
            log.info("[dedup] '%s': mantém %s (rev=%d, Jaccard), descarta %s",
                     tabela, best["pid"], best["rev"], dropped)
    return kept_blocks


def _build_blocos(por_prancha: dict[str, list[dict]]) -> list[dict]:
    """Constrói blocos por prancha com metadados (gt, rev, fingerprint)."""
    blocos: list[dict] = []
    for pid, pitens in por_prancha.items():
        gt = next(
            (it.get("grand_total_tabela") for it in pitens if it.get("grand_total_tabela") is not None),
            None,
        )
        rev_num = max((it.get("revisao_num", 0) for it in pitens), default=0)
        fp = frozenset(
            (it.get("descricao", ""), round(it.get("quantidade", 0), 2))
            for it in pitens
        )
        blocos.append({"pid": pid, "gt": gt, "rev": rev_num, "fp": fp, "items": pitens})
    return blocos


def dedup_by_fingerprint(
    all_items: list[dict],
    threshold: float = 0.05,
) -> tuple[list[dict], list[dict]]:
    """
    Deduplica tabelas que aparecem repetidas em várias pranchas.

    Cada item deve ter os campos:
      tabela            str   — nome da seção CEA (PAREDES, PISOS, RODAPES …)
      grand_total_tabela float | None — total da seção (None se a tabela não tem Grand total)
      prancha_id        str   — stem da prancha de origem
      revisao_num       int   — número da revisão (0 se não encontrado)
      descricao         str
      quantidade        float

    Lógica:
    - Se tabela tem grand_total ± threshold entre pranchas → cópias → mantém revisão mais alta
    - Se grand_total difere >= threshold → aditivo → mantém ambos
    - Sem grand_total → fingerprint = frozenset(desc, qty) → cópias exatas removidas

    Retorna: (itens_deduplicated, dedup_log)
    """
    grupos: dict[str, list[dict]] = defaultdict(list)
    for it in all_items:
        tab = _normalize_tabela_key(it.get("tabela") or "", it.get("descricao") or "")
        if tab == "EXCLUDE":
            continue
        grupos[tab].append(it)

    # ── DEBUG provadores: verificar itens de pranchas 131/132 ────────────────
    _prov_items = [it for it in all_items
                   if _parse_prancha_num(it.get("prancha_id", "")) in {"131", "132"}]
    if _prov_items:
        log.info("[dedup] PROVADORES %d items (131/132), tabelas: %s",
                 len(_prov_items),
                 sorted({it.get("tabela", "?") for it in _prov_items}))
        for _it in _prov_items[:10]:
            log.debug("[dedup] PROVADORES item: pid=%s tab=%s desc=%.40s qty=%s",
                      _it.get("prancha_id"), _it.get("tabela"),
                      _it.get("descricao", ""), _it.get("quantidade"))
    else:
        log.warning("[dedup] PROVADORES — zero items from 131/132 entering dedup")

    result: list[dict] = []
    dedup_log: list[dict] = []

    for tabela, tab_items in grupos.items():
        if tabela == "PORTAS":
            result.extend(_dedup_portas_by_item_code(tab_items, dedup_log))
            continue

        # PINTURA: dedup por (zona, descrição) — vendas e ADM são tabelas lógicas
        # distintas (18.3/18.5, 18.10/18.11), e cada cor pode aparecer só em
        # algumas pranchas. Dedup por bloco descartaria linhas válidas.
        if tabela in ZONE_SENSITIVE_KEYS:
            result.extend(_dedup_pintura_by_zona_desc(tab_items, dedup_log))
            continue

        # Subdivide por prancha_id
        por_prancha: dict[str, list[dict]] = defaultdict(list)
        for it in tab_items:
            pid = it.get("prancha_id") or "?"
            por_prancha[pid].append(it)

        if len(por_prancha) <= 1:
            # Apenas 1 prancha com essa tabela — sem dedup necessário
            result.extend(tab_items)
            continue

        blocos = _build_blocos(por_prancha)

        if all(b["gt"] is not None for b in blocos):
            kept_blocks = _cluster_by_grand_total(blocos, tabela, threshold, dedup_log)
        else:
            kept_blocks = _cluster_by_jaccard(blocos, tabela, dedup_log)

        for kb in kept_blocks:
            result.extend(kb["items"])

    log.info("[dedup] %d → %d itens após dedup (%d tabelas, %d operações)",
             len(all_items), len(result), len(grupos), len(dedup_log))
    return result, dedup_log
