# -*- coding: utf-8 -*-
"""
pdf_extractor.py — extração de texto, tabelas e medidas de arquivos PDF.

Retorna um dict com:
  ok                  bool       — leitura bem-sucedida
  text_lines          list[str]  — linhas LIMPAS (após filtro de ruído blocklist)
  budget_lines        list[str]  — linhas relevantes para orçamento (filtro positivo)
  raw_text_lines      list[str]  — linhas BRUTAS (antes de qualquer filtro)
  noise_removed       list[str]  — linhas descartadas pelo filtro de ruído
  measure_lines       list[str]  — linhas com medidas (m², ml, un)
  area_tags           list[str]  — linhas com A = XX m
  cea_qnt_tables      list       — tabelas com cabeçalho CEA-QNT
  quadro_acabamentos  list       — tabelas "Quadro de Acabamentos"
  errors              list[str]  — erros por página
"""

import re
import logging

from config import _MATERIAL_KEYWORDS, normalize_key, guess_categoria

log = logging.getLogger("extractor")

RE_CEA_QNT = re.compile(r"CEA\s*[-]\s*QNT", re.IGNORECASE)
RE_QUADRO  = re.compile(r"QUADRO\s+DE\s+ACABAMENTOS", re.IGNORECASE)
RE_AREA    = re.compile(r"A\s*=\s*[\d,.]+\s*m", re.IGNORECASE)
RE_MEASURE = re.compile(r"\d+[,.]?\d*\s*(m2|m\u00b2|ml|un|vb|m\b)", re.IGNORECASE)

RE_NUMERO   = re.compile(r"^\d+[,.]?\d*$")
RE_AREA_VAL = re.compile(r"([\d,.]+)\s*m[²2]", re.IGNORECASE)   # ² obrigatório — evita capturar coluna PERIM (m linear)
RE_ML_VAL   = re.compile(r"([\d,.]+)\s*m\.?l\.?", re.IGNORECASE)
RE_UN_VAL   = re.compile(r"([\d,.]+)\s*un", re.IGNORECASE)

# ── Budget row detection (desc + qty + unit) ─────────────────────────────────
RE_BUDGET_ROW = re.compile(
    r"^(?:(?:P\d+[A-Z]?|\d{1,2})\s+)?"
    r"([A-ZÁÉÍÓÚÀÂÊÎÔÃÕÇ][\w\s\-–/\.]{4,}?)\s+"
    r"([\d,.]+)\s*(m[²2]|m\.?l\.?|un)\b"
    r"(?:\s+([\d,.]+))?",
    re.IGNORECASE,
)
RE_BUDGET_QTY_START = re.compile(
    r"^[\d,.]+\s*(m[²2]|m\.?l\.?|un)\b",
    re.IGNORECASE,
)
RE_CEA_HEADER = re.compile(r"CEA\s*[-–]\s*(QNT|LINEAR|QNTD)\b", re.IGNORECASE)
_RE_GRAND_OR_TOTAL = re.compile(r"^(Grand\s+total|TOTAIS?\s*:)", re.IGNORECASE)

# ── Cotas de altura ──────────────────────────────────────────────────────────
# Suporte a três formatos encontrados nas pranchas:
#   1. "H CERAMICA 140"  ou  "H CERAMICA: 140"   → RE_H_LABELED
#   2. "H CERAMICA\n140"  (número na linha seguinte)  → RE_H_ALONE + RE_NUMERO
#   3. "H = 140cm"  (genérico sem rótulo de material)  → RE_H_INLINE
RE_H_ALONE   = re.compile(r"^H\s+(PINT|CERAM|FORRO|ALVENAR|REVEST|GESSO|AZULEJ|RODAP)", re.IGNORECASE)
RE_H_LABELED = re.compile(r"\bH\s+(PINT|CERAM|FORRO|ALVENAR|REVEST|GESSO|AZULEJ|RODAP)\w*[\s:=]+(\d+)", re.IGNORECASE)
RE_H_INLINE  = re.compile(r"\bH\s*=\s*(\d+)\s*cm", re.IGNORECASE)   # "H = 140cm" genérico

# ── Filtros de ruído: linhas que não são itens de obra ────────────────────────
# Cada padrão está comentado com o tipo de linha que ele descarta.
_RE_NOTA_GERAL   = re.compile(r"^\d{1,2}\s*\)")                         # "09) NÃO SERÁ..."
_RE_REVISAO      = re.compile(r"\bR\d{2}\s+\d{2}/\d{2}/\d{4}\b")       # "R02 25/09/2025"
_RE_DATA         = re.compile(r"\b\d{2}/\d{2}/\d{4}\b")                 # qualquer data
_RE_ESC          = re.compile(r"\bESC\s*\.?\s*:\s*1\s*:", re.IGNORECASE)# "ESC.: 1 : 50"
_RE_PLANTA_REF   = re.compile(r"^\d{3}\s*[-–]\s*(PLANTA|CORTE|ELEVA|FORRO|PISO|AXON)", re.IGNORECASE)
_RE_AXONO_TITLE  = re.compile(r"^AXONOM[EÉ]TRICA\s+\d+\s+ESC", re.IGNORECASE)
_RE_CEP          = re.compile(r"\bCEP\s+\d{5}", re.IGNORECASE)
_RE_GRID_CODES   = re.compile(r"^([A-Z]{2,4}\d{2,4}\s+){3,}")           # "EQ94 EQ63 EQ63..."
_RE_CARIMBO      = re.compile(r"[A-Z]{2,4}[-_][A-Z]{2,4}[-_][A-Z]{2,4}.*_R\d{2}", re.IGNORECASE)
_RE_SETOR        = re.compile(r"^SETOR\s+\w", re.IGNORECASE)            # "SETOR BÁSICOS"
_RE_NUMERO_LISTA = re.compile(r"^(\d+\s+){4,}")                         # "64 64 644 64 64"
_RE_FRAG_NOTA    = re.compile(                                           # fragmento de nota
    r"\)\s+(E\s+NA|NO\s+LOCAL|VERIFICAR|CONFORME\s+PADR|DEVERÃO|NÃO\s+SERÁ|"
    r"EXECUTAR|ATÉ\s+A\s+PLAT|DEVERÁ\s+SER|SERÁ\s+OBRIG|NÃO\s+HAVERÁ|"
    r"VÃOS\s+NECES|ATENÇÃO\s+AO\s+TRAJETO|FIXAR\s+BANCOS|NÃO\s+ESTÁ\s+PERMIT|"
    r"PREVER\s+FOLGA|SERÁ\s+AUTOPORTANTE|NÃO\s+SERÁ\s+PERMIT|UTILIZAR\s+PERF)",
    re.IGNORECASE,
)
_RE_COORD_MIR    = re.compile(r"[A-Z]{2,}\\[A-Z\d:]{2,}\\", re.IGNORECASE)  # paths invertidos (AEC\ADC\ etc.)
_RE_REGISTRO_REV = re.compile(                                           # "R00 ... EMISSÃO INICIAL"
    r"^R\d{2}\s+\d{2}/\d{2}/\d{4}\s+",
    re.IGNORECASE,
)
_RE_LEGENDA      = re.compile(r"^LEGENDA\b", re.IGNORECASE)             # "LEGENDA INSTALAÇÕES FORRO..."
_RE_NOTAS_HEADER = re.compile(r"^NOTAS\s+(GERAIS|DO\s+PROJETO|DE\s+OBRA)\b", re.IGNORECASE)
_RE_INSTRUCAO    = re.compile(                                           # continuações de nota com instrução
    r"\b(VER\s+ESPECIFICA[ÇC]|VERIFICAR\s+CADERNO\s+T[EÉ]CN|CONFERIR\s+MEDIDAS|"
    r"CONFIRMAR\s+NECESSIDADE|CADERNO\s+T[EÉ]CNICO\s+DO\s+SHOPPING|"
    r"SEGUINDO\s+PADR[AÃ]O\s+DA\s+DIVIS|CONTATAR\s+O\s+ESCRIT[OÓ]RIO)",
    re.IGNORECASE,
)
_RE_SPEC_FRAG    = re.compile(                                           # sub-linhas de especificação técnica
    r"^(FIX\s*:|ACAB\s*:|ACAB\.?\s*:|SOLDADO\s+ABA|FONTE\s+BLIND|FUNDO\s+EM\s+CHAPA|"
    r"ATIRANTADO\.|BARRA\s+DE\s+[0-9\"\'½]+|INTERNA\s+DO\s+PAINEL|"
    r"latot\s+arutl|LATOT\s+ARUTL|"                                      # texto espelhado
    r"GALVANIZADA\s+MICROPERF|"                                          # continuação de porta
    r"PLACAS\s+EM\s+MDF\s+DE\s+0\d\s*MM|"                              # spec de relevo MDF
    r"PAINEL\s+CENTRALIZADO,\s+COM\s+PINT|"                             # continuação de fachada
    r"ACABAMENTO\s+H\s*=\s*\d+\s*cm|"                                   # fragmento de cerâmica "ACABAMENTO H=140cm"
    r"MONTANTES?\s+NTR\s+BRANCO|"                                        # fragmento de divisória Eucatex
    r"PROVADOR\s+MONTAGEM\s+NO\s+FORRO|"                                 # linha de luminária provador
    r"^FORMICA\s+PRATTAN\s+L\d+|"                                        # fragmento de rodapé "FORMICA PRATTAN L151..."
    r"^IRC\s+\d+\s+RODAP|"                                               # "IRC 90 RODAPÉ PRIMER..." artefato luminária/rodapé
    r"PROTE[CÇ][AÃ]O\s+IP\d+\s+ACAB|"                                   # spec de luminária "PROTEÇÃO IP20 ACAB.: PINTURA COR"
    r"^\d{4}\s*[-–]\s*\d+\s*mm\b|"                                       # código de modelo de luminária "2315 - 1500mm"
    r"^ARQ\s+\w+(\s+\w+)*\s+\d{3}\s*[-–]|"                             # título de prancha "ARQ ESTANTES RETAGUARDA 314 - ..."
    r"^(dor|vador|ovador)\s+Montagem\s+no\s+forro|"                       # fragmento de "Provador Montagem no forro" sem início
    r"^m/[\d\.]+h/?)",                                                   # spec de vida útil luminária "m/25.000h/" quando vira descrição isolada
    re.IGNORECASE,
)
# Especificações do QUADRO DE ACABAMENTOS que vazam para o parser de RODAPÉS.
# Ex: "R2 CURUPIXÁ ou TAUARI, COM ALTURA DE 20cm" → filtrar antes de usar como prev_desc.
_RE_ACABAMENTO_SPEC = re.compile(
    r"COM\s+ALTURA\s+DE\s+\d+|ou\s+tauari[,.]?\s+com\s+altura",
    re.IGNORECASE,
)

# Fragmentos que podem aparecer em QUALQUER posição da string (sem âncora ^).
# _RE_SPEC_FRAG usa ^(...) então .search() nele só captura padrões no início;
# este regex complementar captura os mesmos fragmentos quando surgem no meio.
_RE_FRAG_ANYWHERE = re.compile(
    r"MONTANTES?\s+NTR\s+BRANCO"
    r"|ACABAMENTO\s+H\s*=\s*\d+\s*cm",
    re.IGNORECASE,
)

_RE_SECAO_LABEL  = re.compile(                                           # labels de seção sem conteúdo útil
    r"^(FORRO\s+MEZANINO|PISO\s+MEZANINO|R\d\s+FACHADA|FACHADA\s+R\d|"
    r"PAREDES?_CREMALHEIRAS|PISO\s+ACABADO|FORMICA\s+DIMENS[OÕ]ES|"
    r"FABR\.\s+FORMICA|FABR\.\s+FORMICA\s*$)\s*$",
    re.IGNORECASE,
)
_RE_PLANTA_TITLE = re.compile(                                           # título de vista ("PLANTA BAIXA …")
    r"^PLANTA\s+(BAIXA|ALTA|FORRO|PISO)\b",
    re.IGNORECASE,
)
_RE_METRAGEM     = re.compile(                                           # metadados de metragem/legenda
    r"^(METRAGEM\s+(LINEAR|QUADRADA)|ALTURA\s+PISO\s*[-–]\s*FORRO|"
    r"AFASTAMENTO\s+TAPUME|LEGENDA\s+DE\s+TAPUME)",
    re.IGNORECASE,
)
_RE_PORTA_CODE   = re.compile(                                           # código de porta no detalhe (BUG-4)
    r"^P[ADGMFVLH]\s*\d{3}\s*\(",
    re.IGNORECASE,
)
_RE_MATERIAIS_LABEL = re.compile(r"^MATERIAIS\s*:", re.IGNORECASE)       # "MATERIAIS: ." em specs de porta (BUG-4)

