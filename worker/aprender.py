# -*- coding: utf-8 -*-
"""
aprender.py — Router FastAPI para aprendizado de nomenclaturas.

Endpoints:
  POST /aprender/analisar    → Analisa PDF/DXF e retorna itens matched/unmatched
  POST /aprender/ia-sugerir  → IA sugere mapeamentos para itens desconhecidos
  POST /aprender/atualizar   → Aplica sugestões aprovadas ao banco
  POST /aprender/verificar   → Re-executa análise e retorna nova cobertura
"""

import json
import logging
import re
import tempfile
import unicodedata
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from config import ANTHROPIC_KEY, MODEL
from extractors.pdf_extractor import extract_pdf, parse_cea_qnt_tables
from extractors.dxf_extractor import extract_dxf
from extractors.ai_client import call_claude

log = logging.getLogger("aprender")

router = APIRouter(prefix="/aprender", tags=["aprender"])

DB_PATH = Path(__file__).parent / "nomenclaturas_db.json"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _load_db() -> dict:
    if not DB_PATH.exists():
        return {"version": 1, "items": []}
    return json.loads(DB_PATH.read_text(encoding="utf-8"))


def _save_db(db: dict) -> None:
    from datetime import date
    db["last_updated"] = date.today().isoformat()
    DB_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")


