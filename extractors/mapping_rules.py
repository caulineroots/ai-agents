# -*- coding: utf-8 -*-
"""
mapping_rules.py — regras semânticas de mapeamento descrição → código XLSX.

Contém o MAPA_FIXO (regex estáveis entre projetos C&A) e _match_fixo, que aplica
as regras com desambiguação por zona (vendas/ADM) para pintura/forro.
Itens projeto-específicos sem padrão estável ficam para o fallback Haiku.
"""

from __future__ import annotations

import re

from extractors.loja_config import ADM_PRANCHAS_BLN

# ─── MAPA_FIXO: regex semântico → (cod_xlsx, unidade) ────────────────────────
MAPA_FIXO: list[tuple] = [
    # ── QNT PAREDES — drywall gesso (específicos antes do genérico) ───────────
    (r"ALVENARIA.*BLOCO.*CONCRETO",                                    "9.5",  "m2"),
    (r"ALVENARIA.*BLOCO\s+CELULAR",                                    "25.2", "m2"),
    # RU 2 faces
    (r"DRYWALL.*(?:GESSO\s+)?(?:RESIST.*UMIDADE|\bRU\b).*(?:ST[/\s]ST|950\s*MM|950MM|2\s*F)", "12.4", "m2"),
    # RU 1 face
    (r"DRYWALL.*(?:GESSO\s+)?(?:RESIST.*UMIDADE|\bRU\b).*(?:825\s*MM|825MM|1\s*F|\b1F\b)",     "12.3", "m2"),
    (r"DRYWALL.*(?:GESSO\s+)?RESIST.*UMIDADE|DRYWALL.*\bRU\b",        "12.4", "m2"),
    # RF 2 faces / 1 face
    (r"DRYWALL.*RF[/\s]RF|DRYWALL.*RESIST.*FOGO.*2\s*F",              "12.6", "m2"),
    (r"DRYWALL.*RF[^/].*1\s*F|DRYWALL.*RESIST.*FOGO.*1\s*F",          "12.5", "m2"),
    # ST 2 faces com RFID → 12.2; ST/ST sem RFID → 12.2
    (r"DRYWALL.*ST[/\s]ST.*RFID",                                      "12.2", "m2"),
    (r"DRYWALL.*ST[/\s]ST(?!.*RFID)",                                  "12.2", "m2"),
    # ST 1 face com RFID ou 825mm → 12.1
    (r"DRYWALL.*ST.*RFID|DRYWALL.*ST\+RFID",                          "12.1", "m2"),
    (r"DRYWALL.*\bST\b.*825",                                          "12.1", "m2"),
    (r"DRYWALL.*\bST\b(?!.*RFID)(?!.*ST)",                            "12.1", "m2"),
    # ── QNT PAREDES — fechamentos e revestimentos ─────────────────────────────
    (r"CERÂMICA.*20\s*[Xx]\s*20|AZULEJO.*BRILHANTE",                  "15.1", "m2"),
    (r"PAINEL.*MDF.*FÓRMICA.*BRANCO\s+TX|PAINEL.*LAMINADO.*BRANCO\s+TX", "22.3", "m2"),
    (r"PAINEL.*MDF.*FÓRMICA.*ÁRTICO\s+TX|PAINEL.*LAMINADO.*ÁRTICO\s+TX", "22.1", "m2"),
    (r"FECHAM.*COMPARTIM.*DIVILUX|DIVISORIA.*DIVILUX\s*35|DIVISÓRIA.*EUCATEX.*SANIT", "13.1", "m2"),
    (r"DIVISÓRIA.*SANIT|DIVISORIA.*SANIT",                            "13.1", "m2"),
    (r"VIDRO\s+TEMPERADO.*10\s*[Mm][Mm]",                             "19.4", "m2"),
    # ── QNT SOLEIRAS ──────────────────────────────────────────────────────────
    (r"SOLEIRA.*BRANCO\s+CEAR",                                        "14.8",  "ml"),
    (r"SOLEIRA.*CINZA\s+ANDORINHA",                                    "14.19", "ml"),
    # ── QNT RFID — item sintético gerado a partir do grand_total da seção RFID
    (r"^RFID_GRAND_TOTAL$",                                            "25.1", "m2"),
    # ── QNT PISOS ────────────────────────────────────────────────────────────
    (r"ARGAMASSA\s+IMPERMEABILIZ|IMPERMEABILIZ.*SIKATOP|IMPERMEABILIZ.*VIAPLUS", "10.2", "m2"),
    (r"IMPERMEABILIZ.*MANTA\s+ASFÁLTICA|MANTA\s+ASFÁLTICA.*TORODIN",  "10.1", "m2"),
    # P1 (Canela/Rústico) — P12 (Titanium/Stone) → Haiku
    (r"PISO\s+VINÍLICO.*RÚSTICO|PISO\s+VINÍLICO.*CANELA|\bP1\b.*PISO\s+VINÍLICO", "14.1", "m2"),
    (r"CERÂMICO.*45.*45|PISO.*CERÂMICO.*45|\bP3\b.*CERÂMICO",        "14.11", "m2"),
    (r"PISO.*CIMENTADO.*EPÓXI|\bP5\b.*EPÓXI",                         "18.1",  "m2"),
    # ── QNT RODAPÉS — semântico sem dependência de R1/R2/R3 ──────────────────
    (r"RODAPÉ.*MADEIRA.*(?:7|SETE)\s*[Cc][Mm]|MADEIRA.*CURUPIXÁ.*7",  "14.13", "ml"),
    (r"RODAPÉ.*MADEIRA.*(?:20|VINTE)\s*[Cc][Mm]|MADEIRA.*CURUPIXÁ.*20", "14.14", "ml"),
    (r"RODAPÉ.*PRIMER\s+TARKET.*10|PRIMER.*TARKETT.*10\s*[Cc][Mm]",   "14.5",  "ml"),
    (r"RODAPÉ.*LAMINADO.*PRATTAN|LAMINADO.*MELAMÍNICO.*PRATTAN|FORMICA\s+PRATTAN", "22.15", "ml"),
    (r"RODAPÉ.*PRIMER.*50\s*[Xx]\s*240|PRIMER.*CABINES",              "22.14", "ml"),
    (r"RODAPÉ.*AÇO\s+INOX|CHAPA.*INOX.*RODAPÉ",                      "23.9",  "ml"),
    (r"RODAPÉ.*MDP\s+BRANCO|PAINEL.*MDP.*RODAPÉ",                     "25.5",  "ml"),
    (r"RODAPÉ.*GRANITO|GRANITO.*CEARÁ.*RODAPÉ",                       "25.4",  "ml"),
    # ── CEA - QUADRO DE PORTAS ────────────────────────────────────────────────
    (r"PD\s*0?3[24]\b.*(?:CELA|EUCATEX.*CELA)",                       "13.2", "un"),
    (r"PD\s*0?3[34]\b.*(?:ALAVANCA|EUCATEX.*ALAVANCA)",               "13.3", "un"),
    (r"PM\s*0?0[13]\b.*0[,.]72",                                      "20.2", "un"),
    (r"PM\s*0?0[13]\b.*0[,.]82",                                      "20.3", "un"),
    (r"PM\s*0?0[46]\b.*VIDRO|MADEIRA.*C[/\s]*VISOR",                  "20.4", "un"),
    (r"PD\s*0?3[67]\b.*VIDRO.*HIDRANTE|PORTA.*HIDRANTE.*VIDRO",       "21.15", "un"),
    (r"PF\s*0?\d+\b.*CHAPA.*FERRO|PORTA.*CHAPA.*FERRO",               "8.14",  "un"),
    (r"ALÇAPÃO\b",                                                     "12.11", "un"),
    # ── QNT FORROS ───────────────────────────────────────────────────────────
    # Branco neve → 12.9; Lilás/Diário de Menina → Haiku (nomes variam por projeto)
    (r"FORRO.*TABICADO.*BRANCO\s+NEVE|FORRO.*GYPSUM.*BRANCO\s+NEVE",  "12.9", "m2"),
    # Pintura parede — branco neve (sem split zona)
    (r"PINTURA.*BRANCO\s+NEVE|LÁTEX.*BRANCO\s+NEVE|LATEX.*BRANCO\s+NEVE", "18.4", "m2"),
    (r"DI[ÁA]RIO\s+DE\s+MENINA",                                       "18.8", "m2"),
    # ── QNT TAPUMES ──────────────────────────────────────────────────────────
    (r"TAPUME.*COMPENSADO|TAPUME.*PONTALETES",                         "2.1",  "m2"),
]