# Quadro de Acabamentos / specs de produto — fragmentos que não são linhas de QNT
_RE_DIM_SPEC = re.compile(
    r"\b(ESPESSURA|DIMENS[ÃA]O|TAM\.|METÁLICA\s+H\s*=|\d+\s*mm\b|\d+\s*cm\b|"
    r"\d+\s*[xX×]\s*\d+\s*(mm|cm)?)\b",
    re.IGNORECASE,
)
_RE_FAB_SPEC = re.compile(
    r"^(FABR\.|FORMICA\s+(PRATTAN|ARTICO|GELO)|TARKETT\s*$|^\d{7,8}\s*,?\s*$|"
    r"STONE\s+PADR[AÃ]O|PAGINAÇÃO\s+FÓRMICA|ACARTONADO\s*$)",
    re.IGNORECASE,
)
_RE_INSTRUCAO_PISO = re.compile(
    r"\b(PONTO\s+DE\s+INÍCIO|SENTIDO\s+DE\s+COLOCAÇÃO|PAGINAÇÃO)\b",
    re.IGNORECASE,
)
_RE_VISTA_LABEL = re.compile(
    r"^(VISTA\s+ESQUEMÁTICA|REVEST\.?\s+PILAR|ESCALA\s+1\s*:\s*\d+|"
    r"REVESTIMENTO\s+PILARES|INDICAÇÃO\s+DE\s+REFER)",
    re.IGNORECASE,
)
_RE_H_DIM = re.compile(r"\bH\s*=\s*\d+|METÁLICA\s+H\s*=", re.IGNORECASE)
_RE_FACE_PLACA = re.compile(
    r"^FACE\s+PLACA\s+DE\s+GESSO\s+DRYWALL(\s+FACE\s+PLACA\s+DE\s+GESSO\s+DRYWALL)*",
    re.IGNORECASE,
)
_RE_PRODUCT_CODE = re.compile(r"^\d{7,8}(?:\s*,\s*\d{7,8})*\s*$")

# Tabela de filtros com tag legível (usada no debug para identificar QUAL padrão removeu cada linha)
_NOISE_FILTERS: list[tuple[str, re.Pattern]] = [
    ("nota_numerada",   _RE_NOTA_GERAL),
    ("revisao",         _RE_REVISAO),
    ("data",            _RE_DATA),
    ("escala",          _RE_ESC),
    ("ref_prancha",     _RE_PLANTA_REF),
    ("titulo_axono",    _RE_AXONO_TITLE),
    ("cep",             _RE_CEP),
    ("grid_codigos",    _RE_GRID_CODES),
    ("carimbo",         _RE_CARIMBO),
    ("setor",           _RE_SETOR),
    ("lista_numeros",   _RE_NUMERO_LISTA),
    ("frag_nota",       _RE_FRAG_NOTA),
    ("path_invertido",  _RE_COORD_MIR),
    ("registro_rev",    _RE_REGISTRO_REV),
    ("legenda",         _RE_LEGENDA),
    ("header_notas",    _RE_NOTAS_HEADER),
    ("instrucao",       _RE_INSTRUCAO),
    ("spec_frag",       _RE_SPEC_FRAG),
    ("secao_label",     _RE_SECAO_LABEL),
    ("planta_titulo",   _RE_PLANTA_TITLE),
    ("metragem",        _RE_METRAGEM),
    ("porta_code",      _RE_PORTA_CODE),
    ("materiais_label", _RE_MATERIAIS_LABEL),
    ("dim_spec",        _RE_DIM_SPEC),
    ("fab_spec",        _RE_FAB_SPEC),
    ("instrucao_piso",  _RE_INSTRUCAO_PISO),
    ("vista_label",     _RE_VISTA_LABEL),
    ("h_dim",           _RE_H_DIM),
    ("face_placa",      _RE_FACE_PLACA),
    ("product_code",    _RE_PRODUCT_CODE),
]

_REJOIN_CONT_END = re.compile(
    r"[-–,/]$|[-–]\s*$|\d+\s*CM$|\d+\s*MM$|\d+\s*cm$|\d+\s*mm$",
    re.IGNORECASE,
)
_MAX_MERGED_LEN = 200


def is_budget_row(line: str) -> bool:
    """True se a linha segue o padrão DESCRIÇÃO QTY unidade (m²/ml/un)."""
    return RE_BUDGET_ROW.match(line.strip()) is not None


def parse_budget_row(line: str) -> tuple[str, float, str] | None:
    """Extrai (descricao, quantidade, unidade) de uma linha de tabela QNT."""
    m = RE_BUDGET_ROW.match(line.strip())
    if not m:
        return None
    desc = m.group(1).strip()
    qty = float(m.group(2).replace(",", "."))
    unit_raw = m.group(3).lower().replace(".", "")
    if unit_raw == "un":
        unit = "un"
    elif unit_raw.startswith("ml"):
        unit = "ml"
    else:
        unit = "m2"
    return desc, qty, unit


def is_budget_relevant_line(line: str) -> bool:
    """Filtro positivo: linha útil para orçamento (PDF Limpo)."""
    s = line.strip()
    if not s:
        return False
    if RE_BUDGET_ROW.match(s):
        return True
    if RE_CEA_HEADER.search(s):
        return True
    if _RE_GRAND_OR_TOTAL.match(s):
        return True
    if RE_MEASURE.search(s) and _MATERIAL_KEYWORDS.search(s):
        return True
    return False


def _line_has_budget_unit(line: str) -> bool:
    return bool(RE_BUDGET_QTY_START.search(line) or RE_BUDGET_ROW.search(line))


def rejoin_budget_lines(lines: list[str]) -> list[str]:
    """
    Reúne linhas partidas pelo pdfplumber: descrição numa linha, qty m² na seguinte.
    """
    result: list[str] = []
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if not s:
            i += 1
            continue
        if i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            merged: str | None = None
            if (not _line_has_budget_unit(s)
                    and RE_BUDGET_QTY_START.match(nxt)
                    and (_MATERIAL_KEYWORDS.search(s)
                         or re.match(r"^[A-ZÁÉÍÓÚÀÂÊÎÔÃÕÇ]", s))
                    and len(s) + 1 + len(nxt) <= _MAX_MERGED_LEN):
                merged = s + " " + nxt
            elif (_REJOIN_CONT_END.search(s) and not _line_has_budget_unit(s)
                    and len(s) + 1 + len(nxt) <= _MAX_MERGED_LEN
                    and classify_noise(nxt) is None):
                merged = s + " " + nxt
            if merged:
                result.append(merged)
                i += 2
                continue
        result.append(s)
        i += 1
    return result


def build_budget_display_lines(raw_lines: list[str]) -> tuple[list[str], list[dict]]:
    """
    Filtro positivo para PDF Limpo: mantém só linhas relevantes para orçamento.
    Retorna (budget_lines, extra_noise) onde extra_noise são linhas rejeitadas
    que passaram o blocklist mas não são budget-relevant.
    """
    budget_lines: list[str] = []
    extra_noise: list[dict] = []
    for line in raw_lines:
        s = line.strip()
        if not s:
            continue
        if is_budget_relevant_line(s):
            budget_lines.append(s)
        elif classify_noise(s) is None:
            extra_noise.append({"line": s, "motivo": "not_budget_relevant"})
    return budget_lines, extra_noise


def is_noise_line(line: str) -> bool:
    """Retorna True se a linha for ruído (nota, carimbo, referência de prancha, etc.)."""
    return classify_noise(line) is not None


def classify_noise(line: str) -> str | None:
    """Retorna o nome do padrão que classificou a linha como ruído, ou None se limpa."""
    s = line.strip()
    for tag, pattern in _NOISE_FILTERS:
        # _RE_DATA tem guarda extra de comprimento para não bloquear linhas longas com datas embutidas
        if tag == "data":
            if pattern.search(s) and len(s) < 80:
                return tag
        elif tag in ("nota_numerada", "ref_prancha", "titulo_axono", "grid_codigos",
                     "setor", "lista_numeros", "legenda", "header_notas",
                     "spec_frag", "secao_label", "registro_rev",
                     "fab_spec", "vista_label", "face_placa", "product_code"):
            if pattern.match(s):
                return tag
        else:
            if pattern.search(s):
                return tag
    if len(s) < 12 and not RE_MEASURE.search(s) and not is_budget_row(s):
        return "orphan_short"
    return None


def extract_pdf(path: str) -> dict:
    r: dict = {
        "ok": False,
        "text_lines": [],           # linhas LIMPAS (após filtro blocklist)
        "budget_lines": [],         # linhas relevantes para orçamento (PDF Limpo)
        "raw_text_lines": [],       # linhas BRUTAS (antes de qualquer filtro)
        "noise_removed": [],        # {"line": str, "motivo": str}
        "measure_lines": [],
        "cea_qnt_tables": [],
        "quadro_acabamentos": [],
        "all_tables": [],           # TODAS as tabelas brutas do PDF (para parse_all_tables)
        "area_tags": [],
        "errors": [],
    }
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                try:
                    text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
                    all_lines = [l.strip() for l in text.split("\n") if l.strip()]
                    r["raw_text_lines"].extend(all_lines)

                    clean: list[str] = []
                    for l in all_lines:
                        motivo = classify_noise(l)
                        if motivo:
                            r["noise_removed"].append({"line": l, "motivo": motivo})
                        else:
                            clean.append(l)

                    r["text_lines"].extend(clean)
                    r["measure_lines"].extend([l for l in clean if RE_MEASURE.search(l)])
                    r["area_tags"].extend([l for l in clean if RE_AREA.search(l)])

                    tables = page.extract_tables() or []
                    for t in tables:
                        if not t:
                            continue
                        header = " ".join(str(c or "") for row in t[:2] for c in row)
                        rows = [[str(c or "").strip() for c in row] for row in t]
                        if RE_CEA_QNT.search(header):
                            r["cea_qnt_tables"].append(rows)
                        if RE_QUADRO.search(header):
                            r["quadro_acabamentos"].append(rows)
                        # Guarda todas as tabelas para parse_all_tables()
                        r["all_tables"].append({"header": header, "rows": rows})
                except Exception as e:
                    r["errors"].append(f"pg{i + 1}: {e}")
        if r["raw_text_lines"]:
            budget, extra_noise = build_budget_display_lines(r["raw_text_lines"])
            r["budget_lines"] = budget
            r["noise_removed"].extend(extra_noise)
        r["ok"] = True
    except Exception as e:
        r["errors"].append(str(e))
    return r


def parse_float(s: str) -> float:
    """Converte '371 m²', '80', '60.57', '3,045' (formato BR) em float."""
    s = s.strip()
    m = re.search(r"[\d]+[,.]?[\d]*", s)
    if not m:
        return 0.0
    return float(m.group().replace(",", "."))


def parse_cea_qnt_tables(pdf: dict) -> list[dict]:
    """
    Extrai itens estruturados das tabelas CEA-QNT com quantidades reais do PDF.
    Retorna lista de dicts compatíveis com ItemExtraido.
    """
    items = []
    seen_desc: set[str] = set()
    id_counter = [1]

    for table in pdf.get("cea_qnt_tables", []):
        header = table[0] if table else []
        header_text = " ".join(c.lower() for c in header if c)

        is_area_schedule = (
            any(w in header_text for w in ("área", "setor", "ambiente", "zona"))
            and not any(w in header_text for w in ("comp", "m²/ml", "qtd", "paredes", "total"))
        )
        # Tabela CEA-QNT RODAPÉS: cabeçalho contém "metro linear" ou "rodap" → valores sem sufixo são ml
        is_rodape_table = any(
            w in header_text for w in ("metro linear", "rodap", " ml", "ml ")
        )

        for row in table[1:]:
            if len(row) < 2:
                continue
            cells = [c.strip() for c in row if c.strip()]
            if len(cells) < 2:
                continue

            descricao = ""
            numeric_candidates: list[str] = []

            for c in cells:
                if not RE_NUMERO.match(c) and len(c) > 4 and not descricao:
                    descricao = c[:120]
                elif descricao and re.search(r"\d", c):
                    numeric_candidates.append(c)

            if not descricao or not numeric_candidates:
                continue

            # Prefere candidato com sufixo de área; fallback para o último candidato
            qtd_raw = next(
                (c for c in reversed(numeric_candidates) if RE_AREA_VAL.search(c)),
                numeric_candidates[-1],
            )

            if len(descricao.strip()) <= 8 and descricao.strip().endswith("."):
                continue
            if is_area_schedule and not _MATERIAL_KEYWORDS.search(descricao):
                continue
            if not _MATERIAL_KEYWORDS.search(descricao) and guess_categoria(descricao) == "outro":
                continue
            # Strip embedded spec/drawing-label suffixes before further checks
            descricao = re.sub(r"\s+m/[\d.,]+h/?\S*\s*$", "", descricao, flags=re.IGNORECASE).strip()
            descricao = re.sub(
                r"\s+(?:\d{3}\s*[-–]\s+\w|\bDET\.?\s+\w|\bELEVAÇÃO\b\s+\w|\bVISTA\b\s+[A-Z]\w).*$",
                "", descricao, flags=re.IGNORECASE,
            ).strip()
            if len(descricao) < 5:
                continue
            # Reject spec fragments that survived material-keyword check
            if (_RE_SPEC_FRAG.search(descricao)
                    or _RE_FRAG_ANYWHERE.search(descricao)
                    or _RE_SECAO_LABEL.search(descricao)):
                continue

            dkey = normalize_key(descricao)
            if dkey in seen_desc:
                continue

            qty = 0.0
            unidade = "m2"
            m_area = RE_AREA_VAL.search(qtd_raw)
            m_ml   = RE_ML_VAL.search(qtd_raw)
            m_un   = RE_UN_VAL.search(qtd_raw)
            if m_area:
                qty = float(m_area.group(1).replace(",", "."))
                unidade = "m2"
            elif m_ml:
                qty = float(m_ml.group(1).replace(",", "."))
                unidade = "ml"
            elif m_un:
                qty = float(m_un.group(1).replace(",", "."))
                unidade = "un"
            else:
                qty = parse_float(qtd_raw)
                unidade = "ml" if (is_rodape_table or "rodap" in descricao.lower()) else "m2"

            if qty <= 0:
                continue

            seen_desc.add(dkey)
            items.append({
                "id": id_counter[0],
                "ambiente": "Geral",
                "descricao": descricao,
                "categoria": guess_categoria(descricao),
                "unidade": unidade,
                "quantidade": qty,
                "confianca": 95,
                "fonte": "PDF",
                "status": "confirmado",
                "pendencias": [],
            })
            id_counter[0] += 1

    return items