def _normalize(text: str) -> str:
    """Lowercase, sem acentos, sem pontuação extra."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", text.lower()).strip()


def _match_item(name: str, db_items: list[dict]) -> Optional[dict]:
    """
    Tenta casar o nome com canonical ou variações do banco.

    Critérios (por ordem de precisão):
    1. Igual normalizado ao canonical_name.
    2. Igual normalizado a uma variação.
    3. Variação está CONTIDA no nome (substring), mas apenas se a variação
       tiver >= 5 chars e representar >= 40% do nome — evita matches espúrios
       como "cuba" batendo em textos longos não relacionados.
    """
    norm = _normalize(name)
    words_name = set(norm.split())

    for item in db_items:
        cn = _normalize(item.get("canonical_name", ""))

        # 1. Exact match no canonical
        if norm == cn:
            return item

        for var in item.get("variations", []):
            var_norm = _normalize(var)
            if not var_norm:
                continue

            # 2. Exact match na variação
            if norm == var_norm:
                return item

            # 3. Substring com restrições de tamanho
            min_len = 5
            if len(var_norm) >= min_len and len(norm) >= min_len:
                if var_norm in norm and len(var_norm) / len(norm) >= 0.4:
                    return item
                if norm in var_norm and len(norm) / len(var_norm) >= 0.4:
                    return item

    return None


# Cabeçalhos genéricos conhecidos que não são itens orçáveis
_GENERIC_HEADERS = {
    "DESCRIÇÃO", "Descrição", "DESCRIPCION", "LOCAL", "AMBIENTE", "SETOR",
    "PAREDES", "PISO", "TETO", "FORRO", "REFERÊNCIA", "REFERENCIA",
    "MATERIAL", "OBSERVAÇÃO", "OBSERVACAO", "QUANTIDADE", "UNIDADE",
    "ÁREA", "AREA", "TOTAL", "SUBTOTAL", "ITEM", "TÍTULO", "TITULO",
    "LEGENDA", "NOTAS", "NOTA", "OBS", "QTD", "UN", "M²", "ML",
}

_RE_NOISE = re.compile(
    r"^\d+[\)\.]"           # instrução numerada: "11)" ou "13."
    r"|^\d{3}\s*[-–]"       # referência a prancha: "304 - PLANTA"
    r"|^(com|de|do|da|e |em|na|no|não|por|se|ou|a |o )\b"  # fragmento iniciando com preposição
    r"|\b(título do desenho|planta de |caderno técnico|padrão de piso|seguindo padrão)\b"
    r"|[()]{1}.*[a-z]{3}"   # contém parênteses no meio de frase
    , re.IGNORECASE
)


def _is_noise(name: str) -> bool:
    """Retorna True se o nome parece ruído (instrução, cabeçalho, fragmento)."""
    stripped = name.strip()
    # Muito curto
    if len(stripped) < 4:
        return True
    # Cabeçalho genérico exato
    if stripped in _GENERIC_HEADERS or stripped.upper() in _GENERIC_HEADERS:
        return True
    # Termina com ponto (instrução ou abreviação)
    if stripped.endswith(".") and len(stripped) < 20:
        return True
    # Mais de 10 palavras = instrução normativa
    if len(stripped.split()) > 10:
        return True
    # Padrões de ruído por regex
    if _RE_NOISE.search(stripped):
        return True
    return False


def _extract_item_names(pdf_data: dict, dxf_data: dict) -> list[str]:
    """Extrai nomes únicos de itens do PDF e do DXF.

    Usa apenas tabelas estruturadas (CEA-QNT e quadro de acabamentos) —
    evita text_lines que gera ruído de cabeçalhos e instruções.
    """
    names: set[str] = set()

    # cea_qnt_tables: list[list[list[str]]]
    for table in pdf_data.get("cea_qnt_tables", []):
        for row in table[1:]:  # pula cabeçalho
            cells = [str(c).strip() for c in row if c and str(c).strip()]
            for cell in cells:
                if len(cell) > 4 and not re.match(r"^[\d\s\.,\-]+$", cell):
                    if not _is_noise(cell):
                        names.add(cell[:120])
                    break

    # quadro_acabamentos: mesma estrutura 2D
    for table in pdf_data.get("quadro_acabamentos", []):
        for row in table[1:]:
            cells = [str(c).strip() for c in row if c and str(c).strip()]
            for cell in cells:
                if len(cell) > 4 and not re.match(r"^[\d\s\.,\-]+$", cell):
                    if not _is_noise(cell):
                        names.add(cell[:120])
                    break

    # Textos do DXF — filtro mais restrito (muito ruído de layers/blocos)
    for text in dxf_data.get("texts", []):
        val = str(text).strip()
        if 4 < len(val) < 60 and not re.match(r"^[\d\s\.,\-/°%]+$", val) and not _is_noise(val):
            names.add(val[:60])

    return sorted(names)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AnaliseResult(BaseModel):
    matched: list[dict]
    unmatched: list[str]
    coverage_pct: float
    total_items: int


class Suggestion(BaseModel):
    item_name: str
    tipo: str                      # "variacao" | "novo" | "ruido"
    target_id: Optional[str]       # ID do item existente (se variacao)
    canonical_name: Optional[str]  # Nome canônico sugerido (se novo)
    category: Optional[str]
    unit: Optional[str]
    has_price: bool = False
    rationale: str
    confidence: int = 70           # 0-100: confiança da IA
    is_orcavel: bool = True        # False = ruído/instrução, não deve entrar no banco


class SuggestionRequest(BaseModel):
    unmatched_items: list[str]


class UpdateRequest(BaseModel):
    approved: list[Suggestion]


class VerifyRequest(BaseModel):
    pdf_stem: Optional[str] = None
    dxf_stem: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

async def _processar_arquivos(files: list[UploadFile]) -> tuple[set[str], set[str]]:
    """
    Processa uma lista de arquivos (PDFs e DXFs misturados).
    Retorna (item_names_from_tables, item_names_from_structure).
    """
    _empty_pdf = {"ok": False, "cea_qnt_tables": [], "quadro_acabamentos": [], "measure_lines": [], "area_tags": [], "errors": []}
    _empty_dxf = {"ok": False, "layers": [], "dims": [], "blocks": {}, "texts": [], "errors": []}

    all_item_names: set[str] = set()
    all_extra_names: set[str] = set()

    for f in files:
        fname = f.filename or ""
        ext = Path(fname).suffix.lower()
        raw = await f.read()

        with tempfile.NamedTemporaryFile(suffix=ext or ".tmp", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = Path(tmp.name)

        try:
            if ext == ".pdf":
                pdf_data = extract_pdf(str(tmp_path))
                if pdf_data.get("ok"):
                    pdf_items = parse_cea_qnt_tables(pdf_data)
                    all_item_names.update(it["descricao"] for it in pdf_items if it.get("descricao"))
                    all_extra_names.update(_extract_item_names(pdf_data, _empty_dxf))
                    log.info("PDF %s: %d itens de tabela, %d extras", fname, len(pdf_items), len(all_extra_names))
                else:
                    log.warning("PDF %s: falha na extração — %s", fname, pdf_data.get("errors"))

            elif ext in (".dxf", ".dwg"):
                dxf_data = extract_dxf(str(tmp_path))
                if dxf_data.get("ok"):
                    all_extra_names.update(_extract_item_names(_empty_pdf, dxf_data))
                    log.info("DXF %s: %d extras", fname, len(all_extra_names))
            else:
                log.warning("Arquivo ignorado (extensão desconhecida): %s", fname)
        except Exception as e:
            log.warning("Erro ao processar %s: %s", fname, e)
        finally:
            tmp_path.unlink(missing_ok=True)

    return all_item_names, all_extra_names


@router.post("/analisar", response_model=AnaliseResult)
async def analisar(files: list[UploadFile] = File(default=[])):
    """
    Recebe múltiplos PDFs e/ou DXFs, extrai nomes de itens de todos e compara com o banco.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Envie ao menos um arquivo PDF ou DXF.")

    db = _load_db()
    db_items = db.get("items", [])

    item_names, extra_names = await _processar_arquivos(files)
    all_names = sorted(item_names | extra_names)

    matched = []
    unmatched = []
    for name in all_names:
        m = _match_item(name, db_items)
        if m:
            matched.append({"item_name": name, "matched_to": m["canonical_name"], "id": m["id"]})
        else:
            unmatched.append(name)

    total = len(all_names)
    coverage = (len(matched) / total * 100) if total > 0 else 0.0

    log.info("Análise: %d itens, %d matched (%.1f%%), %d não mapeados",
             total, len(matched), coverage, len(unmatched))

    return AnaliseResult(
        matched=matched,
        unmatched=unmatched,
        coverage_pct=round(coverage, 1),
        total_items=total,
    )