# Pré-compila todos os padrões para performance
_COMPILED_MAP: list[tuple] = [
    (re.compile(pat, re.IGNORECASE | re.UNICODE), cod, un)
    for pat, cod, un in MAPA_FIXO
]


def _parse_prancha_num(stem: str) -> str:
    """Extrai número da prancha do stem (espelha prancha-router.ts)."""
    if not stem:
        return ""
    m = re.search(r"_R\d+-(\d{3})(?:-|$| )", stem, re.IGNORECASE)
    if m:
        return m.group(1)
    all_m = list(re.finditer(r"-(\d{3})(?=-|$| )", stem))
    if all_m:
        return all_m[-1].group(1)
    m = re.match(r"^(\d{3})[-_ ]", stem)
    if m:
        return m.group(1)
    m = re.search(r"(?<!\d)(\d{3})(?!\d)", stem)
    return m.group(1) if m else ""


def _match_fixo(descricao: str, item: dict | None = None) -> tuple[str, str] | None:
    """Tenta match em MAPA_FIXO, retorna (cod, unidade) ou None."""
    d = descricao.upper()
    zona = (item or {}).get("zona")
    prancha = _parse_prancha_num((item or {}).get("prancha_id") or "")
    if not zona and prancha:
        zona = "adm" if prancha in ADM_PRANCHAS_BLN else "vendas"

    # Guard: linhas cujo SUJEITO é a parede (drywall/alvenaria) NÃO são pintura,
    # mesmo contendo "GESSO ACARTONADO". Ex.: "DRYWALL GESSO ACARTONADO RESIST.
    # UMIDADE" é o código 12.4 (RU 2 faces), não 18.10 (pintura de forro).
    is_wall_subject = re.match(r"\s*(DRYWALL|PAREDE|ALVENARIA|DIVIS[ÓO]RIA)\b", d)

    if not is_wall_subject:
        # ACARTONADO / forro antes de BRANCO GELO (evita classificar semi-brilho acartonado como 18.3)
        if re.search(
            r"ACARTONADO|GESSO\s+ACARTONADO|SEMI.?BRILHO.*GESSO|FORRO.*BRANCO\s+NEVE|PINTURA.*FORRO",
            d,
        ):
            cod = "18.11" if zona == "adm" else "18.10"
            return cod, "m2"
        if re.search(
            r"BRANCO\s+GELO|EMassamento.*GELO|PINTURA.*GELO|ACRÍLICA.*GELO|ACRILICA.*GELO",
            d,
        ):
            cod = "18.5" if zona == "adm" else "18.3"
            return cod, "m2"

    for pattern, cod, un in _COMPILED_MAP:
        if pattern.search(d):
            return cod, un
    return None
