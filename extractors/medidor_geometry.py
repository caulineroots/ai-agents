# -*- coding: utf-8 -*-
"""
medidor_geometry.py — Fase 2 (camada COMPUTED, agente LLM): resolve a medida de um
item calculando a geometria do DXF.

O LLM faz só a parte semântica — escolhe a CAMADA (área/comprimento) ou o BLOCO
(contagem) que corresponde ao item, a partir de um menu resumido. As ferramentas
determinísticas (extractors/geometry.py) calculam o número exato. metodo='computed'.
Cuidado: nomes de camada são genéricos (A-FLOR-PATT) — a área costuma ser o TOTAL
de um tipo de piso, não por acabamento; por isso é fallback do stated, sempre com
fonte citada. Ver docs/arquitetura/04-medicao.md.
"""

import logging

from extractors.ai_client import call_claude_json
from extractors.classifier import normalize_unit
from extractors.geometry import (
    load_dxf, layers_geometry_summary, count_blocks, compute_area, compute_length,
)

log = logging.getLogger("extractor")

_SCHEMA = {
    "type": "object",
    "properties": {
        "encontrado": {"type": "boolean"},
        "tipo": {"type": "string", "enum": ["area", "length", "count", "nenhum"]},
        "layer": {"type": ["string", "null"], "description": "camada (para area/length)"},
        "bloco": {"type": ["string", "null"],
                  "description": "nome (ou trecho distintivo) do bloco para contar"},
        "confianca": {"type": "integer", "minimum": 0, "maximum": 100},
        "raciocinio": {"type": "string"},
    },
    "required": ["encontrado", "tipo", "layer", "bloco", "confianca", "raciocinio"],
}

_PROMPT = """Você preenche um orçamento. Precisa MEDIR este item no desenho (DXF):
  descrição: {descricao}
  unidade:   {unidade}
  estratégia: {estrategia}   (AREA=m²  LINEAR=comprimento  COUNT=contagem)

MENU de camadas (com área/qtde de linhas) e de blocos disponíveis no DXF:

CAMADAS (área em m², nº de linhas/hatches):
{layers}

BLOCOS (nome do bloco = nº de inserções):
{blocks}

TAREFA: escolha COMO medir este item:
- COUNT  -> escolha o BLOCO cujo nome corresponde ao elemento (ex.: "PORTA", "Espelho
  do Provador", "ANTENA ANTI-FURTO", "BaciaSanitaria"). IGNORE blocos de anotação
  ("Marca de tipo", "TypeMark", "Eixo/SÍMBOLO GRID", "Elevações de ponto", "Paginação").
  Retorne em `bloco` um trecho distintivo do nome.
- AREA   -> escolha a CAMADA cuja área representa o item. ATENÇÃO: camadas de piso/parede
  costumam ser GENÉRICAS (ex.: A-FLOR-PATT = TODO o piso, somando TODOS os acabamentos).
  Só use AREA se o item for esse TOTAL; se o item é um acabamento específico (um piso entre
  vários, uma área pequena), encontrado=false — a tabela do PDF mede melhor.
- LINEAR -> escolha a CAMADA cujas linhas representam o comprimento (ex.: rodapé/perímetro).
Se nada corresponder com segurança, encontrado=false (melhor que um número errado).
"""


def _candidate_dxf_stems(item: dict, pool: dict) -> list[str]:
    cands = [s for s in (item.get("candidatos") or []) if pool.get(s, {}).get("dxf_path")]
    todos = [s for s, ev in pool.items() if ev.get("dxf_path")]
    return cands or todos


def resolver_item_computed_llm(item: dict, pool: dict, api_key: str,
                               max_sheets: int = 2) -> dict | None:
    """Resolve a medida pela geometria do DXF, com o LLM escolhendo camada/bloco."""
    if not item.get("needs_drawing") or item.get("estrategia") not in ("AREA", "LINEAR", "COUNT"):
        return None
    stems = _candidate_dxf_stems(item, pool)[:max_sheets]
    if not stems:
        return None

    item_unit = normalize_unit(item.get("unidade", "") or item.get("unidade_raw", ""))

    for stem in stems:
        path = pool[stem]["dxf_path"]
        try:
            doc = load_dxf(path)
        except Exception as e:
            log.warning("[geom] %s: load falhou: %s", stem, e)
            continue

        layers = layers_geometry_summary(doc, top=18)
        blocks = count_blocks(doc)["por_bloco"]
        blocks_top = sorted(blocks.items(), key=lambda x: -x[1])[:25]

        layers_txt = "\n".join(
            f"  {l['layer'][:28]:28} area={l['area_m2']:8.1f} m²  linhas={l['n_line']:4} hatch={l['n_hatch']:4}"
            for l in layers) or "  (nenhuma)"
        blocks_txt = "\n".join(f"  {c:4} × {nm[:54]}" for nm, c in blocks_top) or "  (nenhum)"

        prompt = _PROMPT.format(descricao=item.get("descricao", ""),
                                unidade=item_unit, estrategia=item.get("estrategia"),
                                layers=layers_txt, blocks=blocks_txt)
        try:
            obj, _i, _o, custo = call_claude_json(prompt, _SCHEMA, api_key)
        except Exception as e:
            log.warning("[geom] %s: LLM falhou: %s", stem, e)
            continue

        if not obj.get("encontrado") or obj.get("tipo") == "nenhum":
            continue

        tipo = obj["tipo"]
        try:
            if tipo == "count" and obj.get("bloco"):
                r = count_blocks(doc, pattern=obj["bloco"])
                valor, unidade, det = r["count"], "un", f"bloco '{obj['bloco']}'"
            elif tipo == "area" and obj.get("layer"):
                r = compute_area(doc, obj["layer"])
                valor, unidade, det = r["valor_m2"], "m2", f"camada '{obj['layer']}' (hatch/polígono)"
                # área de camada genérica é fallback impreciso -> sempre baixa confiança (revisar)
                obj["confianca"] = min(obj.get("confianca", 50), 40 if r["scale_confiavel"] else 30)
            elif tipo == "length" and obj.get("layer"):
                r = compute_length(doc, obj["layer"])
                valor, unidade, det = r["valor_m"], "m", f"camada '{obj['layer']}'"
                obj["confianca"] = min(obj.get("confianca", 50), 40 if r["scale_confiavel"] else 30)
            else:
                continue
        except Exception as e:
            log.warning("[geom] %s: cálculo falhou: %s", stem, e)
            continue

        if not valor or valor <= 0:
            continue
        return {
            "valor": round(float(valor), 2),
            "unidade": unidade,
            "fonte": f"DXF:{stem} / {det}",
            "metodo": "computed",
            "confianca": int(obj.get("confianca", 60)),
            "stems": [stem],
            "custo_usd": round(custo, 5),
        }
    return None
