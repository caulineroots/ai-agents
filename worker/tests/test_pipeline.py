# -*- coding: utf-8 -*-
"""Teste end-to-end do pipeline (M5) — modo determinístico (sem IA).

Roda planilha -> classificação -> medição stated -> verificação -> preço ->
write-back, contra as fixtures reais do 254_BLN.
"""

import os
import sys
import glob
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extractors.pipeline import processar
from extractors.planilha_parser import parse_planilha
from extractors.writeback import escrever_planilha, relatorio_auditoria, lista_revisao

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_XLSX = os.path.join(_root, "celmar-files", "Projetos inicial", "254_BLN_Planilha Civil.xlsx")
_PDFS = glob.glob(os.path.join(_root, "celmar-files", "Projetos inicial", "PDF", "*.pdf"))

requires_fixtures = pytest.mark.skipif(
    not (os.path.exists(_XLSX) and _PDFS), reason="fixtures ausentes (gitignored)")


@pytest.fixture(scope="module")
def sheets():
    # subconjunto (extrair os 38 PDFs é lento); cobre piso/forro/civil/sanitários/tapume
    want = ("331", "321", "301", "305", "302")
    return [{"stem": os.path.splitext(os.path.basename(p))[0], "pdf": p}
            for p in _PDFS if any(w in os.path.basename(p) for w in want)]


@pytest.fixture(scope="module")
def resultado(sheets):
    return processar(_XLSX, sheets, use_llm=False)


@requires_fixtures
def test_pipeline_roda_e_classifica_tudo(resultado):
    assert resultado["ok"]
    assert len(resultado["itens"]) == 227
    # todo item tem status e a maioria foi precificada
    assert all(it["status"] for it in resultado["itens"])
    r = resultado["resumo"]
    assert r["total_orcado"] > 0
    assert set(r["por_status"]) <= {"confirmado", "divergente", "encontrado",
                                    "manual", "lump_sum", "nota"}


@requires_fixtures
def test_lump_sum_precificado_sem_medir(resultado):
    art = next(it for it in resultado["itens"] if it["item"] == "1.1")
    assert art["status"] == "lump_sum"
    assert art["medida"] is None
    assert art["preco"] and art["preco"]["total"] == 1100.0


@requires_fixtures
def test_writeback_preenche_copia(resultado, tmp_path):
    parsed = parse_planilha(_XLSX)
    out = str(tmp_path / "preenchida.xlsx")
    r = escrever_planilha(_XLSX, resultado["itens"], out, parsed["col_map"])
    assert os.path.exists(out)
    assert r["n_total_preenchidos"] > 0
    # recarrega e confere que algum TOTAL foi gravado
    import openpyxl
    wb = openpyxl.load_workbook(out)
    ws = wb.active
    col_tot = parsed["col_map"]["total"] + 1
    art_row = next(it["row_ref"] for it in resultado["itens"] if it["item"] == "1.1")
    assert ws.cell(row=art_row, column=col_tot).value == 1100.0


@requires_fixtures
def test_relatorio_e_worklist(resultado):
    rel = relatorio_auditoria(resultado["itens"])
    assert len(rel) == 227
    assert all("status" in r and "flags" in r for r in rel)
    work = lista_revisao(resultado["itens"])
    # a work-list é um subconjunto (só exceções)
    assert 0 < len(work) <= len(rel)
