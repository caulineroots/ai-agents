# -*- coding: utf-8 -*-
"""Testes parse haiku_reconcile."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from extractors.haiku_reconcile import parse_reconcile_response, compact_payload


def test_parse_reconcile_response():
    raw = """{
      "duplicatas": [{"tipo": "tabela_repetida", "descricao": "PINTURA dup", "pranchas_envolvidas": ["301","305"], "cods_afetados": ["18.5"]}],
      "cods_revisados": [{"cod": "18.5", "qty_deterministico": 3228, "qty_sugerida": 708, "unidade": "m2", "confianca": 0.9, "motivo": "ADM only", "linhas_manter": ["L001"], "linhas_descartar": ["L002"]}],
      "observacoes": ["ok"]
    }"""
    data = parse_reconcile_response(raw)
    assert len(data["cods_revisados"]) == 1
    assert data["cods_revisados"][0]["cod"] == "18.5"
    assert abs(data["cods_revisados"][0]["qty_sugerida"] - 708) < 0.01


def test_compact_payload():
    p = compact_payload(
        "CEA-254-BLN",
        [{"cod": "18.5", "qdeReferencia": 708, "unidade": "m2"}],
        [{"cod": "18.5", "quantidade": 3228, "unidade": "m2"}],
        [],
        [{"cod": "18.5", "quantidade": 708, "unidade": "m2", "descricao": "GELO", "tabela": "PINTURA", "fonte_pranchas": ["R03-305"]}],
    )
    assert p["obra"] == "CEA-254-BLN"
    assert "L001" in p["linhas_compactas"]


if __name__ == "__main__":
    test_parse_reconcile_response()
    test_compact_payload()
    print("OK haiku_reconcile tests")
