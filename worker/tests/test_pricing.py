# -*- coding: utf-8 -*-
"""Testes de precificação (M5) — contra precos.json real."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extractors.pricing import PriceTable, price_item


def test_match_exact():
    t = PriceTable()
    m = t.match("ART contemplando todos os serviços + placa de obra", "outro")
    assert m and m["match"] == "exact" and m["vlr"] == 1100


def test_match_keyword():
    t = PriceTable()
    m = t.match("Topografia (5 visitas)", "outro")
    assert m and m["match"] in ("exact", "keyword")
    assert m["vlr"] == 2420


def test_match_none_para_gibberish():
    t = PriceTable()
    assert t.match("zxqw inexistente componente alienígena", "") is None


def test_price_item_total():
    t = PriceTable()
    item = {"descricao": "ART contemplando todos os serviços + placa de obra",
            "categoria": "outro", "class_flags": []}
    p = price_item(item, quantidade=1, table=t)
    assert p and p["total"] == 1100.0
    assert p["mat"] is None and p["mobra"] is None      # v1: combinado em total


def test_price_item_qty_multiplica():
    t = PriceTable()
    item = {"descricao": "Topografia", "categoria": "outro", "class_flags": []}
    p = price_item(item, quantidade=2, table=t)
    assert p["total"] == 4840.0


def test_material_cliente_flag():
    t = PriceTable()
    item = {"descricao": "ART contemplando todos os serviços + placa de obra",
            "categoria": "outro", "class_flags": ["MATERIAL_CLIENTE"]}
    p = price_item(item, quantidade=1, table=t)
    assert "PRECO_INCLUI_MATERIAL_CLIENTE" in p["flags"]
