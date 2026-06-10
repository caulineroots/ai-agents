# 03 · Phase 1 — Classification

A cheap, fast LLM pass that tags every one of the 227 line items with **how it should be
measured** and **where to look**. No tools, no images — pure text reasoning over the line
descriptions plus the Phase-0 project map. Batched (~25 items per call).

## Why an LLM here

The line descriptions are free Portuguese text with no schema: *"Guarda corpo de ferro com
pintura de fundo para mezanino"*, *"Painéis e ferragens provadores"*, *"Topografia (5
visitas)"*. Deciding that the first is a **linear** measure off a drawing, the second a
**count/area** of a furniture set, and the third a **lump-sum** with no drawing — that is
semantic classification. No regex survives across projects.

## Output per item

```jsonc
{
  "item": "8.5",
  "unidade": "ml",          // normalized from messy unidade_raw ("m","unid","vb.","und"…)
  "estrategia": "LINEAR",   // AREA | LINEAR | COUNT | VOLUME | LUMP_SUM | TIME
  "categoria": "civil",
  "needs_drawing": true,
  "candidatos": ["8-MEZANINO", "301-ARQ CIVIL"]  // likely source sheets (from project map)
}
```

## Strategies

| `estrategia` | Unit | How it resolves later | Typical lines |
|---|---|---|---|
| `AREA` | m² | table value or DXF hatch-area sum | pisos, pintura, revestimento, forro |
| `LINEAR` | ml / m | table value or DXF polyline-length sum | rodapé, guarda-corpo, soleiras |
| `COUNT` | un | schedule count or DXF block count | portas, luminárias, provadores, balcões |
| `VOLUME` | m³ | table value (rare) | concreto, aterro |
| `LUMP_SUM` | vb | **no drawing** — pricing only | ART, seguro, EPI, administração |
| `TIME` | dia / mês | **no drawing** — pricing only | vigilância, topografia, locação |

## The big payoff

The ~30 `vb.` lines plus the `dia`/`mês` admin lines classify as `LUMP_SUM`/`TIME` and get
`needs_drawing: false` — they **skip measurement entirely** and go straight to pricing. The
drawing-measurement effort then concentrates on the `m²`/`m`/`ml`/`m³` and countable `unid`
items, a fraction of the 227. We never again try to "measure" a line that was never a
drawing quantity.

## Unit normalization

The sheet's units are messy (`unid`(86), `m²`(66), `vb.`(30), `m`(16), `ml`(7), `vb`(6),
`und`(2), …). The Classifier normalizes to the canonical set used by `precos.json`
(`m2|ml|un|m3|vb|kg|hr` + `dia|mes` for time) so downstream stages see one vocabulary.

## Candidate sources

Using the Project Map (Phase 0c), the Classifier proposes which sheet stems likely hold each
item's measure. This **prunes the Medidor's search** — instead of scanning 38 drawings per
item, it starts with 1–3 candidates and only widens if they come up empty.
