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
import fitz  # PyMuPDF — PDF → PNG
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import BASE_DIR, ANTHROPIC_KEY, PDF_SUBDIR, DXF_SUBDIR, MODEL, normalize_key
from schemas import ExtractionResult, Metadata
from extractors.pdf_extractor import (
    extract_pdf, parse_cea_qnt_tables, extract_partial_items_from_text,
    parse_cea_qnt_from_text, parse_special_tables_from_text,
    extract_text_mupdf, merge_dual_extraction, parse_all_tables,
    parse_budget_rows_from_text, parse_pcode_items_from_text,
    parse_section_recovery,
)
from extractors.table_dedup import _parse_prancha_num
from extractors.dxf_extractor import extract_dxf
from extractors.image_processor import compress_to_jpeg
from extractors.context_builder import classify_prancha, build_context, build_prompt, PROMPT_NO_CONTEXT
from extractors.ai_client import call_claude, call_claude_multi, parse_ai_json
from extractors.result_builder import build_items
from extractors.orchestrator import (
    build_leitura_geral_prompt, build_orchestrator_prompt, build_batch_prompt,
    build_especialista_prompt, build_auditoria_prompt,
    build_normalizacao_prompt, parse_normalizacao_json,
    build_verificacao_prompt,
)
from aprender import router as aprender_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("extractor")

# Modelo barato para normalização de nomes — ~$0.001 por prancha
HAIKU_MODEL = "claude-haiku-4-5"

# ─── Pasta de logs raw das respostas do Claude ────────────────────────────────
_LOGS_DIR = Path(BASE_DIR).parent / "ai_logs"
_LOGS_DIR.mkdir(exist_ok=True)


def _log_path(endpoint: str, obra: str, stem: str = "") -> Path:
    """Retorna path único com timestamp para nunca sobrescrever logs anteriores."""
    ts    = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe  = re.sub(r"[^\w\-]", "_", obra)[:30] if obra else "sem_obra"
    extra = ("_" + re.sub(r'[^\w\-]', '_', stem)[:30]) if stem else ""
    return _LOGS_DIR / f"{ts}_{endpoint}_{safe}{extra}.txt"

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

from extractors.maps_router import router as maps_router
from extractors.competitor_router import router as competitor_router

app.include_router(maps_router)
app.include_router(competitor_router)


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


