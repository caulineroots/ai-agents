# -*- coding: utf-8 -*-
"""
orcamento_pipeline_api.py — endpoints HTTP do fluxo scope-driven (planilha-driven).

Router separado do serviço legado de descoberta. Recebe a planilha inicial + os
desenhos, roda o pipeline (planilha → classificação → medição → verificação →
precificação → write-back) e devolve o resumo, o relatório de auditoria, a
work-list de revisão e a planilha preenchida (base64).
Ver docs/arquitetura/.
"""

import os
import base64
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from extractors.pipeline import processar
from extractors.planilha_parser import parse_planilha
from extractors.writeback import escrever_planilha, relatorio_auditoria, lista_revisao
from extractors.dwg_convert import convert_dwg_to_dxf, converter_available

log = logging.getLogger("extractor")
router = APIRouter(prefix="/orcamento", tags=["orcamento-planilha"])


def _agrupar_desenhos(paths: list[str]) -> list[dict]:
    """Agrupa desenhos por stem -> {stem, pdf?, dxf?}. Converte DWG->DXF se possível."""
    grupos: dict[str, dict] = {}
    for p in paths:
        stem = Path(p).stem
        ext = Path(p).suffix.lower()
        g = grupos.setdefault(stem, {"stem": stem})
        if ext == ".pdf":
            g["pdf"] = p
        elif ext == ".dxf":
            g["dxf"] = p
        elif ext == ".dwg":
            dxf = convert_dwg_to_dxf(p)
            if dxf:
                g["dxf"] = dxf
    return list(grupos.values())


@router.get("/health")
def health():
    return {"status": "ok", "dwg_converter": converter_available()}


@router.post("/processar")
async def processar_orcamento(
    planilha: UploadFile = File(...),
    desenhos: list[UploadFile] = File(default=[]),
    use_llm: str = Form("false"),
):
    """Roda o pipeline completo. Retorna resumo + auditoria + work-list + xlsx preenchido."""
    if not (planilha.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Envie a planilha como .xlsx")

    tmp = tempfile.mkdtemp(prefix="orc_")
    try:
        xlsx_path = os.path.join(tmp, os.path.basename(planilha.filename))
        with open(xlsx_path, "wb") as f:
            f.write(await planilha.read())

        desenho_paths: list[str] = []
        for up in desenhos:
            if not up.filename:
                continue
            dp = os.path.join(tmp, os.path.basename(up.filename))
            with open(dp, "wb") as f:
                f.write(await up.read())
            desenho_paths.append(dp)

        sheets = _agrupar_desenhos(desenho_paths)
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        usar_ia = str(use_llm).lower() in ("1", "true", "yes", "sim") and bool(api_key)

        log.info("[orcamento/processar] %s | %d desenhos | %d pranchas | use_llm=%s",
                 planilha.filename, len(desenho_paths), len(sheets), usar_ia)

        res = processar(xlsx_path, sheets, api_key=api_key, use_llm=usar_ia)
        if not res["ok"]:
            raise HTTPException(status_code=422, detail="; ".join(res.get("erros", [])))

        # write-back numa cópia + base64 para download
        parsed = parse_planilha(xlsx_path)
        out_path = os.path.join(tmp, "preenchida.xlsx")
        wb = escrever_planilha(xlsx_path, res["itens"], out_path, parsed["col_map"])
        xlsx_b64 = base64.b64encode(Path(out_path).read_bytes()).decode()

        return JSONResponse({
            "ok": True,
            "arquivo": planilha.filename,
            "n_pranchas": len(sheets),
            "use_llm": usar_ia,
            "resumo": res["resumo"],
            "relatorio": relatorio_auditoria(res["itens"]),
            "work_list": lista_revisao(res["itens"]),
            "writeback": {k: v for k, v in wb.items() if k != "out_path"},
            "planilha_preenchida_b64": xlsx_b64,
            "processado_em": datetime.now(timezone.utc).isoformat(),
        })
    finally:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)