# ─────────────────────────────────────────────────────────────────────────────
# PARSER GENÉRICO — extrai QUALQUER tabela com colunas descrição + quantidade,
# independente de cabeçalho. Complementa o CEA-QNT com Quadro de Portas,
# Quadro de Áreas e quaisquer tabelas adicionais do projeto.
# ─────────────────────────────────────────────────────────────────────────────

# Cabeçalhos que indicam tabelas de ruído — ignorar completamente
_RE_NOISE_HEADER = re.compile(
    r"(REVIS[ÃA]O|DATA\s+DESCRI|EMISS[ÃA]O|N[ÚU]MERO\s+DATA|ESCALA\s+COM|"
    r"ARQ\s+PDF|LEGENDA\s+DESCRI|NOTAS\s+GERAIS|ENDA\s+DE\s+PONTOS|"
    r"PILAR\s+EM|REBAIXO|TELA\s+GALV|DA\s+DESIGN|ua\s+Jo[ãa]o|"
    r"QUADRO\s+DE\s+ACABAMENTOS|LOCAL\s+C[ÓO]D\.?\s+PISO)",  # Quadro de Acabamentos (sem qty)
    re.IGNORECASE,
)

# Padrão "CEA - QUADRO DE PORTAS" — lógica especial para extrair qty em "un"
_RE_QUADRO_PORTAS = re.compile(r"QUADRO\s+DE\s+PORTAS", re.IGNORECASE)

# Padrão "QUADRO DE ÁREAS" — áreas de ambientes
_RE_QUADRO_AREAS = re.compile(r"QUADRO\s+DE\s+[ÁA]REAS", re.IGNORECASE)

# Separador de múltiplos valores numa mesma célula (pdfplumber funde linhas)
_RE_MULTILINE_NUM = re.compile(r"\n")


def _split_multirow_cell(cell: str) -> list[str]:
    """Divide célula com múltiplas linhas em lista de sub-valores."""
    return [v.strip() for v in cell.split("\n") if v.strip()]


def _detect_columns(rows: list[list[str]]) -> tuple[int, int, str]:
    """
    Detecta índice da coluna de descrição e da coluna de quantidade.
    Retorna (desc_col, qty_col, unidade_default).
    Retorna (-1, -1, "") se não conseguir detectar.
    """
    if not rows or len(rows[0]) < 2:
        return -1, -1, ""

    n_cols = max(len(r) for r in rows)
    col_scores: list[dict] = [{"text": 0, "num": 0, "unit": 0} for _ in range(n_cols)]

    for row in rows:
        for ci, cell in enumerate(row):
            if ci >= n_cols:
                continue
            s = cell.strip()
            if not s:
                continue
            if len(s) >= 10 and not RE_NUMERO.match(s):
                col_scores[ci]["text"] += 1
            if RE_AREA_VAL.search(s):
                col_scores[ci]["unit"] += 2
                col_scores[ci]["num"] += 1
            elif RE_ML_VAL.search(s):
                col_scores[ci]["unit"] += 2
                col_scores[ci]["num"] += 1
            elif RE_UN_VAL.search(s):
                col_scores[ci]["unit"] += 2
                col_scores[ci]["num"] += 1
            elif RE_NUMERO.match(s) and float(s.replace(",", ".")) > 0:
                col_scores[ci]["num"] += 1

    # Coluna de descrição: maior pontuação de texto
    desc_col = max(range(n_cols), key=lambda i: col_scores[i]["text"], default=-1)
    if col_scores[desc_col]["text"] < 2:
        return -1, -1, ""

    # Coluna de quantidade: maior pontuação numérica, diferente da desc
    qty_col = max(
        (i for i in range(n_cols) if i != desc_col),
        key=lambda i: col_scores[i]["unit"] * 2 + col_scores[i]["num"],
        default=-1,
    )
    if qty_col == -1 or col_scores[qty_col]["num"] < 2:
        return -1, -1, ""

    # Unidade padrão: m2 se col tem m², ml se col tem ml, un caso contrário
    if col_scores[qty_col]["unit"] > 0:
        unidade = "m2"  # refinado por célula abaixo
    else:
        unidade = "un"

    return desc_col, qty_col, unidade


def parse_all_tables(
    pdf: dict,
    already_seen: set | None = None,
) -> list[dict]:
    """
    Extrai itens de QUALQUER tabela no PDF com heurística de colunas.

    Captura tabelas que o parser CEA-QNT específico perderia:
    - CEA - QUADRO DE PORTAS → portas em "un"
    - Qualquer nova tabela QNT sem header padrão

    Já evita duplicatas via `already_seen` (set de normalize_key(descricao)).
    """
    items:   list[dict] = []
    seen:    set        = set(already_seen or [])
    counter             = [5000]  # ids distintos dos outros parsers

    for entry in pdf.get("all_tables", []):
        header: str        = entry.get("header", "")
        rows:   list       = entry.get("rows", [])

        # Pular tabelas já tratadas pelo CEA-QNT parser
        if RE_CEA_QNT.search(header):
            continue
        # Pular tabelas de ruído conhecidas
        if _RE_NOISE_HEADER.search(header):
            continue
        # Pular tabelas muito pequenas
        data_rows = [r for r in rows if any(c for c in r)]
        if len(data_rows) < 3:
            continue

        is_portas = _RE_QUADRO_PORTAS.search(header)

        # ── Quadro de Portas: lógica dedicada ─────────────────────────────
        if is_portas:
            for row in data_rows[1:]:  # skip header row
                cells = [c.strip() for c in row if c.strip()]
                if len(cells) < 3:
                    continue

                # Primeira célula = "PA 044 PORTA DE ENROLAR EM CHAPA…"
                desc_raw = cells[0]
                # Tenta extrair qty: primeiro inteiro puro na linha
                qty = 0.0
                unidade = "un"
                for c in cells[1:]:
                    # Células de qty contêm apenas números separados por \n
                    sub = [v.strip() for v in c.split("\n") if v.strip()]
                    nums = [v for v in sub if RE_NUMERO.match(v)]
                    if nums:
                        try:
                            qty = sum(float(v.replace(",", ".")) for v in nums)
                            break
                        except ValueError:
                            pass

                if qty <= 0:
                    continue

                # Descrição: limpar código de porta (PA 044, PD 032, etc.)
                desc = re.sub(r"^[A-Z]{2}\s+\d{3}\s+", "", desc_raw).strip()
                # Múltiplas linhas dentro da célula → juntar
                desc = " ".join(desc.split("\n")).strip()[:120]
                # Strip trailing spec/drawing-label suffixes
                desc = re.sub(r"\s+m/[\d.,]+h/?\S*\s*$", "", desc, flags=re.IGNORECASE).strip()
                desc = re.sub(
                    r"\s+(?:\d{3}\s*[-–]\s+\w|\bDET\.?\s+\w|\bELEVAÇÃO\b\s+\w|\bVISTA\b\s+[A-Z]\w).*$",
                    "", desc, flags=re.IGNORECASE,
                ).strip()

                if len(desc) < 6:
                    continue
                if not _MATERIAL_KEYWORDS.search(desc):
                    continue

                dkey = normalize_key(desc)
                if dkey in seen:
                    continue
                seen.add(dkey)

                items.append({
                    "id":         counter[0],
                    "ambiente":   "Geral",
                    "descricao":  desc,
                    "categoria":  guess_categoria(desc),
                    "unidade":    unidade,
                    "quantidade": round(qty, 4),
                    "confianca":  85,
                    "fonte":      "PDF",
                    "status":     "confirmado",
                    "pendencias": [],
                })
                counter[0] += 1
            continue  # próxima tabela

        # ── Tabelas genéricas: detecção automática de colunas ─────────────
        desc_col, qty_col, _ = _detect_columns(data_rows)
        if desc_col == -1:
            continue

        for row in data_rows[1:]:  # pular linha de cabeçalho
            if len(row) <= max(desc_col, qty_col):
                continue
            desc_cell = row[desc_col].strip()
            qty_cell  = row[qty_col].strip()

            # Célula pode ter múltiplos valores fundidos por pdfplumber
            desc_parts = _split_multirow_cell(desc_cell) or [desc_cell]
            qty_parts  = _split_multirow_cell(qty_cell)  or [qty_cell]

            for desc_raw, qty_raw in zip(desc_parts, qty_parts + [qty_parts[-1]] * len(desc_parts)):
                desc = desc_raw[:120].strip()

                # Strip trailing life-spec suffix and drawing-label suffix from cell content
                desc = re.sub(r"\s+m/[\d.,]+h/?\S*\s*$", "", desc, flags=re.IGNORECASE).strip()
                desc = re.sub(
                    r"\s+(?:\d{3}\s*[-–]\s+\w|\bDET\.?\s+\w|\bELEVAÇÃO\b\s+\w|\bVISTA\b\s+[A-Z]\w).*$",
                    "", desc, flags=re.IGNORECASE,
                ).strip()

                if len(desc) < 10 or RE_NUMERO.match(desc):
                    continue
                # Skip if description IS a drawing label (e.g. "314 – DISTRIBUIÇÃO")
                if _RE_DRAWING_LABEL.match(desc):
                    continue
                # Rejeita fragmentos: termina com preposição/artigo/vírgula → linha incompleta
                if re.search(r"(\b(DE|EM|COM|E|OU|NA|NO|A|O|DA|DO|AO|DAS|DOS|SOBRE|ATÉ|ATE|E\/OU),?\s*$)", desc, re.IGNORECASE):
                    continue
                if not _MATERIAL_KEYWORDS.search(desc) and guess_categoria(desc) == "outro":
                    continue

                # Filtrar ruído (fragm. de spec técnica / labels de seção) antes de inserir
                if (_RE_SPEC_FRAG.search(desc)
                        or _RE_FRAG_ANYWHERE.search(desc)
                        or _RE_SECAO_LABEL.search(desc)):
                    continue

                # Extrair quantidade e unidade
                qty = 0.0
                unidade = "m2"
                m_area = RE_AREA_VAL.search(qty_raw)
                m_ml   = RE_ML_VAL.search(qty_raw)
                m_un   = RE_UN_VAL.search(qty_raw)
                if m_area:
                    qty = float(m_area.group(1).replace(",", "."))
                    unidade = "m2"
                elif m_ml:
                    qty = float(m_ml.group(1).replace(",", "."))
                    unidade = "ml"
                elif m_un:
                    qty = float(m_un.group(1).replace(",", "."))
                    unidade = "un"
                else:
                    try:
                        qty = parse_float(qty_raw)
                        unidade = "m2"
                    except Exception:
                        pass

                if qty <= 0:
                    continue

                # Inferir unidade pela descrição quando a célula qty não tem sufixo
                if unidade == "m2":
                    desc_lower = desc.lower()
                    if re.search(
                        r"rodap[eé]|soleira|corrimao|corrimão|formica\s+prattan"
                        r"|primer\s+tarket|tarket\s+primer|laminado\s+de\s+borda",
                        desc_lower,
                    ):
                        unidade = "ml"

                dkey = normalize_key(desc)
                if dkey in seen:
                    continue
                seen.add(dkey)

                items.append({
                    "id":         counter[0],
                    "ambiente":   "Geral",
                    "descricao":  desc,
                    "categoria":  guess_categoria(desc),
                    "unidade":    unidade,
                    "quantidade": round(qty, 4),
                    "confianca":  80,
                    "fonte":      "PDF",
                    "status":     "confirmado",
                    "pendencias": [],
                })
                counter[0] += 1

    log.debug("  parse_all_tables: %d itens de tabelas genéricas", len(items))
    return items


# ─── Parser CEA-QNT baseado em seções de texto ───────────────────────────────
# Substitui parse_cea_qnt_tables como fonte primária, eliminando os problemas
# de sangramento de coluna e linhas do Quadro de Acabamentos do pdfplumber.

