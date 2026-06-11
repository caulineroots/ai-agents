# -*- coding: utf-8 -*-
"""
dxf_extractor.py — extração de camadas, blocos, cotas e textos de arquivos DXF.
"""

import re
import logging
from collections import defaultdict

log = logging.getLogger("extractor")


def extract_dxf(path: str) -> dict:
    r = {"ok": False, "layers": [], "dims": [], "blocks": {}, "texts": [], "errors": []}
    try:
        lines = None
        for enc in ("utf-8", "cp1252", "latin-1"):
            try:
                with open(path, "r", encoding=enc, errors="replace") as f:
                    lines = f.readlines()
                break
            except Exception as e:
                log.warning("Falha ao abrir DXF com encoding %s: %s", enc, e)
                continue

        if lines is None:
            r["errors"].append("Falha ao abrir DXF com todos os encodings tentados")
            return r

        all_layers   = set()
        block_counts = defaultdict(int)
        dims         = []
        texts        = []
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
                if pending_text and len(pending_text) > 1:
                    clean = re.sub(r"\\[A-Za-z][^;]*;|[{}]", "", pending_text).strip()
                    if clean and len(clean) > 2:
                        texts.append(clean[:150])
                pending_text   = None
                current_entity = value_raw.upper()

            elif code == 8:
                val = value_raw.strip()
                if val and val != "0":
                    all_layers.add(val)

            elif code == 2 and current_entity == "INSERT":
                block_counts[value_raw] += 1

            elif code == 1 and current_entity in ("TEXT", "MTEXT"):
                pending_text = value_raw

            elif code == 42 and current_entity == "DIMENSION":
                try:
                    dims.append(round(float(value_raw), 3))
                except ValueError:
                    pass

        r["ok"]     = True
        r["layers"] = sorted(all_layers)
        r["dims"]   = sorted(set(dims))[:50]
        r["texts"]  = list(dict.fromkeys(texts))[:60]
        r["blocks"] = {
            k: v
            for k, v in sorted(block_counts.items(), key=lambda x: -x[1])[:30]
        }
    except Exception as e:
        r["errors"].append(str(e))
    return r