@router.post("/ia-sugerir")
async def ia_sugerir(body: SuggestionRequest):
    """
    Chama Claude com os itens não mapeados + banco atual.
    Retorna sugestões estruturadas (variação de item existente ou novo item).
    """
    if not body.unmatched_items:
        return {"suggestions": []}

    api_key = ANTHROPIC_KEY
    if not api_key:
        import os
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY não configurado.")

    db = _load_db()
    db_items = db.get("items", [])

    db_summary = [
        f"- id={it['id']} | canonical={it['canonical_name']} | cat={it['category']} | unit={it['unit']}"
        for it in db_items
    ]

    prompt = f"""Você é um especialista em orçamento de obras de fit-out para construtoras brasileiras.

Temos um banco de nomenclaturas com os seguintes itens registrados:
{chr(10).join(db_summary)}

Os itens abaixo foram extraídos de um projeto de construção civil e NÃO foram reconhecidos no banco:
{chr(10).join(f'- "{name}"' for name in body.unmatched_items)}

Para cada item, primeiro avalie se é um ITEM ORÇÁVEL (material, serviço, equipamento que gera custo) ou RUÍDO (fragmento de texto, cabeçalho, instrução de execução, nota normativa, referência a prancha, abreviação de ambiente).

Depois classifique:
1. RUÍDO → tipo = "ruido", is_orcavel = false, confidence = 95
2. VARIAÇÃO de item existente → tipo = "variacao", is_orcavel = true, informe target_id
3. NOVO item orçável → tipo = "novo", is_orcavel = true, sugira canonical_name, category e unit

Categories válidas: civil, eletrica, hidraulica, marcenaria, vidros, revestimento, pintura, fachada, climatizacao, outro
Units válidas: m2, ml, un, m3, vb, kg, hr

Responda SOMENTE com JSON válido, sem markdown:
{{
  "suggestions": [
    {{
      "item_name": "nome exato extraído",
      "tipo": "ruido" | "variacao" | "novo",
      "is_orcavel": true | false,
      "confidence": 0-100,
      "target_id": "id do item existente (se variacao, senão null)",
      "canonical_name": "nome canônico sugerido (se novo, senão null)",
      "category": "categoria (se novo, senão null)",
      "unit": "unidade (se novo, senão null)",
      "has_price": false,
      "rationale": "explicação de 1 linha"
    }}
  ]
}}"""

    try:
        raw_text, _, _, _ = call_claude(prompt, None, api_key, max_tokens=4096)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Claude: {e}")

    # Parse JSON da resposta
    try:
        # Tenta extrair JSON do texto
        match = re.search(r'\{[\s\S]*\}', raw_text)
        if not match:
            raise ValueError("Nenhum JSON encontrado na resposta da IA")
        data = json.loads(match.group())
        return data
    except Exception as e:
        log.error("Erro ao parsear resposta da IA: %s\nRaw: %s", e, raw_text[:500])
        raise HTTPException(status_code=500, detail=f"Erro ao parsear resposta da IA: {e}")


