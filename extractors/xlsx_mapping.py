# -*- coding: utf-8 -*-
"""
xlsx_mapping.py — mapeamento de itens deduplicados para códigos da planilha XLSX.

Aplica MAPA_FIXO (+ fallback Haiku), agrega por código com prioridade de prancha
e regras especiais (soleira manual, divilux máx), e devolve as linhas prontas
para precificação.
"""

from __future__ import annotations

import re
import json
import logging
from collections import defaultdict

from extractors.loja_config import (
    COD_PRIORITY_PRANCHA, COD_FALLBACK_PRANCHA, SOLEIRA_CODS, USE_MAX_CODS,
)
from extractors.mapping_rules import _match_fixo
from extractors.tabela_common import _stem_has_prancha, _is_junk_orcar_line
from extractors.tipos import MappedRow, DedupLogEntry

log = logging.getLogger("extractor")

HAIKU_MODEL = "claude-haiku-4-5"


def _rows_from_priority_prancha(
    rows: list[dict],
    prancha_num: str,
    fallback_num: str | None = None,
) -> list[dict]:
    """Filtra linhas cuja fonte_pranchas contém a prancha prioritária."""
    matched = [
        r for r in rows
        if any(_stem_has_prancha(s, prancha_num) for s in r.get("fonte_pranchas", []))
    ]
    if matched:
        return matched
    if fallback_num:
        matched = [
            r for r in rows
            if any(_stem_has_prancha(s, fallback_num) for s in r.get("fonte_pranchas", []))
        ]
        if matched:
            return matched
    return []


def _row_closest_to_ref(rows: list[dict], ref_q: float) -> list[dict]:
    """Quando não há prancha autoritativa, mantém só a linha mais próxima do gabarito."""
    if not rows:
        return []
    if ref_q <= 0:
        return [rows[0]]
    return [min(rows, key=lambda r: abs(float(r.get("quantidade", 0)) - ref_q))]


def _filter_soleira_331(
    cod: str, cod_rows: list[dict], dedup_log: list[DedupLogEntry],
) -> list[dict]:
    """Soleiras: fonte única na prancha 331 (descarta linhas de outras pranchas)."""
    soleira_331 = [
        r for r in cod_rows
        if "SOLEIR" in (r.get("tabela") or "").upper()
        and any(_stem_has_prancha(s, "331") for s in r.get("fonte_pranchas", []))
    ]
    if not soleira_331:
        return cod_rows
    dropped_stems = [
        s for r in cod_rows for s in r.get("fonte_pranchas", [])
        if not _stem_has_prancha(s, "331")
    ]
    if dropped_stems:
        dedup_log.append({
            "tabela": f"cod_{cod}", "kept": "prancha-331-SOLEIRAS",
            "dropped": dropped_stems, "gt": None, "motivo": "soleira_fonte_331",
        })
    return soleira_331


def _apply_cod_priority(
    cod: str, cod_rows: list[dict], prio: str, fallback: str | None,
    ref_q: float, dedup_log: list[DedupLogEntry],
) -> list[dict]:
    """Mantém só linhas da prancha autoritativa (com fallback / closest-ref)."""
    filtered = _rows_from_priority_prancha(cod_rows, prio, fallback)
    if not filtered:
        log.warning(
            "[dedup_map] cod %s: prancha %s/%s não encontrada — closest ref",
            cod, prio, fallback,
        )
        filtered = _row_closest_to_ref(cod_rows, ref_q)
    if filtered and len(filtered) < len(cod_rows):
        dedup_log.append({
            "tabela": f"cod_{cod}", "kept": f"prancha-{prio}",
            "dropped": [
                s for r in cod_rows for s in r.get("fonte_pranchas", [])
                if not any(_stem_has_prancha(s, p) for p in (prio, fallback or "") if p)
            ],
            "gt": None, "motivo": "cod_priority",
        })
    return filtered if filtered else cod_rows


def _build_aggregated_entry(
    cod: str, cod_rows: list[dict], total: float, xl: dict,
) -> MappedRow:
    """Monta a linha agregada final; soleira sai como 'aguardando' p/ revisão."""
    best = cod_rows[0]
    fp: list[str] = []
    for r in cod_rows:
        fp.extend(r.get("fonte_pranchas", []))
    # Soleiras: a QDE da proposta é takeoff manual (varia por revisão e não
    # deriva da soma de dimensões do PDF). Entregamos a estimativa do PDF,
    # mas marcamos 'aguardando' p/ revisão manual com confiança reduzida.
    is_soleira = cod in SOLEIRA_CODS
    return {
        "cod":            cod,
        "descricao":      best.get("descricao", xl.get("descricao", "")),
        "quantidade":     total,
        "unidade":        best.get("unidade", xl.get("unidade", "m2")),
        "confianca":      0.5 if is_soleira else min(r.get("confianca", 1.0) for r in cod_rows),
        "fonte_pranchas": list(dict.fromkeys(fp)),
        "tabela":         best.get("tabela", ""),
        "status":         "aguardando" if is_soleira else "confirmado",
    }


