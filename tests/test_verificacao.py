# -*- coding: utf-8 -*-
"""Testes da verificação Fase 3 (M5) — lógica pura, sem IA."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extractors.pipeline import verificar


def _item(**kw):
    base = {"needs_drawing": True, "estrategia": "AREA", "qde_inicial": None,
            "class_flags": []}
    base.update(kw)
    return base


def test_lump_sum_nao_mede():
    v = verificar(_item(needs_drawing=False, estrategia="LUMP_SUM"), None)
    assert v["status"] == "lump_sum" and v["medida"] is None


def test_sem_medida_com_qde_confia_planilha():
    v = verificar(_item(qde_inicial=99.0), None)
    assert v["status"] == "confirmado"
    assert "NAO_VERIFICADO" in v["flags"] and v["qde_final"] == 99.0


def test_sem_medida_sem_qde_vira_manual():
    v = verificar(_item(qde_inicial=None), None)
    assert v["status"] == "manual" and "NOT_FOUND" in v["flags"]


def test_medida_concorda_confirma():
    medida = {"valor": 100.0, "metodo": "stated", "confianca": 90}
    v = verificar(_item(qde_inicial=102.0), medida)   # delta 2% < 5%
    assert v["status"] == "confirmado" and v["qde_final"] == 102.0


def test_medida_diverge_sinaliza_mantendo_planilha():
    medida = {"valor": 150.0, "metodo": "stated", "confianca": 90}
    v = verificar(_item(qde_inicial=100.0), medida)   # delta 50%
    assert v["status"] == "divergente"
    assert "QTY_MISMATCH" in v["flags"]
    assert v["qde_final"] == 100.0                    # política: planilha vence
    assert v["delta"] == 0.5


def test_medida_preenche_quando_planilha_vazia():
    medida = {"valor": 612.4, "metodo": "computed", "confianca": 88}
    v = verificar(_item(qde_inicial=None), medida)
    assert v["status"] == "encontrado" and v["qde_final"] == 612.4


def test_baixa_confianca_e_estimativa_sinalizadas():
    medida = {"valor": 50.0, "metodo": "estimated", "confianca": 30}
    v = verificar(_item(qde_inicial=None), medida)
    assert "ESTIMATED" in v["flags"] and "LOW_CONFIDENCE" in v["flags"]