def _already_covered(item_name: str, items_by_id: dict) -> str | None:
    """
    Retorna o id do item se item_name já está coberto (canonical ou variação).
    Evita adicionar duplicatas ao banco.
    """
    norm = _normalize(item_name)
    for it in items_by_id.values():
        if norm == _normalize(it.get("canonical_name", "")):
            return it["id"]
        if any(norm == _normalize(v) for v in it.get("variations", [])):
            return it["id"]
    return None


def _canonical_id_similar(canonical_name: str, items_by_id: dict) -> str | None:
    """
    Verifica se já existe um item cujo canonical_name normalizado seja contido
    no novo ou o novo seja contido nele (evita 'Grama Sintética' vs 'Grama Sintética Premium').
    Retorna o id do item existente se houver sobreposição alta.
    """
    norm_new = _normalize(canonical_name)
    for it in items_by_id.values():
        norm_ex = _normalize(it.get("canonical_name", ""))
        # substring mútua ou igual
        if norm_ex == norm_new or norm_ex in norm_new or norm_new in norm_ex:
            return it["id"]
    return None


@router.post("/atualizar")
async def atualizar(body: UpdateRequest):
    """
    Aplica sugestões aprovadas ao banco de nomenclaturas.
    Variações são adicionadas ao item existente; novos itens são inseridos.
    Duplicatas são detectadas e ignoradas com log, nunca sobrescrevem dados existentes.
    """
    db = _load_db()
    items_by_id = {it["id"]: it for it in db.get("items", [])}

    added_variations = []
    added_items = []
    skipped = []   # duplicatas detectadas
    errors = []
    seen_names: set[str] = set()   # dedup dentro do mesmo batch

    for sug in body.approved:
        norm_name = _normalize(sug.item_name)

        # ── Dedup intra-batch ────────────────────────────────────────────
        if norm_name in seen_names:
            skipped.append({"item_name": sug.item_name, "reason": "duplicado no mesmo batch"})
            continue
        seen_names.add(norm_name)

        # ── item_name já coberto pelo banco atual ────────────────────────
        already = _already_covered(sug.item_name, items_by_id)
        if already:
            skipped.append({"item_name": sug.item_name, "reason": f"já coberto por '{already}'"})
            continue

        if sug.tipo == "variacao":
            if not sug.target_id:
                errors.append(f"Variação sem target_id: {sug.item_name}")
                continue
            target = items_by_id.get(sug.target_id)
            if not target:
                errors.append(f"Item não encontrado: {sug.target_id}")
                continue
            existing_norms = [_normalize(v) for v in target.get("variations", [])]
            if norm_name not in existing_norms:
                target.setdefault("variations", []).append(sug.item_name)
                added_variations.append({"variation": sug.item_name, "added_to": sug.target_id})
            else:
                skipped.append({"item_name": sug.item_name, "reason": "variação já existe no target"})

        elif sug.tipo == "novo":
            if not sug.canonical_name:
                errors.append(f"Novo item sem canonical_name: {sug.item_name}")
                continue

            # ── canonical_name similar a item existente → vira variação ─
            similar_id = _canonical_id_similar(sug.canonical_name, items_by_id)
            if similar_id:
                target = items_by_id[similar_id]
                existing_norms = [_normalize(v) for v in target.get("variations", [])]
                if norm_name not in existing_norms:
                    target.setdefault("variations", []).append(sug.item_name)
                    added_variations.append({
                        "variation": sug.item_name,
                        "added_to": similar_id,
                        "note": f"canonical '{sug.canonical_name}' similar ao existente '{target['canonical_name']}' — adicionado como variação",
                    })
                else:
                    skipped.append({"item_name": sug.item_name, "reason": f"canonical similar a '{similar_id}' e variação já existe"})
                continue

            new_id = re.sub(r"[^a-z0-9]", "-", _normalize(sug.canonical_name))[:40].strip("-")
            if new_id in items_by_id:
                # ID colide — adiciona como variação do existente
                existing_norms = [_normalize(v) for v in items_by_id[new_id].get("variations", [])]
                if norm_name not in existing_norms:
                    items_by_id[new_id].setdefault("variations", []).append(sug.item_name)
                    added_variations.append({"variation": sug.item_name, "added_to": new_id, "note": "ID colide com existente"})
                else:
                    skipped.append({"item_name": sug.item_name, "reason": f"ID '{new_id}' colide e variação já existe"})
            else:
                new_item = {
                    "id": new_id,
                    "canonical_name": sug.canonical_name,
                    "category": sug.category or "outro",
                    "unit": sug.unit or "un",
                    "price_key": new_id.upper().replace("-", "_"),
                    "has_price": sug.has_price,
                    "variations": [sug.item_name] if norm_name != _normalize(sug.canonical_name) else [],
                }
                items_by_id[new_id] = new_item
                added_items.append(new_item)

    db["items"] = list(items_by_id.values())
    _save_db(db)

    log.info("Banco atualizado: %d variações, %d novos, %d pulados, %d erros",
             len(added_variations), len(added_items), len(skipped), len(errors))

    return {
        "ok": True,
        "added_variations": added_variations,
        "added_items": added_items,
        "skipped": skipped,
        "errors": errors,
        "total_items": len(db["items"]),
    }


