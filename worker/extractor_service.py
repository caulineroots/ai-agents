# -*- coding: utf-8 -*-
"""
extractor_service.py
FastAPI microservice do fluxo scope-driven (planilha-driven).

Monta os routers do pipeline (orcamento) e da aprendizagem de nomenclatura
(aprender), além de um endpoint utilitário para inspecionar o parsing da planilha.
O fluxo de descoberta antigo (extrair/ler-prancha/orquestrar/analisar-batch) foi
removido — ver docs/arquitetura/.

Uso:
  pip install -r requirements.txt
  uvicorn extractor_service:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import tempfile
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import MODEL
from extractors.planilha_parser import parse_planilha
from aprender import router as aprender_router
from orcamento_pipeline_api import router as orcamento_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("extractor")

app = FastAPI(title="Orçamento Construtora — Extractor Service", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(aprender_router)
app.include_router(orcamento_router)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}


@app.post("/parse-planilha")
async def parse_planilha_endpoint(planilha: UploadFile = File(...)):
    """
    Utilitário — lê a planilha orçamentária inicial (.xlsx) e retorna a lista de
    itens de linha (escopo do orçamento). Detecta o cabeçalho por conteúdo; sem IA.
    Ver docs/arquitetura/02-ingestao.md.
    """
    fname = planilha.filename or "planilha.xlsx"
    if not fname.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Envie um arquivo .xlsx")
    log.info("[parse-planilha] %s", fname)

    try:
        raw = await planilha.read()
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tf:
            tf.write(raw)
            tmp = tf.name
        res = parse_planilha(tmp)
        os.unlink(tmp)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler planilha: {e}")

    if not res["ok"]:
        raise HTTPException(
            status_code=422,
            detail="; ".join(res["erros"]) or "Cabeçalho de detalhe não encontrado na planilha",
        )

    res["arquivo"] = fname
    res["processado_em"] = datetime.now(timezone.utc).isoformat()
    return JSONResponse(res)
