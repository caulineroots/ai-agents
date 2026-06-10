# -*- coding: utf-8 -*-
"""Testes do classificador (M2) — determinístico, sem IA."""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extractors.classifier import (
    normalize_unit, classify_one, classify_items, build_project_map,
)
from extractors.planilha_parser import parse_planilha

FIXTURE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "celmar-files", "Projetos inicial", "254_BLN_Planilha Civil.xlsx",
)
requires_fixture = pytest.mark.skipif(
    not os.path.exists(FIXTURE), reason="fixture ausente (celmar-files gitignored)")


def test_normalize_unit():
    assert normalize_unit("m²") == "m2"
    assert normalize_unit("M2") == "m2"
    assert normalize_unit("unid") == "un"
    assert normalize_unit("und") == "un"
    assert normalize_unit("pç") == "un"
    assert normalize_unit("vb.") == "vb"
    assert normalize_unit("mês") == "mes"
    assert normalize_unit("ml") == "ml"
    assert normalize_unit("m") == "m"
    assert normalize_unit("") == ""


def test_strategy_mapping():
    assert classify_one({"descricao": "Piso vinílico", "unidade_raw": "m²"})["estrategia"] == "AREA"
    assert classify_one({"descricao": "Rodapé", "unidade_raw": "ml"})["estrategia"] == "LINEAR"
    assert classify_one({"descricao": "Guarda corpo", "unidade_raw": "m"})["estrategia"] == "LINEAR"
    assert classify_one({"descricao": "Porta de ferro", "unidade_raw": "unid"})["estrategia"] == "COUNT"
    assert classify_one({"descricao": "Concreto", "unidade_raw": "m3"})["estrategia"] == "VOLUME"
    assert classify_one({"descricao": "ART", "unidade_raw": "vb."})["estrategia"] == "LUMP_SUM"
    assert classify_one({"descricao": "Vigilância", "unidade_raw": "dia"})["estrategia"] == "TIME"


def test_needs_drawing_flag():
    assert classify_one({"descricao": "Piso", "unidade_raw": "m²"})["needs_drawing"] is True
    assert classify_one({"descricao": "ART", "unidade_raw": "vb."})["needs_drawing"] is False
    assert classify_one({"descricao": "Vigilância", "unidade_raw": "dia"})["needs_drawing"] is False


def test_fornecimento_terceiro_detection():
    it = classify_one({"descricao": "Mezanino metálico - contratação direta C&A", "unidade_raw": ""})
    assert "FORNEC_TERCEIRO" in it["class_flags"]
    assert it["needs_drawing"] is False
    assert it["estrategia"] == "LUMP_SUM"
    # mesmo com unidade geométrica, fornecimento por terceiro não exige medição
    it2 = classify_one({"descricao": "Estante metálica fornecido pela C&A", "unidade_raw": "pç"})
    assert it2["needs_drawing"] is False
    assert "FORNEC_TERCEIRO" in it2["class_flags"]


def test_nota_detection():
    it = classify_one({"descricao": "Obs.: Demais louças serão fornecidas pela Instaladora", "unidade_raw": ""})
    assert it["estrategia"] == "NOTA"
    assert it["needs_drawing"] is False


@requires_fixture
def test_classifica_planilha_real():
    itens = parse_planilha(FIXTURE)["itens"]
    res = classify_items(itens)
    r = res["resumo"]
    assert r["n_total"] == 227
    # todo item priceável recebe uma estratégia
    assert all(it["estrategia"] for it in res["itens"])
    # lump-sum/time/nota não precisam de desenho
    for it in res["itens"]:
        if it["estrategia"] in ("LUMP_SUM", "TIME", "NOTA"):
            assert it["needs_drawing"] is False
        if it["estrategia"] in ("AREA", "LINEAR", "COUNT", "VOLUME") and not it["class_flags"]:
            assert it["needs_drawing"] is True
    # deve haver itens de cada estratégia geométrica principal
    assert r["por_estrategia"].get("AREA", 0) >= 50      # ~66 m² items
    assert r["por_estrategia"].get("COUNT", 0) >= 70     # ~86 unid items


@requires_fixture
def test_candidatos_com_project_map():
    itens = parse_planilha(FIXTURE)["itens"]
    # pranchas de exemplo (nomes reais do projeto)
    stems = [
        "CEA-254-BLN-ARQ_R03-331-ARQ PISO",
        "CEA-254-BLN-ARQ_R03-321-ARQ FORRO",
        "CEA-254-BLN-ARQ_R02-305 - ARQ SANITARIOS",
        "CEA-254-BLN-ARQ_R03-201-INT ILUMINAÇÃO SEM MOB",
    ]
    pmap = build_project_map(stems)
    res = classify_items(itens, project_map=pmap)
    # algum item de piso deve apontar para a prancha de PISO
    piso_items = [it for it in res["itens"]
                  if "piso" in it["descricao"].lower() and it["needs_drawing"]]
    assert piso_items, "esperava itens de piso priceáveis"
    assert any("PISO" in c for it in piso_items for c in it["candidatos"])
