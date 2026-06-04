# -*- coding: utf-8 -*-
"""
context_builder.py — monta contexto textual a partir dos dados extraídos do PDF/DXF,
constrói o prompt para Claude e classifica a prancha por score.
"""

import re
import json


def classify_prancha(pdf: dict, dxf: dict) -> str:
    score = 0
    if pdf["ok"]:
        score += len(pdf["cea_qnt_tables"]) * 4
        if pdf["quadro_acabamentos"]:
            score += 3
        if len(pdf["measure_lines"]) >= 10:
            score += min(len(pdf["measure_lines"]) // 10, 3)
        if pdf["area_tags"]:
            score += 1
    if dxf["ok"]:
        if len(dxf["dims"]) >= 20:
            score += min(len(dxf["dims"]) // 20, 3)
        if len(dxf["blocks"]) >= 10:
            score += min(len(dxf["blocks"]) // 10, 2)
        if len(dxf["layers"]) >= 20:
            score += 1
    if score >= 6:
        return "DIRETO"
    if score >= 3:
        return "IA_AUDITORIA"
    return "IA_NECESSARIA"


def build_context(stem: str, pdf: dict, dxf: dict) -> str:
    parts = [f"PRANCHA: {stem}"]

    if pdf["ok"] and pdf["cea_qnt_tables"]:
        parts.append("\n[TABELAS CEA-QNT — quantitativos oficiais do projeto]")
        for t in pdf["cea_qnt_tables"][:4]:
            for row in t[:10]:
                cleaned = [c[:50] for c in row if c]
                if cleaned:
                    parts.append("  " + " | ".join(cleaned))

    if pdf["ok"] and pdf["quadro_acabamentos"]:
        parts.append("\n[QUADRO DE ACABAMENTOS]")
        for t in pdf["quadro_acabamentos"][:2]:
            for row in t[:12]:
                cleaned = [c[:50] for c in row if c]
                if cleaned:
                    parts.append("  " + " | ".join(cleaned))

    if pdf["ok"] and pdf["area_tags"]:
        parts.append("\n[AREAS E DIMENSOES (PDF)]")
        for l in pdf["area_tags"][:10]:
            parts.append(f"  {l}")

    if pdf["ok"] and pdf["measure_lines"]:
        parts.append("\n[LINHAS COM MEDIDAS (PDF)]")
        for l in pdf["measure_lines"][:20]:
            parts.append(f"  {l}")

    if dxf["ok"]:
        if dxf["dims"]:
            parts.append(f"\n[COTAS DXF — {len(dxf['dims'])} dimensoes unicas]")
            parts.append("  " + ", ".join(str(d) for d in dxf["dims"][:30]))

        if dxf["blocks"]:
            parts.append("\n[FIXTURES/BLOCOS DXF — nome(quantidade)]")
            for name, cnt in list(dxf["blocks"].items())[:20]:
                clean = re.sub(r"\d{6,}-.*", "", name).strip()[:60]
                parts.append(f"  {clean}: {cnt}x")

        if dxf["layers"]:
            relevant = [
                l for l in dxf["layers"]
                if any(k in l.upper() for k in ("DOOR", "FLOR", "WALL", "CLNG", "ANNO", "DIMS", "AREA"))
            ]
            if relevant:
                parts.append("\n[LAYERS RELEVANTES DXF]")
                parts.append("  " + ", ".join(relevant[:20]))

        if dxf["texts"]:
            parts.append("\n[ANOTACOES/TEXTOS DXF]")
            for t in dxf["texts"][:15]:
                parts.append(f"  {t}")

    return "\n".join(parts)


def build_prompt(context_text: str, pdf_items: list[dict]) -> str:
    """
    Com itens PDF pre-extraidos, instrui a IA a COMPLEMENTAR — não re-extrair.
    """
    has_pdf_items = len(pdf_items) > 0

    if has_pdf_items:
        items_json = json.dumps(pdf_items, ensure_ascii=False, indent=2)
        task = f"""ITENS JA EXTRAIDOS DO PDF COM QUANTIDADES REAIS ({len(pdf_items)} itens):
{items_json}

TAREFA:
1. Esses itens acima ja tem quantidade confirmada do PDF — NAO os altere.
2. Olhe a imagem e identifique o que FALTA nessa lista.
3. Para cada item ausente, adicione com a quantidade que conseguir estimar.
4. Se uma quantidade do PDF parecer errada visualmente, registre como divergencia.
5. Retorne TODOS os itens: os do PDF (campo fonte="PDF") + os novos que voce identificou (fonte="IA")."""
    else:
        task = """TAREFA:
Extraia TODOS os itens que conseguir identificar para orcamento.
Use os dados estruturados abaixo como referencia para confirmar ou complementar.
Para cada item: use a quantidade mais precisa possivel. Se nao souber a quantidade, use status="aguardando" e quantidade=0."""

    return f"""Voce e um engenheiro orcamentista experiente analisando a prancha de projeto executivo de uma loja C&A (fit-out varejo).

DADOS ESTRUTURADOS EXTRAIDOS AUTOMATICAMENTE:
{context_text}

{task}

CATEGORIAS validas: civil | revestimento | pintura | marcenaria | vidros | eletrica | hidraulica | climatizacao | outro
UNIDADES validas: m2 | ml | un | m3 | vb | kg | hr
STATUS de cada item:
  "confirmado" = quantidade real do PDF ou visualmente clara
  "parcial"    = quantidade estimada, precisa confirmacao
  "aguardando" = item identificado mas impossivel quantificar

Responda SOMENTE com JSON valido (sem texto fora do JSON):

{{
  "projeto": "CEA-254-BLN",
  "cliente": "C&A",
  "itens": [
    {{
      "id": 1,
      "ambiente": "Copa",
      "descricao": "PINTURA ACRILICA FOSCA, COR BRANCO GELO",
      "categoria": "pintura",
      "unidade": "m2",
      "quantidade": 371.0,
      "confianca": 95,
      "fonte": "PDF",
      "status": "confirmado",
      "pendencias": []
    }}
  ],
  "divergencias": [],
  "erros_limitacoes": []
}}"""


PROMPT_NO_CONTEXT = """Voce e um engenheiro orcamentista analisando a prancha de projeto executivo de uma loja C&A (fit-out varejo).

Nao ha dados estruturados disponiveis para esta prancha (sem PDF ou DXF).
Extraia TUDO que conseguir identificar para orcamento apenas pela imagem.
Se nao souber a quantidade, use status="aguardando" e quantidade=0.

CATEGORIAS validas: civil | revestimento | pintura | marcenaria | vidros | eletrica | hidraulica | climatizacao | outro
UNIDADES validas: m2 | ml | un | m3 | vb | kg | hr

Responda SOMENTE com JSON valido:

{
  "projeto": "CEA-254-BLN",
  "cliente": "C&A",
  "itens": [...],
  "divergencias": [],
  "erros_limitacoes": [...]
}"""
