# -*- coding: utf-8 -*-
"""
planilha_parser.py — lê a planilha orçamentária inicial (.xlsx) do cliente e
produz a lista de itens de linha (LineItem) que define o ESCOPO do orçamento.

Abordagem scope-driven (ver docs/arquitetura/02-ingestao.md):
o cabeçalho de detalhe é DETECTADO por conteúdo — nunca por posição fixa — porque
o layout varia por projeto. O cabeçalho costuma estar dividido em duas linhas
(ex.: "C.C. | ITEM | DESCRIÇÃO" em uma, "UN | QDE | MAT | M.OBRA | TOTAL" na
seguinte) e há uma tabela-resumo decoy acima dele; exigir as colunas UN + QDE +
(MAT|M.OBRA) na banda de cabeçalho desambigua.

Uso programático:
    from extractors.planilha_parser import parse_planilha
    res = parse_planilha("caminho/Planilha.xlsx")  # -> dict (PlanilhaParseResult-shaped)
"""

import re
import logging
import unicodedata

log = logging.getLogger("extractor")

# Item-folha: numeração com ao menos um ponto (1.1, 2.3, 8.5, 8.5.1).
# Cabeçalhos de seção são número único ("1", "2") ou letra ("A") — não casam.
_RE_LEAF = re.compile(r"^\s*\d+(?:\.\d+)+\s*$")

# Janela (em linhas) na qual o cabeçalho dividido pode se espalhar.
_HEADER_BAND = 3


def _norm(s: object) -> str:
    """Normaliza rótulo de cabeçalho: minúsculas, sem acento, sem pontuação/espaços."""
    if s is None:
        return ""
    txt = unicodedata.normalize("NFKD", str(s))
    txt = "".join(c for c in txt if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", txt.lower())


def _role_of(label: str) -> str | None:
    """Mapeia um rótulo de cabeçalho normalizado para um papel de coluna."""
    if not label:
        return None
    # ordem importa: "mobra" contém "obra"; "total" antes de "mat" não conflita
    if label == "item":
        return "item"
    if label.startswith("descric"):
        return "descricao"
    if label in ("un", "und", "unid", "unidade"):
        return "unidade"
    if label.startswith(("qde", "qtd", "quant")):
        return "qde"
    if "obra" in label:                       # "mobra", "maodeobra"
        return "mobra"
    if label.startswith("mat"):               # "mat", "material"
        return "mat"
    if label == "total":
        return "total"
    if label in ("cc", "ccusto") or label.startswith("centrodecusto"):
        return "cc"
    return None


def _detect_header(rows: list[list]) -> tuple[int, dict[str, int]] | None:
    """Procura a banda de cabeçalho de DETALHE. Retorna (header_row_idx, col_map)
    com índices 0-based, ou None. header_row_idx é a linha mais baixa da banda
    (os dados começam em header_row_idx + 1)."""
    n = len(rows)
    for start in range(n):
        col_map: dict[str, int] = {}
        last_label_row = start
        for r in range(start, min(start + _HEADER_BAND, n)):
            for c, cell in enumerate(rows[r]):
                role = _role_of(_norm(cell))
                if role and role not in col_map:   # primeira ocorrência vence
                    col_map[role] = c
                    last_label_row = max(last_label_row, r)
        # Cabeçalho de detalhe exige quantidade + unidade + descrição/item + preço.
        # Isso descarta a tabela-resumo (que tem DESCRIÇÃO/ITEM/CÓDIGO mas não UN/QDE/MAT).
        has_core = {"item", "descricao", "unidade", "qde"} <= col_map.keys()
        has_price = bool({"mat", "mobra", "total"} & col_map.keys())
        if has_core and has_price:
            return last_label_row, col_map
    return None


def _to_float(v: object) -> float | None:
    """Converte célula de quantidade para float; '', None, texto -> None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    # aceita "1.234,56" (pt-BR) e "1234.56"
    s = s.replace(".", "").replace(",", ".") if re.search(r",\d", s) else s
    try:
        return float(re.sub(r"[^\d.\-]", "", s) or "")
    except ValueError:
        return None


def _cell(row: list, idx: int | None) -> object:
    if idx is None or idx >= len(row):
        return None
    return row[idx]


def parse_planilha(path: str) -> dict:
    """Lê o .xlsx e retorna um dict no formato de PlanilhaParseResult.

    Varre todas as abas, escolhe a primeira com um cabeçalho de detalhe
    detectável, e extrai os itens-folha (numeração x.y) abaixo dele.
    """
    res: dict = {
        "ok": False, "sheet": "", "header_row": 0, "col_map": {},
        "n_itens": 0, "n_com_medida": 0, "n_sem_medida": 0,
        "n_linhas_vazias": 0,   # linhas-folha (numeradas) sem descrição — reservas "OMISSOS", ignoradas
        "itens": [], "erros": [],
    }
    try:
        import openpyxl
    except ImportError:
        res["erros"].append("openpyxl não instalado (pip install openpyxl)")
        return res

    try:
        wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    except Exception as e:
        res["erros"].append(f"Falha ao abrir xlsx: {e}")
        return res

    for ws in wb.worksheets:
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        detected = _detect_header(rows)
        if not detected:
            continue

        header_idx, col_map = detected
        res["ok"] = True
        res["sheet"] = ws.title
        res["header_row"] = header_idx + 1          # 1-based para o usuário
        res["col_map"] = col_map

        itens: list[dict] = []
        n_vazias = 0
        for r in range(header_idx + 1, len(rows)):
            row = rows[r]
            item_val = _cell(row, col_map.get("item"))
            item_str = "" if item_val is None else str(item_val).strip()
            if not _RE_LEAF.match(item_str):
                continue                             # pula seções, totais, vazios

            desc = _cell(row, col_map.get("descricao"))
            desc_str = "" if desc is None else str(desc).strip()
            if not desc_str:
                # Linha-folha numerada porém sem descrição: reservas "OMISSOS" e
                # placeholders. Não são escopo priceável — contadas, não incluídas.
                n_vazias += 1
                continue

            qde = _to_float(_cell(row, col_map.get("qde")))
            un = _cell(row, col_map.get("unidade"))
            cc = _cell(row, col_map.get("cc"))

            itens.append({
                "item": item_str.replace(",", "."),  # normaliza "1,1" -> "1.1" se ocorrer
                "cc": "" if cc is None else str(cc).strip(),
                "descricao": desc_str,
                "unidade_raw": "" if un is None else str(un).strip(),
                "qde_inicial": qde,
                "row_ref": r + 1,                    # 1-based: linha real no .xlsx
            })

        res["itens"] = itens
        res["n_itens"] = len(itens)
        res["n_com_medida"] = sum(1 for it in itens if (it["qde_inicial"] or 0) > 0)
        res["n_sem_medida"] = res["n_itens"] - res["n_com_medida"]
        res["n_linhas_vazias"] = n_vazias
        wb.close()
        log.info("[planilha] aba=%s header_row=%d itens=%d (com_medida=%d, sem_medida=%d, vazias_ignoradas=%d)",
                 res["sheet"], res["header_row"], res["n_itens"],
                 res["n_com_medida"], res["n_sem_medida"], n_vazias)
        return res

    wb.close()
    res["erros"].append("Nenhum cabeçalho de detalhe (ITEM/DESCRIÇÃO/UN/QDE/MAT) encontrado")
    return res