_RE_CEA_SEC      = re.compile(r"CEA\s*[-–]+\s*QNT\s+(.+)", re.IGNORECASE)
_RE_SEC_STOP     = re.compile(
    r"^(TOTAIS?\s*:|Grand\s+total\b|Total\s+geral\b|DET\s+IMPERM|\d{3}\s*[-–]\s*(PLANTA|CORTE|ELEVA|FORRO|PISO))",
    re.IGNORECASE,
)
_RE_REV_LINE     = re.compile(r"^R\d{2}\s+\d{2}/\d{2}/\d{4}")  # ex: "R01 24/07/2025 …"
_RE_PISOS_ROW    = re.compile(
    r"^(?:(?:P\d+[A-Z]?|\d{1,2})\s+)?(.{5,}?)\s+([\d,.]+)\s*m[²2]",
    re.IGNORECASE,
)
_RE_DIM          = re.compile(r"([\d,.]+)\s*[xX×]\s*([\d,.]+)")
_RE_RODAPE_STD   = re.compile(r"^R(\d+[A-Z]?)\s+(.{5,}?)\s+([\d,.]+)\s*$", re.IGNORECASE)
_RE_RODAPE_QTY   = re.compile(r"^R(\d+[A-Z]?)\s+([\d,.]+)", re.IGNORECASE)
_RE_TRAILING_NUM = re.compile(r"\s+[\d,.]+\s*$")       # remove coluna Comp./Pé-dir. do fim
_RE_M2_START     = re.compile(r"^([\d,.]+)\s*m[²2]\s*(.*)", re.IGNORECASE)  # linha partida

# Prefixo de título de vista (BUG-1): "PLANTA BAIXA 1° PAVIMENTO - ADM CERÂMICA..." → strip o prefixo
_RE_DRAWING_PREFIX = re.compile(
    r"^(?:PLANTA\s+BAIXA\s+[\d°]+[°º]?\s*PAV\w*\s*[-–]\s*\w+\s+|ESC\s*\.\s*:\s+)",
    re.IGNORECASE,
)
# Rótulos de prancha/vista/detalhe que não devem ser anexados como sufixo de descrição
# ex: "303 - TAPUME", "DET ARMÁRIO AÉREO", "ELEVAÇÃO VS03", "314 - DISTRIBUIÇÃO"
_RE_DRAWING_LABEL = re.compile(
    r"^(?:\d{3}\s*[-–]|DET\s+|DET\.\s+|ELEVAÇÃO\s+|VISTA\s+[A-Z]|ESC\s*\.?\s*:\s*1\s*:)",
    re.IGNORECASE,
)
# Linha simples "DESCRIÇÃO   VALOR" — usada nas tabelas CEA-LINEAR e CEA-QNTD (BUG-6)
_RE_SIMPLE_ROW   = re.compile(r"^(.{5,}?)\s+([\d,.]+)\s*$")
# Cabeçalho mais amplo que captura CEA-LINEAR e CEA-QNTD além de CEA-QNT (BUG-6)
_RE_CEA_BROAD    = re.compile(r"CEA\s*[-–]+\s*(QNT|LINEAR|QNTD)\b\s*(.*)", re.IGNORECASE)
# Grand total sem dois-pontos — para defesa em step 5 (BUG-12)
_RE_GRAND_TOTAL  = re.compile(r"^Grand\s+total\b", re.IGNORECASE)


def _capture_section_gt(line: str, sec_name: str, store: dict) -> None:
    """
    Extrai grand_total de uma linha de stop (Grand total ou TOTAIS:) e
    armazena em `store[sec_name]`.

    Formatos conhecidos:
      "Grand total 1370.06 m²"           → 1370.06
      "Grand total: 443 3323 m² 1124.13" → 3323  (número antes de m²)
      "TOTAIS: 417 668.43"               → 668.43 (último número)
    """
    # Preferência: número imediatamente antes de m² / m2
    m = re.search(r"([\d,.]+)\s*m[²2]", line, re.IGNORECASE)
    if m:
        store.setdefault(sec_name, float(m.group(1).replace(",", ".")))
        return
    # Fallback: último número da linha
    nums = re.findall(r"[\d,.]+", line)
    if nums:
        store.setdefault(sec_name, float(nums[-1].replace(",", ".")))


def _soleira_material_key(desc: str) -> str:
    """Agrupa soleiras por tipo de granito para soma de comprimentos (ml)."""
    d = desc.upper()
    if "ANDORINHA" in d:
        return "SOLEIRA_CINZA_ANDORINHA"
    if "CEAR" in d:
        return "SOLEIRA_BRANCO_CEARA"
    return normalize_key(desc)


def _cea_add(
    items: list, seen: set, counter: list,
    desc: str, qty: float, unidade: str, confianca: int, fallback_cat: str = "outro",
    tabela: str = "GERAL", zona: str | None = None,
) -> bool:
    """Adiciona item se não for duplicata. Retorna True se foi adicionado."""
    desc = desc.strip(" ,/")[:120]

    # Strip trailing luminária life-spec suffix that pdfplumber embeds mid-description
    # Ex: "IRC 90 RODAPÉ – FORMICA PRATTAN L151 m/25.000h" → "IRC 90 RODAPÉ – FORMICA PRATTAN L151"
    desc = re.sub(r"\s+m/[\d.,]+h/?\S*\s*$", "", desc, flags=re.IGNORECASE).strip()

    # Strip trailing drawing-label suffix that pdfplumber concatenates into the cell
    # Ex: "Laminado Xpto 314 – DISTRIBUIÇÃO", "Cerâmica XYZ DET ARMÁRIO AÉREO"
    desc = re.sub(
        r"\s+(?:\d{3}\s*[-–]\s+\w|\bDET\.?\s+\w|\bELEVAÇÃO\b\s+\w|\bVISTA\b\s+[A-Z]\w|\bARQ\b\s+\w).*$",
        "", desc, flags=re.IGNORECASE,
    ).strip()

    if len(desc) < 5 or qty <= 0:
        return False
    # Filtrar linhas de total/subtotal que escapam do stop pattern
    if re.match(r"^Grand\s+total\b", desc, re.IGNORECASE):
        return False
    if re.match(r"^TOTAIS?\s*:", desc, re.IGNORECASE):
        return False
    # Filtrar fragmentos de spec técnica / luminária que escapam como itens
    if re.match(r"^(FIX\s*:|ACAB\s*:)", desc, re.IGNORECASE):
        return False
    # Filtrar fragmento de revisão de prancha embutido na descrição
    if re.search(r"\bR\d{2}\s+\d{2}/\d{2}/\d{4}\b", desc):
        return False
    # Filtrar linhas de legenda/header de tabela (ex: "LEGENDA CÓD. DESCRIÇÃO ...")
    if re.match(r"^LEGENDA\s+(CÓD|DE|DO|DA|TIPO)\b", desc, re.IGNORECASE):
        return False
    # Filtrar descrições que são claramente "Provador Montagem no forro"
    if re.match(r"^(Provador|dor)\s+Montagem\s+no\s+forro", desc, re.IGNORECASE):
        return False
    # Filtrar qualquer fragmento de spec técnica / seção de label (cobre o caminho PyMuPDF)
    if (_RE_SPEC_FRAG.search(desc)
            or _RE_FRAG_ANYWHERE.search(desc)
            or _RE_SECAO_LABEL.search(desc)):
        return False
    # Rejeitar descrições que SÃO rótulos de prancha (ex: "314 – DISTRIBUIÇÃO", "DET ARMÁRIO AÉREO")
    if _RE_DRAWING_LABEL.match(desc):
        return False
    dkey = normalize_key(desc)
    if dkey in seen:
        return False
    seen.add(dkey)
    cat = guess_categoria(desc)
    if cat == "outro":
        cat = fallback_cat
    items.append({
        "id":                 counter[0],
        "ambiente":           "Geral",
        "descricao":          desc,
        "categoria":          cat,
        "unidade":            unidade,
        "quantidade":         round(qty, 4),
        "confianca":          confianca,
        "fonte":              "PDF",
        "status":             "confirmado",
        "pendencias":         [],
        "tabela":             tabela,
        "grand_total_tabela": None,  # preenchido depois pela função principal
        "zona":               zona,
    })
    counter[0] += 1
    return True


def _zona_from_prancha(pdf: dict, sec_name: str) -> str | None:
    """Heurística BLN: pintura/forro em pranchas ADM vs vendas."""
    if "PINTURA" not in sec_name and "FORRO" not in sec_name:
        return None
    num = pdf.get("prancha_num") or ""
    adm = {"304", "305", "312", "308", "309"}
    if num in adm:
        return "adm"
    if num in {"301", "303", "307", "321", "331"}:
        return "vendas"
    return None


