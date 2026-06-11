# -*- coding: utf-8 -*-
"""Testes da camada stated do Medidor (M3) — determinístico, sem IA.

Usa o pool de evidências real (PDFs do 254_BLN). Pulado se as fixtures (gitignored)
não estiverem presentes.
"""

import os
import sys
import glob
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extractors.evidence import build_evidence_pool
from extractors.medidor import find_table_value, read_area_tags, medir_stated

PDF_GLOB = "celmar-files/Projetos inicial/PDF/*.pdf"
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# subconjunto suficiente para as asserções (extrair os 38 PDFs é lento, ~100s)
_WANT = ("331", "321", "301", "305")     # PISO, FORRO, CIVIL, SANITARIOS
_pdfs = [p for p in glob.glob(os.path.join(_root, PDF_GLOB))
         if any(w in os.path.basename(p) for w in _WANT)]

requires_fixtures = pytest.mark.skipif(
    not _pdfs, reason="PDFs de fixture ausentes (celmar-files gitignored)")


@pytest.fixture(scope="module")
def pool():
    sheets = [{"stem": os.path.splitext(os.path.basename(p))[0], "pdf": p} for p in _pdfs]
    return build_evidence_pool(sheets)


@pytest.fixture(scope="module")
def stems(pool):
    return list(pool.keys())


@requires_fixtures
def test_pool_tem_itens_stated(pool):
    total = sum(len(ev["stated_items"]) for ev in pool.values())
    assert total > 50          # o projeto tem ~50 tabelas CEA-QNT
    # cada item stated carrega quantidade e unidade
    piso = next(ev for s, ev in pool.items() if "331" in s)
    assert piso["stated_items"]
    assert all("quantidade" in it for it in piso["stated_items"])


@requires_fixtures
def test_read_area_tags_parse_numerico(pool, stems):
    piso = next(s for s in stems if "331" in s)
    vals = read_area_tags(piso, pool)
    assert vals and all(isinstance(v, float) and v > 0 for v in vals)


@requires_fixtures
def test_find_table_value_piso_vinilico(pool, stems):
    cand = [s for s in stems if "331" in s]      # ARQ PISO
    fv = find_table_value(
        "Assentamento de piso vinílico salão de vendas/provadores", "m2", pool, cand)
    assert fv is not None
    assert 900 <= fv["valor"] <= 920             # PISO VINÍLICO TARKETT ~914.55 m²
    assert fv["unidade"] == "m2"
    assert fv["metodo"] == "stated"
    assert "331" in fv["fonte"] or "PISO" in fv["fonte"]


@requires_fixtures
def test_find_table_value_sem_match_retorna_none(pool):
    # descrição sem correspondência tabelada + unidade improvável
    assert find_table_value("xyzqwerty inexistente componente", "m2", pool) is None


@requires_fixtures
def test_unidade_incompativel_nao_casa(pool, stems):
    # pedir COUNT (un) para um material claramente de área não deve casar a área
    fv = find_table_value("piso vinílico", "un", pool, [s for s in stems if "331" in s])
    # ou não casa, ou (se casar algum 'un') não é a área do vinílico
    assert fv is None or fv["unidade"] != "m2"


def test_medir_stated_pula_lump_sum(pool=None):
    item = {"descricao": "ART", "unidade": "vb", "estrategia": "LUMP_SUM",
            "needs_drawing": False}
    assert medir_stated(item, {}) is None


def test_medir_stated_pula_sem_needs_drawing():
    item = {"descricao": "x", "unidade": "m2", "estrategia": "AREA",
            "needs_drawing": False}
    assert medir_stated(item, {}) is None
