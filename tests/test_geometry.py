# -*- coding: utf-8 -*-
"""Testes das ferramentas de geometria (M4) — DXF sintético com valores conhecidos.

Determinístico, sem dependência das fixtures DWG nem de conversor externo.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ezdxf = pytest.importorskip("ezdxf")
pytest.importorskip("shapely")

from extractors.geometry import (
    compute_area, compute_length, count_blocks, read_dimensions,
    layers_geometry_summary, detect_scale,
)


@pytest.fixture(scope="module")
def doc(tmp_path_factory):
    """DXF em metros: retângulo 5x4 (PISO), hatch 2x3 (PISO2), linha 10m (RODAPE),
    3 blocos PORTA, 1 cota."""
    d = ezdxf.new("R2010")
    d.header["$INSUNITS"] = 6                      # metros -> scale 1.0
    msp = d.modelspace()

    # retângulo fechado 5 x 4 = 20 m² na camada PISO
    msp.add_lwpolyline([(0, 0), (5, 0), (5, 4), (0, 4)], close=True,
                       dxfattribs={"layer": "PISO"})
    # hatch 2 x 3 = 6 m² na camada PISO2 (disjunto do retângulo PISO)
    h = msp.add_hatch(dxfattribs={"layer": "PISO2"})
    h.paths.add_polyline_path([(10, 0), (12, 0), (12, 3), (10, 3)], is_closed=True)
    # linha de 10 m na camada RODAPE
    msp.add_line((0, 0), (10, 0), dxfattribs={"layer": "RODAPE"})
    # 3 blocos PORTA
    d.blocks.new("PORTA")
    for x in (1, 2, 3):
        msp.add_blockref("PORTA", (x, x), dxfattribs={"layer": "ESQ"})
    # 1 cota horizontal de 5 m
    dim = msp.add_linear_dim(base=(0, -1), p1=(0, 0), p2=(5, 0))
    dim.render()

    path = str(tmp_path_factory.mktemp("dxf") / "synthetic.dxf")
    d.saveas(path)
    return ezdxf.readfile(path)


def test_detect_scale_metros(doc):
    scale, reliable = detect_scale(doc)
    assert scale == 1.0 and reliable is True


def test_compute_area_por_camada(doc):
    assert abs(compute_area(doc, "PISO")["valor_m2"] - 20.0) < 0.5
    assert abs(compute_area(doc, "PISO2")["valor_m2"] - 6.0) < 0.5


def test_compute_area_total(doc):
    # todas as camadas: 20 + 6 = 26 (regiões disjuntas)
    assert abs(compute_area(doc)["valor_m2"] - 26.0) < 1.0


def test_compute_length(doc):
    r = compute_length(doc, "RODAPE")
    assert abs(r["valor_m"] - 10.0) < 0.2 and r["n_entidades"] == 1


def test_count_blocks(doc):
    assert count_blocks(doc, "PORTA")["count"] == 3
    assert count_blocks(doc, "JANELA")["count"] == 0


def test_read_dimensions(doc):
    vals = read_dimensions(doc)
    assert any(abs(v - 5.0) < 0.2 for v in vals)


def test_layers_summary(doc):
    summary = layers_geometry_summary(doc)
    layers = {d["layer"]: d for d in summary}
    assert layers["PISO"]["area_m2"] > 15
    assert layers["ESQ"]["n_insert"] == 3
