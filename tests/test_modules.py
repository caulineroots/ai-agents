# -*- coding: utf-8 -*-
"""Testes por módulo da pipeline refatorada (loja_config / mapping_rules /
tabela_common / xlsx_mapping / table_dedup) + smoke de integração."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ─── loja_config ─────────────────────────────────────────────────────────────
def test_loja_config_detecta_loja():
    from extractors.loja_config import get_loja_config, _detect_loja
    assert _detect_loja("CEA-254-BLN-ARQ") == "BLN"
    assert _detect_loja("CEA-BLK-ARQ") == "BLK"
    assert _detect_loja(None) == "BLN"
    cfg = get_loja_config("qualquer")
    assert "301" in cfg["cod_priority_prancha"].get("12.1", "")
    assert "13.1" in cfg["use_max_cods"]


def test_loja_config_aliases_compat():
    from extractors.loja_config import SOLEIRA_CODS, USE_MAX_CODS, ADM_PRANCHAS_BLN
    assert "14.8" in SOLEIRA_CODS and "14.19" in SOLEIRA_CODS
    assert "13.1" in USE_MAX_CODS
    assert "305" in ADM_PRANCHAS_BLN


# ─── mapping_rules ───────────────────────────────────────────────────────────
def test_mapping_rules_parse_prancha():
    from extractors.mapping_rules import _parse_prancha_num
    assert _parse_prancha_num("CEA-254-BLN-ARQ_R03-301-CIVIL") == "301"
    assert _parse_prancha_num("CEA-BLK-ARQ_R02-331") == "331"
    assert _parse_prancha_num("") == ""


def test_mapping_rules_match_fixo_drywall():
    from extractors.mapping_rules import _match_fixo
    assert _match_fixo("DRYWALL GESSO ACARTONADO RESISTENTE À UMIDADE")[0] == "12.4"
    assert _match_fixo("ALÇAPÃO 60X60")[0] == "12.11"


def test_mapping_rules_wall_subject_guard():
    from extractors.mapping_rules import _match_fixo
    # parede não vira pintura, mesmo com "acartonado"
    cod, _ = _match_fixo("DRYWALL GESSO ACARTONADO ST/ST 950mm")
    assert cod.startswith("12.")


# ─── tabela_common ───────────────────────────────────────────────────────────
def test_common_normalize_e_junk():
    from extractors.tabela_common import _normalize_tabela_key, _is_junk_orcar_line
    assert _normalize_tabela_key("GLOBAL_SCAN") == "EXCLUDE"
    assert _normalize_tabela_key("CEA - QNT PAREDES") == "PAREDES"
    assert _is_junk_orcar_line("123,45") is True
    assert _is_junk_orcar_line("DRYWALL GESSO ST") is False


def test_common_item_zona():
    from extractors.tabela_common import _item_zona
    assert _item_zona({"prancha_id": "CEA-254-BLN-ARQ_R03-305-CIVIL"}) == "adm"
    assert _item_zona({"prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL"}) == "vendas"
    assert _item_zona({"zona": "adm"}) == "adm"


def test_common_block_priority():
    from extractors.tabela_common import _block_priority_score
    s301 = _block_priority_score("CEA-254-BLN-ARQ_R03-301-CIVIL", "PAREDES")
    s305 = _block_priority_score("CEA-254-BLN-ARQ_R03-305-CIVIL", "PAREDES")
    assert s301 > s305


# ─── xlsx_mapping ────────────────────────────────────────────────────────────
def test_xlsx_aggregate_soleira_aguardando():
    from extractors.xlsx_mapping import _aggregate_mapped_rows
    rows = [{"cod": "14.8", "descricao": "Soleira", "quantidade": 22.62, "unidade": "ml",
             "confianca": 1.0, "fonte_pranchas": ["CEA-254-BLN-ARQ_R03-331-PISO"],
             "tabela": "SOLEIRAS"}]
    agg, _ = _aggregate_mapped_rows(rows, {"14.8": {"qdeReferencia": 11.4}})
    assert agg[0]["status"] == "aguardando"
    assert agg[0]["confianca"] <= 0.5


def test_xlsx_aggregate_max_cod():
    from extractors.xlsx_mapping import _aggregate_mapped_rows
    rows = [
        {"cod": "13.1", "descricao": "FECHAM", "quantidade": 13, "unidade": "m2",
         "confianca": 1.0, "fonte_pranchas": ["CEA-254-BLN-ARQ_R03-301-CIVIL"], "tabela": "PAREDES"},
        {"cod": "13.1", "descricao": "SANIT", "quantidade": 29, "unidade": "m2",
         "confianca": 1.0, "fonte_pranchas": ["CEA-254-BLN-ARQ_R03-301-CIVIL"], "tabela": "PAREDES"},
    ]
    agg, _ = _aggregate_mapped_rows(rows, {"13.1": {"qdeReferencia": 30}})
    assert abs(agg[0]["quantidade"] - 29) < 1


# ─── table_dedup (facade + engine) ───────────────────────────────────────────
def test_table_dedup_facade_reexports():
    import extractors.table_dedup as td
    for name in ("MAPA_FIXO", "_match_fixo", "_parse_prancha_num", "filter_orcar_items",
                 "map_rows_to_xlsx", "_aggregate_mapped_rows", "dedup_by_fingerprint",
                 "_parse_revisao", "_normalize_tabela_key", "_block_priority_score"):
        assert hasattr(td, name), f"facade não reexporta {name}"


def test_table_dedup_cluster_grand_total():
    from extractors.table_dedup import dedup_by_fingerprint
    items = [
        {"tabela": "PAREDES", "descricao": "DRYWALL ST", "quantidade": 100, "grand_total_tabela": 500.0,
         "prancha_id": "CEA-254-BLN-ARQ_R02-301-CIVIL", "revisao_num": 2},
        {"tabela": "PAREDES", "descricao": "DRYWALL ST", "quantidade": 100, "grand_total_tabela": 500.0,
         "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3},
    ]
    out, logs = dedup_by_fingerprint(items)
    assert len(out) == 1  # cópias colapsam para a revisão mais alta
    assert out[0]["revisao_num"] == 3


if __name__ == "__main__":
    tests = [
        test_loja_config_detecta_loja,
        test_loja_config_aliases_compat,
        test_mapping_rules_parse_prancha,
        test_mapping_rules_match_fixo_drywall,
        test_mapping_rules_wall_subject_guard,
        test_common_normalize_e_junk,
        test_common_item_zona,
        test_common_block_priority,
        test_xlsx_aggregate_soleira_aguardando,
        test_xlsx_aggregate_max_cod,
        test_table_dedup_facade_reexports,
        test_table_dedup_cluster_grand_total,
    ]
    fail = 0
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except Exception as e:
            fail += 1
            print(f"FAIL {t.__name__}: {e}")
    if fail:
        raise SystemExit(f"{fail} teste(s) falharam")
    print(f"\n{len(tests)} testes por módulo OK")
