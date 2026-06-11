# -*- coding: utf-8 -*-
"""
extractor_service.py
FastAPI microservice — extrai PDF+DXF, monta contexto e chama Claude (1 call).

Uso:
  pip install fastapi uvicorn pdfplumber anthropic pillow python-multipart
  uvicorn extractor_service:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import re
import json
import asyncio
import tempfile
import base64
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import BASE_DIR, ANTHROPIC_KEY, PDF_SUBDIR, DXF_SUBDIR, MODEL
from schemas import ExtractionResult, Metadata
from extractors.pdf_extractor import (
    extract_pdf, parse_cea_qnt_tables, extract_partial_items_from_text,
    parse_cea_qnt_from_text, parse_special_tables_from_text, classify_item_junk,
)
from extractors.planilha_parser import parse_planilha
from extractors.dxf_extractor import extract_dxf
from extractors.image_processor import compress_to_jpeg
from extractors.context_builder import classify_prancha, build_context, build_prompt, PROMPT_NO_CONTEXT
from extractors.ai_client import call_claude, call_claude_multi, parse_ai_json
from extractors.result_builder import build_items
from extractors.orchestrator import build_leitura_geral_prompt, build_orchestrator_prompt, build_batch_prompt
from aprender import router as aprender_router
from orcamento_pipeline_api import router as orcamento_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("extractor")

# BUG-8: Pranchas visuais sem tabelas de quantidades — skip extract_partial
# BUG-502-A: adicionado LAY\s+ÁREAS (ex: "502-LAY ÁREAS" não coberto por LAY[_\s]?OUT)
_RE_VISUAL_PRANCHA = re.compile(
    r"\b(CVS|COMUNICAÇÃO\s+VISUAL|VINHETE|AXONOM[EÉ]TRICA|CORTE\s+GERAL|"
    r"DET\.?\s+LOGO|LAY[_\s]?OUT|ÁREAS?\s+TOTAIS|LAYOUT|LAY\s+[ÁA]REAS?)\b",
    re.IGNORECASE,
)

# BUG-5: PDFs com QUADRO DE ACABAMENTOS mas sem CEA-QNT são pranchas de referência
# — não rodar extract_partial (evita lixo de elevações/cortes)

app = FastAPI(title="Extractor Service", version="2.0.0")
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


@app.get("/reparse/{stem}", response_model=ExtractionResult)
async def reparse(stem: str):
    """Carrega resultado já processado sem chamar a API novamente."""
    results_dir = Path(BASE_DIR).parent / "extractor_results"
    safe_stem = re.sub(r"[^\w\-]", "_", stem)[:80]
    result_path = results_dir / f"{safe_stem}.json"
    if not result_path.exists():
        raise HTTPException(status_code=404,
            detail=f"Resultado nao encontrado: {result_path}. Execute /extrair primeiro.")
    try:
        import json
        data = json.loads(result_path.read_text(encoding="utf-8"))
        return ExtractionResult(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar resultado: {e}")


def _score_prancha(pdf: dict, dxf: dict) -> int:
    """Replica o cálculo de score de classify_prancha para expor no debug."""
    score = 0
    if pdf["ok"]:
        score += len(pdf["cea_qnt_tables"]) * 4
        if pdf["quadro_acabamentos"]: score += 3
        if len(pdf["measure_lines"]) >= 10:
            score += min(len(pdf["measure_lines"]) // 10, 3)
        if pdf["area_tags"]: score += 1
    if dxf["ok"]:
        if len(dxf["dims"]) >= 20:
            score += min(len(dxf["dims"]) // 20, 3)
        if len(dxf["blocks"]) >= 10:
            score += min(len(dxf["blocks"]) // 10, 2)
        if len(dxf["layers"]) >= 20: score += 1
    return score


@app.post("/parse-planilha")
async def parse_planilha_endpoint(planilha: UploadFile = File(...)):
    """
    Fase 0a — lê a planilha orçamentária inicial (.xlsx) e retorna a lista de
    itens de linha (escopo do orçamento). Detecta o cabeçalho por conteúdo;
    não chama IA. Ver docs/arquitetura/02-ingestao.md.
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