def parse_cea_qnt_from_text(pdf: dict) -> list[dict]:
    """
    Parser CEA-QNT baseado em seções de texto — substitui parse_cea_qnt_tables.

    Detecta seções por header 'CEA - QNT XXXX' no text_lines e parseia cada
    linha diretamente, sem depender do extract_tables() do pdfplumber.

    Resolve:
    - Nomes truncados por sangramento de coluna (RQUIBANCADA, MPERMEABILIZAÇÃO)
    - Linhas do Quadro de Acabamentos misturadas com CEA-QNT
    - Itens P-code e código numérico não detectados
    - Soleiras com largura em vez de área (calcula W×L e agrupa por tipo)
    - P3 CONFORME PADRÃO DO SHOPPING e similares filtrados por keyword
    """
    items:  list[dict] = []
    seen:   set        = set()
    counter            = [1]

    # grand_total por seção — preenchido durante a coleta de linhas stop
    section_grand_totals: dict[str, float] = {}

    # ── 1a. PISOS / SOLEIRAS / RODAPÉS — text_lines (filtrado, sem ruído) ────
    # text_lines já removeu revisões/legendas; ideal para essas seções fixas.
    sections: dict[str, list[str]] = {}
    current: str | None = None

    for line in pdf.get("text_lines", []):
        m = _RE_CEA_SEC.search(line)
        if m:
            raw = m.group(1).strip().upper()
            if   "PISO"  in raw: current = "PISOS"
            elif "SOLEI" in raw: current = "SOLEIRAS"
            elif "RODAP" in raw: current = "RODAPES"
            else:                current = None  # genéricas tratadas no passo 1b
            if current:
                sections.setdefault(current, [])
            continue

        if current:
            ls = line.strip()
            if _RE_SEC_STOP.match(ls):
                # Captura TOTAIS: (RODAPES) e Grand total (outros)
                _capture_section_gt(ls, current, section_grand_totals)
                current = None
                continue
            sections[current].append(line)

    # ── 1b. Seções genéricas (PAREDES, PINTURA …) + LINEAR/QNTD/LOGO — raw_text_lines ──
    # raw_text_lines preserva linhas mescladas pelo pdfplumber (ex: "PINTURA …
    # 371 m² 01 R01 24/07/2025 …") que seriam descartadas como ruído no text_lines.
    # Seções RFID coletadas para captura do grand_total (cod 25.1).
    # _RE_CEA_BROAD captura CEA-QNT, CEA-LINEAR e CEA-QNTD (BUG-6).
    current = None

    for line in pdf.get("raw_text_lines", []):
        mb = _RE_CEA_BROAD.search(line)
        if mb:
            ctype = mb.group(1).upper()   # QNT | LINEAR | QNTD
            raw   = mb.group(2).strip().upper()
            if ctype == "QNT":
                if "PISO" in raw or "SOLEI" in raw:
                    current = None
                elif "RODAP" in raw:
                    # BUG-131-A: coletar também de raw_text_lines para capturar desc
                    # que pdfplumber fundiu com rótulos de escala de outras vistas
                    current = "RODAPES_RAW"
                    sections.setdefault("RODAPES_RAW", [])
                elif "RFID" in raw:
                    # Coletar seção RFID para capturar o grand_total → cod 25.1
                    current = "RFID_" + raw.replace(" ", "_")
                    sections.setdefault(current, [])
                elif "LOGO" in raw:
                    current = "LOGO_" + (raw.replace(" ", "_") or "GERAL")
                    sections.setdefault(current, [])
                else:
                    current = raw.replace(" ", "_") or "QNT_GERAL"
                    sections.setdefault(current, [])
            elif ctype == "LINEAR":
                current = "LINEAR_" + (raw.replace(" ", "_") or "GERAL")
                sections.setdefault(current, [])
            elif ctype == "QNTD":
                current = "QNTD_" + (raw.replace(" ", "_") or "GERAL")
                sections.setdefault(current, [])
            continue

        if current:
            ls = line.strip()
            # BUG-131-A-v2: RODAPES_RAW usa stop mais permissivo — não para em
            # "131 - PLANTA..." (noise de pdfplumber dentro da seção RODAPÉS).
            # Para essa seção só paramos em TOTAIS:/Grand total/CEA-.
            if current == "RODAPES_RAW":
                if re.match(r"^(TOTAIS?\s*:|Grand\s+total\b|Total\s+geral\b|CEA\s*[-–])",
                             ls, re.IGNORECASE):
                    _capture_section_gt(ls, "RODAPES", section_grand_totals)
                    current = None
                    continue
            elif _RE_SEC_STOP.match(ls):
                _capture_section_gt(ls, current, section_grand_totals)
                current = None
                continue
            sections[current].append(line)

    # ── 2. PISOS — P-code, código numérico e sem código ─────────────────────
    has_soleiras_sec = bool(sections.get("SOLEIRAS"))
    for line in sections.get("PISOS", []):
        m = _RE_PISOS_ROW.match(line.strip())
        if not m:
            continue
        desc = m.group(1).strip()
        if has_soleiras_sec and re.search(r"SOLEIRA", desc, re.IGNORECASE):
            continue
        _cea_add(items, seen, counter,
                 desc, float(m.group(2).replace(",", ".")),
                 "m2", 95, "revestimento", tabela="PISOS")

    # ── 3. SOLEIRAS — soma comprimento (2ª dimensão) em ml por tipo de granito ─
    sol_acc:  dict[str, float] = {}
    sol_desc: dict[str, str]   = {}

    for line in sections.get("SOLEIRAS", []):
        m = _RE_DIM.search(line.strip())
        if not m:
            continue
        desc = line.strip()[:m.start()].strip().rstrip(" ,/-")
        if len(desc) < 5:
            continue
        try:
            length_ml = float(m.group(2).replace(",", "."))
        except ValueError:
            continue
        dkey = _soleira_material_key(desc)
        sol_acc[dkey]  = sol_acc.get(dkey, 0.0) + length_ml
        sol_desc[dkey] = desc if dkey not in sol_desc else sol_desc[dkey]

    _SOLEIRA_LABELS = {
        "SOLEIRA_CINZA_ANDORINHA": "SOLEIRA EM GRANITO CINZA ANDORINHA",
        "SOLEIRA_BRANCO_CEARA":    "SOLEIRA EM GRANITO BRANCO CEARÁ",
    }
    for dkey, total in sol_acc.items():
        desc = _SOLEIRA_LABELS.get(dkey, sol_desc.get(dkey, dkey))
        desc_up = desc.upper()
        if any(
            ("ANDORINHA" in desc_up and "ANDORINHA" in k.upper()) or
            ("CEAR" in desc_up and "CEAR" in k.upper())
            for k in seen if "SOLEIRA" in k.upper()
        ):
            continue
        _cea_add(items, seen, counter, desc, round(total, 4), "ml", 95, "revestimento",
                 tabela="SOLEIRAS")

    # ── 4. RODAPÉS — linha padrão e linha R5 (descrição separada da qty) ─────
    prev_desc = ""
    for line in sections.get("RODAPES", []):
        s = line.strip()

        # Rejeitar linhas do QUADRO DE ACABAMENTOS que vazam para esta seção
        # ex: "R2 CURUPIXÁ ou TAUARI, COM ALTURA DE 20cm"
        if _RE_ACABAMENTO_SPEC.search(s):
            prev_desc = ""
            continue

        m_std = _RE_RODAPE_STD.match(s)
        if m_std:
            desc = m_std.group(2).strip()
            # Rejeitar specs de luminária / textos não-materiais que escapam das
            # tabelas adjacentes (ex: "m/25.000h", "IRC 90", etc.)
            if not _MATERIAL_KEYWORDS.search(desc) and not re.search(
                r"rodap|madeira|laminad|inox|primer|tarket|granito|a[çc]o|prattan"
                r"|madeirite|gesso|cerâmica|vinílico|epóxi|impermeab",
                desc, re.IGNORECASE,
            ):
                prev_desc = ""
                continue
            _cea_add(items, seen, counter,
                     desc, float(m_std.group(3).replace(",", ".")),
                     "ml", 95, "revestimento", tabela="RODAPES")
            prev_desc = desc
            continue

        # Linha "R5 43.68 H=10cm" — descrição estava na linha anterior
        m_qty = _RE_RODAPE_QTY.match(s)
        if m_qty and prev_desc:
            qty  = float(m_qty.group(2).replace(",", "."))
            rest = s[m_qty.end():].strip()
            full = (prev_desc.rstrip(" ,/") + (" " + rest if rest else "")).strip()
            _cea_add(items, seen, counter, full, qty, "ml", 95, "revestimento",
                     tabela="RODAPES")
            prev_desc = ""
            continue

        # Só armazena como prev_desc se parece material real (evita specs de luminária)
        if s and not RE_NUMERO.match(s) and len(s) > 5:
            if _MATERIAL_KEYWORDS.search(s) or re.search(
                r"rodap|madeira|laminad|inox|primer|tarket|granito|a[çc]o|prattan"
                r"|madeirite|gesso|cerâmica|vinílico|epóxi|impermeab",
                s, re.IGNORECASE,
            ):
                prev_desc = s
            else:
                prev_desc = ""

    # ── 4b. RODAPÉS (raw pass) — BUG-131-A: captura desc fundida com escala ──
    # pdfplumber às vezes une "ESC.: 1 : 75 ... RODAPÉ EM LAMINADO..." numa única
    # linha; _RE_ESC descarta no text_lines, mas raw_text_lines preserva.
    # Aqui fazemos uma segunda passagem com strip do prefixo ESC.
    _RE_ESC_PREFIX = re.compile(r"^(?:ESC\s*\.?\s*:\s*\d+\s*:\s*\d+\s*)+", re.IGNORECASE)
    prev_desc = ""
    for line in sections.get("RODAPES_RAW", []):
        s = line.strip()

        # Rejeitar linhas do QUADRO DE ACABAMENTOS que vazam para esta seção
        if _RE_ACABAMENTO_SPEC.search(s):
            prev_desc = ""
            continue

        m_std = _RE_RODAPE_STD.match(s)
        if m_std:
            desc = m_std.group(2).strip()
            # Rejeitar specs de luminária / textos não-materiais (mesmo guard da 4a)
            if not _MATERIAL_KEYWORDS.search(desc) and not re.search(
                r"rodap|madeira|laminad|inox|primer|tarket|granito|a[çc]o|prattan"
                r"|madeirite|gesso|cerâmica|vinílico|epóxi|impermeab",
                desc, re.IGNORECASE,
            ):
                prev_desc = ""
                continue
            _cea_add(items, seen, counter,
                     desc, float(m_std.group(3).replace(",", ".")),
                     "ml", 95, "revestimento", tabela="RODAPES")
            prev_desc = desc
            continue
        m_qty = _RE_RODAPE_QTY.match(s)
        if m_qty and prev_desc:
            qty  = float(m_qty.group(2).replace(",", "."))
            rest = s[m_qty.end():].strip()
            full = (prev_desc.rstrip(" ,/") + (" " + rest if rest else "")).strip()
            _cea_add(items, seen, counter, full, qty, "ml", 95, "revestimento",
                     tabela="RODAPES")
            prev_desc = ""
            continue
        # Strip "ESC.: 1 : 75" prefixes before storing as potential prev_desc
        s_clean = _RE_ESC_PREFIX.sub("", s).strip()
        if s_clean and not RE_NUMERO.match(s_clean) and len(s_clean) > 5:
            # Só armazena como prev_desc se parece material real (mesmo guard da 4a)
            if _MATERIAL_KEYWORDS.search(s_clean) or re.search(
                r"rodap|madeira|laminad|inox|primer|tarket|granito|a[çc]o|prattan"
                r"|madeirite|gesso|cerâmica|vinílico|epóxi|impermeab",
                s_clean, re.IGNORECASE,
            ):
                prev_desc = s_clean
            else:
                prev_desc = ""
        elif not s_clean:
            prev_desc = ""

    # ── 5. Seções genéricas: PAREDES, PINTURA, FORROS, LINEAR, QNTD, LOGO … ──
    # RFID_* sections: grand_total already captured in step 1b; skip row processing
    _SKIP = {"PISOS", "SOLEIRAS", "RODAPES", "RODAPES_RAW"}
    for sec_name, sec_lines in sections.items():
        if sec_name in _SKIP or sec_name.startswith("RFID_"):
            continue

        # ── 5a. CEA-LINEAR / CEA-QNTD / CEA-QNT LOGO (BUG-6) ───────────────
        # Usa buffer "pending" para capturar sufixos em linha separada:
        # ex: "ESTANTES - PONTO 131" → pending; "FIXO" → "ESTANTES - PONTO FIXO 131"
        is_linear = sec_name.startswith("LINEAR_")
        is_qntd   = sec_name.startswith("QNTD_") or sec_name.startswith("LOGO_")
        if is_linear or is_qntd:
            unit: str = "ml" if is_linear else "un"
            pending: tuple | None = None  # (desc: str, qty: float)
            for line in sec_lines:
                s = line.strip()
                is_stop   = not s or _RE_SEC_STOP.match(s) or _RE_GRAND_TOTAL.match(s)
                is_noisy  = is_noise_line(s)
                is_header = bool(re.match(r"^(LEGENDA|METRO\s+LINEAR|QUANTIDADE|TIPO\b|ITEM\b)", s, re.IGNORECASE))
                if is_stop:
                    if pending:
                        _cea_add(items, seen, counter, pending[0], pending[1], unit, 90,
                                 "marcenaria", tabela=sec_name)
                        pending = None
                    continue
                if is_noisy or is_header:
                    continue  # don't flush pending — suffix may still come next line
                m = _RE_SIMPLE_ROW.match(s)
                if m:
                    if pending:
                        _cea_add(items, seen, counter, pending[0], pending[1], unit, 90,
                                 "marcenaria", tabela=sec_name)
                    pending = (m.group(1).strip(), float(m.group(2).replace(",", ".")))
                elif (pending and not RE_NUMERO.match(s) and 2 <= len(s) <= 30
                      and not _RE_DRAWING_LABEL.match(s)
                      and not is_noise_line(s)):
                    # Linha curta sem número → sufixo da descrição anterior
                    pending = (f"{pending[0]} {s}", pending[1])
                else:
                    if pending:
                        _cea_add(items, seen, counter, pending[0], pending[1], unit, 90,
                                 "marcenaria", tabela=sec_name)
                        pending = None
            if pending:
                _cea_add(items, seen, counter, pending[0], pending[1], unit, 90,
                         "marcenaria", tabela=sec_name)
            continue

        # ── 5b. Seções padrão m²: PAREDES, PINTURA, FORROS … ────────────────
        fallback_cat = "pintura" if "PINTURA" in sec_name else "civil"
        is_forros    = "FORRO" in sec_name
        item_zona    = _zona_from_prancha(pdf, sec_name)
        prev_desc    = ""
        prev_last    = False  # True se a linha anterior adicionou um item (BUG-2)

        for line in sec_lines:
            s = line.strip()

            # Capture whether last iteration added an item, then reset
            was_last = prev_last
            prev_last = False

            # BUG-12: Grand total deve parar a seção (defesa em step 5)
            if _RE_GRAND_TOTAL.match(s):
                _capture_section_gt(s, sec_name, section_grand_totals)
                prev_desc = ""
                continue

            # Linha partida: começa com "qty m² texto_extra" (ex: "13 m² BRANCO …")
            m_start = _RE_M2_START.match(s)
            if m_start and prev_desc:
                qty  = float(m_start.group(1).replace(",", "."))
                rest = m_start.group(2).strip()
                # BUG-10: não anexar código de cor puro (ex: "11", "07") à descrição
                if RE_NUMERO.match(rest) or re.match(r"^\d{1,2}$", rest):
                    rest = ""
                base = _RE_TRAILING_NUM.sub("", prev_desc).strip()
                full = (base + (" " + rest if rest else "")).strip()
                prev_last = _cea_add(items, seen, counter, full, qty, "m2", 90,
                                     fallback_cat, tabela=sec_name, zona=item_zona)
                prev_desc = ""
                continue

            # Linha de histórico de revisão pura — pular sem afetar prev_desc
            if _RE_REV_LINE.match(s):
                continue

            m = _RE_PISOS_ROW.match(s)
            if m:
                raw_desc = m.group(1).strip()
                qty      = float(m.group(2).replace(",", "."))

                # BUG-11: seção FORROS — PD vai no INÍCIO para sobreviver ao [:60] de normalize_key
                if is_forros:
                    pd_m = _RE_TRAILING_NUM.search(raw_desc)
                    if pd_m:
                        pd_val = pd_m.group().strip()
                        base_d = _RE_TRAILING_NUM.sub("", raw_desc).strip()
                        desc   = f"[PD={pd_val}m] {base_d}"
                    else:
                        desc = raw_desc
                else:
                    # Remove coluna numérica à direita (Comp. / Pé-direito)
                    desc = _RE_TRAILING_NUM.sub("", raw_desc).strip()
                    # Remove número à esquerda de linha mesclada (ex: "18.00 DRYWALL …")
                    desc = re.sub(r"^[\d,.]+\s+", "", desc)

                # BUG-1: strip prefixo de título de vista da descrição
                desc = _RE_DRAWING_PREFIX.sub("", desc).strip()

                # Desc. curta = continuação da linha anterior (ex: "ACARTONADO 663 m²")
                if len(desc) < 20 and prev_desc:
                    base = _RE_TRAILING_NUM.sub("", prev_desc).strip()
                    base = re.sub(r"\s+\d{1,2}\s*$", "", base).strip()
                    desc = (base + " " + desc).strip()
                    prev_desc = ""

                prev_last = _cea_add(items, seen, counter, desc, qty, "m2", 90,
                                     fallback_cat, tabela=sec_name, zona=item_zona)
                # Segunda metade de linha mesclada (dois itens numa linha só)
                remainder = s[m.end():].strip()
                if remainder:
                    m2 = _RE_PISOS_ROW.match(remainder)
                    if m2:
                        d2 = _RE_TRAILING_NUM.sub("", m2.group(1).strip()).strip()
                        d2 = re.sub(r"^[\d,.]+\s+", "", d2)
                        d2 = _RE_DRAWING_PREFIX.sub("", d2).strip()
                        q2 = float(m2.group(2).replace(",", "."))
                        _cea_add(items, seen, counter, d2, q2, "m2", 90,
                                 fallback_cat, tabela=sec_name, zona=item_zona)
                prev_desc = ""
                continue

            # BUG-2: linha curta pura logo após um item → sufixo da descrição
            # _RE_DRAWING_LABEL filtra rótulos de prancha/vista ("303 - TAPUME",
            # "DET ARMÁRIO AÉREO", "ELEVAÇÃO VS03", "314 - DISTRIBUIÇÃO", etc.)
            if (s and not RE_NUMERO.match(s) and not is_noise_line(s)
                    and not _RE_DRAWING_LABEL.match(s)
                    and 5 < len(s) < 70 and was_last and items):
                items[-1]["descricao"] = (items[-1]["descricao"] + " " + s)[:120]
                prev_desc = ""
                continue

            # Linha de descrição pura (continuada na próxima)
            if s and not RE_NUMERO.match(s) and len(s) > 8:
                prev_desc = s
            else:
                prev_desc = ""

    # ── 6. Anotar grand_total_tabela em cada item ────────────────────────────
    for it in items:
        tab = it.get("tabela", "GERAL")
        it["grand_total_tabela"] = section_grand_totals.get(tab)

    # ── 7. Item sintético para manta RFID (cod 25.1) ─────────────────────────
    # A seção RFID não emite items individuais (step 5 pula RFID_*), mas o
    # grand_total dela representa a área total de manta RFID a orçar.
    for sec_key, gt in section_grand_totals.items():
        if sec_key.startswith("RFID_") and gt and gt > 0:
            rfid_desc = "RFID_GRAND_TOTAL"
            if normalize_key(rfid_desc) not in seen:
                seen.add(normalize_key(rfid_desc))
                items.append({
                    "id":                 counter[0],
                    "ambiente":           "Geral",
                    "descricao":          rfid_desc,
                    "categoria":          "civil",
                    "unidade":            "m2",
                    "quantidade":         round(gt, 4),
                    "confianca":          95,
                    "fonte":              "PDF",
                    "status":             "confirmado",
                    "pendencias":         [],
                    "tabela":             sec_key,
                    "grand_total_tabela": gt,
                })
                counter[0] += 1
                log.debug("  RFID grand_total=%.2f → item sintético 25.1", gt)

    log.debug("  parse_cea_qnt_from_text: %d itens extraídos (%d seções, gt=%s)",
              len(items), len(sections), section_grand_totals)
    return items