@router.post("/verificar", response_model=AnaliseResult)
async def verificar(files: list[UploadFile] = File(default=[])):
    """Re-executa a análise com o banco atualizado."""
    return await analisar(files=files)


class RematchRequest(BaseModel):
    item_names: list[str]


@router.post("/re-match", response_model=AnaliseResult)
async def re_match(body: RematchRequest):
    """
    Re-faz o matching dos nomes já extraídos contra o banco atualizado.
    Mais rápido que /verificar — não precisa re-processar PDFs/DXFs.
    """
    db = _load_db()
    db_items = db.get("items", [])

    matched = []
    unmatched = []
    for name in body.item_names:
        m = _match_item(name, db_items)
        if m:
            matched.append({"item_name": name, "matched_to": m["canonical_name"], "id": m["id"]})
        else:
            unmatched.append(name)

    total = len(body.item_names)
    coverage = (len(matched) / total * 100) if total > 0 else 0.0

    return AnaliseResult(
        matched=matched,
        unmatched=unmatched,
        coverage_pct=round(coverage, 1),
        total_items=total,
    )


@router.get("/banco")
async def get_banco():
    """Retorna o banco de nomenclaturas completo."""
    db = _load_db()
    return db


# ─── Pre-scan ─────────────────────────────────────────────────────────────────

class FileScanResult(BaseModel):
    filename: str
    ext: str                     # "pdf" | "dxf"
    needs_ai: bool
    reason: str                  # explicação da decisão
    items_found: int             # itens extraídos programaticamente
    tables_found: int            # tabelas estruturadas encontradas
    measures_found: int          # linhas com medidas (m², ml, un…)
    size_kb: float


