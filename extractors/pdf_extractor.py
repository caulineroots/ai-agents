# -*- coding: utf-8 -*-
"""
pdf_extractor.py — extração de texto, tabelas e medidas de arquivos PDF.
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
RE_AREA_VAL = re.compile(r"([\d,.]+)\s*m[²2]?", re.IGNORECASE)
RE_ML_VAL   = re.compile(r"([\d,.]+)\s*m\.?l\.?", re.IGNORECASE)
RE_UN_VAL   = re.compile(r"([\d,.]+)\s*un", re.IGNORECASE)

# Regexes para detecção de cotas de altura (formato "H CERAMICA 140" ou "H CERÂMICA\n140")
RE_H_ALONE   = re.compile(r"^H\s+(PINT|CERAM|FORRO|ALVENAR|REVEST|GESSO|AZULEJ|RODAP)", re.IGNORECASE)
RE_H_LABELED = re.compile(r"\bH\s+(PINT|CERAM|FORRO|ALVENAR|REVEST|GESSO|AZULEJ|RODAP)\w*[\s:=]+(\d+)", re.IGNORECASE)
RE_H_INLINE  = re.compile(r"\bH\s*=\s*(\d+)\s*cm", re.IGNORECASE)

# ── Filtros de ruído: linhas que não são itens de obra ────────────────────────
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

# Padrões adicionais para ruído que escapava dos filtros anteriores
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


def is_noise_line(line: str) -> bool:
    """Retorna True se a linha for ruído (nota, carimbo, referência de prancha, etc.)."""
    s = line.strip()
    if _RE_NOTA_GERAL.match(s):       return True   # 09) NÃO SERÁ...
    if _RE_REVISAO.search(s):         return True   # R02 25/09/2025
    if _RE_DATA.search(s) and len(s) < 80: return True  # linha com data (até 80 chars)
    if _RE_ESC.search(s):             return True   # ESC.: 1 : 50
    if _RE_PLANTA_REF.match(s):       return True   # 131 - PLANTA DE PISO
    if _RE_AXONO_TITLE.match(s):      return True   # AXONOMÉTRICA 01 ESC.:
    if _RE_CEP.search(s):             return True   # CEP 91330-370
    if _RE_GRID_CODES.match(s):       return True   # EQ94 EQ63 EQ63...
    if _RE_CARIMBO.search(s):         return True   # CEA-BLN-ARQ_RVT24_R00
    if _RE_SETOR.match(s):            return True   # SETOR BÁSICOS
    if _RE_NUMERO_LISTA.match(s):     return True   # 64 64 644 64
    if _RE_FRAG_NOTA.search(s):       return True   # ) E NA PLATAFORMA...
    if _RE_COORD_MIR.search(s):       return True   # path invertido AEC\ADC\ etc.
    if _RE_REGISTRO_REV.match(s):     return True   # R00 13/06/2025 EMISSÃO
    if _RE_LEGENDA.match(s):          return True   # LEGENDA INSTALAÇÕES FORRO...
    if _RE_NOTAS_HEADER.match(s):     return True   # NOTAS GERAIS 01) CONFERIR...
    if _RE_INSTRUCAO.search(s):       return True   # VER ESPECIFICAÇÕES NO CADERNO...
    if _RE_SPEC_FRAG.match(s):        return True   # FIX: / ACAB: / SOLDADO ABA...
    if _RE_SECAO_LABEL.match(s):      return True   # FORRO MEZANINO / PAREDES_CREMALHEIRAS
    return False


def extract_pdf(path: str) -> dict:
    r = {
        "ok": False, "text_lines": [], "measure_lines": [],
        "cea_qnt_tables": [], "quadro_acabamentos": [], "area_tags": [], "errors": [],
    }
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                try:
                    text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    # Remove ruído antes de processar (notas, carimbos, referências)
                    lines = [l for l in lines if not is_noise_line(l)]
                    r["text_lines"].extend(lines)
                    r["measure_lines"].extend([l for l in lines if RE_MEASURE.search(l)])
                    r["area_tags"].extend([l for l in lines if RE_AREA.search(l)])

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
    """Converte '371 m²', '80', '60.57', '3.045' em float."""
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
                # Heurística: tabela de rodapés ou descrição contém "rodap" → metro linear
                if is_rodape_table or "rodap" in descricao.lower():
                    unidade = "ml"
                else:
                    unidade = "m2"

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
        m_lbl = RE_H_LABELED.search(line)
        if m_lbl:
            tipo = m_lbl.group(1).lower()[:5]
            height_context[tipo] = float(m_lbl.group(2))
            continue
        if RE_H_ALONE.match(line):
            tipo = RE_H_ALONE.match(line).group(1).lower()[:5]
            if i + 1 < len(lines) and RE_NUMERO.match(lines[i + 1].strip()):
                height_context[tipo] = float(lines[i + 1].strip().replace(",", "."))

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

    for line in lines:
        s = line.strip()
        # Ruído: notas gerais, carimbos, referências de prancha, etc.
        if is_noise_line(s):
            flush()
            buffer = []
            continue
        # Número isolado ou cota de altura — quebra o buffer
        if RE_NUMERO.match(s) or RE_H_ALONE.match(s) or RE_H_LABELED.search(s):
            flush()
            buffer = []
            continue
        # Linha muito curta — ignora
        if len(s) < 5:
            flush()
            buffer = []
            continue

        # Nova descrição começa se: buffer já tem keyword E linha parece novo item
        if buffer and _MATERIAL_KEYWORDS.search(s) and _MATERIAL_KEYWORDS.search(" ".join(buffer)):
            # Heurística: linha nova começa com maiúscula e não é palavra de ligação
            _continuacao = s[0].islower() or s[:3].lower() in ("com", "sem", "de ", "e r", "ou ", "e p")
            if not _continuacao:
                flush()
                buffer = [s]
                continue

        buffer.append(s)

    flush()
    log.debug("  extract_partial: %d itens parciais, height_context=%s", len(items), height_context)
    return items, height_context