@app.post("/extrair-tabelas")
@app.post("/extrair-codigo")
async def extrair_tabelas(
    image: Optional[UploadFile] = File(None),
    pdf:   Optional[UploadFile] = File(None),
    dxf:   Optional[UploadFile] = File(None),  # aceito mas ignorado
):
    """
    Extração programática pura — sem chamar IA.
    Recebe opcionalmente: image (PNG/JPG), pdf (PDF).
    O DXF é aceito para backward compat mas ignorado.
    Filtra o PDF para retornar SOMENTE tabelas QNT estruturadas.
    """
    stem = "prancha"
    for up in [image, pdf]:
        if up and up.filename:
            stem = Path(up.filename).stem
            break
    log.info("[extrair-tabelas] Processando: %s", stem)

    _empty_pdf = {"ok": False, "cea_qnt_tables": [], "quadro_acabamentos": [],
                  "measure_lines": [], "area_tags": [], "errors": []}

    erros = []
    pdf_data = _empty_pdf.copy()

    # ── Processar PDF — tabelas QNT + conversão para PNG ─────────────────────
    png_b64: Optional[str] = None
    tmp_pdf: Optional[str] = None
    if pdf and pdf.filename:
        try:
            raw_pdf = await pdf.read()
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
                tf.write(raw_pdf)
                tmp_pdf = tf.name
            pdf_data = extract_pdf(tmp_pdf)
            pdf_data["prancha_num"] = _parse_prancha_num(stem)
            pdf_data["stem"] = stem
            log.info("  PDF ok: %d tabelas QNT, %d linhas medida",
                     len(pdf_data["cea_qnt_tables"]), len(pdf_data["measure_lines"]))
            log.debug("[extrair-tabelas:QNT] %s — tabelas QNT encontradas: %s",
                      stem,
                      [t.get("section_name", t.get("label", "?")) for t in pdf_data.get("cea_qnt_tables", [])])

            # Converter página 0 para PNG (150 DPI) para análise visual da IA
            try:
                doc = fitz.open(tmp_pdf)
                page = doc[0]
                mat = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI
                pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
                png_bytes = pix.tobytes("png")
                png_b64 = base64.b64encode(png_bytes).decode()
                doc.close()
                log.info("  PDF→PNG: página 0 convertida (%dKB)", len(png_bytes) // 1024)
            except Exception as e:
                log.warning("  PDF→PNG falhou: %s", e)

            # tmp_pdf removido depois da segunda extração (abaixo)
        except Exception as e:
            erros.append(f"PDF: {e}")
            log.warning("  Erro ao extrair PDF: %s", e)
    else:
        log.info("  PDF: nao enviado")

    _empty_dxf = {"ok": False, "layers": [], "dims": [], "blocks": {}, "texts": [], "errors": []}
    dxf_data = _empty_dxf.copy()

    # ── Classificar ──────────────────────────────────────────────────────────
    classificacao = classify_prancha(pdf_data, dxf_data)
    if not pdf_data["ok"]:
        classificacao = "SEM_CONTEUDO"

    score = _score_prancha(pdf_data, dxf_data)

    # ── Extração 1: pdfplumber ────────────────────────────────────────────────
    pdf_items_plumber: list[dict] = []
    if pdf_data["ok"]:
        pdf_items_plumber = parse_cea_qnt_from_text(pdf_data) or parse_cea_qnt_tables(pdf_data)
        seen_qa = {it.get("descricao", "") for it in pdf_items_plumber}
        special_items = parse_special_tables_from_text(pdf_data, seen_qa)
        if special_items:
            pdf_items_plumber = pdf_items_plumber + special_items
            log.info("  Tabelas especiais: +%d itens", len(special_items))

    # ── Extração 2: PyMuPDF text (rápida, <10ms) — mesmos parsers regex ──────
    pdf_items_mupdf: list[dict] = []
    if tmp_pdf and pdf_data["ok"]:
        try:
            mupdf_data = extract_text_mupdf(tmp_pdf)
            if mupdf_data["ok"]:
                mupdf_data["prancha_num"] = pdf_data.get("prancha_num", "")
                mupdf_data["stem"] = stem
                pdf_items_mupdf = (
                    parse_cea_qnt_from_text(mupdf_data)
                    or parse_cea_qnt_tables(mupdf_data)
                )
                log.info("  PyMuPDF text: %d itens", len(pdf_items_mupdf))
        except Exception as e:
            log.warning("  PyMuPDF text extraction falhou (ignorando): %s", e)

    # Remover arquivo temporário após ambas as extrações de texto
    if tmp_pdf:
        try:
            os.unlink(tmp_pdf)
        except Exception:
            pass

    # ── Extração 3: Parser genérico — TODAS as tabelas do PDF ────────────────
    # Captura Quadro de Portas, Quadro de Áreas e quaisquer tabelas sem header
    # padrão. Usa already_seen para não duplicar o que os parsers 1 e 2 já pegaram.
    pdf_items_generic: list[dict] = []
    if pdf_data["ok"]:
        try:
            seen_descs = {normalize_key(it.get("descricao", "")) for it in pdf_items_plumber + pdf_items_mupdf}
            pdf_items_generic = parse_all_tables(pdf_data, already_seen=seen_descs)
            if pdf_items_generic:
                log.info("  Tabelas genéricas: +%d itens novos", len(pdf_items_generic))
                log.debug("[extrair-tabelas:GENERIC] %s — tabelas=%s",
                          stem,
                          sorted({it.get("tabela", "?") for it in pdf_items_generic}))
        except Exception as e:
            log.warning("  parse_all_tables falhou (ignorando): %s", e)

    # ── Cross-validation + merge final ───────────────────────────────────────
    merged_12  = merge_dual_extraction(pdf_items_plumber, pdf_items_mupdf)
    pdf_items  = merge_dual_extraction(merged_12, pdf_items_generic)

    # ── Extração 4: varredura global de linhas budget-row + pcode recovery ───
    if pdf_data["ok"]:
        seen_keys = {normalize_key(it.get("descricao", "")) for it in pdf_items}
        recovery: list[dict] = parse_budget_rows_from_text(pdf_data, seen_keys)
        seen_keys.update(normalize_key(it["descricao"]) for it in recovery)
        recovery.extend(parse_pcode_items_from_text(pdf_data, seen_keys))
        seen_keys.update(normalize_key(it["descricao"]) for it in recovery)
        recovery.extend(parse_section_recovery(pdf_data, seen_keys))
        if recovery:
            log.info("  Budget-row recovery: +%d itens", len(recovery))
            log.debug("[extrair-tabelas:RECOVERY] %s — tabelas=%s descs=%s",
                      stem,
                      sorted({it.get("tabela", "?") for it in recovery}),
                      [it.get("descricao", "")[:30] for it in recovery[:5]])
            pdf_items = merge_dual_extraction(pdf_items, recovery)

    log.info("  Itens QNT extraídos: %d (plumber=%d mupdf=%d generic=%d)",
             len(pdf_items), len(pdf_items_plumber), len(pdf_items_mupdf), len(pdf_items_generic))

    # Sem extração parcial — somente tabelas estruturadas (evita lixo de texto livre)
    height_context: dict = {}

    log.info("  Classificacao: %s | score=%d | itens_confirmados=%d",
             classificacao, score, len(pdf_items))

    # ── Montar resposta ──────────────────────────────────────────────────────
    itens_extraidos = [
        {
            "descricao":          it.get("descricao", ""),
            "quantidade":         it.get("quantidade"),
            "unidade":            it.get("unidade", ""),
            "ambiente":           it.get("ambiente", ""),
            "categoria":          it.get("categoria", "outro"),
            "status":             it.get("status", "confirmado"),
            "fonte":              it.get("fonte", "PDF"),
            "pendencias":         it.get("pendencias", []),
            "tabela":             it.get("tabela", "GERAL"),
            "grand_total_tabela": it.get("grand_total_tabela"),
        }
        for it in pdf_items
    ]

    # ── Normalização Haiku (com timeout interno para evitar travamento) ───────
    itens_normalizados: list[dict] = []
    if itens_extraidos:
        api_key_norm = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
        if api_key_norm:
            try:
                norm_prompt = build_normalizacao_prompt(itens_extraidos)
                loop = asyncio.get_running_loop()
                raw_norm, _ti, _to, _c = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: call_claude(norm_prompt, None, api_key_norm, max_tokens=4096, model=HAIKU_MODEL),
                    ),
                    timeout=90.0,  # desiste após 90s e retorna lista vazia
                )
                itens_normalizados = parse_normalizacao_json(raw_norm)
                log.info("  Normalização Haiku: %d/%d itens classificados",
                         len(itens_normalizados), len(itens_extraidos))
            except asyncio.TimeoutError:
                log.warning("  Normalização Haiku: timeout (90s) — ignorando")
            except Exception as e:
                log.warning("  Normalização Haiku falhou (ignorando): %s", e)
        else:
            log.info("  Normalização Haiku: ignorada (sem API key)")

    debug = {
        "pdf_ok":       pdf_data["ok"],
        "image_enviada": bool(image and image.filename),
        "pdf_fonte": "upload" if (pdf and pdf.filename) else ("nao_encontrado"),
        "score":                    score,
        "classificacao":            classificacao,
        "pdf_n_raw_lines":          len(pdf_data.get("raw_text_lines", [])),
        "pdf_n_clean_lines":        len(pdf_data.get("budget_lines") or pdf_data.get("text_lines", [])),
        "pdf_n_noise_removed":      len(pdf_data.get("noise_removed", [])),
        "pdf_n_tables_cea_qnt":     len(pdf_data.get("cea_qnt_tables", [])),
        "pdf_n_quadro_acabamentos": len(pdf_data.get("quadro_acabamentos", [])),
        "pdf_n_measure_lines":      len(pdf_data.get("measure_lines", [])),
        "pdf_n_area_tags":          len(pdf_data.get("area_tags", [])),
        "n_itens_confirmados": len(pdf_items),
        "n_itens_aguardando":  0,
        "height_context":      height_context,
        "erros_pdf":            pdf_data.get("errors", []),
        "erros_processamento":  erros,
        "pdf_raw_lines":     pdf_data.get("raw_text_lines", []),
        "pdf_clean_lines":   pdf_data.get("budget_lines") or pdf_data.get("text_lines", []),
        "pdf_noise_removed": pdf_data.get("noise_removed", []),
        "pdf_measure_lines": pdf_data.get("measure_lines", []),
        "pdf_area_tags":     pdf_data.get("area_tags", []),
        "pdf_items_confirmados": pdf_items,
        "pdf_items_parciais":    [],
    }

    return JSONResponse({
        "stem": stem,
        "classificacao": classificacao,
        "precisa_ia": False,
        "n_itens_extraidos": len(itens_extraidos),
        "itens_extraidos": itens_extraidos,
        "itens_normalizados": itens_normalizados,
        "height_context": height_context,
        "png_base64": png_b64,
        "fontes": {
            "pdf": pdf_data["ok"],
            "dxf": False,
            "image": bool(image and image.filename),
        },
        "debug": debug,
        "processado_em": datetime.now(timezone.utc).isoformat(),
    })


