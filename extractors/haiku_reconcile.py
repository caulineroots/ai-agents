# -*- coding: utf-8 -*-
"""
haiku_reconcile.py — auditoria Haiku pós-orçamento para duplicatas e qty sugeridas.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

log = logging.getLogger("extractor")

HAIKU_MODEL = "claude-haiku-4-5"
WATCHLIST_BLN = (
    "18.3", "18.4", "18.5", "18.8", "18.10", "18.11",
    "15.1", "13.1", "12.11", "14.19", "14.8", "12.1", "12.2",
)


def compact_payload(
    obra: str,
    checklist: list[dict],
    itens_agregados: list[dict],
    dedup_log: list[dict],
    linhas_pre: list[dict],
) -> dict[str, Any]:
    """Compacta payload para contexto Haiku."""
    cods_present = {it.get("cod") for it in itens_agregados if it.get("cod")}
    checklist_ref = [
        {
            "cod": it["cod"],
            "qdeReferencia": it.get("qdeReferencia"),
            "unidade": it.get("unidade"),
        }
        for it in checklist
        if it.get("cod") and (it["cod"] in cods_present or it["cod"] in WATCHLIST_BLN)
    ]

    linhas: list[str] = []
    for i, row in enumerate(linhas_pre[:500]):
        stem = (row.get("fonte_pranchas") or ["?"])[0]
        pr = re.search(r"-(\d{3})-", stem)
        pr_num = pr.group(1) if pr else "?"
        linhas.append(
            f"L{i+1:03d} | R{pr_num} | {row.get('tabela', '?')} | "
            f"{row.get('quantidade', 0)} {row.get('unidade', '?')} | "
            f"{row.get('cod', '?')} | {(row.get('descricao') or '')[:80]}"
        )

    return {
        "obra": obra,
        "checklist_ref": checklist_ref,
        "itens_agregados": itens_agregados,
        "dedup_log": dedup_log[:100],
        "linhas_compactas": "\n".join(linhas),
        "n_linhas": len(linhas_pre),
    }


def build_reconcile_prompt(payload: dict[str, Any]) -> str:
    checklist_lines = "\n".join(
        f"{c['cod']} | ref {c.get('qdeReferencia')} {c.get('unidade', '')}"
        for c in payload.get("checklist_ref", [])
    )
    agregados = json.dumps(payload.get("itens_agregados", []), ensure_ascii=False)[:6000]
    dedup_log = json.dumps(payload.get("dedup_log", []), ensure_ascii=False)[:3000]

    return f"""Você é engenheiro de orçamento de fit-out C&A (projeto BLN).
Analise duplicatas e supercontagens entre pranchas. NÃO invente quantidades —
use APENAS as linhas fornecidas.

## Regras BLN (pranchas autoritativas R03)
- Vendas pintura/paredes: R03-301
- ADM pintura: R03-305 ou R03-309 (não somar com 301 para o mesmo cod ADM)
- Forros execução: R03-321
- Pisos/soleiras/rodapés: R03-331
- Portas/alçapão: preferir QUADRO DE PORTAS em R03-301 sobre R02/R03-306
- Soleira: usar ml da seção SOLEIRAS; ignorar soleira em m² na seção PISOS
- Mapeamento pintura:
  - BRANCO GELO sobre parede → 18.3 (vendas) ou 18.5 (ADM)
  - SEMI-BRILHO/ACARTONADO em gesso → 18.10 (vendas) ou 18.11 (ADM)
  - Não classificar acartonado como 18.3/18.5

## Duplicata típica
- Mesma tabela QNT PINTURA/PAREDES/PISOS repetida em 301, 305, 309, 312
- Mesmo cod somado de pranchas diferentes
- ml + m² da mesma soleira

## Entrada
OBRA: {payload.get('obra', '')}

### Referência gabarito (qdeReferencia)
{checklist_lines}

### Resultado determinístico agregado (pode estar errado)
{agregados}

### Log dedup determinístico
{dedup_log}

### Linhas extraídas (pré-agregação) — fonte da verdade para qty
{payload.get('linhas_compactas', '')}

## Tarefa
1. Liste duplicatas estruturais (mesma tabela lógica em múltiplas pranchas).
2. Para cada cod onde qty agregada diverge >15% do qdeReferencia OU há duplicata clara,
   sugira qty_sugerida somando SOMENTE linhas_manter.
3. confianca: 0.0–1.0 (1.0 = regra BLN clara; <0.7 = incerto — diga na observação).
4. NÃO altere códigos. NÃO crie linhas novas.

Watchlist: {', '.join(WATCHLIST_BLN)}

Responda SOMENTE JSON válido (sem markdown):
{{
  "duplicatas": [
    {{
      "tipo": "tabela_repetida|soleira_ml_m2|portas_duplas|mapeamento_errado",
      "descricao": "string",
      "pranchas_envolvidas": ["301","305"],
      "cods_afetados": ["18.5","18.10"]
    }}
  ],
  "cods_revisados": [
    {{
      "cod": "18.5",
      "qty_deterministico": 0,
      "qty_sugerida": 0,
      "unidade": "m2",
      "confianca": 0.9,
      "motivo": "string",
      "linhas_manter": ["L012","L045"],
      "linhas_descartar": ["L013","L046"]
    }}
  ],
  "observacoes": ["string"]
}}"""


def parse_reconcile_response(raw: str) -> dict[str, Any]:
    """Valida e normaliza resposta JSON do Haiku."""
    json_m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not json_m:
        raise ValueError("Resposta Haiku sem JSON")
    data = json.loads(json_m.group())
    if not isinstance(data, dict):
        raise ValueError("JSON raiz deve ser objeto")

    duplicatas = data.get("duplicatas") or []
    cods = data.get("cods_revisados") or []
    observacoes = data.get("observacoes") or []

    if not isinstance(duplicatas, list):
        duplicatas = []
    if not isinstance(cods, list):
        cods = []
    if not isinstance(observacoes, list):
        observacoes = []

    normalized_cods = []
    for entry in cods:
        if not isinstance(entry, dict) or not entry.get("cod"):
            continue
        normalized_cods.append({
            "cod":               str(entry["cod"]),
            "qty_deterministico": float(entry.get("qty_deterministico") or 0),
            "qty_sugerida":      float(entry.get("qty_sugerida") or 0),
            "unidade":           str(entry.get("unidade") or "m2"),
            "confianca":         float(entry.get("confianca") or 0.5),
            "motivo":            str(entry.get("motivo") or ""),
            "linhas_manter":     list(entry.get("linhas_manter") or []),
            "linhas_descartar":  list(entry.get("linhas_descartar") or []),
        })

    return {
        "duplicatas":    duplicatas,
        "cods_revisados": normalized_cods,
        "observacoes":   observacoes,
    }


def reconcile_with_haiku(payload: dict[str, Any], api_key: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Chama Haiku e retorna (resultado, metadata tokens)."""
    from extractors.ai_client import call_claude

    prompt = build_reconcile_prompt(payload)
    raw, ti, to, custo = call_claude(
        prompt, None, api_key, max_tokens=4096, model=HAIKU_MODEL,
    )
    parsed = parse_reconcile_response(raw)
    metadata = {
        "tokens_input":  ti,
        "tokens_output": to,
        "custo_usd":     round(custo, 6),
    }
    log.info(
        "[haiku_reconcile] %d duplicatas, %d cods revisados | tokens in=%d out=%d",
        len(parsed["duplicatas"]), len(parsed["cods_revisados"]), ti, to,
    )
    return parsed, metadata
