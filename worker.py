# -*- coding: utf-8 -*-
"""
worker.py — worker de processamento de orçamentos (fila de jobs).

Faz polling no backend Next: reivindica o próximo job pendente, lê os arquivos da
pasta do job, roda o pipeline, escreve a planilha preenchida e reporta o resultado
(status/result) de volta pela API. NUNCA acessa o banco direto — só fala HTTP com o
Next, como na arquitetura combinada. Ver docs/arquitetura/.

Rodar:
  .venv/bin/python worker.py
Config (env / .env.local):
  ORCAMENTO_API_URL   (default http://localhost:3000)
  WORKER_POLL_SECONDS (default 3)
  ANTHROPIC_API_KEY   (para use_llm)
"""

import os
import sys
import time
import json
import glob
import logging
import traceback
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ANTHROPIC_KEY  # carrega .env.local
from extractors.pipeline import processar
from extractors.planilha_parser import parse_planilha
from extractors.writeback import escrever_planilha, relatorio_auditoria, lista_revisao
from extractors.dwg_convert import convert_dwg_to_dxf, converter_available

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("worker")

API = os.environ.get("ORCAMENTO_API_URL", "http://localhost:3000").rstrip("/")
POLL = float(os.environ.get("WORKER_POLL_SECONDS", "3"))
_JOBS = "/api/orcamento-construtora/jobs"


def _req(method: str, path: str, payload: dict | None = None, timeout: int = 30):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read()
        return json.loads(body) if body else None


def claim():
    return _req("POST", f"{_JOBS}/claim")


def patch(job_id: str, **fields):
    try:
        return _req("PATCH", f"{_JOBS}/{job_id}", fields)
    except Exception as e:
        log.warning("PATCH %s falhou: %s", job_id, e)
        return None


def _find_xlsx(dirpath: str) -> str | None:
    for p in glob.glob(os.path.join(dirpath, "*")):
        if p.lower().endswith((".xlsx", ".xlsm")):
            return p
    return None


def _group_drawings(dirpath: str) -> list[dict]:
    """Agrupa desenhos por stem -> {stem, pdf?, dxf?}; converte DWG->DXF."""
    grupos: dict[str, dict] = {}
    for p in sorted(glob.glob(os.path.join(dirpath, "*"))):
        ext = Path(p).suffix.lower()
        if ext not in (".pdf", ".dwg", ".dxf"):
            continue
        g = grupos.setdefault(Path(p).stem, {"stem": Path(p).stem})
        if ext == ".pdf":
            g["pdf"] = p
        elif ext == ".dxf":
            g["dxf"] = p
        elif ext == ".dwg":
            dxf = convert_dwg_to_dxf(p)
            if dxf:
                g["dxf"] = dxf
    return list(grupos.values())


def process_job(job: dict):
    jid = job["id"]
    dirpath = job["input_dir"]
    use_llm = bool(job.get("use_llm")) and bool(ANTHROPIC_KEY)
    log.info("Job %s: processando (%s) em %s", jid, "IA" if use_llm else "determinístico", dirpath)

    xlsx = _find_xlsx(dirpath)
    if not xlsx:
        patch(jid, status="failed", error="planilha .xlsx não encontrada na pasta do job")
        return

    sheets = _group_drawings(dirpath)

    state = {"last": 0.0}

    def prog(done, total, fase):
        now = time.time()
        if done == 0 or done >= total or now - state["last"] > 2.0:
            state["last"] = now
            patch(jid, progress=f"{fase} {done}/{total}" if total > 1 else fase)

    res = processar(xlsx, sheets, ANTHROPIC_KEY, use_llm=use_llm, progress_cb=prog)
    if not res.get("ok"):
        patch(jid, status="failed", error="; ".join(res.get("erros", [])) or "falha no pipeline")
        return

    parsed = parse_planilha(xlsx)
    out = os.path.join(dirpath, "preenchida.xlsx")
    wb = escrever_planilha(xlsx, res["itens"], out, parsed["col_map"])

    result = {
        "resumo": res["resumo"],
        "relatorio": relatorio_auditoria(res["itens"]),
        "work_list": lista_revisao(res["itens"]),
        "writeback": {k: v for k, v in wb.items() if k != "out_path"},
        "n_pranchas": len(sheets),
        "use_llm": use_llm,
    }
    patch(jid, status="completed", progress="concluído", result=result)
    log.info("Job %s: concluído | %s | R$ %.2f", jid,
             res["resumo"]["por_status"], res["resumo"]["total_orcado"])


def main():
    log.info("worker iniciado | API=%s | poll=%.1fs | DWG converter=%s | IA=%s",
             API, POLL, converter_available(), bool(ANTHROPIC_KEY))
    while True:
        try:
            job = claim()
        except urllib.error.URLError as e:
            log.warning("backend indisponível (%s) — retry em %.0fs", e, POLL)
            time.sleep(POLL)
            continue
        except Exception as e:
            log.warning("erro ao reivindicar job: %s", e)
            time.sleep(POLL)
            continue

        if not job:
            time.sleep(POLL)
            continue

        jid = job.get("id")
        try:
            process_job(job)
        except Exception as e:
            log.error("Job %s falhou: %s\n%s", jid, e, traceback.format_exc())
            if jid:
                patch(jid, status="failed", error=str(e))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("worker encerrado")