def parse_special_tables_from_text(pdf: dict, already_seen: set | None = None) -> list[dict]:
    """
    Parseia tabelas especiais que não seguem o padrão CEA-QNT:
    - CEA - QUADRO DE PORTAS / CEA - QUADRO PISO PODOTÁTIL  (BUG-3)
    - CEA - QUADRO DE LUMINÁRIAS                             (BUG-9)
    - CEA - COMUNICAÇÃO VISUAL                               (BUG-13)

    Retorna itens com status "confirmado" e quantidade inteira (unidade "un").
    """
    items:   list[dict] = []
    seen:    set        = set(already_seen or [])
    counter             = [700]

    lines = pdf.get("raw_text_lines", [])
    if not lines:
        return items

    # ── Padrões de detecção de cabeçalho ────────────────────────────────────
    _HDR_PORTAS = re.compile(r"CEA\s*[-–]+\s*QUADRO\s+DE\s+PORTAS",  re.IGNORECASE)
    _HDR_PODO   = re.compile(r"CEA\s*[-–]+\s*QUADRO\s+PISO\s+PODO",  re.IGNORECASE)
    _HDR_LUM    = re.compile(r"CEA\s*[-–]+\s*QUADRO\s+DE\s+LUMINAR", re.IGNORECASE)
    _HDR_CV     = re.compile(r"CEA\s*[-–]+\s*COMUNICA",               re.IGNORECASE)

    # BUG-131-E: stop conservador para LU/PODO/CV — não para em PLANTA BAIXA ou ESC.:
    # (essas linhas de detalhe ficam mescladas pelo pdfplumber na área da tabela)
    _SEC_END_CONSERVATIVE = re.compile(
        r"^(Grand\s+total\b|Total\s+geral\b|NÚMERO\s+DATA|CEA\s*[-–])",
        re.IGNORECASE,
    )
    # BUG-306-B: stop agressivo para QUADRO DE PORTAS — detecta borda do quadro
    _SEC_END    = re.compile(
        r"^(Grand\s+total\b|Total\s+geral\b|NÚMERO\s+DATA|CEA\s*[-–]"
        r"|PLANTA\s+(BAIXA|ALTA)\b|ESC\s*\.?\s*:\s*1\s*:|NOTAS\s*[-–]"
        r"|LOCALIZA[ÇC][AÃ]O\s+(CORTES|PORTAS)|DETALHES?\s+P[\"']?\s*\d)",
        re.IGNORECASE,
    )
    _RE_SCALE   = re.compile(r"\b1\s*:\s*\d{2,3}\b")   # BUG-306-C: filtro de linhas de escala
    _DOOR_CODE  = re.compile(r"^([A-Z]{1,2}[A-Z]?\s*\d{3})\s+(.*)", re.IGNORECASE)
    _LU_CODE    = re.compile(r"^(LU\d{2})\s*(.*)",                   re.IGNORECASE)
    _CV_CODE    = re.compile(r"^(CV_\d+)\s+(.*)",                     re.IGNORECASE)
    _TECH_SPEC  = re.compile(r"^(FIX\s*:|ACAB\s*:|\d+\s*[Xx×]\s*LED|\d+\s*[Xx×]\s*\d+W)", re.IGNORECASE)
    _QTD_END    = re.compile(r"\s+(\d{1,4})\s*$")
    _QTD_START  = re.compile(r"^(\d{1,3})\s+(?![Xx×\d])")   # BUG-131-B: "7 GESSO..." (não "1 X LED", não "1000LM")
    _DIMS_END   = re.compile(r"\s+(\d{1,4})\s+[\d.]+\s+[\d.]+\s*$")

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # ── QUADRO DE PORTAS (BUG-3) ─────────────────────────────────────────
        if _HDR_PORTAS.search(line):
            i += 1
            code = desc = ""
            while i < len(lines):
                s = lines[i].strip()
                i += 1
                if _SEC_END.match(s):
                    break
                if not s or len(s) < 3:
                    continue
                if re.match(r"^(CÓD|TÉCNICO|DESCRIÇÃO|QTD|Larg|Alt\.)", s, re.IGNORECASE):
                    continue
                # BUG-306-C: descarta linhas de escala (ex: "1 : 50 1 : 50")
                if _RE_SCALE.search(s):
                    continue
                m_door = _DOOR_CODE.match(s)
                if m_door:
                    # BUG-306-C: descarta índices de detalhe ("PD 030 PD 031 PD 032...")
                    rest_after_code = m_door.group(2).strip()
                    if _DOOR_CODE.match(rest_after_code):
                        continue
                    if code and desc:
                        m_q = _DIMS_END.search(desc) or _QTD_END.search(desc)
                        if m_q:
                            qty   = float(m_q.group(1))
                            clean = desc[:m_q.start()].strip()
                            _cea_add(items, seen, counter, f"{code} {clean}", qty, "un", 90, "marcenaria")
                    code = m_door.group(1).strip()
                    desc = m_door.group(2).strip()
                elif code and s:
                    # BUG-306-A: se desc já tem QTD resolvido, flush antes de contaminar
                    already = _DIMS_END.search(desc) or _QTD_END.search(desc)
                    if already:
                        qty   = float(already.group(1))
                        clean = desc[:already.start()].strip()
                        _cea_add(items, seen, counter, f"{code} {clean}", qty, "un", 90, "marcenaria")
                        code = desc = ""
                    else:
                        m_q = _DIMS_END.search(s) or _QTD_END.search(s)
                        if m_q:
                            qty   = float(m_q.group(1))
                            clean = s[:m_q.start()].strip()
                            full  = (desc + " " + clean).strip() if clean else desc
                            _cea_add(items, seen, counter, f"{code} {full}", qty, "un", 90, "marcenaria")
                            code = desc = ""
                        else:
                            desc = (desc + " " + s).strip()
            if code and desc:
                m_q = _DIMS_END.search(desc) or _QTD_END.search(desc)
                if m_q:
                    qty   = float(m_q.group(1))
                    clean = desc[:m_q.start()].strip()
                    _cea_add(items, seen, counter, f"{code} {clean}", qty, "un", 90, "marcenaria")
            continue

        # ── QUADRO PISO PODOTÁTIL (BUG-3) ───────────────────────────────────
        if _HDR_PODO.search(line):
            i += 1
            desc = ""
            while i < len(lines):
                s = lines[i].strip()
                i += 1
                if _SEC_END_CONSERVATIVE.match(s):  # BUG-131-E: stop conservador
                    break
                if not s or len(s) < 3:
                    continue
                if re.match(r"^(DESCRIÇÃO|QUANT)", s, re.IGNORECASE):
                    continue
                m_q = _QTD_END.search(s)
                if m_q:
                    qty   = float(m_q.group(1))
                    clean = s[:m_q.start()].strip()
                    full  = (desc + " " + clean).strip() if clean else desc
                    if full:
                        _cea_add(items, seen, counter, full, qty, "un", 90, "revestimento")
                    desc = ""
                else:
                    desc = (desc + " " + s).strip() if desc else s
            continue

        # ── QUADRO DE LUMINÁRIAS (BUG-9) ─────────────────────────────────────
        if _HDR_LUM.search(line):
            i += 1
            lu_code = lu_desc = ""
            while i < len(lines):
                s = lines[i].strip()
                i += 1
                if _SEC_END_CONSERVATIVE.match(s):  # BUG-131-E: stop conservador
                    break
                if not s or len(s) < 2:
                    continue
                if re.match(
                    r"^(SAL[ÃA]O|PROVADOR|FACHADA|ADMIN|CÓD\.|DESCRIÇÃO|LÂMPADA|Image)",
                    s, re.IGNORECASE,
                ):
                    continue
                m_lu = _LU_CODE.match(s)
                if m_lu:
                    if lu_code and lu_desc:
                        m_q = _QTD_END.search(lu_desc)
                        if m_q:
                            qty   = float(m_q.group(1))
                            clean = lu_desc[:m_q.start()].strip()
                            _cea_add(items, seen, counter, f"{lu_code} {clean}", qty, "un", 90, "eletrica")
                    lu_code = m_lu.group(1).strip()
                    lu_desc = m_lu.group(2).strip()
                elif lu_code:
                    if _TECH_SPEC.match(s):
                        m_q = _QTD_END.search(s)
                        if m_q:
                            qty = float(m_q.group(1))
                            _cea_add(items, seen, counter, f"{lu_code} {lu_desc}", qty, "un", 90, "eletrica")
                            lu_code = lu_desc = ""
                    else:
                        m_q = _QTD_END.search(s)
                        if m_q:
                            qty   = float(m_q.group(1))
                            clean = s[:m_q.start()].strip()
                            full  = (lu_desc + " " + clean).strip() if clean else lu_desc
                            _cea_add(items, seen, counter, f"{lu_code} {full}", qty, "un", 90, "eletrica")
                            lu_code = lu_desc = ""
                        else:
                            # BUG-131-B: QTD no início da linha ("7 GESSO, ACABAMENTO...")
                            # evita "1 X LED" (spec) e "1000LM" (dimensão)
                            m_qs = _QTD_START.match(s) if lu_desc else None
                            if m_qs:
                                qty = float(m_qs.group(1))
                                _cea_add(items, seen, counter, f"{lu_code} {lu_desc}", qty, "un", 90, "eletrica")
                                lu_code = lu_desc = ""
                            else:
                                lu_desc = (lu_desc + " " + s).strip()
            if lu_code and lu_desc:
                m_q = _QTD_END.search(lu_desc)
                if m_q:
                    qty   = float(m_q.group(1))
                    clean = lu_desc[:m_q.start()].strip()
                    _cea_add(items, seen, counter, f"{lu_code} {clean}", qty, "un", 90, "eletrica")
            continue

        # ── CEA - COMUNICAÇÃO VISUAL (BUG-13) ────────────────────────────────
        if _HDR_CV.search(line):
            i += 1
            cv_code = cv_desc = ""
            while i < len(lines):
                s = lines[i].strip()
                i += 1
                if _SEC_END_CONSERVATIVE.match(s) or not s:  # BUG-131-E: stop conservador
                    break
                if re.match(r"^(Código|Code|Description|Qtd\.)", s, re.IGNORECASE):
                    continue
                m_cv = _CV_CODE.match(s)
                if m_cv:
                    if cv_code and cv_desc:
                        m_q = _QTD_END.search(cv_desc)
                        if m_q:
                            qty   = float(m_q.group(1))
                            clean = cv_desc[:m_q.start()].strip()
                            _cea_add(items, seen, counter, clean or cv_code, qty, "un", 90, "outro")
                    cv_code = m_cv.group(1).strip()
                    rest    = m_cv.group(2).strip()
                    m_q     = _QTD_END.search(rest)
                    if m_q:
                        qty   = float(m_q.group(1))
                        clean = rest[:m_q.start()].strip()
                        _cea_add(items, seen, counter, clean or cv_code, qty, "un", 90, "outro")
                        cv_code = cv_desc = ""
                    else:
                        cv_desc = rest
                elif cv_code:
                    m_q = _QTD_END.search(s)
                    if m_q:
                        qty   = float(m_q.group(1))
                        clean = s[:m_q.start()].strip()
                        full  = (cv_desc + " " + clean).strip() if clean else cv_desc
                        _cea_add(items, seen, counter, full or cv_code, qty, "un", 90, "outro")
                        cv_code = cv_desc = ""
                    else:
                        cv_desc = (cv_desc + " " + s).strip()
            if cv_code and cv_desc:
                m_q = _QTD_END.search(cv_desc)
                if m_q:
                    qty   = float(m_q.group(1))
                    clean = cv_desc[:m_q.start()].strip()
                    _cea_add(items, seen, counter, clean or cv_code, qty, "un", 90, "outro")
            continue

        i += 1

    log.debug("  parse_special_tables: %d itens extraídos", len(items))
    return items


