# -*- coding: utf-8 -*-
"""
pdf_extractor.py — extração de texto, tabelas e medidas de arquivos PDF.

Retorna um dict com:
  ok                  bool       — leitura bem-sucedida
  text_lines          list[str]  — linhas LIMPAS (após filtro de ruído)
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
    r"PAINEL\s+CENTRALIZADO,\s+COM\s+PINT)",                            # continuação de fachada
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
]


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
                     "spec_frag", "secao_label", "registro_rev"):
            if pattern.match(s):
                return tag
        else:
            if pattern.search(s):
                return tag
    return None


def extract_pdf(path: str) -> dict:
    r: dict = {
        "ok": False,
        "text_lines": [],           # linhas LIMPAS (após filtro de ruído)
        "raw_text_lines": [],       # linhas BRUTAS (antes de qualquer filtro)
        "noise_removed": [],        # {"line": str, "motivo": str}
        "measure_lines": [],
        "cea_qnt_tables": [],
        "quadro_acabamentos": [],
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
                except Exception as e:
                    r["errors"].append(f"pg{i + 1}: {e}")
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
# Linha simples "DESCRIÇÃO   VALOR" — usada nas tabelas CEA-LINEAR e CEA-QNTD (BUG-6)
_RE_SIMPLE_ROW   = re.compile(r"^(.{5,}?)\s+([\d,.]+)\s*$")
# Cabeçalho mais amplo que captura CEA-LINEAR e CEA-QNTD além de CEA-QNT (BUG-6)
_RE_CEA_BROAD    = re.compile(r"CEA\s*[-–]+\s*(QNT|LINEAR|QNTD)\b\s*(.*)", re.IGNORECASE)
# Grand total sem dois-pontos — para defesa em step 5 (BUG-12)
_RE_GRAND_TOTAL  = re.compile(r"^Grand\s+total\b", re.IGNORECASE)


def _cea_add(
    items: list, seen: set, counter: list,
    desc: str, qty: float, unidade: str, confianca: int, fallback_cat: str = "outro",
) -> bool:
    """Adiciona item se não for duplicata. Retorna True se foi adicionado."""
    desc = desc.strip(" ,/")[:120]
    if len(desc) < 5 or qty <= 0:
        return False
    dkey = normalize_key(desc)
    if dkey in seen:
        return False
    seen.add(dkey)
    cat = guess_categoria(desc)
    if cat == "outro":
        cat = fallback_cat
    items.append({
        "id":         counter[0],
        "ambiente":   "Geral",
        "descricao":  desc,
        "categoria":  cat,
        "unidade":    unidade,
        "quantidade": round(qty, 4),
        "confianca":  confianca,
        "fonte":      "PDF",
        "status":     "confirmado",
        "pendencias": [],
    })
    counter[0] += 1
    return True


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
            if _RE_SEC_STOP.match(line.strip()):
                current = None
                continue
            sections[current].append(line)

    # ── 1b. Seções genéricas (PAREDES, PINTURA …) + LINEAR/QNTD/LOGO — raw_text_lines ──
    # raw_text_lines preserva linhas mescladas pelo pdfplumber (ex: "PINTURA …
    # 371 m² 01 R01 24/07/2025 …") que seriam descartadas como ruído no text_lines.
    # Seções RFID são detalhe; os totais já aparecem na seção-pai (PAREDES).
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
                    current = "SKIP_" + raw.replace(" ", "_")
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
                    current = None
                    continue
            elif _RE_SEC_STOP.match(ls):
                current = None
                continue
            sections[current].append(line)

    # ── 2. PISOS — P-code, código numérico e sem código ─────────────────────
    for line in sections.get("PISOS", []):
        m = _RE_PISOS_ROW.match(line.strip())
        if not m:
            continue
        _cea_add(items, seen, counter,
                 m.group(1).strip(), float(m.group(2).replace(",", ".")),
                 "m2", 95, "revestimento")

    # ── 3. SOLEIRAS — calcula área = W×L e agrupa por tipo de granito ────────
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
            area = float(m.group(1).replace(",", ".")) * float(m.group(2).replace(",", "."))
        except ValueError:
            continue
        dkey = normalize_key(desc)
        sol_acc[dkey]  = sol_acc.get(dkey, 0.0) + area
        sol_desc[dkey] = desc

    for dkey, total in sol_acc.items():
        desc = sol_desc[dkey]
        desc_up = desc.upper()
        # Pula se já existe soleira do mesmo material vinda da tabela PISOS
        if any(
            ("ANDORINHA" in desc_up and "ANDORINHA" in k.upper()) or
            ("CEAR" in desc_up and "CEAR" in k.upper())
            for k in seen if "SOLEIRA" in k.upper()
        ):
            continue
        _cea_add(items, seen, counter, desc, round(total, 4), "m2", 95, "revestimento")

    # ── 4. RODAPÉS — linha padrão e linha R5 (descrição separada da qty) ─────
    prev_desc = ""
    for line in sections.get("RODAPES", []):
        s = line.strip()

        m_std = _RE_RODAPE_STD.match(s)
        if m_std:
            desc = m_std.group(2).strip()
            _cea_add(items, seen, counter,
                     desc, float(m_std.group(3).replace(",", ".")),
                     "ml", 95, "revestimento")
            prev_desc = desc
            continue

        # Linha "R5 43.68 H=10cm" — descrição estava na linha anterior
        m_qty = _RE_RODAPE_QTY.match(s)
        if m_qty and prev_desc:
            qty  = float(m_qty.group(2).replace(",", "."))
            rest = s[m_qty.end():].strip()
            full = (prev_desc.rstrip(" ,/") + (" " + rest if rest else "")).strip()
            _cea_add(items, seen, counter, full, qty, "ml", 95, "revestimento")
            prev_desc = ""
            continue

        if s and not RE_NUMERO.match(s) and len(s) > 5:
            prev_desc = s

    # ── 4b. RODAPÉS (raw pass) — BUG-131-A: captura desc fundida com escala ──
    # pdfplumber às vezes une "ESC.: 1 : 75 ... RODAPÉ EM LAMINADO..." numa única
    # linha; _RE_ESC descarta no text_lines, mas raw_text_lines preserva.
    # Aqui fazemos uma segunda passagem com strip do prefixo ESC.
    _RE_ESC_PREFIX = re.compile(r"^(?:ESC\s*\.?\s*:\s*\d+\s*:\s*\d+\s*)+", re.IGNORECASE)
    prev_desc = ""
    for line in sections.get("RODAPES_RAW", []):
        s = line.strip()
        m_std = _RE_RODAPE_STD.match(s)
        if m_std:
            desc = m_std.group(2).strip()
            _cea_add(items, seen, counter,
                     desc, float(m_std.group(3).replace(",", ".")),
                     "ml", 95, "revestimento")
            prev_desc = desc
            continue
        m_qty = _RE_RODAPE_QTY.match(s)
        if m_qty and prev_desc:
            qty  = float(m_qty.group(2).replace(",", "."))
            rest = s[m_qty.end():].strip()
            full = (prev_desc.rstrip(" ,/") + (" " + rest if rest else "")).strip()
            _cea_add(items, seen, counter, full, qty, "ml", 95, "revestimento")
            prev_desc = ""
            continue
        # Strip "ESC.: 1 : 75" prefixes before storing as potential prev_desc
        s_clean = _RE_ESC_PREFIX.sub("", s).strip()
        if s_clean and not RE_NUMERO.match(s_clean) and len(s_clean) > 5:
            prev_desc = s_clean
        elif not s_clean:
            prev_desc = ""

    # ── 5. Seções genéricas: PAREDES, PINTURA, FORROS, LINEAR, QNTD, LOGO … ──
    _SKIP = {"PISOS", "SOLEIRAS", "RODAPES", "RODAPES_RAW"}
    for sec_name, sec_lines in sections.items():
        if sec_name in _SKIP or sec_name.startswith("SKIP_"):
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
                        _cea_add(items, seen, counter, pending[0], pending[1], unit, 90, "marcenaria")
                        pending = None
                    continue
                if is_noisy or is_header:
                    continue  # don't flush pending — suffix may still come next line
                m = _RE_SIMPLE_ROW.match(s)
                if m:
                    if pending:
                        _cea_add(items, seen, counter, pending[0], pending[1], unit, 90, "marcenaria")
                    pending = (m.group(1).strip(), float(m.group(2).replace(",", ".")))
                elif pending and not RE_NUMERO.match(s) and 2 <= len(s) <= 30:
                    # Linha curta sem número → sufixo da descrição anterior
                    pending = (f"{pending[0]} {s}", pending[1])
                else:
                    if pending:
                        _cea_add(items, seen, counter, pending[0], pending[1], unit, 90, "marcenaria")
                        pending = None
            if pending:
                _cea_add(items, seen, counter, pending[0], pending[1], unit, 90, "marcenaria")
            continue

        # ── 5b. Seções padrão m²: PAREDES, PINTURA, FORROS … ────────────────
        fallback_cat = "pintura" if "PINTURA" in sec_name else "civil"
        is_forros    = "FORRO" in sec_name
        prev_desc    = ""
        prev_last    = False  # True se a linha anterior adicionou um item (BUG-2)

        for line in sec_lines:
            s = line.strip()

            # Capture whether last iteration added an item, then reset
            was_last = prev_last
            prev_last = False

            # BUG-12: Grand total deve parar a seção (defesa em step 5)
            if _RE_GRAND_TOTAL.match(s):
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
                prev_last = _cea_add(items, seen, counter, full, qty, "m2", 90, fallback_cat)
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

                prev_last = _cea_add(items, seen, counter, desc, qty, "m2", 90, fallback_cat)
                # Segunda metade de linha mesclada (dois itens numa linha só)
                remainder = s[m.end():].strip()
                if remainder:
                    m2 = _RE_PISOS_ROW.match(remainder)
                    if m2:
                        d2 = _RE_TRAILING_NUM.sub("", m2.group(1).strip()).strip()
                        d2 = re.sub(r"^[\d,.]+\s+", "", d2)
                        d2 = _RE_DRAWING_PREFIX.sub("", d2).strip()
                        q2 = float(m2.group(2).replace(",", "."))
                        _cea_add(items, seen, counter, d2, q2, "m2", 90, fallback_cat)
                prev_desc = ""
                continue

            # BUG-2: linha curta pura logo após um item → sufixo da descrição
            if (s and not RE_NUMERO.match(s) and not is_noise_line(s)
                    and 5 < len(s) < 70 and was_last and items):
                items[-1]["descricao"] = (items[-1]["descricao"] + " " + s)[:120]
                prev_desc = ""
                continue

            # Linha de descrição pura (continuada na próxima)
            if s and not RE_NUMERO.match(s) and len(s) > 8:
                prev_desc = s
            else:
                prev_desc = ""

    log.debug("  parse_cea_qnt_from_text: %d itens extraídos (%d seções)",
              len(items), len(sections))
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


# Linhas de tabela CEA-QNT não capturadas por pdfplumber.
# Formatos suportados (todos com área m² embutida na linha):
#   "P1 PISO VINÍLICO TARKETT … 914.55 m² 136.56 m"  (P-code)
#   "10 ARGAMASSA IMPERMEABILIZANTE … 28.87 m² 37.80 m"  (código numérico)
#   Embutidas: "48.54 mP1 PISO VINÍLICO … 914.55 m²"  (P-code após outra célula)
RE_CEA_QNT_ROW = re.compile(
    r"(?:^|(?<=m))(?:P(\d+[A-Z]?)|\d{1,2})\s+([A-ZÁÉÍÓÚÀÂÊÎÔÃÕÇ].{7,}?)\s+([\d,.]+)\s*m[²2]",
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

    for raw_line in pdf.get("raw_text_lines", []):
        for m in RE_CEA_QNT_ROW.finditer(raw_line):
            descricao = m.group(2).strip()[:120]
            qty_str   = m.group(3)

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
