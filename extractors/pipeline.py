# -*- coding: utf-8 -*-
"""
pipeline.py — orquestra o fluxo scope-driven completo:
  planilha -> classificação -> medição -> verificação -> precificação -> (write-back)

Determinístico por padrão (sem IA); com api_key+use_llm usa o resolver LLM da
camada stated. A camada computed (geometria) está pronta (extractors/geometry.py)
e é integrada quando há DXF + seleção de camada pelo agente (follow-up).
Ver docs/arquitetura/04-medicao.md e 05-verificacao-precificacao.md.
"""

import logging

from extractors.planilha_parser import parse_planilha
from extractors.classifier import classify_items, build_project_map
from extractors.evidence import build_evidence_pool
from extractors.medidor import medir_stated
from extractors.pricing import price_item, get_table

log = logging.getLogger("extractor")

_TOL = 0.05          # tolerância de divergência (decisão #3, configurável)
_CONF_MIN = 60       # abaixo disso, medida é "baixa confiança" (revisar)


def _medir(item: dict, pool: dict, api_key: str | None, use_llm: bool) -> dict | None:
    """Resolve a medida pela camada stated (det. ou LLM). None se não achar."""
    if use_llm and api_key:
        from extractors.medidor_agent import resolver_item_stated_llm
        return resolver_item_stated_llm(item, pool, api_key)
    return medir_stated(item, pool)


def verificar(item: dict, medida: dict | None, tol: float = _TOL) -> dict:
    """Aplica a Fase 3: define status, flags e a quantidade final do item."""
    flags: list[str] = []
    qde_ini = item.get("qde_inicial")
    estrategia = item.get("estrategia")

    if not item.get("needs_drawing"):
        if estrategia in ("LUMP_SUM",) or "FORA_ESCOPO" in item.get("class_flags", []):
            status = "lump_sum"
        elif estrategia == "TIME":
            status = "lump_sum"
        elif estrategia in ("NOTA",):
            status = "nota"
        else:
            status = "lump_sum"
        return {"status": status, "flags": flags, "qde_final": qde_ini, "medida": None}

    if medida is None:
        if qde_ini and qde_ini > 0:
            # planilha tem medida mas não conseguimos verificar -> confia na planilha
            return {"status": "confirmado", "flags": ["NAO_VERIFICADO"],
                    "qde_final": qde_ini, "medida": None}
        return {"status": "manual", "flags": ["NOT_FOUND"], "qde_final": None, "medida": None}

    # houve medida
    if medida.get("metodo") == "estimated":
        flags.append("ESTIMATED")
    if medida.get("confianca", 100) < _CONF_MIN:
        flags.append("LOW_CONFIDENCE")

    if qde_ini and qde_ini > 0:
        delta = abs(medida["valor"] - qde_ini) / qde_ini if qde_ini else 1.0
        if delta <= tol:
            return {"status": "confirmado", "flags": flags, "qde_final": qde_ini, "medida": medida}
        flags.append("QTY_MISMATCH")
        # política: mantém o valor da planilha; divergência sinalizada para humano
        return {"status": "divergente", "flags": flags, "qde_final": qde_ini,
                "medida": medida, "delta": round(delta, 3)}

    # planilha sem medida -> usa a medida encontrada
    return {"status": "encontrado", "flags": flags, "qde_final": medida["valor"], "medida": medida}


def processar(planilha_path: str, sheets: list[dict] | None = None,
              api_key: str | None = None, use_llm: bool = False) -> dict:
    """Roda o pipeline. `sheets`: [{stem, pdf?, dxf?}] para o pool de evidências."""
    parsed = parse_planilha(planilha_path)
    if not parsed["ok"]:
        return {"ok": False, "erros": parsed["erros"], "itens": []}

    pool = build_evidence_pool(sheets or [])
    project_map = build_project_map([s["stem"] for s in (sheets or [])])
    classified = classify_items(parsed["itens"], project_map=project_map)["itens"]

    table = get_table()
    itens_out: list[dict] = []
    for it in classified:
        medida = _medir(it, pool, api_key, use_llm)
        verif = verificar(it, medida)
        preco = None
        if verif["status"] not in ("nota",):
            preco = price_item(it, verif["qde_final"], table)

        rec = dict(it)
        rec.update({
            "medida": verif.get("medida"),
            "status": verif["status"],
            "flags": (it.get("class_flags", []) + verif["flags"]),
            "qde_final": verif["qde_final"],
            "preco": preco,
        })
        if "delta" in verif:
            rec["delta"] = verif["delta"]
        itens_out.append(rec)

    resumo = _resumir(itens_out)
    log.info("[pipeline] %s", resumo)
    return {"ok": True, "sheet": parsed["sheet"], "itens": itens_out, "resumo": resumo,
            "planilha_path": planilha_path}


def _resumir(itens: list[dict]) -> dict:
    por_status: dict[str, int] = {}
    n_flag_revisao = 0
    total_orcado = 0.0
    for it in itens:
        por_status[it["status"]] = por_status.get(it["status"], 0) + 1
        if any(f in it["flags"] for f in
               ("QTY_MISMATCH", "NOT_FOUND", "LOW_CONFIDENCE", "ESTIMATED", "PRECO_INCERTO")):
            n_flag_revisao += 1
        if it.get("preco") and it["preco"].get("total"):
            total_orcado += it["preco"]["total"]
    return {"n_itens": len(itens), "por_status": por_status,
            "n_para_revisao": n_flag_revisao, "total_orcado": round(total_orcado, 2)}
