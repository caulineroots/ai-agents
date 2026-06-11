# -*- coding: utf-8 -*-
"""
dwg_convert.py — converte DWG -> DXF na ingestão (ezdxf não lê DWG nativamente).

Tenta, em ordem: LibreDWG `dwg2dxf`, depois ODA File Converter. Faz cache do .dxf
ao lado do .dwg. Falha graciosamente (retorna None) quando nenhum conversor existe
— nesse caso a camada de geometria fica indisponível e o item cai para stated/manual.
Ver docs/arquitetura/02-ingestao.md (decisão #2).
"""

import os
import shutil
import logging
import subprocess
import tempfile

log = logging.getLogger("extractor")


def _has(tool: str) -> bool:
    return shutil.which(tool) is not None


def convert_dwg_to_dxf(dwg_path: str, out_path: str | None = None,
                       cache: bool = True) -> str | None:
    """Converte um .dwg para .dxf. Retorna o caminho do .dxf ou None se falhar."""
    if not os.path.isfile(dwg_path):
        return None
    if out_path is None:
        out_path = os.path.splitext(dwg_path)[0] + ".dxf"

    if cache and os.path.isfile(out_path) and \
            os.path.getmtime(out_path) >= os.path.getmtime(dwg_path):
        return out_path

    # 1) LibreDWG dwg2dxf
    if _has("dwg2dxf"):
        try:
            subprocess.run(["dwg2dxf", "-o", out_path, dwg_path],
                           check=True, capture_output=True, timeout=180)
            if os.path.isfile(out_path) and os.path.getsize(out_path) > 0:
                log.info("[dwg2dxf] %s -> %s", os.path.basename(dwg_path), os.path.basename(out_path))
                return out_path
        except Exception as e:
            log.warning("[dwg2dxf] falhou em %s: %s", os.path.basename(dwg_path), e)

    # 2) ODA File Converter (headless, converte pasta inteira)
    oda = next((t for t in ("ODAFileConverter",
                "/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter")
                if _has(t) or os.path.exists(t)), None)
    if oda:
        try:
            with tempfile.TemporaryDirectory() as tin, tempfile.TemporaryDirectory() as tout:
                shutil.copy(dwg_path, tin)
                subprocess.run([oda, tin, tout, "ACAD2018", "DXF", "0", "1"],
                               check=True, capture_output=True, timeout=240)
                produced = os.path.join(tout, os.path.splitext(os.path.basename(dwg_path))[0] + ".dxf")
                if os.path.isfile(produced):
                    shutil.move(produced, out_path)
                    log.info("[ODA] %s -> %s", os.path.basename(dwg_path), os.path.basename(out_path))
                    return out_path
        except Exception as e:
            log.warning("[ODA] falhou em %s: %s", os.path.basename(dwg_path), e)

    log.warning("[dwg_convert] nenhum conversor DWG->DXF disponível para %s",
                os.path.basename(dwg_path))
    return None


def converter_available() -> bool:
    return _has("dwg2dxf") or _has("ODAFileConverter") or \
        os.path.exists("/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter")
