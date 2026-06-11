# -*- coding: utf-8 -*-
"""Testes do resolver LLM da camada stated (M3) — apenas a lógica de guarda.

A resolução via LLM em si é validada manualmente/no pipeline (custa chamadas de
API); aqui cobrimos os retornos antecipados que não dependem de IA.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extractors.medidor_agent import resolver_item_stated_llm


def test_resolver_pula_lump_sum():
    item = {"needs_drawing": False, "estrategia": "LUMP_SUM", "descricao": "ART"}
    assert resolver_item_stated_llm(item, {}, api_key="x") is None


def test_resolver_pula_estrategia_nao_geometrica():
    item = {"needs_drawing": True, "estrategia": "NOTA", "descricao": "Obs."}
    assert resolver_item_stated_llm(item, {}, api_key="x") is None


def test_resolver_retorna_none_sem_linhas():
    # needs_drawing/AREA mas pool vazio -> sem linhas tabeladas -> None (sem chamar API)
    item = {"needs_drawing": True, "estrategia": "AREA", "descricao": "Piso", "unidade": "m2"}
    assert resolver_item_stated_llm(item, {}, api_key="x") is None
