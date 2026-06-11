# -*- coding: utf-8 -*-
"""
medidor_agent.py — Fase 2 (camada LLM, PRIMÁRIA da camada stated): resolve a
medida de um item de linha lendo as quantidades JÁ TABELADAS nas pranchas
candidatas, com julgamento semântico — desambigua por AMBIENTE (salão vs ADM vs
sanitários) e decide se a linha = uma linha do PDF, a SOMA de várias, ou nenhuma.

É o que o casamento determinístico (medidor.py) não consegue fazer com segurança.
Saída estruturada (tool-use), com provenance: metodo='stated' + fonte citada.
Ver docs/arquitetura/04-medicao.md.
"""

import logging

from extractors.ai_client import call_claude_json
from extractors.classifier import normalize_unit

log = logging.getLogger("extractor")

_SCHEMA = {
    "type": "object",
    "properties": {
        "encontrado": {"type": "boolean",
                       "description": "true se há correspondência tabelada para o item"},
        "valor": {"type": ["number", "null"], "description": "quantidade (somada se aplicável)"},
        "unidade": {"type": "string", "enum": ["m2", "ml", "m", "un", "m3", ""]},
        "linhas_usadas": {"type": "array", "items": {"type": "integer"},
                          "description": "índices das linhas tabeladas usadas"},
        "confianca": {"type": "integer", "minimum": 0, "maximum": 100},
        "raciocinio": {"type": "string", "description": "1 frase: por que essas linhas e não outras"},
    },
    "required": ["encontrado", "valor", "unidade", "linhas_usadas", "confianca", "raciocinio"],
}

_PROMPT = """Você preenche um orçamento de obra a partir de uma planilha do cliente.

ITEM DA PLANILHA (escopo fixo — não invente):
  descrição: {descricao}
  unidade:   {unidade}
  estratégia: {estrategia}

LINHAS JÁ TABELADAS NOS DESENHOS (com quantidade), candidatas a corresponder:
{linhas}

TAREFA: decida qual(is) dessas linhas correspondem a ESTE item e devolva a medida.
Regras:
- Linhas de SERVIÇO/MÃO DE OBRA ("assentamento", "aplicação", "execução", "montagem") têm a
  MESMA quantidade do material/elemento correspondente — ex.: "Assentamento de piso vinílico
  salão" usa a área da linha "PISO VINÍLICO ..." do salão. Não exija que as palavras batam: o
  que importa é ser o mesmo elemento físico/ambiente.
- Respeite o AMBIENTE: "salão de vendas/provadores" ≠ "ADM" ≠ "sanitários". Não misture ambientes.
- SOME apenas quando for o MESMO material/serviço dividido em várias linhas (ex.: forro
  por altura de pé-direito) no mesmo ambiente. NÃO some materiais distintos.
- A unidade da medida deve ser compatível com a unidade do item.
- Se NENHUMA linha corresponder com segurança, retorne encontrado=false (melhor que um número errado).
- linhas_usadas = índices (number à esquerda) das linhas que você somou/usou.
"""


def resolver_item_stated_llm(item: dict, pool: dict, api_key: str,
                             max_linhas: int = 300) -> dict | None:
    """Resolve a medida do item pela camada stated usando o LLM. None se não achar.

    As linhas das pranchas CANDIDATAS vêm primeiro (sobrevivem ao corte de
    max_linhas), depois o resto do pool — assim a desambiguação por ambiente do
    LLM funciona mesmo quando o ranking de candidatos é imperfeito. (Candidatos de
    melhor qualidade são tarefa do Project Mapper — ver docs/arquitetura.)
    """
    if not item.get("needs_drawing") or item.get("estrategia") not in (
            "AREA", "LINEAR", "COUNT", "VOLUME"):
        return None

    item_unit = normalize_unit(item.get("unidade", "") or item.get("unidade_raw", ""))

    cands = [s for s in (item.get("candidatos") or []) if s in pool]
    ordered = cands + [s for s in pool.keys() if s not in cands]   # candidatos primeiro

    linhas: list[dict] = []
    for stem in ordered:
        for it in pool[stem].get("stated_items", []):
            if it.get("quantidade") is None:
                continue
            linhas.append({"stem": stem, "descricao": it.get("descricao", ""),
                           "quantidade": it.get("quantidade"), "unidade": it.get("unidade", "")})
    if not linhas:
        return None
    linhas = linhas[:max_linhas]

    linhas_txt = "\n".join(
        f"  [{i}] {l['descricao'][:70]} = {l['quantidade']} {l['unidade']}  (prancha {l['stem'].split('-')[-1].strip()})"
        for i, l in enumerate(linhas)
    )
    prompt = _PROMPT.format(
        descricao=item.get("descricao", ""),
        unidade=item_unit or item.get("unidade_raw", ""),
        estrategia=item.get("estrategia", ""),
        linhas=linhas_txt,
    )

    try:
        obj, _tin, _tout, custo = call_claude_json(prompt, _SCHEMA, api_key)
    except Exception as e:
        log.warning("[medidor-llm] erro em '%s': %s", item.get("item"), e)
        return None

    if not obj.get("encontrado") or obj.get("valor") is None:
        return None

    usados = [linhas[i] for i in obj.get("linhas_usadas", []) if 0 <= i < len(linhas)]
    stems = sorted({l["stem"] for l in usados}) or [linhas[0]["stem"]]
    fonte = f"PDF:{stems[0]} / tabela (LLM: {obj.get('raciocinio','')[:60]})"
    return {
        "valor": round(float(obj["valor"]), 2),
        "unidade": obj.get("unidade") or item_unit,
        "fonte": fonte,
        "metodo": "stated",
        "confianca": int(obj.get("confianca", 70)),
        "n_fontes": len(usados),
        "stems": stems,
        "custo_usd": round(custo, 5),
    }
