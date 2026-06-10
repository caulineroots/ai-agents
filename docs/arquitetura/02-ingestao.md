# 02 · Phase 0 — Ingestion

Two inputs are ingested per project: the **budget spreadsheet** (defines scope) and the
**drawing set** (PDF + DWG/DXF + PNG, the evidence pool). Plus one LLM orientation pass that
maps the drawings so every later agent knows where to look. This phase is mostly
deterministic.

## 0a · Spreadsheet parser (`parse-planilha`)

Produces the `LineItem[]` backbone — the 233 leaf items for `254_BLN`.

**Structure varies per project**, so positions are **detected, never hardcoded**:

1. Find the detail header row by scanning for the cells `DESCRIÇÃO`, `UN`, `QDE` (and
   `MAT`/`M.OBRA`). In `254_BLN` that header is at row 31; in another project it will move.
2. From the header, map columns → fields (`C.C.`, `ITEM`, `DESCRIÇÃO`, `UN`, `QDE`, `MAT`,
   `M.OBRA`, `TOTAL`).
3. Read rows below it; a **leaf line item** is one whose `ITEM` matches `^\d+\.\d+`
   (e.g. `1.1`, `8.5`). Section headers (`A`, `1`, `2`…) and the top summary block (rows
   7–28 in `254_BLN`) are skipped — though the summary's cost-center → description mapping
   is captured to seed `categoria`.
4. Capture `row_ref` (1-based) for each leaf for write-back.

Output per item: `{ item, cc, descricao, unidade_raw, qde_inicial, row_ref }`.

**Library:** `openpyxl` (read + later write-back preserving formatting).

### Verifiable target
Running the parser on `254_BLN_Planilha Civil.xlsx` must yield **233 leaf items**, of which
**112 have `qde_inicial > 0`** and **121 do not**. This is milestone 1's acceptance test.

## 0b · Drawing evidence pool

Reuse the existing extractors (`extractors/pdf_extractor.py`, `extractors/dxf_extractor.py`),
but repurposed: today they feed a discovery firehose; here they build a **queryable index**
that the Medidor consults *per line item*.

Per drawing stem, extract once and cache:

- **PDF** (`pdfplumber`): CEA-QNT quantity tables, quadros de acabamentos, area tags
  (`A = … m²`), measure lines, raw text.
- **DXF** (`ezdxf`): layers, dimensions, blocks/`INSERT`s, text annotations — **and**, new,
  the geometry needed to *compute* areas/lengths/counts (see [`04-medicao.md`](04-medicao.md)).
- **PNG/render**: kept only as the vision fallback (`pymupdf` can render from PDF when no
  PNG is supplied).

Files are grouped by stem (e.g. `301-ARQ CIVIL.pdf` + `301-ARQ CIVIL.dwg` + `…png`), exactly
as `StepUpload` already does.

### DWG → DXF conversion (hard dependency)

In the real project **every drawing ships as `.dwg`** (27 current + an `Old/` set), and
`ezdxf` **cannot read DWG natively**. A conversion step is therefore required at ingestion:

- **ODA File Converter** (free, batch DWG↔DXF), or
- **LibreDWG** `dwg2dxf` (open source).

Convert once at upload, cache the `.dxf` next to the `.dwg`. Without this, the entire
`computed` tier is unavailable and we fall back to `stated`/`estimated` only.

> Open decision #2: which converter to standardize on (licensing/operational trade-off).
> The `Old/` DWGs are superseded revisions — ingest only the current set; ignore `Old/`.

## 0c · Project Mapper (1 LLM pass, vision)

One call over the drawing set produces an **inventory** that orients every downstream agent:
which sheet is what (`301 = planta civil`, `321 = forro`, `331 = piso`, `8 = mezanino`…),
the **total area**, and the list of **ambientes**. This repurposes the old *leitura geral*
stage — but now it serves *filling* (telling the Classifier which sheets are candidate
sources per item), not *discovery*.

Output (cached on the project): `{ area_total, ambientes[], sheets: [{stem, tipo, resumo}] }`.

## Coverage reality (from the probe)

The evidence pool is **heterogeneous** — this is why measurement needs three tiers:

- 20/38 PDFs carry CEA-QNT tables (civil, piso, forro, copa, sanitários, provadores,
  descompressão…) → rich **`stated`** tier.
- Sheets like iluminação, layout, lay-áreas, caixilhos, cremalheiras, doca have **no clean
  table** (T=0) but many measure lines / area tags, or only geometry → **`computed`**/vision.

No single extractor covers the whole spreadsheet. The Medidor routes per item accordingly.
