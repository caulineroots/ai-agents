# -*- coding: utf-8 -*-
"""
geometry.py — Fase 2 (camada COMPUTED): mede de verdade a geometria do DXF.

ezdxf + shapely. O LLM decide QUAL camada/região corresponde ao item; estas
funções calculam o NÚMERO exato (áreas de hatch, comprimentos de polilinha,
contagem de blocos). É a capacidade nova vs. o sistema antigo (que lia DXF só
como anotação). metodo='computed'. Ver docs/arquitetura/04-medicao.md.
"""

import re
import math
import logging

log = logging.getLogger("extractor")

# INSUNITS -> fator para METROS
_INSUNITS_TO_M = {0: 0.001, 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0,
                  8: 2.54e-5, 9: 0.001, 13: 1e-9}


def detect_scale(doc) -> tuple[float, bool]:
    """Fator para converter unidades do desenho em metros. (scale, confiável?).

    INSUNITS ausente/0 é ambíguo — assume mm (CAD comum) com confiança baixa.
    """
    insunits = doc.header.get("$INSUNITS", 0)
    if insunits in _INSUNITS_TO_M and insunits != 0:
        return _INSUNITS_TO_M[insunits], True
    return 0.001, False          # default mm, não confiável


def load_dxf(path: str):
    import ezdxf
    return ezdxf.readfile(path)


def _polygons(msp, layer: str | None, scale: float):
    """Polígonos shapely (em metros) de HATCH/LWPOLYLINE/POLYLINE fechadas."""
    from shapely.geometry import Polygon
    from ezdxf import path as ezpath
    polys = []
    for e in msp:
        if layer and e.dxf.layer != layer:
            continue
        t = e.dxftype()
        try:
            if t == "HATCH":
                for p in ezpath.from_hatch(e):
                    pts = [(v.x * scale, v.y * scale) for v in p.flattening(0.05)]
                    if len(pts) >= 3:
                        poly = Polygon(pts)
                        if poly.is_valid and poly.area > 0:
                            polys.append(poly)
            elif t in ("LWPOLYLINE", "POLYLINE") and getattr(e, "is_closed", False) or \
                    (t == "LWPOLYLINE" and e.closed):
                p = ezpath.make_path(e)
                pts = [(v.x * scale, v.y * scale) for v in p.flattening(0.05)]
                if len(pts) >= 3:
                    poly = Polygon(pts)
                    if poly.is_valid and poly.area > 0:
                        polys.append(poly)
        except Exception:
            continue
    return polys


def compute_area(doc, layer: str | None = None) -> dict:
    """Área (m²) somando hatches/polígonos fechados de uma camada (ou todas).
    Faz união (shapely) para não contar sobreposições em dobro."""
    from shapely.ops import unary_union
    scale, reliable = detect_scale(doc)
    msp = doc.modelspace()
    polys = _polygons(msp, layer, scale)
    if not polys:
        return {"valor_m2": 0.0, "n_poligonos": 0, "scale_confiavel": reliable}
    area = unary_union(polys).area
    return {"valor_m2": round(area, 3), "n_poligonos": len(polys),
            "scale_confiavel": reliable}


def compute_length(doc, layer: str | None = None) -> dict:
    """Comprimento (m) somando LINE/LWPOLYLINE/POLYLINE de uma camada."""
    scale, reliable = detect_scale(doc)
    msp = doc.modelspace()
    total = 0.0
    n = 0
    for e in msp:
        if layer and e.dxf.layer != layer:
            continue
        t = e.dxftype()
        try:
            if t == "LINE":
                s, d = e.dxf.start, e.dxf.end
                total += math.dist((s.x, s.y), (d.x, d.y)) * scale
                n += 1
            elif t in ("LWPOLYLINE", "POLYLINE"):
                from ezdxf import path as ezpath
                pts = list(ezpath.make_path(e).flattening(0.05))
                for a, b in zip(pts, pts[1:]):
                    total += math.dist((a.x, a.y), (b.x, b.y)) * scale
                n += 1
        except Exception:
            continue
    return {"valor_m": round(total, 3), "n_entidades": n, "scale_confiavel": reliable}


def count_blocks(doc, pattern: str | None = None, layer: str | None = None) -> dict:
    """Conta INSERTs (blocos) cujo nome casa com `pattern` (regex, opcional)."""
    rx = re.compile(pattern, re.IGNORECASE) if pattern else None
    msp = doc.modelspace()
    nomes: dict[str, int] = {}
    for e in msp:
        if e.dxftype() != "INSERT":
            continue
        if layer and e.dxf.layer != layer:
            continue
        name = e.dxf.name
        if rx and not rx.search(name):
            continue
        nomes[name] = nomes.get(name, 0) + 1
    return {"count": sum(nomes.values()), "por_bloco": nomes}


def read_dimensions(doc) -> list[float]:
    """Valores medidos das entidades DIMENSION (em metros)."""
    scale, _ = detect_scale(doc)
    vals: list[float] = []
    for e in doc.modelspace():
        if e.dxftype() != "DIMENSION":
            continue
        try:
            m = e.get_measurement()
            if isinstance(m, (int, float)) and m > 0:
                vals.append(round(float(m) * scale, 3))
        except Exception:
            continue
    return vals


def layers_geometry_summary(doc, top: int = 25) -> list[dict]:
    """Resumo por camada (área, comprimento, nº de blocos) — menu para o agente
    LLM escolher qual camada corresponde ao item."""
    from shapely.ops import unary_union
    scale, _ = detect_scale(doc)
    msp = doc.modelspace()
    layers: dict[str, dict] = {}
    polys_by_layer: dict[str, list] = {}
    for e in msp:
        lay = e.dxf.layer
        d = layers.setdefault(lay, {"layer": lay, "n_hatch": 0, "n_line": 0,
                                    "n_insert": 0, "n_dim": 0})
        t = e.dxftype()
        if t == "HATCH":
            d["n_hatch"] += 1
        elif t in ("LINE", "LWPOLYLINE", "POLYLINE"):
            d["n_line"] += 1
        elif t == "INSERT":
            d["n_insert"] += 1
        elif t == "DIMENSION":
            d["n_dim"] += 1

    # área das camadas com hatch OU polilinhas fechadas (custo de shapely)
    for lay, d in layers.items():
        if d["n_hatch"] or d["n_line"]:
            polys = _polygons(msp, lay, scale)
            d["area_m2"] = round(unary_union(polys).area, 2) if polys else 0.0
        else:
            d["area_m2"] = 0.0

    ordered = sorted(layers.values(),
                     key=lambda x: (x["area_m2"], x["n_hatch"], x["n_line"]), reverse=True)
    return ordered[:top]