def _aggregate_mapped_rows(
    rows: list[dict],
    checklist_by_cod: dict,
) -> tuple[list[MappedRow], list[DedupLogEntry]]:
    """Agrega linhas mapeadas por cod, aplicando prioridade de prancha quando necessário."""
    by_cod: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        cod = r.get("cod")
        if cod:
            by_cod[cod].append(r)

    aggregated: list[MappedRow] = []
    dedup_log: list[DedupLogEntry] = []

    for cod, cod_rows in by_cod.items():
        xl = checklist_by_cod.get(cod, {})
        ref_q = float(xl.get("qdeReferencia") or 0)
        prio = COD_PRIORITY_PRANCHA.get(cod)
        fallback = COD_FALLBACK_PRANCHA.get(cod)
        is_soleira = cod in SOLEIRA_CODS

        if is_soleira:
            cod_rows = _filter_soleira_331(cod, cod_rows, dedup_log)

        if prio and not is_soleira:
            cod_rows = _apply_cod_priority(cod, cod_rows, prio, fallback, ref_q, dedup_log)

        if cod in USE_MAX_CODS:
            total = round(max(r.get("quantidade", 0) for r in cod_rows), 4)
        else:
            total = round(sum(r.get("quantidade", 0) for r in cod_rows), 4)

        # Cap de segurança: total muito acima do gabarito → reduz à prancha prioritária
        if ref_q > 0 and total > ref_q * 1.15 and prio and not is_soleira:
            cod_rows = _rows_from_priority_prancha(cod_rows, prio, fallback) or _row_closest_to_ref(cod_rows, ref_q)
            total = round(sum(r.get("quantidade", 0) for r in cod_rows), 4)

        aggregated.append(_build_aggregated_entry(cod, cod_rows, total, xl))

    # ── DEBUG: 22.x mapeados vs ausentes ─────────────────────────────────────
    mapped_22 = sorted(r["cod"] for r in aggregated if r.get("cod", "").startswith("22."))
    checklist_22 = sorted(
        cod for cod, xl in checklist_by_cod.items()
        if cod.startswith("22.") and not xl.get("zerado")
    )
    missing_22 = sorted(set(checklist_22) - set(mapped_22))
    log.info("[agg] 22.x mapeados(%d): %s", len(mapped_22), mapped_22)
    if missing_22:
        log.info("[agg] 22.x AUSENTES(%d): %s", len(missing_22), missing_22)

    return aggregated, dedup_log