@app.post("/extrair-codigo")
async def extrair_codigo(
    image: Optional[UploadFile] = File(None),
    pdf:   Optional[UploadFile] = File(None),
    dxf:   Optional[UploadFile] = File(None),
):
    """
    Extração programática pura — sem chamar IA.
    Recebe opcionalmente: image (PNG/JPG), pdf (PDF), dxf (DXF ou DWG).
    Retorna classificação, itens extraídos e debug detalhado.
    """
    stem = "prancha"
    for up in [image, pdf, dxf]:
        if up and up.filename:
            stem = Path(up.filename).stem
            break
    log.info("[extrair-codigo] Processando: %s", stem)

    _empty_pdf = {"ok": False, "cea_qnt_tables": [], "quadro_acabamentos": [],
                  "measure_lines": [], "area_tags": [], "errors": []}
    _empty_dxf = {"ok": False, "layers": [], "dims": [], "blocks": {}, "texts": [], "errors": []}

    erros = []
    pdf_data = _empty_pdf.copy()
    dxf_data = _empty_dxf.copy()

    # ── Processar PDF ─────────────────────────────────────────────────────────
    if pdf and pdf.filename:
        try:
            raw_pdf = await pdf.read()
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
                tf.write(raw_pdf)
                tmp_pdf = tf.name
            pdf_data = extract_pdf(tmp_pdf)
            os.unlink(tmp_pdf)
            log.info("  PDF ok: %d tabelas, %d linhas medida",
                     len(pdf_data["cea_qnt_tables"]), len(pdf_data["measure_lines"]))
        except Exception as e:
            erros.append(f"PDF: {e}")
            log.warning("  Erro ao extrair PDF: %s", e)
    else:
        log.info("  PDF: nao enviado")

    # ── Processar DXF / DWG ───────────────────────────────────────────────────
    if dxf and dxf.filename:
        ext = Path(dxf.filename).suffix.lower()
        try:
            raw_dxf = await dxf.read()
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
                tf.write(raw_dxf)
                tmp_dxf = tf.name
            dxf_data = extract_dxf(tmp_dxf)
            os.unlink(tmp_dxf)
            log.info("  DXF ok: %d layers, %d dims, %d textos",
                     len(dxf_data["layers"]), len(dxf_data["dims"]), len(dxf_data["texts"]))
        except Exception as e:
            erros.append(f"DXF/DWG: {e}")
            log.warning("  Erro ao extrair DXF/DWG: %s", e)
    else:
        log.info("  DXF/DWG: nao enviado")

    # ── Classificar e extrair itens ──────────────────────────────────────────
    classificacao = classify_prancha(pdf_data, dxf_data)
    if not pdf_data["ok"] and not dxf_data["ok"]:
        classificacao = "SEM_CONTEUDO"

    score = _score_prancha(pdf_data, dxf_data)
    # Parser baseado em seções de texto — resolve bleed, duplicatas e soleiras
    pdf_items = parse_cea_qnt_from_text(pdf_data) if pdf_data["ok"] else []
    if pdf_data["ok"] and not pdf_items:
        # Fallback para PDFs sem seções CEA-QNT detectáveis no texto
        pdf_items = parse_cea_qnt_tables(pdf_data)
    # Tabelas especiais: QUADRO DE PORTAS, LUMINÁRIAS, COMUNICAÇÃO VISUAL
    if pdf_data["ok"]:
        seen_qa = {it.get("descricao", "") for it in pdf_items}
        special_items = parse_special_tables_from_text(pdf_data, seen_qa)
        if special_items:
            pdf_items = pdf_items + special_items
            log.info("  Tabelas especiais: +%d itens", len(special_items))
    log.info("  Itens extraídos do PDF: %d", len(pdf_items))

    precisa_ia = classificacao in ("IA_AUDITORIA", "IA_NECESSARIA", "SEM_CONTEUDO")

    # ── Extração parcial (fallback para pranchas sem tabelas estruturadas) ───
    height_context: dict = {}
    partial_items: list = []

    has_quadro = bool(pdf_data.get("quadro_acabamentos"))
    has_cea    = bool(pdf_data.get("cea_qnt_tables")) or bool(pdf_items)
    # BUG-5: pranchas com QUADRO mas sem CEA-QNT são referências — skip partial
    _skip_partial_quadro_only = has_quadro and not has_cea
    # BUG-8: pranchas visuais (CVS, axo, layout) — skip partial
    _skip_partial_visual = bool(_RE_VISUAL_PRANCHA.search(stem))

    # BUG-7: só roda extract_partial se nenhum item CEA foi encontrado
    if (pdf_data["ok"] and len(pdf_items) == 0
            and not _skip_partial_quadro_only
            and not _skip_partial_visual):
        seen_descs = {it.get("descricao", "") for it in pdf_items}
        partial_items, height_context = extract_partial_items_from_text(pdf_data, seen_descs)
        log.info("  Extração parcial: %d itens aguardando, height_context=%s",
                 len(partial_items), height_context)

    # Combina: itens confirmados (com qty) primeiro, parciais (sem qty) depois
    all_pdf_items = pdf_items + partial_items

    # ── Filtro de LIXO determinístico (nível de item) ────────────────────────
    # classify_noise() só roda por linha; estes itens chegam por parsers/IA que não
    # passam por ela. Removemos ruído estrutural aqui, na fonte, sem depender do LLM.
    # Pattern-based — itens legítimos de qty 0 são preservados.
    itens_validos: list = []
    itens_descartados: list = []
    for it in all_pdf_items:
        motivo = classify_item_junk(it.get("descricao", ""))
        if motivo:
            itens_descartados.append({"descricao": it.get("descricao", ""), "motivo": motivo})
        else:
            itens_validos.append(it)
    if itens_descartados:
        log.info("  Filtro de lixo: %d itens descartados de %d", len(itens_descartados), len(all_pdf_items))

    log.info("  Classificacao: %s | score=%d | itens_confirmados=%d | itens_aguardando=%d | lixo=%d | precisa_ia=%s",
             classificacao, score, len(pdf_items), len(partial_items), len(itens_descartados), precisa_ia)

    # ── Montar resposta ──────────────────────────────────────────────────────
    itens_extraidos = [
        {
            "descricao": it.get("descricao", ""),
            "quantidade": it.get("quantidade"),
            "unidade": it.get("unidade", ""),
            "ambiente": it.get("ambiente", ""),
            "categoria": it.get("categoria", "outro"),
            "status": it.get("status", "confirmado"),
            "fonte": it.get("fonte", "PDF"),
            "pendencias": it.get("pendencias", []),
        }
        for it in itens_validos
    ]

    dxf_counts = dxf_data.get("counts", {
        "layers": len(dxf_data.get("layers", [])),
        "dims":   len(dxf_data.get("dims", [])),
        "blocks": len(dxf_data.get("blocks", {})),
        "texts":  len(dxf_data.get("texts", [])),
    })

    debug = {
        # ── Status geral ────────────────────────────────────────────────────────
        "pdf_ok":       pdf_data["ok"],
        "dxf_ok":       dxf_data["ok"],
        "image_enviada": bool(image and image.filename),
        "pdf_fonte": "upload" if (pdf and pdf.filename) else ("disco" if pdf_data["ok"] else "nao_encontrado"),
        "dxf_fonte": "upload" if (dxf and dxf.filename) else ("disco" if dxf_data["ok"] else "nao_encontrado"),

        # ── Score de classificação ───────────────────────────────────────────────
        "score":                    score,
        "score_threshold_direto":   6,
        "score_threshold_ia_auditoria": 3,
        "classificacao":            classificacao,

        # ── Resumo PDF ───────────────────────────────────────────────────────────
        "pdf_n_raw_lines":          len(pdf_data.get("raw_text_lines", [])),
        "pdf_n_clean_lines":        len(pdf_data.get("text_lines", [])),
        "pdf_n_noise_removed":      len(pdf_data.get("noise_removed", [])),
        "pdf_n_tables_cea_qnt":     len(pdf_data.get("cea_qnt_tables", [])),
        "pdf_n_quadro_acabamentos": len(pdf_data.get("quadro_acabamentos", [])),
        "pdf_n_measure_lines":      len(pdf_data.get("measure_lines", [])),
        "pdf_n_area_tags":          len(pdf_data.get("area_tags", [])),

        # ── Resumo DXF ───────────────────────────────────────────────────────────
        "dxf_n_layers":  dxf_counts["layers"],
        "dxf_n_dims":    dxf_counts["dims"],
        "dxf_n_blocks":  dxf_counts["blocks"],
        "dxf_n_texts":   dxf_counts["texts"],

        # ── Itens extraídos ──────────────────────────────────────────────────────
        "n_itens_confirmados": len(pdf_items),
        "n_itens_aguardando":  len(partial_items),
        "n_itens_lixo":        len(itens_descartados),
        "itens_descartados":   itens_descartados,   # [{"descricao": str, "motivo": tag}]
        "height_context":      height_context,

        # ── Erros ────────────────────────────────────────────────────────────────
        "erros_pdf":            pdf_data.get("errors", []),
        "erros_dxf":            dxf_data.get("errors", []),
        "erros_processamento":  erros,

        # ── Dados completos para inspeção visual ─────────────────────────────────
        "pdf_raw_lines":     pdf_data.get("raw_text_lines", []),
        "pdf_clean_lines":   pdf_data.get("text_lines", []),
        "pdf_noise_removed": pdf_data.get("noise_removed", []),   # [{"line": str, "motivo": str}]
        "pdf_measure_lines": pdf_data.get("measure_lines", []),
        "pdf_area_tags":     pdf_data.get("area_tags", []),
        "pdf_items_confirmados": pdf_items,
        "pdf_items_parciais":    partial_items,

        "dxf_all_layers": dxf_data.get("all_layers", dxf_data.get("layers", [])),
        "dxf_all_dims":   dxf_data.get("all_dims",   dxf_data.get("dims", [])),
        "dxf_all_blocks": dxf_data.get("all_blocks", dxf_data.get("blocks", {})),
        "dxf_all_texts":  dxf_data.get("all_texts",  dxf_data.get("texts", [])),
    }

    return JSONResponse({
        "stem": stem,
        "classificacao": classificacao,
        "precisa_ia": precisa_ia,
        "n_itens_extraidos": len(itens_extraidos),
        "itens_extraidos": itens_extraidos,
        "height_context": height_context,
        "fontes": {
            "pdf": pdf_data["ok"],
            "dxf": dxf_data["ok"],
            "image": bool(image and image.filename),
        },
        "debug": debug,
        "processado_em": datetime.now(timezone.utc).isoformat(),
    })


