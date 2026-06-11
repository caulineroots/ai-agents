# -*- coding: utf-8 -*-
"""
Testes do parser da planilha orçamentária inicial (M1).
Verifica contra a planilha real do projeto 254_BLN.

Rodar:  .venv/bin/python3 -m pytest tests/test_planilha_parser.py -v
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extractors.planilha_parser import parse_planilha

FIXTURE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "celmar-files", "Projetos inicial", "254_BLN_Planilha Civil.xlsx",
)

requires_fixture = pytest.mark.skipif(
    not os.path.exists(FIXTURE),
    reason="fixture 254_BLN_Planilha Civil.xlsx ausente (celmar-files é gitignored)",
)


@pytest.fixture(scope="module")
def res():
    return parse_planilha(FIXTURE)


@requires_fixture
def test_ok_e_aba_detectada(res):
    assert res["ok"] is True
    assert res["sheet"] == "Planilha2"
    assert res["erros"] == []


@requires_fixture
def test_cabecalho_detectado_por_conteudo(res):
    # cabeçalho de detalhe dividido em duas linhas; banda termina na linha 31 (1-based)
    assert res["header_row"] == 31
    cm = res["col_map"]
    assert cm["item"] == 2 and cm["descricao"] == 3
    assert cm["unidade"] == 4 and cm["qde"] == 5
    assert cm["mat"] == 6 and cm["mobra"] == 7


@requires_fixture
def test_contagem_de_itens(res):
    # 227 itens reais (com descrição); 112 já trazem medida, 115 não.
    # 6 linhas-folha numeradas porém vazias (reservas "25 OMISSOS" + 14.5) são ignoradas.
    assert res["n_itens"] == 227
    assert res["n_com_medida"] == 112
    assert res["n_sem_medida"] == 115
    assert res["n_linhas_vazias"] == 6
    assert res["n_com_medida"] + res["n_sem_medida"] == res["n_itens"]


@requires_fixture
def test_invariantes_por_item(res):
    for it in res["itens"]:
        assert it["item"] and "." in it["item"]      # numeração x.y
        assert it["descricao"].strip()               # nunca vazia
        assert it["row_ref"] > 31                     # abaixo do cabeçalho
        assert it["qde_inicial"] is None or isinstance(it["qde_inicial"], float)


@requires_fixture
def test_row_refs_unicos_e_ordenados(res):
    refs = [it["row_ref"] for it in res["itens"]]
    assert refs == sorted(refs)
    assert len(refs) == len(set(refs))               # 1 item por linha


@requires_fixture
def test_amostra_primeiro_item(res):
    first = res["itens"][0]
    assert first["item"] == "1.1"
    assert first["cc"] == "810080"
    assert first["unidade_raw"] == "vb."
    assert first["qde_inicial"] == 1.0
    assert first["row_ref"] == 34