def extract_partial_items_from_text(pdf: dict, already_seen: set) -> tuple:
    """
    Extrai descrições de materiais do texto bruto do PDF — mesmo sem quantidade.
    Usado como fallback quando CEA-QNT tables estão ausentes (pranchas de acabamentos,
    elevações, quadros de especificação sem coluna de qty).

    Retorna (itens_parciais: list[dict], height_context: dict).
    - itens_parciais: quantidade=0, status="aguardando" — aguardam verificação visual da IA
    - height_context: e.g. {"ceram": 140, "pint": 110, "forro": 250}  (altura em cm)
    """
    lines = pdf.get("text_lines", [])
    if not lines:
        return [], {}

    height_context: dict = {}
    items: list = []
    seen: set = set(already_seen)
    id_counter = [200]

    # ── 1. Extrai cotas de altura ────────────────────────────────────────────────
    for i, line in enumerate(lines):
        # Formato: "H CERAMICA 140" ou "H CERAMICA: 140" ou "H CERAMICA = 140"
        m_lbl = RE_H_LABELED.search(line)
        if m_lbl:
            tipo = m_lbl.group(1).lower()[:5]
            height_context[tipo] = float(m_lbl.group(2))
            continue

        # Formato: "H CERAMICA" em uma linha, número "140" na linha seguinte
        if RE_H_ALONE.match(line):
            tipo = RE_H_ALONE.match(line).group(1).lower()[:5]
            if i + 1 < len(lines) and RE_NUMERO.match(lines[i + 1].strip()):
                height_context[tipo] = float(lines[i + 1].strip().replace(",", "."))
            continue

        # Formato genérico: "H = 140cm" (sem rótulo de material)
        m_inline = RE_H_INLINE.search(line)
        if m_inline and "geral" not in height_context:
            height_context["geral"] = float(m_inline.group(1))

    # ── 2. Reassembla descrições multilinhas e coleta materiais ──────────────────
    buffer: list = []

    def flush():
        if not buffer:
            return
        desc = " ".join(buffer).strip()
        # Remove sufixos de produto: "d=28 x 16.6 x 34", "H= 140cm"
        desc = re.sub(r"\s*d\s*=\s*[\d.\s×xX]+.*$", "", desc, flags=re.IGNORECASE)
        desc = re.sub(r"\s*H\s*=\s*\d+\s*cm\b.*$", "", desc, flags=re.IGNORECASE)
        desc = desc.strip(" ,/")

        if len(desc) < 10:
            return
        if not _MATERIAL_KEYWORDS.search(desc):
            return

        dkey = normalize_key(desc)
        if dkey in seen:
            return
        seen.add(dkey)

        cat = guess_categoria(desc)
        unidade = "m2" if cat in ("revestimento", "pintura", "civil") else "un"

        items.append({
            "id": id_counter[0],
            "ambiente": "Geral",
            "descricao": desc[:120],
            "categoria": cat,
            "unidade": unidade,
            "quantidade": 0,
            "confianca": 30,
            "fonte": "PDF",
            "status": "aguardando",
            "pendencias": ["quantidade ausente no PDF — verificar na imagem"],
        })
        id_counter[0] += 1

    in_nota      = False  # True dentro de NOTA GERAL numerada (ex: "05) …")
    in_materiais = False  # True dentro de bloco de especificação de porta (BUG-4)
    for line in lines:
        s = line.strip()
        noise_tag = classify_noise(s)
        if noise_tag is not None:
            if noise_tag == "nota_numerada":
                in_nota = True
            elif noise_tag in ("porta_code", "materiais_label"):
                in_materiais = True  # entra em modo spec de porta — descarta continuação
            flush()
            buffer = []
            continue
        # Sai do modo nota somente ao encontrar um cabeçalho de seção de quantidades
        if in_nota:
            if RE_CEA_QNT.search(s) or RE_QUADRO.match(s):
                in_nota = False
            else:
                continue
        # Sai do modo materiais ao encontrar seção ou outro código de porta
        if in_materiais:
            if RE_CEA_QNT.search(s) or RE_QUADRO.match(s):
                in_materiais = False
            else:
                continue
        if RE_NUMERO.match(s) or RE_H_ALONE.match(s) or RE_H_LABELED.search(s):
            flush()
            buffer = []
            continue
        if len(s) < 5:
            flush()
            buffer = []
            continue

        # Nova descrição começa se: buffer já tem keyword E linha parece novo item
        if buffer and _MATERIAL_KEYWORDS.search(s) and _MATERIAL_KEYWORDS.search(" ".join(buffer)):
            _continuacao = s[0].islower() or s[:3].lower() in ("com", "sem", "de ", "e r", "ou ", "e p")
            if not _continuacao:
                flush()
                buffer = [s]
                continue

        buffer.append(s)

    flush()
    log.debug("  extract_partial: %d itens parciais, height_context=%s", len(items), height_context)
    return items, height_context


_RE_QUADRO_ACAB_HDR = re.compile(r"QUADRO\s+DE\s+ACABAMENTOS", re.IGNORECASE)
_RE_CEA_OR_PLANTA_STOP = re.compile(
    r"CEA\s*[-–]|^\d{3}\s*[-–]\s*(PLANTA|CORTE|ELEVA|FORRO|PISO)",
    re.IGNORECASE,
)


def parse_budget_rows_from_text(pdf: dict, already_seen: set | None = None) -> list[dict]:
    """
    Varredura global de linhas com padrão DESC QTY unidade — sem depender de
    cabeçalho CEA-QNT. Complementa parse_cea_qnt_from_text para linhas perdidas
    ou partidas pelo pdfplumber.
    """
    items: list[dict] = []
    seen: set = set(already_seen or [])
    counter = [800]

    rejoined = rejoin_budget_lines(pdf.get("raw_text_lines", []))
    in_quadro = False

    for line in rejoined:
        s = line.strip()
        if not s:
            continue
        if _RE_QUADRO_ACAB_HDR.search(s):
            in_quadro = True
            continue
        if in_quadro and _RE_CEA_OR_PLANTA_STOP.search(s):
            in_quadro = False
        if in_quadro:
            continue
        if (_RE_ACABAMENTO_SPEC.search(s)
                or _RE_SPEC_FRAG.match(s)
                or _RE_DRAWING_LABEL.match(s)):
            continue

        parsed = parse_budget_row(s)
        if not parsed:
            continue
        desc, qty, unit = parsed
        if qty <= 0:
            continue

        fallback = "pintura" if "PINT" in desc.upper() else "civil"
        _cea_add(items, seen, counter, desc, qty, unit, 88, fallback, tabela="GLOBAL_SCAN")

    log.debug("  parse_budget_rows_global: %d itens", len(items))
    return items


# Linhas de tabela CEA-QNT não capturadas por pdfplumber.
# Formatos suportados (todos com área m² embutida na linha):
#   "P1 PISO VINÍLICO TARKETT … 914.55 m² 136.56 m"  (P-code)
#   "10 ARGAMASSA IMPERMEABILIZANTE … 28.87 m² 37.80 m"  (código numérico)
#   "ACABAMENTO EM ACM BRANCO BRILHO 52 m² 24.58"  (sem prefixo)
#   Embutidas: "48.54 mP1 PISO VINÍLICO … 914.55 m²"  (P-code após outra célula)
RE_CEA_QNT_ROW = re.compile(
    r"(?:^|(?<=m\b))(?:(?:P\d+[A-Z]?|\d{1,2})\s+)?"
    r"([A-ZÁÉÍÓÚÀÂÊÎÔÃÕÇ][\w\s\-–/\.]{4,}?)\s+"
    r"([\d,.]+)\s*m[²2]",
    re.IGNORECASE,
)


def parse_pcode_items_from_text(pdf: dict, already_seen: set | None = None) -> list[dict]:
    """
    Recupera itens de tabela CEA-QNT que pdfplumber não inclui no extract_tables().

    Cobre linhas com P-code (P1, P3, P12…) e código numérico (10, 20…),
    tanto em linhas standalone quanto fundidas com a linha anterior.
    O padrão esperado é:
        'P1 PISO VINÍLICO TARKETT … 914.55 m² 136.56 m'
        '10 ARGAMASSA IMPERMEABILIZANTE … 28.87 m² 37.80 m'

    Retorna itens com confiança 85 e status 'confirmado'.
    """
    seen: set = set(already_seen or [])
    items: list = []
    id_counter = [600]

    rejoined = rejoin_budget_lines(pdf.get("raw_text_lines", []))
    for raw_line in rejoined:
        for m in RE_CEA_QNT_ROW.finditer(raw_line):
            descricao = m.group(1).strip()[:120]
            qty_str   = m.group(2)

            if len(descricao) < 8:
                continue
            if not _MATERIAL_KEYWORDS.search(descricao):
                continue

            qty = float(qty_str.replace(",", "."))
            if qty <= 0:
                continue

            dkey = normalize_key(descricao)
            if dkey in seen:
                continue
            seen.add(dkey)

            items.append({
                "id":        id_counter[0],
                "ambiente":  "Geral",
                "descricao": descricao,
                "categoria": guess_categoria(descricao),
                "unidade":   "m2",
                "quantidade": qty,
                "confianca": 85,
                "fonte":     "PDF",
                "status":    "confirmado",
                "pendencias": [],
            })
            id_counter[0] += 1

    log.debug("  parse_pcode: %d itens CEA-QNT extraídos do texto", len(items))
    return items


def parse_section_recovery(pdf: dict, already_seen: set | None = None) -> list[dict]:
    """
    Nível 2b: recupera linhas descartadas como not_budget_relevant/dim_spec
    quando estão dentro de seções CEA-QNT conhecidas (SOLEIRAS, PINTURA).
    """
    items: list[dict] = []
    seen: set = set(already_seen or [])
    counter = [900]

    recoverable: set[str] = set()
    for entry in pdf.get("noise_removed", []):
        if entry.get("motivo") in ("not_budget_relevant", "dim_spec"):
            s = entry.get("line", "").strip()
            if s:
                recoverable.add(s)

    if not recoverable:
        return items

    current: str | None = None
    sec_lines: list[str] = []

    def _flush_section(sec: str | None, lines: list[str]) -> None:
        if not sec or not lines:
            return
        if sec == "SOLEIRAS":
            sol_acc: dict[str, float] = {}
            sol_desc: dict[str, str] = {}
            for line in lines:
                if line not in recoverable and classify_noise(line) is not None:
                    continue
                m = _RE_DIM.search(line.strip())
                if not m:
                    continue
                desc = line.strip()[:m.start()].strip().rstrip(" ,/-")
                if len(desc) < 5:
                    continue
                try:
                    length_ml = float(m.group(2).replace(",", "."))
                except ValueError:
                    continue
                dkey = _soleira_material_key(desc)
                sol_acc[dkey] = sol_acc.get(dkey, 0.0) + length_ml
                sol_desc[dkey] = desc
            _SOLEIRA_LABELS = {
                "SOLEIRA_CINZA_ANDORINHA": "SOLEIRA EM GRANITO CINZA ANDORINHA",
                "SOLEIRA_BRANCO_CEARA":    "SOLEIRA EM GRANITO BRANCO CEARÁ",
            }
            for dkey, total in sol_acc.items():
                desc = _SOLEIRA_LABELS.get(dkey, sol_desc.get(dkey, dkey))
                _cea_add(items, seen, counter, desc, round(total, 4), "ml", 85,
                         "revestimento", tabela="SOLEIRAS")
        elif "PINTURA" in sec:
            item_zona = _zona_from_prancha(pdf, sec)
            prev_desc = ""
            for line in lines:
                s = line.strip()
                if s not in recoverable and classify_noise(s) not in (None, "dim_spec"):
                    if not _RE_PISOS_ROW.search(s) and not _RE_M2_START.match(s):
                        continue
                m_start = _RE_M2_START.match(s)
                if m_start and prev_desc:
                    qty = float(m_start.group(1).replace(",", "."))
                    rest = m_start.group(2).strip()
                    base = _RE_TRAILING_NUM.sub("", prev_desc).strip()
                    full = (base + (" " + rest if rest and not RE_NUMERO.match(rest) else "")).strip()
                    _cea_add(items, seen, counter, full, qty, "m2", 85,
                             "pintura", tabela=sec, zona=item_zona)
                    prev_desc = ""
                    continue
                m = _RE_PISOS_ROW.match(s)
                if m:
                    desc = _RE_TRAILING_NUM.sub("", m.group(1).strip()).strip()
                    desc = re.sub(r"^[\d,.]+\s+", "", desc)
                    qty = float(m.group(2).replace(",", "."))
                    _cea_add(items, seen, counter, desc, qty, "m2", 85,
                             "pintura", tabela=sec, zona=item_zona)
                    prev_desc = ""
                elif s and len(s) > 8 and not RE_NUMERO.match(s):
                    prev_desc = s

    for line in pdf.get("raw_text_lines", []):
        s = line.strip()
        if not s:
            continue
        m_broad = _RE_CEA_BROAD.search(s)
        m_sec = _RE_CEA_SEC.search(s) if not m_broad else None
        if m_broad or m_sec:
            if sec_lines and current:
                _flush_section(current, sec_lines)
            sec_lines = []
            raw = (m_broad.group(2) if m_broad else m_sec.group(1)).strip().upper()
            if "SOLEI" in raw:
                current = "SOLEIRAS"
            elif "PINTURA" in raw:
                current = raw.replace(" ", "_")
            else:
                current = None
            continue
        if current:
            if _RE_SEC_STOP.match(s):
                _flush_section(current, sec_lines)
                current = None
                sec_lines = []
                continue
            sec_lines.append(s)

    if sec_lines and current:
        _flush_section(current, sec_lines)

    log.debug("  parse_section_recovery: %d itens recuperados", len(items))
    return items