@app.post("/ler-prancha")
async def ler_prancha(
    image_0: Optional[UploadFile] = File(None),
    image_1: Optional[UploadFile] = File(None),
    image_2: Optional[UploadFile] = File(None),
    context_json: str = Form(""),
):
    """
    Estágio 1 — Leitura Geral.
    Recebe até 3 imagens + context_json com batch_items.
    A IA documenta cada prancha (ambiente, tipo, itens vistos) SEM pressão de qty.
    Retorna lista de leituras indexadas por stem.
    """
    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    try:
        context = json.loads(context_json) if context_json else {}
    except Exception:
        context = {}

    batch_items = context.get("batch_items", [])
    images_uploads = [u for u in [image_0, image_1, image_2] if u and u.filename]

    if not images_uploads:
        raise HTTPException(status_code=400, detail="Nenhuma imagem recebida em /ler-prancha")

    log.info("[ler-prancha] %d imagens, %d stems", len(images_uploads), len(batch_items))

    images_b64 = []
    for up in images_uploads:
        raw = await up.read()
        jpg = compress_to_jpeg(raw)
        images_b64.append(base64.b64encode(jpg).decode())
        log.info("  [ler-prancha] %s → %dKB", up.filename, len(jpg) // 1024)

    # Garante alinhamento entre imagens e batch_items
    while len(batch_items) < len(images_b64):
        batch_items.append({
            "stem": f"prancha-{len(batch_items)+1}",
            "itens_extraidos": [],
            "classificacao": "IA_NECESSARIA",
            "height_context": {},
        })

    prompt = build_leitura_geral_prompt(batch_items[:len(images_b64)])

    try:
        raw_text, tokens_in, tokens_out, custo = await asyncio.get_running_loop().run_in_executor(
            None, lambda: call_claude_multi(prompt, images_b64, api_key)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Claude (ler-prancha): {e}")

    raw_save_path = Path(BASE_DIR).parent / "leitura_last_response.json"
    try:
        parsed = parse_ai_json(raw_text, save_path=raw_save_path)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Indexa leituras por stem usando o label A/B/C → stem
    labels = ["A", "B", "C"]
    label_to_stem = {labels[i]: batch_items[i]["stem"] for i in range(len(batch_items[:len(images_b64)]))}

    leituras_por_stem: dict = {}
    for leitura in parsed.get("leituras", []):
        label = str(leitura.get("prancha", "A")).upper()
        stem  = label_to_stem.get(label, batch_items[0]["stem"])
        leitura["stem"] = stem
        leituras_por_stem[stem] = leitura

    return JSONResponse({
        "leituras": leituras_por_stem,
        "prompt_sent": prompt,
        "raw_output":  raw_text,
        "metadata": {
            "tokens_input":  tokens_in,
            "tokens_output": tokens_out,
            "custo_usd":     round(custo, 5),
        },
    })


@app.post("/orquestrar")
async def orquestrar(
    context_json: str = Form(""),
):
    """
    Estágio 2 — Orquestrador.
    Recebe leitura_map (resultado do /ler-prancha de todas as pranchas) +
    extract_summary (dados da extração por código). SEM imagens.
    A IA identifica gaps e decide quais pranchas precisam de análise de detalhe.
    """
    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    try:
        context = json.loads(context_json) if context_json else {}
    except Exception:
        context = {}

    leitura_map     = context.get("leitura_map", [])
    extract_summary = context.get("extract_summary", [])

    log.info("[orquestrar] leitura_map=%d pranchas, extract_summary=%d",
             len(leitura_map), len(extract_summary))

    prompt = build_orchestrator_prompt(leitura_map, extract_summary)

    try:
        raw_text, tokens_in, tokens_out, custo = await asyncio.get_running_loop().run_in_executor(
            None, lambda: call_claude_multi(prompt, [], api_key)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Claude (orquestrador): {e}")

    raw_save_path = Path(BASE_DIR).parent / "orchestrator_last_response.json"
    try:
        parsed = parse_ai_json(raw_text, save_path=raw_save_path)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse({
        "contexto_projeto":     parsed.get("contexto_projeto", ""),
        "cliente":              parsed.get("cliente", "C&A"),
        "projeto":              parsed.get("projeto", "CEA-254-BLN"),
        "categorias_cobertas":  parsed.get("categorias_cobertas", []),
        "categorias_ausentes":  parsed.get("categorias_ausentes", []),
        "gaps_globais":         parsed.get("gaps_globais", []),
        "fontes_primarias":     parsed.get("fontes_primarias", {}),
        "pranchas_para_detalhar": parsed.get("pranchas_para_detalhar", []),
        "pranchas_dispensadas":   parsed.get("pranchas_dispensadas", []),
        "prompt_sent": prompt,
        "raw_output":  raw_text,
        "metadata": {
            "tokens_input":  tokens_in,
            "tokens_output": tokens_out,
            "custo_usd":     round(custo, 5),
        },
    })


@app.post("/analisar-batch")
async def analisar_batch(
    image_0: Optional[UploadFile] = File(None),
    image_1: Optional[UploadFile] = File(None),
    image_2: Optional[UploadFile] = File(None),
    context_json: str = Form(""),
):
    """
    Análise de um batch de 1–3 pranchas em uma única chamada de IA.
    context_json deve conter: {contexto_projeto, batch_items: [{stem, itens_extraidos, classificacao}]}
    """
    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    try:
        context = json.loads(context_json) if context_json else {}
    except Exception:
        context = {}

    contexto_projeto = context.get("contexto_projeto", "Projeto de fit-out C&A")
    batch_items      = context.get("batch_items", [])

    images_uploads = [u for u in [image_0, image_1, image_2] if u and u.filename]
    if not images_uploads:
        raise HTTPException(status_code=400, detail="Nenhuma imagem recebida no batch")

    log.info("[analisar-batch] %d imagens, %d stems",
             len(images_uploads), len(batch_items))

    images_b64 = []
    for up in images_uploads:
        raw = await up.read()
        jpg = compress_to_jpeg(raw)
        images_b64.append(base64.b64encode(jpg).decode())
        log.info("  [batch] %s → %dKB", up.filename, len(jpg) // 1024)

    # Garante que batch_items tenha o mesmo tamanho que as imagens recebidas
    while len(batch_items) < len(images_b64):
        batch_items.append({"stem": f"prancha-{len(batch_items)+1}", "itens_extraidos": [], "classificacao": "IA_NECESSARIA"})

    prompt = build_batch_prompt(contexto_projeto, batch_items[:len(images_b64)])

    try:
        raw_text, tokens_in, tokens_out, custo = await asyncio.get_running_loop().run_in_executor(
            None, lambda: call_claude_multi(prompt, images_b64, api_key)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Claude (batch): {e}")

    raw_save_path = Path(BASE_DIR).parent / "batch_last_response.json"
    try:
        parsed = parse_ai_json(raw_text, save_path=raw_save_path)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Separar itens por prancha label (A, B, C) → stem
    labels = ["A", "B", "C"]
    label_to_stem = {labels[i]: batch_items[i]["stem"] for i in range(len(batch_items[:len(images_b64)]))}

    batched: dict[str, list] = {item["stem"]: [] for item in batch_items[:len(images_b64)]}
    batched_descartados: list = []
    for it in parsed.get("itens", []):
        label = str(it.get("prancha", "A")).upper()
        stem  = label_to_stem.get(label, batch_items[0]["stem"])
        # Mesmo filtro de lixo determinístico aplicado aos itens da IA (a instrução
        # "FILTRO DE LIXO" do prompt é não-determinística; este guard não depende dela).
        motivo = classify_item_junk(it.get("descricao", ""))
        if motivo:
            batched_descartados.append({"descricao": it.get("descricao", ""), "motivo": motivo, "stem": stem})
        else:
            batched.setdefault(stem, []).append(it)
    if batched_descartados:
        log.info("  [batch] Filtro de lixo: %d itens da IA descartados", len(batched_descartados))

    return JSONResponse({
        "batched": batched,
        "itens_descartados": batched_descartados,
        "divergencias": parsed.get("divergencias", []),
        "erros_limitacoes": parsed.get("erros_limitacoes", []),
        "prompt_sent": prompt,
        "raw_output":  raw_text,
        "metadata": {
            "tokens_input":  tokens_in,
            "tokens_output": tokens_out,
            "custo_usd":     round(custo, 5),
            "n_imagens":     len(images_b64),
        },
    })


@app.post("/extrair", response_model=ExtractionResult)
async def extrair(image: UploadFile = File(...)):
    stem = Path(image.filename or "prancha").stem
    log.info("Processando prancha: %s", stem)

    pdf_path = os.path.join(BASE_DIR, PDF_SUBDIR, stem + ".pdf")
    dxf_path = os.path.join(BASE_DIR, DXF_SUBDIR, stem + ".dxf")
    has_pdf = os.path.isfile(pdf_path)
    has_dxf = os.path.isfile(dxf_path)
    log.info("  PDF: %s | DXF: %s", "OK" if has_pdf else "nao encontrado", "OK" if has_dxf else "nao encontrado")

    _empty_pdf = {"ok": False, "cea_qnt_tables": [], "quadro_acabamentos": [], "measure_lines": [], "area_tags": [], "errors": []}
    _empty_dxf = {"ok": False, "layers": [], "dims": [], "blocks": {}, "texts": [], "errors": []}
    pdf_data = extract_pdf(pdf_path) if has_pdf else _empty_pdf
    dxf_data = extract_dxf(dxf_path) if has_dxf else _empty_dxf

    classificacao = classify_prancha(pdf_data, dxf_data)
    log.info("  Classificacao: %s", classificacao)

    # Parser baseado em seções de texto — resolve bleed, duplicatas e soleiras
    pdf_items = parse_cea_qnt_from_text(pdf_data) if pdf_data["ok"] else []
    if pdf_data["ok"] and not pdf_items:
        pdf_items = parse_cea_qnt_tables(pdf_data)
    if pdf_data["ok"]:
        seen_qa = {it.get("descricao", "") for it in pdf_items}
        special_items = parse_special_tables_from_text(pdf_data, seen_qa)
        if special_items:
            pdf_items = pdf_items + special_items
    log.info("  Itens pre-extraidos do PDF: %d", len(pdf_items))

    has_context = pdf_data["ok"] or dxf_data["ok"]
    if has_context:
        context_text = build_context(stem, pdf_data, dxf_data)
        prompt = build_prompt(context_text, pdf_items)
    else:
        prompt = PROMPT_NO_CONTEXT

    raw_image = await image.read()
    jpg_bytes = compress_to_jpeg(raw_image)
    img_b64   = base64.b64encode(jpg_bytes).decode()
    log.info("  Imagem: %dKB JPEG", len(jpg_bytes) // 1024)

    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    raw_save_path = Path(BASE_DIR).parent / "extractor_last_response.json"
    try:
        raw_text, tokens_in, tokens_out, custo = call_claude(prompt, img_b64, api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Claude: {e}")

    try:
        parsed = parse_ai_json(raw_text, save_path=raw_save_path)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    fontes_usadas = []
    if has_pdf and pdf_data["ok"]: fontes_usadas.append("PDF")
    if has_dxf and dxf_data["ok"]: fontes_usadas.append("DXF")
    fontes_usadas.append("IA")

    itens, divergencias, erros_ia = build_items(parsed, pdf_items)

    result = ExtractionResult(
        prancha=stem,
        classificacao=classificacao,
        fontes_usadas=fontes_usadas,
        projeto=str(parsed.get("projeto", "CEA-254-BLN")),
        cliente=str(parsed.get("cliente", "C&A")),
        itens=itens,
        divergencias=divergencias,
        erros_ia=erros_ia,
        metadata=Metadata(
            processado_em=datetime.now(timezone.utc).isoformat(),
            modelo_ia=MODEL,
            tokens_input=tokens_in,
            tokens_output=tokens_out,
            custo_usd=round(custo, 5),
            ia_usada=True,
            pdf_encontrado=has_pdf,
            dxf_encontrado=has_dxf,
        ),
    )

    results_dir = Path(BASE_DIR).parent / "extractor_results"
    results_dir.mkdir(exist_ok=True)
    safe_stem = re.sub(r"[^\w\-]", "_", stem)[:80]
    result_path = results_dir / f"{safe_stem}.json"
    try:
        result_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        log.info("  Resultado salvo em: %s", result_path)
    except Exception as e:
        log.warning("  Nao foi possivel salvar resultado: %s", e)

    return result