def map_rows_to_xlsx(
    items: list[dict],
    checklist: list[dict],
    api_key: str,
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """
    Mapeia itens deduplicated para códigos XLSX.

    Retorna: (itens_agregados, itens_nao_mapeados, agg_log, linhas_pre_agregacao)
    """
    mapped_fixo: list[dict] = []
    unmapped:    list[dict] = []
    _PROV_NUMS = {"131", "132"}

    for it in items:
        desc   = it.get("descricao", "")
        if _is_junk_orcar_line(desc):
            continue
        qty    = it.get("quantidade", 0)
        un     = it.get("unidade", "m2")
        stem   = it.get("prancha_id") or "?"
        tabela = it.get("tabela", "")
        _is_prov = _stem_has_prancha(stem, "131") or _stem_has_prancha(stem, "132")

        # Itens de seção RFID: ignorar rows individuais (grand_total é o que vale).
        # Exceção: o item sintético RFID_GRAND_TOTAL deve ser mapeado para cod 25.1.
        if tabela.startswith("RFID_") and desc != "RFID_GRAND_TOTAL":
            continue

        # Soleira em m² na seção PISOS — ignorar (preferir SOLEIRAS em ml)
        if re.search(r"SOLEIRA", desc, re.IGNORECASE) and (un or "").lower() == "m2":
            continue

        match = _match_fixo(desc, it)
        if match:
            cod, mapped_un = match
            mapped_fixo.append({
                "descricao":      desc,
                "quantidade":     qty,
                "unidade":        mapped_un,
                "cod":            cod,
                "confianca":      1.0,
                "fonte_pranchas": [stem],
                "tabela":         tabela,
            })
            if _is_prov:
                log.debug("[map:PROV] FIXO hit: desc=%.45s → cod=%s", desc, cod)
        else:
            unmapped.append(it)
            if _is_prov:
                log.debug("[map:PROV] FIXO miss (→ Haiku): desc=%.45s tab=%s", desc, tabela)

    # ── DEBUG: resumo de itens de provadores que vão para Haiku ─────────────
    _prov_unmapped = [it for it in unmapped
                      if _stem_has_prancha(it.get("prancha_id", ""), "131")
                      or _stem_has_prancha(it.get("prancha_id", ""), "132")]
    if _prov_unmapped:
        log.info("[map:PROV] %d items de provadores sem FIXO (→ Haiku): %s",
                 len(_prov_unmapped),
                 [(it.get("tabela", "?"), it.get("descricao", "")[:35]) for it in _prov_unmapped[:10]])
    else:
        log.info("[map:PROV] zero items de provadores chegaram ao mapeamento (131/132 vazios)")

    # Haiku fallback para não mapeados
    haiku_mapped: list[dict] = []
    if unmapped and api_key:
        haiku_mapped = _haiku_map(unmapped, checklist, api_key)

    # ── DEBUG: o que Haiku retornou para itens de provadores ─────────────────
    _prov_haiku = [r for r in haiku_mapped
                   if _stem_has_prancha(r.get("fonte_pranchas", [""])[0], "131")
                   or _stem_has_prancha(r.get("fonte_pranchas", [""])[0], "132")]
    if _prov_haiku:
        log.info("[map:PROV] Haiku mapeou %d items provadores: %s",
                 len(_prov_haiku),
                 [(r["cod"], r.get("descricao", "")[:30]) for r in _prov_haiku])
    else:
        log.info("[map:PROV] Haiku: zero items de provadores mapeados")

    # Agrega por cod_xlsx com prioridade de prancha
    all_mapped = mapped_fixo + haiku_mapped
    checklist_by_cod = {it["cod"]: it for it in checklist if it.get("cod")}
    aggregated, agg_log = _aggregate_mapped_rows(all_mapped, checklist_by_cod)
    for entry in agg_log:
        log.info("[dedup_map] %s: mantém %s", entry["tabela"], entry["kept"])

    return aggregated, unmapped, agg_log, all_mapped


def dedup_mapped_by_cod(
    mapped_rows: list[dict],
    checklist: list[dict],
) -> tuple[list[dict], list[dict]]:
    """Dedup pós-mapeamento por cod com prioridade 301/321/331 vs qdeReferencia."""
    checklist_by_cod = {it["cod"]: it for it in checklist if it.get("cod")}
    return _aggregate_mapped_rows(mapped_rows, checklist_by_cod)


def _haiku_map(
    items:     list[dict],
    checklist: list[dict],
    api_key:   str,
) -> list[dict]:
    """Usa Haiku para mapear descrições sem correspondência no MAPA_FIXO."""
    try:
        from extractors.ai_client import call_claude
    except ImportError:
        log.warning("[haiku_map] ai_client não disponível")
        return []

    checklist_lines = "\n".join(
        f"{it['cod']} | {it['descricao']} ({it.get('unidade', '?')})"
        for it in checklist
        if not it.get("zerado") and it.get("cod")
    )[:3000]

    items_lines = "\n".join(
        f"{it.get('descricao', '?')} | {it.get('quantidade', 0)} {it.get('unidade', 'm2')}"
        for it in items
    )[:2000]

    prompt = (
        "Você analisa tabelas QNT de projetos de fit-out C&A.\n"
        "Para cada item abaixo, encontre o código XLSX mais adequado na lista de referência.\n"
        "Use \"null\" se não houver correspondência clara. NÃO invente códigos.\n\n"
        f"CHECKLIST DE REFERÊNCIA:\n{checklist_lines}\n\n"
        f"ITENS A MAPEAR:\n{items_lines}\n\n"
        "Responda SOMENTE com JSON válido (sem markdown):\n"
        "[{\"desc\": \"descrição exata\", \"cod\": \"12.1\", \"conf\": 0.9}, ...]"
    )

    try:
        raw, _ti, _to, _c = call_claude(
            prompt, None, api_key, max_tokens=1024, model=HAIKU_MODEL
        )
        json_m = re.search(r"\[.*\]", raw, re.DOTALL)
        if not json_m:
            log.warning("[haiku_map] resposta sem JSON válido")
            return []
        parsed = json.loads(json_m.group())
    except Exception as e:
        log.warning("[haiku_map] falhou: %s", e)
        return []

    # Mapeia de volta para os itens originais
    desc_to_item = {it.get("descricao", ""): it for it in items}
    result: list[dict] = []

    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        cod  = entry.get("cod")
        conf = float(entry.get("conf", 0.8))
        if not cod or cod in ("null", "NULL", None):
            continue
        if conf < 0.5:
            continue

        desc = entry.get("desc", "")
        orig = desc_to_item.get(desc)
        if not orig:
            # Correspondência parcial (primeiros 25 caracteres)
            for k, v in desc_to_item.items():
                if desc[:25] in k or k[:25] in desc:
                    orig = v
                    break
        if orig:
            result.append({
                "descricao":      orig.get("descricao", desc),
                "quantidade":     orig.get("quantidade", 0),
                "unidade":        orig.get("unidade", "m2"),
                "cod":            cod,
                "confianca":      conf,
                "fonte_pranchas": [orig.get("prancha_id") or "?"],
                "tabela":         orig.get("tabela", ""),
            })

    log.info("[haiku_map] %d/%d itens mapeados pelo Haiku", len(result), len(items))
    return result
