# -*- coding: utf-8 -*-
"""Testes de regressão BLN — parsers e mapeamento."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from extractors.pdf_extractor import parse_cea_qnt_from_text, parse_section_recovery
from extractors.table_dedup import (
    _match_fixo, dedup_by_fingerprint, _parse_prancha_num, _block_priority_score,
    filter_orcar_items, map_rows_to_xlsx, _aggregate_mapped_rows, _normalize_tabela_key,
)
from extractors.derived_quantities import apply_derived_quantities


def _pdf_soleiras_fixture() -> dict:
    return {
        "ok": True,
        "text_lines": [
            "CEA -QNT SOLEIRAS",
            "SOLEIRA EM GRANITO BRANCO CEARÁ 0.42x6.66 ENTRADA",
            "SOLEIRA EM GRANITO BRANCO CEARÁ 0.61x7.38 ENTRADA",
            "SOLEIRA EM GRANITO CINZA ANDORINHA 0.14x0.79 DML",
            "SOLEIRA EM GRANITO CINZA ANDORINHA 0.14x1.12 DML",
            "Grand total",
        ],
        "raw_text_lines": [],
        "prancha_num": "331",
    }


def test_soleiras_ml_sum():
    items = parse_cea_qnt_from_text(_pdf_soleiras_fixture())
    soleiras = [it for it in items if it.get("tabela") == "SOLEIRAS"]
    assert len(soleiras) == 2
    by_desc = {it["descricao"]: it for it in soleiras}
    cinza = by_desc.get("SOLEIRA EM GRANITO CINZA ANDORINHA")
    assert cinza is not None
    assert cinza["unidade"] == "ml"
    assert abs(cinza["quantidade"] - 1.91) < 0.01
    branco = by_desc.get("SOLEIRA EM GRANITO BRANCO CEARÁ")
    assert branco is not None
    assert branco["unidade"] == "ml"
    assert abs(branco["quantidade"] - 14.04) < 0.01


def test_soleira_mapa_fixo():
    m = _match_fixo("SOLEIRA EM GRANITO CINZA ANDORINHA")
    assert m == ("14.19", "ml")
    m2 = _match_fixo("SOLEIRA EM GRANITO BRANCO CEARÁ")
    assert m2 == ("14.8", "ml")


def test_drywall_mapa_fixo_ru_split():
    m1 = _match_fixo("DRYWALL GESSO RESISTENTE A UMIDADE ST - 825mm")
    assert m1 == ("12.3", "m2")
    m2 = _match_fixo("DRYWALL GESSO RESISTENTE A UMIDADE ST/ST - 950mm")
    assert m2 == ("12.4", "m2")
    m3 = _match_fixo("DRYWALL GESSO ST/ST - 950mm")
    assert m3 == ("12.2", "m2")
    m4 = _match_fixo("DRYWALL GESSO ST - 825mm")
    assert m4 == ("12.1", "m2")


def test_drywall_acartonado_nao_vira_pintura():
    """'DRYWALL ... ACARTONADO RESISTENTE À UMIDADE' é parede (12.4), não pintura (18.10)."""
    item_vendas = {"zona": "vendas", "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL"}
    assert _match_fixo("DRYWALL GESSO ACARTONADO RESISTENTE À UMIDADE", item_vendas) == ("12.4", "m2")
    # pintura sobre gesso acartonado continua sendo 18.10
    assert _match_fixo(
        "PINTURA ACRÍLICA SEMI-BRILHO, COR BRANCO GELO, EM GESSO ACARTONADO", item_vendas
    ) == ("18.10", "m2")


def test_drywall_st_faces_aggregam():
    """Faces ST 1f (825) somam em 12.1; ST/ST 2f (950) somam em 12.2."""
    qty = {
        "DRYWALL GESSO ST - 825mm": 385,
        "DRYWALL GESSO ST + RFID - 825mm": 55,
        "DRYWALL GESSO ST/ST - 950mm": 79,
        "DRYWALL GESSO ST/ST+RFID - 950mm": 103,
    }
    items = [
        {"tabela": "PAREDES", "descricao": d, "quantidade": q, "unidade": "m2",
         "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3, "grand_total_tabela": 500.0}
        for d, q in qty.items()
    ]
    cl = [{"cod": c, "descricao": c, "unidade": "m2", "qdeReferencia": r}
          for c, r in [("12.1", 672), ("12.2", 274)]]
    mapped, _, _, _ = map_rows_to_xlsx(items, cl, "")
    by_cod = {m["cod"]: m["quantidade"] for m in mapped}
    assert abs(by_cod.get("12.1", 0) - 440) < 1
    assert abs(by_cod.get("12.2", 0) - 182) < 1


def test_pintura_zona_split():
    item_vendas = {"zona": "vendas", "prancha_id": "CEA-254-BLN-ARQ_R03-301-ARQ CIVIL"}
    item_adm = {"zona": "adm", "prancha_id": "CEA-254-BLN-ARQ_R03-305-ARQ SANITARIOS"}
    m_v = _match_fixo("PINTURA ACRÍLICA BRANCO GELO", item_vendas)
    m_a = _match_fixo("PINTURA ACRÍLICA BRANCO GELO", item_adm)
    assert m_v == ("18.3", "m2")
    assert m_a == ("18.5", "m2")
    f_v = _match_fixo("ACARTONADO 663 m²", item_vendas)
    f_a = _match_fixo("ACARTONADO 663 m²", item_adm)
    assert f_v == ("18.10", "m2")
    assert f_a == ("18.11", "m2")
    semi = _match_fixo(
        "PINTURA ACRÍLICA SEMI-BRILHO, COR BRANCO GELO FABRIC. SUVINIL, EM GESSO ACARTONADO",
        item_vendas,
    )
    assert semi == ("18.10", "m2")


def test_dedup_prancha_priority():
    items = [
        {"tabela": "QNT_PAREDES", "descricao": "DRYWALL ST", "quantidade": 100,
         "prancha_id": "CEA-254-BLN-ARQ_R03-305-SAN", "revisao_num": 3,
         "grand_total_tabela": 500.0},
        {"tabela": "QNT_PAREDES", "descricao": "DRYWALL ST", "quantidade": 100,
         "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3,
         "grand_total_tabela": 500.0},
    ]
    deduped, log = dedup_by_fingerprint(items)
    assert len(deduped) == 1
    assert "301" in deduped[0]["prancha_id"]
    assert len(log) == 1


def test_parse_prancha_num():
    assert _parse_prancha_num("CEA-254-BLN-ARQ_R03-331-ARQ PISO") == "331"
    assert _parse_prancha_num("CEA-254-BLN-ARQ_R03-301-ARQ CIVIL") == "301"


def test_block_priority_301_over_305():
    assert _block_priority_score("CEA-254-BLN-ARQ_R03-301-X", "QNT_PAREDES") > \
           _block_priority_score("CEA-254-BLN-ARQ_R03-305-X", "QNT_PAREDES")


def test_derived_quantities():
    mapped = [
        {"cod": "9.5", "quantidade": 204, "unidade": "m2"},
        {"cod": "25.2", "quantidade": 10, "unidade": "m2"},
        {"cod": "14.1", "quantidade": 1019.77, "unidade": "m2"},
    ]
    checklist = {
        "9.7": {"cod": "9.7", "descricao": "Chapisco e emboço", "unidade": "m2"},
        "14.2": {"cod": "14.2", "descricao": "Autonivelante", "unidade": "m2"},
    }
    derived = apply_derived_quantities(mapped, checklist, obra="BLN")
    by_cod = {d["cod"]: d for d in derived}
    assert abs(by_cod["9.7"]["quantidade"] - 428.0) < 0.01
    assert abs(by_cod["14.2"]["quantidade"] - 1019.77) < 0.01


def test_section_recovery_soleiras():
    pdf = {
        "raw_text_lines": [
            "CEA - QNT SOLEIRAS",
            "SOLEIRA EM GRANITO CINZA ANDORINHA 0.14x2.00 TEST",
            "Grand total",
        ],
        "noise_removed": [
            {"line": "SOLEIRA EM GRANITO CINZA ANDORINHA 0.14x2.00 TEST",
             "motivo": "not_budget_relevant"},
        ],
        "prancha_num": "331",
    }
    items = parse_section_recovery(pdf, set())
    assert len(items) >= 1
    assert items[0]["unidade"] == "ml"


def test_filter_orcar_excludes_global_scan():
    items = [
        {"tabela": "GLOBAL_SCAN", "descricao": "LIXO", "quantidade": 99},
        {"tabela": "QNT_PINTURA", "descricao": "PINTURA GELO", "quantidade": 100},
    ]
    out = filter_orcar_items(items)
    assert len(out) == 1
    assert "PINTURA" in out[0]["tabela"].upper() or out[0]["tabela"] == "QNT_PINTURA"


def test_normalize_tabela_key_portas():
    assert _normalize_tabela_key("GERAL", "PM 001 0,72") == "PORTAS"
    assert _normalize_tabela_key("GLOBAL_SCAN", "") == "EXCLUDE"
    assert _normalize_tabela_key("QNT_PINTURA", "") == "PINTURA"


def test_dedup_pintura_adm_from_305():
    rows = [
        {"cod": "18.5", "quantidade": 3228, "fonte_pranchas": ["CEA-254-BLN-ARQ_R03-309-X"],
         "descricao": "PINTURA GELO ADM", "unidade": "m2", "confianca": 1.0, "tabela": "PINTURA"},
        {"cod": "18.5", "quantidade": 708, "fonte_pranchas": ["CEA-254-BLN-ARQ_R03-305-X"],
         "descricao": "PINTURA GELO ADM", "unidade": "m2", "confianca": 1.0, "tabela": "PINTURA"},
    ]
    checklist = {"18.5": {"cod": "18.5", "qdeReferencia": 708, "descricao": "Pintura ADM", "unidade": "m2"}}
    agg, _ = _aggregate_mapped_rows(rows, checklist)
    assert len(agg) == 1
    assert abs(agg[0]["quantidade"] - 708) < 1


def test_pintura_zona_nao_colapsa():
    """Vendas e ADM nunca colapsam; ADM com gelo+acartonado preserva ambos."""
    items = [
        # vendas (301): gelo + acartonado
        {"tabela": "PINTURA", "descricao": "PINTURA ACRÍLICA FOSCA, COR BRANCO GELO",
         "quantidade": 371, "unidade": "m2", "zona": "vendas",
         "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3, "grand_total_tabela": 800.0},
        {"tabela": "PINTURA", "descricao": "PINTURA SEMI-BRILHO COR BRANCO GELO EM GESSO ACARTONADO",
         "quantidade": 663, "unidade": "m2", "zona": "vendas",
         "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3, "grand_total_tabela": 800.0},
        # adm (305): só gelo  | adm (309): gelo (cópia) + acartonado
        {"tabela": "PINTURA", "descricao": "PINTURA ACRÍLICA FOSCA, COR BRANCO GELO",
         "quantidade": 368, "unidade": "m2", "zona": "adm",
         "prancha_id": "CEA-254-BLN-ARQ_R03-305-SAN", "revisao_num": 3, "grand_total_tabela": 800.0},
        {"tabela": "PINTURA", "descricao": "PINTURA ACRÍLICA FOSCA, COR BRANCO GELO",
         "quantidade": 368, "unidade": "m2", "zona": "adm",
         "prancha_id": "CEA-254-BLN-ARQ_R03-309-DESC", "revisao_num": 3, "grand_total_tabela": 800.0},
        {"tabela": "PINTURA", "descricao": "PINTURA SEMI-BRILHO COR BRANCO GELO EM GESSO ACARTONADO",
         "quantidade": 408, "unidade": "m2", "zona": "adm",
         "prancha_id": "CEA-254-BLN-ARQ_R03-309-DESC", "revisao_num": 3, "grand_total_tabela": 800.0},
    ]
    deduped, _ = dedup_by_fingerprint(items)
    checklist = [
        {"cod": "18.3", "descricao": "Pintura gelo vendas", "unidade": "m2", "qdeReferencia": 1153},
        {"cod": "18.5", "descricao": "Pintura gelo ADM", "unidade": "m2", "qdeReferencia": 708},
        {"cod": "18.10", "descricao": "Forro vendas", "unidade": "m2", "qdeReferencia": 1044},
        {"cod": "18.11", "descricao": "Forro ADM", "unidade": "m2", "qdeReferencia": 408},
    ]
    mapped, _, _, _ = map_rows_to_xlsx(deduped, checklist, "")
    by_cod = {m["cod"]: m["quantidade"] for m in mapped}
    # Nenhuma zona pode zerar
    assert by_cod.get("18.3", 0) > 0, "vendas gelo zerou"
    assert by_cod.get("18.5", 0) > 0, "ADM gelo zerou"
    assert by_cod.get("18.10", 0) > 0, "vendas forro zerou"
    assert by_cod.get("18.11", 0) > 0, "ADM forro zerou (bug bloco)"
    # ADM acartonado preservado mesmo compartilhando prancha 309 com gelo cópia
    assert abs(by_cod.get("18.11", 0) - 408) < 1


def test_dedup_portas_alcapao():
    items = [
        {"tabela": "GERAL", "descricao": "ALÇAPÃO 50x50cm PARA ACESSO AO FORRO",
         "quantidade": 14, "unidade": "un", "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3},
        {"tabela": "GERAL", "descricao": "ALÇAPÃO 50x50cm PARA ACESSO AO FORRO",
         "quantidade": 14, "unidade": "un", "prancha_id": "CEA-254-BLN-ARQ_R02-306-CAIXILHOS", "revisao_num": 2},
    ]
    deduped, log = dedup_by_fingerprint(items)
    alcapoes = [it for it in deduped if "ALÇAPÃO" in it.get("descricao", "")]
    assert len(alcapoes) == 1
    assert "301" in alcapoes[0]["prancha_id"]
    assert len(log) >= 1


def test_integration_bln_dedup_gabarito():
    """Pipeline sintético 301+305+309+306+331 — qty próximas do gabarito BLN."""
    checklist = [
        {"cod": "18.5", "descricao": "Pintura ADM gelo", "unidade": "m2", "qdeReferencia": 708},
        {"cod": "18.10", "descricao": "Forro vendas neve", "unidade": "m2", "qdeReferencia": 1044},
        {"cod": "14.19", "descricao": "Soleira cinza", "unidade": "ml", "qdeReferencia": 5.88},
        {"cod": "12.11", "descricao": "Alçapão", "unidade": "un", "qdeReferencia": 15},
        {"cod": "15.1", "descricao": "Azulejo", "unidade": "m2", "qdeReferencia": 81},
    ]
    items = [
        # 18.5 — ADM gelo duplicado 305+309
        {"tabela": "PINTURA", "descricao": "PINTURA ACRÍLICA FOSCA, COR BRANCO GELO",
         "quantidade": 708, "unidade": "m2", "prancha_id": "CEA-254-BLN-ARQ_R03-305-SAN", "revisao_num": 3,
         "grand_total_tabela": 800.0, "zona": "adm"},
        {"tabela": "PINTURA", "descricao": "PINTURA ACRÍLICA FOSCA, COR BRANCO GELO",
         "quantidade": 2520, "unidade": "m2", "prancha_id": "CEA-254-BLN-ARQ_R03-309-DESC", "revisao_num": 3,
         "grand_total_tabela": 800.0, "zona": "adm"},
        # 18.10 — vendas acartonado 301
        {"tabela": "PINTURA", "descricao": "PINTURA ACRÍLICA SEMI-BRILHO, COR BRANCO GELO, EM GESSO ACARTONADO",
         "quantidade": 1044, "unidade": "m2", "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3,
         "grand_total_tabela": 1100.0, "zona": "vendas"},
        {"tabela": "PINTURA", "descricao": "PINTURA ACRÍLICA SEMI-BRILHO, COR BRANCO GELO, EM GESSO ACARTONADO",
         "quantidade": 663, "unidade": "m2", "prancha_id": "CEA-254-BLN-ARQ_R03-309-DESC", "revisao_num": 3,
         "grand_total_tabela": 1100.0, "zona": "adm"},
        # 14.19 — soleira 331 + extra
        {"tabela": "SOLEIRAS", "descricao": "SOLEIRA EM GRANITO CINZA ANDORINHA",
         "quantidade": 5.88, "unidade": "ml", "prancha_id": "CEA-254-BLN-ARQ_R03-331-PISO", "revisao_num": 3},
        {"tabela": "PISOS", "descricao": "SOLEIRA GRANITO CINZA ANDORINHA",
         "quantidade": 1.49, "unidade": "ml", "prancha_id": "CEA-254-BLN-ARQ_R03-312-SALA", "revisao_num": 3},
        # 12.11 — alçapão 301+306
        {"tabela": "GERAL", "descricao": "ALÇAPÃO 50x50cm PARA ACESSO AO FORRO",
         "quantidade": 14, "unidade": "un", "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3},
        {"tabela": "GERAL", "descricao": "ALÇAPÃO 50x50cm PARA ACESSO AO FORRO",
         "quantidade": 14, "unidade": "un", "prancha_id": "CEA-254-BLN-ARQ_R02-306-CAIX", "revisao_num": 2},
        # 15.1 — cerâmica duplicada
        {"tabela": "PAREDES", "descricao": "CERÂMICA ELIANE 20x20, COR BRANCA, LINHA FORMA WHITE BRILHANTE",
         "quantidade": 81, "unidade": "m2", "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL", "revisao_num": 3,
         "grand_total_tabela": 500.0},
        {"tabela": "PAREDES", "descricao": "CERÂMICA ELIANE 20x20, COR BRANCA, LINHA FORMA WHITE BRILHANTE",
         "quantidade": 80, "unidade": "m2", "prancha_id": "CEA-254-BLN-ARQ_R03-305-SAN", "revisao_num": 3,
         "grand_total_tabela": 500.0},
    ]
    filtered = filter_orcar_items(items)
    deduped, _ = dedup_by_fingerprint(filtered)
    mapped, _, _, _ = map_rows_to_xlsx(deduped, checklist, "")
    by_cod = {m["cod"]: m["quantidade"] for m in mapped}

    assert abs(by_cod.get("18.5", 0) - 708) / 708 <= 0.15
    assert abs(by_cod.get("18.10", 0) - 1044) / 1044 <= 0.15
    assert abs(by_cod.get("14.19", 0) - 5.88) < 0.01
    assert 14 <= by_cod.get("12.11", 0) <= 15
    assert abs(by_cod.get("15.1", 0) - 81) / 81 <= 0.15


def test_soleira_no_double_count():
    items = [
        {"descricao": "SOLEIRA EM GRANITO CINZA ANDORINHA", "quantidade": 1.49,
         "unidade": "m2", "prancha_id": "CEA_R03-331", "tabela": "PISOS"},
        {"descricao": "SOLEIRA EM GRANITO CINZA ANDORINHA", "quantidade": 5.88,
         "unidade": "ml", "prancha_id": "CEA_R03-331", "tabela": "SOLEIRAS"},
    ]
    cl = [{"cod": "14.19", "descricao": "Soleira cinza", "unidade": "ml", "qdeReferencia": 5.88}]
    mapped, _, _, _ = map_rows_to_xlsx(items, cl, "")
    by_cod = {m["cod"]: m for m in mapped}
    assert "14.19" in by_cod
    assert abs(by_cod["14.19"]["quantidade"] - 5.88) < 0.01


def test_soleira_flag_aguardando():
    """Soleira (takeoff manual) sai como 'aguardando' p/ revisão, confiança reduzida."""
    items = [
        {"descricao": "SOLEIRA EM GRANITO BRANCO CEARÁ", "quantidade": 22.62,
         "unidade": "ml", "prancha_id": "CEA-254-BLN-ARQ_R03-331-PISO", "tabela": "SOLEIRAS"},
    ]
    cl = [{"cod": "14.8", "descricao": "Soleira branco", "unidade": "ml", "qdeReferencia": 11.4}]
    mapped, _, _, _ = map_rows_to_xlsx(items, cl, "")
    by_cod = {m["cod"]: m for m in mapped}
    assert by_cod["14.8"]["status"] == "aguardando"
    assert by_cod["14.8"]["confianca"] <= 0.5


def test_divilux_13_1_usa_max():
    """13.1: FECHAM (13) + EUCATEX sanitários (29) = mesmo sistema → max 29, não soma 42."""
    items = [
        {"tabela": "PAREDES", "descricao": "FECHAM. COMPARTIMENTOS: DIVISÓRIAS, REF. SISTEMA DIVILUX 35",
         "quantidade": 13, "unidade": "m2", "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL",
         "revisao_num": 3, "grand_total_tabela": 500.0},
        {"tabela": "PAREDES", "descricao": "DIVISORIA EUCATEX DIVILUX 35 - SANITÁRIOS",
         "quantidade": 29, "unidade": "m2", "prancha_id": "CEA-254-BLN-ARQ_R03-301-CIVIL",
         "revisao_num": 3, "grand_total_tabela": 500.0},
    ]
    cl = [{"cod": "13.1", "descricao": "Fecham divilux", "unidade": "m2", "qdeReferencia": 30}]
    mapped, _, _, _ = map_rows_to_xlsx(items, cl, "")
    by_cod = {m["cod"]: m["quantidade"] for m in mapped}
    assert abs(by_cod.get("13.1", 0) - 29) < 1


def test_material_cliente_mo_only_total():
    qty, mat, mo = 100.0, 50.0, 30.0
    material_cliente = True
    vlr_mat = 0.0 if material_cliente else round(qty * mat, 2)
    vlr_mo = round(qty * mo, 2)
    vlr_total = vlr_mo if material_cliente else round(qty * (mat + mo), 2)
    assert vlr_mat == 0.0
    assert vlr_total == 3000.0
    assert vlr_total == vlr_mo


if __name__ == "__main__":
    tests = [
        test_soleiras_ml_sum,
        test_soleira_mapa_fixo,
        test_drywall_mapa_fixo_ru_split,
        test_drywall_acartonado_nao_vira_pintura,
        test_drywall_st_faces_aggregam,
        test_pintura_zona_split,
        test_dedup_prancha_priority,
        test_parse_prancha_num,
        test_block_priority_301_over_305,
        test_derived_quantities,
        test_section_recovery_soleiras,
        test_filter_orcar_excludes_global_scan,
        test_normalize_tabela_key_portas,
        test_dedup_pintura_adm_from_305,
        test_pintura_zona_nao_colapsa,
        test_dedup_portas_alcapao,
        test_integration_bln_dedup_gabarito,
        test_soleira_no_double_count,
        test_soleira_flag_aguardando,
        test_divilux_13_1_usa_max,
        test_material_cliente_mo_only_total,
    ]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"OK  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
    sys.exit(1 if failed else 0)
