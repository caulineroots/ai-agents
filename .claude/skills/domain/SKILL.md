---
name: domain
description: Read this to understand WHAT problem this project solves and WHY — the construction-budget (orçamento) domain. Covers the client spreadsheet that defines scope, the DWG/PDF drawings that supply the measures, how budgeting works, the domain vocabulary, why it's hard, and why it needed LLMs. Start here before touching the pipeline.
---

# The problem domain — construction budgets from spreadsheets + drawings

## What this is
This tool produces a **pré-orçamento** (preliminary construction budget) for **store
fit-out projects** (cliente C&A / Celmar — e.g. a new store in a shopping mall). A budget is
a long list of line items ("serviços"): piso vinílico, forro de gesso, divisórias, portas,
pintura, instalações, etc. — each with a **quantity** (the *measure*) and a **price**.

## The inputs (every project arrives with these)

1. **The initial spreadsheet** (`*.xlsx`) — the client sends this, and it is the **scope**.
   It already enumerates **every line item** to be priced, hierarchically numbered (1.1, 2.3,
   8.5…), with a unit (`m²`, `ml`/`m`, `un`/`unid`, `m³`, `vb`/verba, `dia`). Crucially:
   - The **price** columns (`MAT.`, `M.OBRA`, `TOTAL`) are **empty** — that's what we produce.
   - The **quantity** column (`QDE`) is **partially filled** — some lines already have a
     measure (verify it), most don't (find it).
   - Layout **varies per project** (header position, column set) — must be detected, not hardcoded.

2. **The drawings** — the project's technical drawings, in two forms:
   - **PDF** — flat technical drawings. Many carry **CEA-QNT tables** (quantity schedules) and
     **quadros de acabamentos** (finish schedules) with quantities already tabulated, plus area
     tags (`A = 123 m²`). These are the richest, most reliable source of measures.
   - **DWG** (CAD, AutoCAD/Revit export) — the source geometry: floor hatches, walls, blocks
     (doors, luminaires, mirrors), dimensions. Needs **DWG→DXF** conversion to read (ezdxf).
     Layer names are generic (`A-FLOR-PATT`), so geometry gives totals/counts, not per-finish areas.

## The job
**Fill the spreadsheet.** For each line item:
- If it already has a quantity → **verify** it against the drawings (flag mismatches).
- If it doesn't → **find** the measure in the drawings.
- Then **price** it (against `precos.json`) → write `QDE` + `TOTAL` back into the sheet.
- Surface the uncertain lines for **human review** (a work-list).

Every number carries **provenance**: `stated` (read from a PDF table) > `computed` (calculated
from DXF geometry) > `estimated` (LLM visual guess — flagged). This is the heart of the design.

## Why it's hard (and why it needed LLMs)
Matching a free-text spreadsheet line like *"Assentamento de piso vinílico salão de
vendas/provadores"* to the right drawing data is **semantic and ambiente-sensitive**:
- The same material appears in different rooms (salão vs ADM vs sanitários) — must not be mixed.
- One line can equal the **sum of several** table rows (e.g. forro split by ceiling height).
- A "material fornecido pela C&A" line is still **measured** but priced labor-only; a
  "contratação direta" line is **out of scope**.
- DWG layers don't name finishes — the model must decide which layer/block corresponds.
- It all **varies per project** — no fixed schema.

None of this was tractable deterministically. The LLM is the **semantic glue and the eyes**
(it matches lines to drawing data and reads drawings); deterministic code does the **measuring**
(table lookup, polygon area, block count). That division makes the result both *possible* and *accurate*.

## What was wrong before (the failure we fixed)
The old approach **guessed what to measure** — it scanned the drawings, *invented* a line-item
list, then applied a universal heuristic checklist (e.g. "piso = 50% of an *estimated* total
area"). Estimated area × guessed fraction × invented item = compounding error. The fix:
**the spreadsheet defines scope** (no inventing), and measures come from the drawings with
provenance — estimation becomes the flagged last resort, not the default.

## Vocabulary (pt-BR)
orçamento (budget) · planilha (spreadsheet) · prancha (drawing sheet) · DWG/DXF (CAD) ·
CEA-QNT (quantity table) · quadro de acabamentos (finish schedule) · ambiente (room/area) ·
salão de vendas, provadores, ADM, sanitários, copa (room types) · m²/ml/un/m³/vb (units) ·
acabamento (finish) · MAT./M.OBRA (material/labour cost) · escopo (scope).

## Where to go next
- How the system is built to solve this: the **`architecture`** skill, and
  [`docs/arquitetura/`](../../../docs/arquitetura/README.md) (00–02 cover scope & inputs in depth).
- To operate a service: the `db`, `worker`, `next-app` skills.