@app.post("/especialista")
async def especialista(
    context_json: str = Form(""),
):
    """
    Análise especialista de um grupo de pranchas — table-only (sem imagens).
    Recebe context_json com:
      { grupo, secoes, checklist, pdf_tables, pdf_tables_aggregated }
    checklist: [{cod, descricao, unidade, zona, vlrUnit, materialCliente, qdeReferencia, zerado}]
    pdf_tables: [{stem, itens: [{descricao, quantidade, unidade, status}]}]
    Retorna itens do checklist com quantidades preenchidas a partir das tabelas QNT.
    """
    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    try:
        context = json.loads(context_json) if context_json else {}
    except Exception:
        context = {}

    grupo                 = context.get("grupo", "G1")
    secoes                = context.get("secoes", [])
    checklist             = context.get("checklist", [])
    pdf_tables            = context.get("pdf_tables", [])
    pdf_tables_normalized  = context.get("pdf_tables_normalized") or None
    pdf_tables_aggregated  = context.get("pdf_tables_aggregated") or None
    obra                   = context.get("obra", "")

    log.info("[especialista] obra=%s grupo=%s secoes=%s checklist=%d (table-only)",
             obra, grupo, secoes, len(checklist))

    prompt = build_especialista_prompt(
        grupo, secoes, checklist, pdf_tables, obra=obra,
        pdf_tables_normalized=pdf_tables_normalized,
        pdf_tables_aggregated=pdf_tables_aggregated,
    )

    try:
        raw_text, tokens_in, tokens_out, custo = await asyncio.get_running_loop().run_in_executor(
            None, lambda: call_claude(prompt, None, api_key)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Claude (especialista {grupo}): {e}")

    raw_save_path = _log_path("especialista", obra, grupo)
    try:
        parsed = parse_ai_json(raw_text, save_path=raw_save_path)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse({
        "grupo":       grupo,
        "itens":       parsed.get("itens", []),
        "prompt_sent": prompt,
        "raw_output":  raw_text,
        "metadata": {
            "tokens_input":  tokens_in,
            "tokens_output": tokens_out,
            "custo_usd":     round(custo, 5),
            "n_imagens":     0,
            "n_checklist":   len(checklist),
        },
    })


@app.post("/verificar")
async def verificar(
    context_json: str = Form(""),
):
    """
    Verificação de completude da extração via Haiku.
    Recebe context_json com:
      { obra, grupos_resumo, itens_aguardando }
    grupos_resumo: [{grupo, n_confirmados, n_aguardando, n_pranchas, categorias_encontradas}]
    itens_aguardando: [{cod, descricao, grupo}]
    Retorna análise de qualidade da extração sem chamar visão — texto puro.
    """
    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    try:
        context = json.loads(context_json) if context_json else {}
    except Exception:
        context = {}

    grupos_resumo    = context.get("grupos_resumo", [])
    itens_aguardando = context.get("itens_aguardando", [])
    obra             = context.get("obra", "")

    log.info("[verificar] obra=%s %d grupos, %d aguardando",
             obra, len(grupos_resumo), len(itens_aguardando))

    prompt = build_verificacao_prompt(grupos_resumo, itens_aguardando, obra=obra)

    try:
        raw_text, tokens_in, tokens_out, custo = await asyncio.get_running_loop().run_in_executor(
            None, lambda: call_claude(prompt, None, api_key, max_tokens=1024, model=HAIKU_MODEL)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Claude (verificar): {e}")

    raw_save_path = _log_path("verificar", obra)
    try:
        parsed = parse_ai_json(raw_text, save_path=raw_save_path)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse({
        "qualidade_extracao":                parsed.get("qualidade_extracao", "parcial"),
        "observacoes":                       parsed.get("observacoes", []),
        "categorias_possivelmente_ausentes": parsed.get("categorias_possivelmente_ausentes", []),
        "itens_provavelmente_em_tabela":     parsed.get("itens_provavelmente_em_tabela", []),
        "prompt_sent": prompt,
        "raw_output":  raw_text,
        "metadata": {
            "tokens_input":  tokens_in,
            "tokens_output": tokens_out,
            "custo_usd":     round(custo, 5),
        },
    })


@app.post("/orcar-tabelas")
async def orcar_tabelas(
    context_json: str = Form(""),
):
    """
    Pipeline determinístico: dedup + mapeamento XLSX para tabelas de TODAS as pranchas.

    Input JSON:
      {
        obra: str,
        checklist: [{cod, descricao, unidade, vlrUnit, materialCliente, zerado}],
        pranchas:  [{stem, items: [{descricao, quantidade, unidade, tabela,
                                   grand_total_tabela, ...}]}]
      }

    Output JSON:
      {
        itens:      [{cod, descricao, quantidade, unidade, vlrUnit, vlrTotal,
                      confianca, fonte_pranchas}],
        residual:   [{cod, descricao, unidade}],  ← cods XLSX sem cobertura
        dedup_log:  [{tabela, kept, dropped, gt}],
        metadata:   {n_itens_entrada, n_apos_dedup, n_mapeados, n_residual}
      }
    """
    from extractors.table_dedup import dedup_by_fingerprint, map_rows_to_xlsx, filter_orcar_items
    from extractors.table_dedup import _parse_revisao
    from extractors.derived_quantities import apply_derived_quantities

    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    try:
        context = json.loads(context_json) if context_json else {}
    except Exception:
        context = {}

    obra            = context.get("obra", "")
    checklist       = context.get("checklist", [])
    pranchas        = context.get("pranchas", [])
    incluir_secao_a = bool(context.get("incluir_secao_a", False))

    log.info("[orcar-tabelas] obra=%s %d pranchas %d checklist secao_a=%s",
             obra, len(pranchas), len(checklist), incluir_secao_a)

    # ── 1. Coleta e enriquece todos os itens ────────────────────────────────
    all_items: list[dict] = []
    for prancha in pranchas:
        stem    = prancha.get("stem", "?")
        rev_str, rev_num = _parse_revisao(stem)
        for it in prancha.get("items", []):
            enriched = dict(it)
            enriched["prancha_id"]  = stem
            enriched["revisao"]     = rev_str
            enriched["revisao_num"] = rev_num
            all_items.append(enriched)

    n_entrada = len(all_items)

    # ── DEBUG provadores: contar itens por prancha antes do filtro ───────────
    from collections import Counter as _Counter
    _pre_filter = _Counter(it.get("prancha_id", "?") for it in all_items)
    log.info("[orcar-tabelas] itens por prancha (pré-filtro): %s", dict(sorted(_pre_filter.items())))
    _prov_pre = [it for it in all_items if _parse_prancha_num(it.get("prancha_id", "")) in {"131", "132"}]
    if _prov_pre:
        log.info("[orcar-tabelas] PROVADORES pré-filtro %d items: %s",
                 len(_prov_pre),
                 [(it.get("tabela", "?"), it.get("descricao", "")[:30]) for it in _prov_pre[:10]])
    else:
        log.warning("[orcar-tabelas] PROVADORES — ZERO items de 131/132 chegaram ao pipeline!")

    all_items = filter_orcar_items(all_items)

    # ── DEBUG provadores: o que o filtro removeu ─────────────────────────────
    _post_filter = _Counter(it.get("prancha_id", "?") for it in all_items)
    for _pid, _pre_count in _pre_filter.items():
        _post_count = _post_filter.get(_pid, 0)
        if _pre_count != _post_count:
            log.info("[orcar-tabelas] filtro removeu %d/%d de %s", _pre_count - _post_count, _pre_count, _pid)

    log.info("[orcar-tabelas] %d itens após filtro (%d removidos)", len(all_items), n_entrada - len(all_items))

    # ── 2. Deduplicação ─────────────────────────────────────────────────────
    deduped, dedup_log = dedup_by_fingerprint(all_items)

    # ── 3. Mapeamento XLSX ──────────────────────────────────────────────────
    mapped, unmapped, map_dedup_log, linhas_pre = map_rows_to_xlsx(deduped, checklist, api_key)
    dedup_log = dedup_log + map_dedup_log

    # ── 3b. Quantidades derivadas (chapisco, autonivelante) ─────────────────
    checklist_by_cod: dict[str, dict] = {it["cod"]: it for it in checklist if it.get("cod")}
    derived_items = apply_derived_quantities(mapped, checklist_by_cod, obra=obra)
    mapped = mapped + derived_items

    # ── 4. Calcula vlrTotal a partir do checklist ────────────────────────────
    itens_resultado: list[dict] = []

    for it in mapped:
        cod = it.get("cod", "")
        xl  = checklist_by_cod.get(cod, {})
        mat  = float(xl.get("mat", 0) or 0)
        mo   = float(xl.get("mo", 0) or 0)
        mc   = bool(xl.get("materialCliente", False))
        vlr_unit = float(xl.get("vlrUnit", 0) or 0)
        qty      = float(it.get("quantidade", 0))
        vlr_mat  = 0.0 if mc else round(qty * mat, 2)
        vlr_mo   = round(qty * mo, 2)
        vlr_total = vlr_mo if mc else round(qty * vlr_unit, 2)
        itens_resultado.append({
            "cod":             cod,
            "descricao":       xl.get("descricao") or it.get("descricao", ""),
            "quantidade":      round(qty, 4),
            "unidade":         it.get("unidade", xl.get("unidade", "")),
            "vlrUnit":         vlr_unit,
            "mat":             mat,
            "mo":              mo,
            "vlrMat":          vlr_mat,
            "vlrMo":           vlr_mo,
            "materialCliente": mc,
            "vlrTotal":        vlr_total,
            "confianca":       it.get("confianca", 1.0),
            "fonte_pranchas":  it.get("fonte_pranchas", []),
            "status":          it.get("status", "confirmado"),
            "fonte":           it.get("fonte", "PDF"),
            "qdeReferencia":   float(xl.get("qdeReferencia") or 0) or None,
        })

    # ── 4b. Seção A — custos indiretos da planilha ───────────────────────────
    if incluir_secao_a:
        mapped_cods_pre = {it["cod"] for it in itens_resultado}
        for xl in checklist:
            if str(xl.get("secao", "")).upper() != "A":
                continue
            cod = xl.get("cod")
            if not cod or xl.get("zerado") or cod in mapped_cods_pre:
                continue
            ref = float(xl.get("qdeReferencia") or 0)
            if ref <= 0:
                continue
            mat  = float(xl.get("mat", 0) or 0)
            mo   = float(xl.get("mo", 0) or 0)
            mc   = bool(xl.get("materialCliente", False))
            vlr_unit = float(xl.get("vlrUnit", 0) or 0)
            vlr_mat  = 0.0 if mc else round(ref * mat, 2)
            vlr_mo   = round(ref * mo, 2)
            itens_resultado.append({
                "cod":             cod,
                "descricao":       xl.get("descricao", ""),
                "quantidade":      ref,
                "unidade":         xl.get("unidade", ""),
                "vlrUnit":         vlr_unit,
                "mat":             mat,
                "mo":              mo,
                "vlrMat":          vlr_mat,
                "vlrMo":           vlr_mo,
                "materialCliente": mc,
                "vlrTotal":        vlr_mo if mc else round(ref * vlr_unit, 2),
                "confianca":       1.0,
                "fonte_pranchas":  [],
                "status":          "planilha",
                "fonte":           "planilha",
                "qdeReferencia":   ref,
            })

    # ── 5. Residual: cods XLSX sem cobertura ─────────────────────────────────
    mapped_cods = {it["cod"] for it in itens_resultado}
    residual = [
        {"cod": it["cod"], "descricao": it.get("descricao", ""), "unidade": it.get("unidade", "")}
        for it in checklist
        if it.get("cod") and it["cod"] not in mapped_cods and not it.get("zerado")
    ]

    log.info("[orcar-tabelas] resultado: %d mapeados, %d residual, %d dedup ops",
             len(itens_resultado), len(residual), len(dedup_log))

    return JSONResponse({
        "itens":     itens_resultado,
        "residual":  residual,
        "dedup_log": dedup_log,
        "linhas_pre_agregacao": linhas_pre,
        "metadata": {
            "n_itens_entrada": n_entrada,
            "n_apos_filtro":   len(all_items),
            "n_apos_dedup":    len(deduped),
            "n_mapeados":      len(itens_resultado),
            "n_residual":      len(residual),
        },
    })


@app.post("/orcar-auditar")
async def orcar_auditar(
    context_json: str = Form(""),
):
    """
    Auditoria Haiku pós-orcar: detecta duplicatas e sugere quantidades.

    Input JSON:
      {
        obra, checklist, itens_deterministicos, dedup_log, linhas_pre_agregacao
      }
    """
    from extractors.haiku_reconcile import compact_payload, reconcile_with_haiku

    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    try:
        context = json.loads(context_json) if context_json else {}
    except Exception:
        context = {}

    obra       = context.get("obra", "")
    checklist  = context.get("checklist", [])
    itens      = context.get("itens_deterministicos", [])
    dedup_log  = context.get("dedup_log", [])
    linhas_pre = context.get("linhas_pre_agregacao", [])

    log.info("[orcar-auditar] obra=%s %d itens %d linhas pre-agg",
             obra, len(itens), len(linhas_pre))

    payload = compact_payload(obra, checklist, itens, dedup_log, linhas_pre)
    result, metadata = reconcile_with_haiku(payload, api_key)

    return JSONResponse({
        **result,
        "metadata": metadata,
    })


@app.post("/auditar")
async def auditar(
    context_json: str = Form(""),
):
    """
    Auditoria do orçamento consolidado vs totais esperados do XLSX.
    Recebe context_json com:
      { secao_totais: {seção: {total_calculado, n_itens, itens_aguardando}},
        totais_xlsx:  {seção: total_esperado} }
    Retorna flags de divergência por seção.
    """
    api_key = ANTHROPIC_KEY or os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurado")

    try:
        context = json.loads(context_json) if context_json else {}
    except Exception:
        context = {}

    secao_totais = context.get("secao_totais", {})
    totais_xlsx  = context.get("totais_xlsx", {})
    obra         = context.get("obra", "")

    log.info("[auditar] obra=%s %d seções calculadas, %d seções XLSX", obra, len(secao_totais), len(totais_xlsx))

    prompt = build_auditoria_prompt(secao_totais, totais_xlsx, obra=obra)

    try:
        raw_text, tokens_in, tokens_out, custo = await asyncio.get_running_loop().run_in_executor(
            None, lambda: call_claude_multi(prompt, [], api_key)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Claude (auditar): {e}")

    raw_save_path = _log_path("auditoria", obra)
    try:
        parsed = parse_ai_json(raw_text, save_path=raw_save_path)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse({
        "total_calculado":    parsed.get("total_calculado", 0),
        "total_esperado":     parsed.get("total_esperado", 0),
        "delta_total":        parsed.get("delta_total", 0),
        "delta_pct":          parsed.get("delta_pct", 0),
        "secoes_ok":          parsed.get("secoes_ok", []),
        "secoes_problema":    parsed.get("secoes_problema", []),
        "itens_aguardando_total": parsed.get("itens_aguardando_total", 0),
        "qualidade_geral":    parsed.get("qualidade_geral", ""),
        "observacoes":        parsed.get("observacoes", ""),
        "prompt_sent":        prompt,
        "raw_output":         raw_text,
        "metadata": {
            "tokens_input":  tokens_in,
            "tokens_output": tokens_out,
            "custo_usd":     round(custo, 5),
        },
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
    for it in parsed.get("itens", []):
        label = str(it.get("prancha", "A")).upper()
        stem  = label_to_stem.get(label, batch_items[0]["stem"])
        batched.setdefault(stem, []).append(it)

    return JSONResponse({
        "batched": batched,
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

    # Tenta inferir a obra a partir do stem (ex: "CEA-254-BLN-ARQ_R03-301" → "CEA-254-BLN")
    obra_inferida = re.match(r"(CEA-\d+-[A-Z]+)", stem)
    obra_stem = obra_inferida.group(1) if obra_inferida else stem[:20]

    raw_save_path = _log_path("extractor", obra_stem, stem)
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