# ─────────────────────────────────────────────────────────────────────────────
# DUAL EXTRACTION: PyMuPDF text (segunda camada, rápida) + cross-validation
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_mupdf(path: str) -> dict:
    """
    Extrai texto do PDF usando PyMuPDF (fitz) em vez de pdfplumber.

    O PyMuPDF lê o stream de conteúdo do PDF em ordem de arquivo — algoritmo
    diferente do pdfplumber (que agrupa por blocos visuais). Essa diferença
    permite capturar itens que o pdfplumber perde em layouts complexos.

    Velocidade: <10ms por página (vs. segundos do find_tables).
    Retorna o mesmo formato de dict que extract_pdf() para compatibilidade
    com parse_cea_qnt_from_text() e parse_cea_qnt_tables().
    """
    _empty: dict = {
        "ok": False,
        "text_lines": [],
        "budget_lines": [],
        "raw_text_lines": [],
        "noise_removed": [],
        "measure_lines": [],
        "area_tags": [],
        "cea_qnt_tables": [],
        "quadro_acabamentos": [],
        "errors": [],
    }
    try:
        import fitz  # already installed for PNG generation
    except ImportError:
        log.warning("PyMuPDF (fitz) não disponível — text extraction desativada")
        return _empty

    raw_lines: list[str] = []
    errors:    list[str] = []
    try:
        doc = fitz.open(path)
        for page_num, page in enumerate(doc):
            try:
                text = page.get_text("text")  # raw text stream — fast, no table detection
                raw_lines.extend(text.splitlines())
            except Exception as e:
                errors.append(f"página {page_num}: {e}")
        doc.close()
    except Exception as e:
        log.warning("  extract_text_mupdf erro: %s", e)
        _empty["errors"].append(str(e))
        return _empty

    # Apply same noise filter as extract_pdf()
    text_lines:    list[str] = []
    noise_removed: list[dict] = []
    measure_lines: list[str] = []
    area_tags:     list[str] = []

    for line in raw_lines:
        s = line.strip()
        if not s:
            continue
        motivo = classify_noise(s)
        if motivo:
            noise_removed.append({"line": s, "motivo": motivo})
        else:
            text_lines.append(s)
        if RE_MEASURE.search(s):
            measure_lines.append(s)
        if RE_AREA.search(s):
            area_tags.append(s)

    log.debug(
        "  extract_text_mupdf: %d raw lines → %d clean, %d noise",
        len(raw_lines), len(text_lines), len(noise_removed),
    )

    stripped_raw = [l.strip() for l in raw_lines if l.strip()]
    budget_lines, extra_noise = build_budget_display_lines(stripped_raw)
    noise_removed.extend(extra_noise)

    return {
        "ok": True,
        "text_lines":         text_lines,
        "budget_lines":       budget_lines,
        "raw_text_lines":     stripped_raw,
        "noise_removed":      noise_removed,
        "measure_lines":      measure_lines,
        "area_tags":          area_tags,
        "cea_qnt_tables":     [],  # not extracted by text method
        "quadro_acabamentos": [],
        "errors":             errors,
    }


def extract_mupdf_tables(path: str) -> list[dict]:
    """
    Segunda camada de extração usando PyMuPDF find_tables().
    Detecta tabelas por linhas vetoriais do PDF (algoritmo diferente do pdfplumber).
    Retorna itens com a mesma estrutura de _cea_add.
    """
    try:
        import fitz  # already installed for PNG generation
    except ImportError:
        log.warning("PyMuPDF (fitz) não disponível — dual extraction desativada")
        return []

    items: list  = []
    seen:  set   = set()
    counter      = [2000]  # ids distintos dos itens pdfplumber (1–1999)

    try:
        doc = fitz.open(path)
        for page_num, page in enumerate(doc):
            try:
                tabs = page.find_tables()
            except Exception as e:
                log.debug("  mupdf page %d find_tables erro: %s", page_num, e)
                continue

            for tab in tabs:
                try:
                    rows = tab.extract()  # list[list[str|None]]
                except Exception:
                    continue

                if not rows or len(rows) < 2:
                    continue

                # Heurística: coluna de descrição = texto mais longo, coluna qty = numérica
                header = [str(c or "").strip().upper() for c in rows[0]]

                # Só processar tabelas que parecem QNT (header contém qty/área keywords)
                header_str = " ".join(header)
                if not re.search(r"(QNT|QUANT|AREA|M2|M²|ML|UN\b)", header_str, re.IGNORECASE):
                    # Tenta heurística sem header: precisa ter pelo menos uma linha numérica
                    has_numeric = any(
                        any(RE_AREA_VAL.search(str(c or "")) for c in row)
                        for row in rows[1:4]
                    )
                    if not has_numeric:
                        continue

                for row in rows[1:]:  # skip header
                    cells = [str(c or "").strip() for c in row]
                    if not any(cells):
                        continue

                    # Encontrar célula de descrição (texto > 5 chars, não puramente numérico)
                    desc = ""
                    qty  = 0.0
                    un   = "m2"

                    for cell in cells:
                        if not cell:
                            continue
                        # Tenta extrair quantidade com unidade
                        m_area = RE_AREA_VAL.search(cell)
                        m_ml   = RE_ML_VAL.search(cell)
                        m_un   = RE_UN_VAL.search(cell)
                        if m_area and qty == 0.0:
                            try:
                                qty = float(m_area.group(1).replace(",", "."))
                                un  = "m2"
                            except ValueError:
                                pass
                        elif m_ml and qty == 0.0:
                            try:
                                qty = float(m_ml.group(1).replace(",", "."))
                                un  = "ml"
                            except ValueError:
                                pass
                        elif m_un and qty == 0.0:
                            try:
                                qty = float(m_un.group(1).replace(",", "."))
                                un  = "un"
                            except ValueError:
                                pass
                        elif RE_NUMERO.match(cell) and qty == 0.0:
                            try:
                                v = float(cell.replace(",", "."))
                                if v > 0:
                                    qty = v
                            except ValueError:
                                pass
                        elif len(cell) >= 5 and not RE_NUMERO.match(cell) and not desc:
                            desc = cell[:120]

                    if not desc or qty <= 0:
                        continue

                    # Corrigir truncamento PyMuPDF ANTES do _MATERIAL_KEYWORDS check:
                    # "FORRO" cai na página seguinte como "RO …" porque a célula foi cortada.
                    if re.match(r"^RO\s+(LISO|TABICADO|MODULADO|REBAIXADO|MINERAL|GESSO|ACARTONADO|EM\s+GESSO|EM\s+ACM)", desc, re.IGNORECASE):
                        desc = "FOR" + desc  # "FOR" + "RO LISO..." = "FORRO LISO..."

                    if not _MATERIAL_KEYWORDS.search(desc):
                        continue

                    # Se nenhuma unidade explícita foi detectada (ainda "m2" por padrão),
                    # infere a unidade pela descrição — rodapé/soleira/formica são ml, não m².
                    if un == "m2":
                        desc_lower = desc.lower()
                        if re.search(
                            r"rodap[eé]|soleira|corrimao|corrimão|barra\s+de\s+\d"
                            r"|formica\s+prattan|primer\s+tarket|tarket\s+primer"
                            r"|laminado\s+de\s+borda|perfil\s+de\s+acabamento",
                            desc_lower,
                        ):
                            un = "ml"
                        elif re.search(r"\bun\b|unidade|porta|luminár|lumin|armário|armario|cuba", desc_lower):
                            un = "un"

                    _cea_add(items, seen, counter, desc, qty, un, confianca=80)

        doc.close()
    except Exception as e:
        log.warning("  extract_mupdf_tables erro geral: %s", e)

    log.debug("  extract_mupdf_tables: %d itens extraídos", len(items))
    return items


def merge_dual_extraction(
    plumber_items: list[dict],
    mupdf_items:   list[dict],
) -> list[dict]:
    """
    Cross-valida dois conjuntos de itens extraídos (pdfplumber + PyMuPDF).

    Regras:
    - Ambos encontraram, diferença < 5%  → confianca=95, usa média
    - Ambos encontraram, diferença >= 5% → confianca=70, usa max (undercount é mais comum)
    - Só pdfplumber encontrou            → confianca item original, sem mudança
    - Só mupdf encontrou                 → confianca=75, adiciona ao resultado

    Retorna lista unificada com campo extra "confianca_dual" (string legível).
    """
    # Indexar por normalized key
    plumber_map: dict[str, dict] = {}
    for it in plumber_items:
        k = normalize_key(it.get("descricao", ""))
        if k:
            plumber_map[k] = it

    mupdf_map: dict[str, dict] = {}
    for it in mupdf_items:
        k = normalize_key(it.get("descricao", ""))
        if k:
            mupdf_map[k] = it

    # Índice de prefixo para fuzzy match: PyMuPDF frequentemente trunca descrições.
    # Mapeia o primeiro segmento significativo (min 20 chars) para a chave completa.
    _PREFIX_MIN = 20
    mupdf_prefix: dict[str, str] = {}  # prefixo → chave original em mupdf_map
    for k in mupdf_map:
        if len(k) >= _PREFIX_MIN:
            mupdf_prefix[k[:_PREFIX_MIN]] = k

    def _find_mupdf_key(pb_key: str) -> str | None:
        """Encontra chave correspondente em mupdf_map via exact match ou prefix fuzzy."""
        if pb_key in mupdf_map:
            return pb_key
        # PyMuPDF truncou a descrição: verifica se mupdf key é prefixo do plumber key
        for mu_key in mupdf_map:
            if len(mu_key) >= _PREFIX_MIN and pb_key.startswith(mu_key):
                return mu_key
        # Plumber truncou (raro): verifica se plumber key é prefixo de mupdf key
        if len(pb_key) >= _PREFIX_MIN:
            mu_key_candidate = mupdf_prefix.get(pb_key[:_PREFIX_MIN])
            if mu_key_candidate and mu_key_candidate.startswith(pb_key):
                return mu_key_candidate
        return None

    merged: list[dict] = []
    used_mupdf: set = set()

    for key, pb in plumber_map.items():
        item = dict(pb)
        mu_key = _find_mupdf_key(key)
        if mu_key is not None:
            used_mupdf.add(mu_key)
            mu       = mupdf_map[mu_key]
            qty_pb   = pb.get("quantidade", 0) or 0
            qty_mu   = mu.get("quantidade", 0) or 0
            max_qty  = max(qty_pb, qty_mu)
            if max_qty == 0:
                item["confianca_dual"] = "baixa"
            else:
                diff = abs(qty_pb - qty_mu) / max_qty
                if diff < 0.05:
                    item["quantidade"]     = round((qty_pb + qty_mu) / 2, 4)
                    item["confianca"]      = 95
                    item["confianca_dual"] = "alta"
                else:
                    item["quantidade"]     = round(max_qty, 4)
                    item["confianca"]      = 70
                    item["confianca_dual"] = f"revisar ({qty_pb} vs {qty_mu})"
        else:
            item["confianca_dual"] = "unica_plumber"
        merged.append(item)

    # Itens que só o PyMuPDF encontrou
    for key, mu in mupdf_map.items():
        if key in used_mupdf:
            continue
        item = dict(mu)
        item["confianca"]      = 75
        item["confianca_dual"] = "unica_mupdf"
        merged.append(item)

    log.info(
        "  merge_dual: plumber=%d mupdf=%d → merged=%d",
        len(plumber_items), len(mupdf_items), len(merged),
    )
    return merged
