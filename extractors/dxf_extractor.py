# -*- coding: utf-8 -*-
"""
dxf_extractor.py — extração de camadas, blocos, cotas e textos de arquivos DXF.

Retorna um dict com:
  ok               bool         — leitura bem-sucedida
  layers           list[str]    — layers únicas (até 200 para processamento)
  dims             list[float]  — cotas únicas ordenadas (até 100)
  blocks           dict         — nome → contagem (top 50 por uso)
  texts            list[str]    — textos únicos de TEXT/MTEXT (até 100)
  errors           list[str]    — erros capturados

  — campos de debug (dados completos, sem truncação) —
  all_layers       list[str]    — TODAS as layers encontradas
  all_dims         list[float]  — TODAS as cotas únicas
  all_blocks       dict         — TODOS os blocos com contagem
  all_texts        list[str]    — TODOS os textos únicos
  counts           dict         — totais antes da truncação
"""

import re
import logging
from collections import defaultdict

log = logging.getLogger("extractor")


def extract_dxf(path: str) -> dict:
    r: dict = {
        "ok": False,
        "layers": [], "dims": [], "blocks": {}, "texts": [],
        # debug — dados completos
        "all_layers": [], "all_dims": [], "all_blocks": {}, "all_texts": [],
        "counts": {"layers": 0, "dims": 0, "blocks": 0, "texts": 0},
        "errors": [],
    }
    try:
        lines = None
        for enc in ("utf-8", "cp1252", "latin-1"):
            try:
                with open(path, "r", encoding=enc, errors="replace") as f:
                    lines = f.readlines()
                log.debug("[dxf] Aberto com encoding %s (%d linhas)", enc, len(lines))
                break
            except Exception as e:
                log.warning("[dxf] Falha com encoding %s: %s", enc, e)

        if lines is None:
            r["errors"].append("Falha ao abrir DXF com todos os encodings tentados")
            return r

        all_layers   = set()
        block_counts = defaultdict(int)
        dims_raw: list[float] = []
        texts_raw: list[str]  = []

        n = len(lines)
        i = 0
        current_entity = None
        pending_text   = None

        while i < n - 1:
            code_raw  = lines[i].strip()
            value_raw = lines[i + 1].strip()
            i += 2
            if not code_raw.lstrip("-").isdigit():
                continue
            code = int(code_raw)

            if code == 0:
                # Flush texto pendente do MTEXT anterior
                if pending_text and len(pending_text) > 1:
                    clean = re.sub(r"\\[A-Za-z][^;]*;|[{}]", "", pending_text).strip()
                    if clean and len(clean) > 2:
                        texts_raw.append(clean[:200])
                pending_text   = None
                current_entity = value_raw.upper()

            elif code == 8:
                # Layer da entidade atual
                val = value_raw.strip()
                if val and val != "0":
                    all_layers.add(val)

            elif code == 2 and current_entity == "INSERT":
                # Nome do bloco inserido
                block_counts[value_raw] += 1

            elif code == 1 and current_entity in ("TEXT", "MTEXT"):
                pending_text = value_raw

            elif code == 42 and current_entity == "DIMENSION":
                try:
                    dims_raw.append(round(float(value_raw), 3))
                except ValueError:
                    pass

        # Flush final
        if pending_text and len(pending_text) > 1:
            clean = re.sub(r"\\[A-Za-z][^;]*;|[{}]", "", pending_text).strip()
            if clean and len(clean) > 2:
                texts_raw.append(clean[:200])

        # ── Dados completos para debug ──────────────────────────────────────────
        all_dims_unique  = sorted(set(dims_raw))
        all_texts_unique = list(dict.fromkeys(texts_raw))
        all_layers_sorted = sorted(all_layers)
        all_blocks_sorted = dict(sorted(block_counts.items(), key=lambda x: -x[1]))

        r["counts"] = {
            "layers": len(all_layers),
            "dims":   len(all_dims_unique),
            "blocks": len(block_counts),
            "texts":  len(all_texts_unique),
        }

        r["all_layers"] = all_layers_sorted
        r["all_dims"]   = all_dims_unique
        r["all_texts"]  = all_texts_unique
        r["all_blocks"] = all_blocks_sorted

        # ── Dados truncados para processamento (score, context_builder) ─────────
        r["layers"] = all_layers_sorted[:200]
        r["dims"]   = all_dims_unique[:100]
        r["texts"]  = all_texts_unique[:100]
        r["blocks"] = dict(list(all_blocks_sorted.items())[:50])

        r["ok"] = True

        log.info(
            "[dxf] %s — %d layers | %d dims | %d blocos | %d textos",
            path, r["counts"]["layers"], r["counts"]["dims"],
            r["counts"]["blocks"], r["counts"]["texts"],
        )

    except Exception as e:
        r["errors"].append(str(e))
        log.error("[dxf] Erro ao processar %s: %s", path, e)

    return r
