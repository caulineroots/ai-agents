# -*- coding: utf-8 -*-
"""
medidor.py — Fase 2 (camada determinística): resolve a medida de um item a
partir das quantidades JÁ TABELADAS no PDF (camada 'stated').

Esta é a pré-passagem rápida e testável. O caso semântico difícil
(desambiguação por ambiente, decidir se uma linha = soma de várias linhas do PDF)
é do agente LLM em medidor_agent.py. Aqui somos CONSERVADORES: só devolvemos uma
medida com confiança alta quando o casamento é nítido; senão deixamos para o
agente/humano (um número errado é pior que 'manual').

Provenance: toda medida carrega metodo='stated' + fonte citada.
Ver docs/arquitetura/04-medicao.md.
"""

import re
import logging
import unicodedata

from extractors.classifier import normalize_unit

log = logging.getLogger("extractor")

# Palavras de PROCESSO (não ajudam a identificar o material) — removidas dos tokens.
_PROCESS_STOP = {
    "assentamento", "aplicacao", "execucao", "montagem", "instalacao",
    "fornecimento", "fornecido", "fornecida", "fornecidas", "material",
    "obra", "incluindo", "demais", "apenas", "para", "com", "sobre",
    "tipo", "conforme", "padrao", "inclusive", "completo", "completa",
}

# Unidades consideradas equivalentes para fins de medição.
_UNIT_GROUP = {"m": "linear", "ml": "linear", "m2": "area", "m3": "volume",
               "un": "count", "kg": "count"}

_MIN_SHARED = 2          # tokens significativos em comum mínimos para um match
_RE_AREA = re.compile(r"A\s*=\s*([\d.,]+)\s*m", re.IGNORECASE)


def _norm(desc: str) -> str:
    txt = unicodedata.normalize("NFKD", desc or "")
    txt = "".join(c for c in txt if not unicodedata.combining(c)).lower()
    txt = re.sub(r"\[[^\]]*\]", " ", txt)        # remove prefixos [PD=2.30m] etc.
    txt = re.sub(r"[^a-z0-9]+", " ", txt)
    return re.sub(r"\s+", " ", txt).strip()


def _content_tokens(desc: str) -> set[str]:
    return {t for t in _norm(desc).split() if len(t) >= 4 and t not in _PROCESS_STOP}


def _unit_compatible(line_unit: str, item_unit: str) -> bool:
    lu, iu = normalize_unit(line_unit), normalize_unit(item_unit)
    if not lu or not iu:
        return False
    return _UNIT_GROUP.get(lu, lu) == _UNIT_GROUP.get(iu, iu)


def read_area_tags(stem: str, pool: dict) -> list[float]:
    """Valores numéricos (m²) dos area tags de uma prancha."""
    ev = pool.get(stem)
    if not ev:
        return []
    vals: list[float] = []
    for tag in ev.get("area_tags", []):
        for m in _RE_AREA.finditer(str(tag)):
            try:
                vals.append(float(m.group(1).replace(".", "").replace(",", ".")
                                   if "," in m.group(1) else m.group(1)))
            except ValueError:
                pass
    return vals


def find_table_value(descricao: str, unidade: str, pool: dict,
                     candidatos: list[str] | None = None) -> dict | None:
    """Procura, nas tabelas do PDF, a quantidade do item descrito.

    Estratégia: casa por sobreposição de tokens (unidade compatível), agrupa os
    matches pela descrição normalizada do PDF — assim splits por altura ([PD=…])
    com a MESMA descrição somam, mas variantes distintas NÃO somam — e escolhe o
    grupo de maior pontuação. Devolve None quando não há match claro.
    """
    line_tokens = _content_tokens(descricao)
    if not line_tokens:
        return None

    def _collect(stems: list[str]) -> list[dict]:
        out: list[dict] = []
        for stem in stems:
            ev = pool.get(stem)
            if not ev:
                continue
            for it in ev.get("stated_items", []):
                q = it.get("quantidade")
                if q is None or not _unit_compatible(unidade, it.get("unidade", "")):
                    continue
                shared = line_tokens & _content_tokens(it.get("descricao", ""))
                if len(shared) >= _MIN_SHARED:
                    out.append({
                        "stem": stem, "descricao": it.get("descricao", ""),
                        "norm": _norm(it.get("descricao", "")),
                        "quantidade": float(q), "unidade": it.get("unidade", ""),
                        "score": len(shared),
                    })
        return out

    # Candidatos CONSTRANGEM a busca: se eles têm match, ignoramos o resto do pool
    # (evita casar a mesma material em prancha de outro ambiente). Só caímos para o
    # pool inteiro quando os candidatos não produzem nada.
    matches = _collect(list(candidatos or [])) or _collect(list(pool.keys()))
    if not matches:
        return None

    # Agrupa por (prancha, descrição normalizada): splits por altura ([PD=…]) na
    # MESMA prancha somam; a MESMA material em pranchas diferentes (ambientes
    # diferentes) NÃO soma entre si.
    groups: dict[tuple[str, str], dict] = {}
    for m in matches:
        key = (m["stem"], m["norm"])
        g = groups.setdefault(key, {"total": 0.0, "score": 0, "n": 0,
                                    "stem": m["stem"], "desc": m["descricao"],
                                    "unidade": m["unidade"]})
        g["total"] += m["quantidade"]
        g["score"] = max(g["score"], m["score"])
        g["n"] += 1

    ranked = sorted(groups.values(), key=lambda g: (g["score"], g["n"]), reverse=True)
    best = ranked[0]
    runner = ranked[1] if len(ranked) > 1 else None
    ambiguo = runner is not None and runner["score"] == best["score"]

    # confiança: nitidez do casamento; penaliza empate entre variantes distintas
    confianca = 85 if best["score"] >= 3 else 65
    if not ambiguo:
        confianca = min(95, confianca + 10)
    else:
        confianca = 45

    fonte = (f"PDF:{best['stem']} / tabela '{best['desc'][:48]}'"
             + (f" (soma de {best['n']} linhas)" if best["n"] > 1 else ""))
    out = {
        "valor": round(best["total"], 2),
        "unidade": normalize_unit(best["unidade"]) or best["unidade"],
        "fonte": fonte,
        "metodo": "stated",
        "confianca": confianca,
        "n_fontes": best["n"],
        "stems": [best["stem"]],
    }
    if ambiguo:
        out["nota"] = f"match ambíguo (empate com '{runner['desc'][:40]}')"
    return out


def medir_stated(item: dict, pool: dict) -> dict | None:
    """Resolve a medida do item pela camada stated. Retorna `medida` ou None.

    Só atua em itens que precisam de desenho e têm estratégia geométrica;
    LUMP_SUM/TIME/NOTA/INDEFINIDO não passam por aqui.
    """
    if not item.get("needs_drawing"):
        return None
    if item.get("estrategia") not in ("AREA", "LINEAR", "COUNT", "VOLUME"):
        return None
    return find_table_value(
        item.get("descricao", ""),
        item.get("unidade", "") or item.get("unidade_raw", ""),
        pool,
        item.get("candidatos"),
    )
