# 08 · Roadmap — build milestones

Each milestone is independently shippable and verifiable against the real `254_BLN` project.
Order is chosen so value lands early and risk is retired in sequence.

## M1 · Spreadsheet backbone *(no LLM)* — ✅ DONE
Build `parse-planilha` + the `LineItem` model, and expose it via the service.

- **Deliverable:** `extractors/planilha_parser.py` + `LineItem`/`PlanilhaParseResult`
  schemas + `POST /parse-planilha` endpoint. Upload `*.xlsx` → structured line-item list.
- **Acceptance (met):** 227 priceable items; 112 with `qde_inicial > 0`, 115 without; 6
  empty placeholder rows reported (not dropped silently); header detected by content (split
  across rows 30–31, not hardcoded); `row_ref` captured per item. Covered by
  `tests/test_planilha_parser.py` (6 tests, green).
- **Still open in M1:** frontend wiring — extend `StepUpload` `ACCEPTED` with `.xlsx` and add
  a spreadsheet slot that calls `/parse-planilha` and renders the line-item list.
- **New dependency:** `openpyxl` (no `requirements.txt` exists yet — see roadmap note).

## M2 · Orientation + classification
Project Mapper (Phase 0c) + Classifier (Phase 1).

- **Deliverable:** every line item tagged with `estrategia`, normalized `unidade`,
  `needs_drawing`, and `candidatos`.
- **Acceptance:** `vb.`/admin lines → `LUMP_SUM`/`TIME` (`needs_drawing: false`); geometric
  lines get plausible candidate sheets from the project map.

## M3 · Medidor — stated tier only *(table + area tags)*
The Medidor agent with **only** `find_table_value` + `read_area_tags`. No geometry yet.

- **Deliverable:** all table-backed measures resolved with `metodo: "stated"` + cited
  `fonte`; everything else → `manual`.
- **Acceptance:** items on the 20/38 table-bearing sheets (civil, piso, forro, copa,
  sanitários, provadores…) resolve and verify against `qde_inicial`. **Already beats today**
  for those items, because the numbers are read, not estimated.

## M4 · Medidor — computed tier *(DXF geometry)*
Add DWG→DXF conversion at ingestion + the `compute_dxf_*` / `count_dxf_blocks` /
`read_dimensions` tools (`ezdxf` + `shapely`), with unit/scale detection.

- **Deliverable:** measures for items not in any table (iluminação points, linear runs,
  caixilhos, etc.) resolved with `metodo: "computed"`.
- **Acceptance:** computed values fall within sanity bounds (≤ sheet area tag) and match the
  gabarito within tolerance for a sample set; unit detection verified (no 1000× errors).
- **Risk retired here:** the genuinely new capability. Keep `estimate_from_image` as the
  flagged last resort.

## M5 · Pricing + write-back + review UI
Deterministic pricing against `precos.json` (+ LLM fallback into Aprender), `openpyxl`
write-back into the original sheet, and the exceptions work-list in the wizard.

- **Deliverable:** end-to-end — upload spreadsheet + drawings → filled spreadsheet + audit
  report + flagged review list.
- **Acceptance:** the filled `254_BLN` sheet preserves formatting; every number traces to a
  `fonte`; the reviewer sees only flagged lines.

## Sequencing notes

- **M3 is already a usable, more-accurate product** for table-backed scope; M4 extends
  coverage to untabulated items; M5 closes the loop and ships the artifact.
- Build an **eval harness** alongside M3 (pytest vs a known-good gabarito) so M4's geometry
  can be measured against ground truth as it's added.
- The `template C&A` heuristics and discovery chain are removed **as** M3 lands (not before —
  keep the app runnable throughout).

## Pre-work cleanup (this branch)
- Repo scratch/dead files removed (study `.md`s, one-off scripts, gabarito dumps,
  transcripts). See branch history.
- **Flagged, not yet done:** the root route `app/page.js` is a leftover mock "agents
  dashboard" (uses `components/`), and `lib/construtora/` + the old `app/api/.../stage1` &
  `calcular` `.js` routes look superseded by `chamada-controlada` + `calcular.ts`. Both are
  candidates for removal once confirmed unused by the live wizard.