@router.post("/pre-scan")
async def pre_scan(files: list[UploadFile] = File(default=[])):
    """
    Analisa cada arquivo com extração programática (sem IA) e decide
    quais precisarão ser enviados à IA na análise principal.

    Critérios para needs_ai=False:
      - DXF: sempre False (extração 100% programática)
      - PDF: False se encontrar ≥ 3 itens com quantidade em tabelas estruturadas
             (cea_qnt_tables ou quadro_acabamentos)
    """
    results: list[FileScanResult] = []

    for upload in files:
        fname = upload.filename or "unknown"
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        raw = await upload.read()
        size_kb = round(len(raw) / 1024, 1)

        if ext in ("dxf", "dwg"):
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(raw)
                tmp_path = tmp.name
            try:
                dxf_data = extract_dxf(tmp_path)
                texts = dxf_data.get("texts", [])
                items_found = sum(1 for t in texts if _MATERIAL_KW.search(t))
            except Exception:
                texts = []
                items_found = 0
            finally:
                import os as _os
                _os.unlink(tmp_path)

            results.append(FileScanResult(
                filename=fname,
                ext=ext,
                needs_ai=False,
                reason="DXF é extraído 100% por código (geometria + textos)",
                items_found=items_found,
                tables_found=0,
                measures_found=len(texts),
                size_kb=size_kb,
            ))

        elif ext == "pdf":
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(raw)
                tmp_path = tmp.name
            try:
                pdf_data = extract_pdf(tmp_path)
            except Exception as e:
                results.append(FileScanResult(
                    filename=fname, ext=ext, needs_ai=True,
                    reason=f"Erro na extração: {e}",
                    items_found=0, tables_found=0, measures_found=0,
                    size_kb=size_kb,
                ))
                continue
            finally:
                import os as _os
                _os.unlink(tmp_path)

            # Conta itens com quantidade em tabelas estruturadas
            structured_items = 0
            for table in pdf_data.get("cea_qnt_tables", []):
                for row in table[1:]:  # skip header
                    if row and any(str(c).strip() for c in row if c):
                        structured_items += 1
            for table in pdf_data.get("quadro_acabamentos", []):
                for row in table[1:]:
                    if row and any(str(c).strip() for c in row if c):
                        structured_items += 1

            tables_found = (
                len(pdf_data.get("cea_qnt_tables", [])) +
                len(pdf_data.get("quadro_acabamentos", []))
            )
            measures_found = len(pdf_data.get("measure_lines", []))
            material_lines = sum(
                1 for l in pdf_data.get("text_lines", [])
                if _MATERIAL_KW.search(l)
            )

            # Decisão
            if structured_items >= 3:
                needs_ai = False
                reason = (
                    f"{tables_found} tabela(s) estruturada(s) com "
                    f"{structured_items} itens — extração programática suficiente"
                )
            elif measures_found >= 5 and material_lines >= 3:
                needs_ai = False
                reason = (
                    f"Sem tabelas, mas {measures_found} linhas com medidas e "
                    f"{material_lines} linhas com materiais — extração textual adequada"
                )
            else:
                needs_ai = True
                reason = (
                    f"Pouco conteúdo estruturado ({structured_items} itens em tabelas, "
                    f"{measures_found} medidas, {material_lines} materiais) — "
                    "necessário análise visual por IA"
                )

            results.append(FileScanResult(
                filename=fname,
                ext=ext,
                needs_ai=needs_ai,
                reason=reason,
                items_found=structured_items or material_lines,
                tables_found=tables_found,
                measures_found=measures_found,
                size_kb=size_kb,
            ))

        else:
            results.append(FileScanResult(
                filename=fname, ext=ext, needs_ai=False,
                reason="Formato não suportado — ignorado",
                items_found=0, tables_found=0, measures_found=0,
                size_kb=size_kb,
            ))

    ai_count = sum(1 for r in results if r.needs_ai)
    return {
        "files": [r.model_dump() for r in results],
        "summary": {
            "total": len(results),
            "needs_ai": ai_count,
            "skip_ai": len(results) - ai_count,
        },
    }


import re as _re
_MATERIAL_KW = _re.compile(
    r"drywall|gesso|alvenar|ceram|porcelanat|piso|pint|imperm|divisor|"
    r"painel|forro|porta|vidro|espelho|granito|marmore|rodap|manta|"
    r"madeira|mdp|mdf|osb|acm|acril|latex|epoxi|revestim|soleira|"
    r"parede|bloco|concreto|tabua|formica|laminad|fachada|vitrine|"
    r"hidrante|corrimao|guardacorpo|cortin|fechamento|tablado|ripado",
    _re.IGNORECASE,
)
