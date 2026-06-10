# 04 · Phase 2 — Measurement Resolution (the core)

This is the heart of the system and the place the redesign earns its accuracy. For each line
item with `needs_drawing: true`, a **Medidor agent** derives the measure **with provenance**.

The agent is a **tool-using LLM** (Anthropic tool-use / function calling, run inside the
existing Python extractor service). The LLM decides *what* to measure — which table row,
which DXF layer, which region — and **deterministic tools return the exact number**. The LLM
never multiplies dimensions in its head; that is what the tools are for.

## Inputs to one Medidor invocation

- The `LineItem` (description, normalized unit, strategy, candidate sheets).
- The Phase-0 project map (orientation).
- The extracted evidence for the candidate sheets (tables, area tags, DXF layer list,
  block list) — a compact manifest, not raw dumps.
- The candidate sheets' **images** (for the vision tool / to read the drawing).

## Toolset

```
find_table_value(descricao, stem?)   → search CEA-QNT / quadros / schedules for a row
                                        matching the item → {valor, unidade, cell, stem}     [stated]
read_area_tags(stem)                 → list "A = … m²" annotations on a sheet                [stated]
compute_dxf_area(stem, layer)        → sum closed-polyline + hatch areas on a layer → m²     [computed]
compute_dxf_length(stem, layer)      → sum polyline/line lengths on a layer → m              [computed]
count_dxf_blocks(stem, pattern)      → count INSERT blocks matching a name pattern → un      [computed]
read_dimensions(stem, near?)         → DIMENSION-entity values (cotas)                       [computed]
estimate_from_image(stem, item)      → vision estimate, LAST RESORT, low-confidence + flag   [estimated]
```

`find_table_value` / `read_area_tags` read the cached PDF extraction. The `compute_dxf_*` /
`count_dxf_blocks` / `read_dimensions` tools run **real geometry** on the converted DXF
(`ezdxf` + `shapely`). `estimate_from_image` is the only path that yields `metodo:
"estimated"` and it always sets `flag: "ESTIMATED"`.

## The resolution loop (enforced by the prompt)

The Medidor must walk the provenance hierarchy and **stop at the first reliable hit**:

```
1. stated   — is the quantity written down? (CEA-QNT table cell, area tag, schedule count)
2. computed — can geometry produce it? (hatch area, polyline length, block count on a
              semantically-matched layer)
3. estimated— only if 1 and 2 fail: vision estimate, flagged low-confidence
```

It returns:

```jsonc
{
  "valor": 612.4,
  "unidade": "m2",
  "fonte": "DXF:331-ARQ PISO / layer 'PISO-VINIL' (soma de hatch areas)",
  "metodo": "computed",
  "confianca": 88
}
```

`fonte` is **always cited** so a human (and the audit report) can trace the number back to a
specific table cell or layer.

## The new capability: DXF geometry

This is what today's system lacks entirely (it reads DXF only as annotations and as a
*scoring integer*). The geometry tools:

- **Area** — collect closed `LWPOLYLINE`/`HATCH` entities on the target layer, build
  `shapely` polygons, union to dedupe overlaps, sum area. Convert by drawing units → m².
- **Length** — sum lengths of `LINE`/`LWPOLYLINE` on the target layer → m.
- **Count** — count `INSERT` (block) references matching a name pattern → un.

**Implementation caveats** (must handle, not assume away):

- **Units/scale.** Detect DXF `$INSUNITS` (mm vs m vs cm); a wrong unit is a 1000× error.
  Where absent, infer from a known dimension or the title-block scale, and **flag low
  confidence** if undeterminable.
- **Layer ↔ finish mapping is semantic, not literal.** The LLM picks the layer
  (`"PISO-VINIL"` vs `"PISO-PORC"`); a per-client **layer-map** config can cache confirmed
  mappings so repeat clients skip the LLM step (see [`07`](07-agentes-e-ferramentas.md)).
- **Messy CAD.** Open polylines, duplicated hatches, construction lines on the wrong layer →
  `shapely` union + sanity bounds (area can't exceed the sheet's total area tag) catch the
  worst; anything implausible falls back to `stated`/`estimated` with a flag.

## Fan-out

Line items are independent, so Medidor invocations **run in parallel** (one agent per item,
or small batches grouped by candidate sheet to share image context). This is naturally
pipelined — see [`08-roadmap.md`](08-roadmap.md). It also matches a fan-out workflow during
development for evaluating many items against the gabarito at once.

## Why this fixes the inaccuracy

Today: `estimated area × guessed fraction × invented item`. Here: a **named** item gets a
**single** measure from the **most authoritative available source**, with the method
recorded. Estimation is the exception, flagged for a human — not the silent default.
