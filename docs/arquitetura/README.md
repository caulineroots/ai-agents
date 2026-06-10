# Orçamento Construtora — Spreadsheet-Driven Architecture

> Status: **target design** (this branch: `feat/orcamento-planilha-driven`).
> The system being replaced is described in [`../sistema-atual.md`](../sistema-atual.md).

## The problem we are fixing

The current system **reconstructs the budget scope from scratch** on every project: it
scans PDFs/DWGs, asks an LLM to *invent* the list of items ("identifique o que FALTA"),
then applies a hardcoded universal checklist (`template C&A`: *piso ≥ 50% área, rodapé ≥
60% perímetro…*) on top of a **visually estimated** area. The result is a stack of guesses
— estimated area × guessed fraction × invented item list — and the compounding error is
why the output is inaccurate.

## The reframe

Every project arrives with an **initial budget spreadsheet** (`*.xlsx`) that already
enumerates **every line item** to be priced. It is the scope. Some lines already carry a
measure (`QDE`), most carry none, and none carry prices. We stop guessing *what* to measure
and instead **fill the spreadsheet**:

```
OLD (discovery):   drawings → invent items → estimate areas → guess quantities → price
NEW (scope-led):   spreadsheet (fixed line items)
                     → per item: determine the measure (verify | find | none) WITH provenance
                     → price from precos.json
                     → write the values back into the sheet + emit an audit report
```

This converts an open-ended *"what exists in these drawings?"* question (which LLMs answer
badly and over-produce on) into a bounded, checkable *"what is the measure of **this**
named item?"* question.

## Principles

1. **The spreadsheet is ground truth for scope.** Nothing is priced that is not a line in
   the sheet. (An optional final pass may *suggest* — never auto-add — scope the drawings
   imply is missing.)
2. **Every number carries provenance.** `metodo ∈ {stated, computed, estimated}` +
   `fonte` (cited source) + `confianca`. See [`01-modelo-de-dados.md`](01-modelo-de-dados.md).
3. **LLMs are the semantic glue and the eyes; deterministic code does the measuring.**
   An LLM decides *which* table row / layer / region corresponds to a line item and reads
   drawings; geometry and table-retrieval produce the *exact* number. Using an LLM to
   "estimate" a polygon area is the guessing we are removing — `estimated` is the flagged
   last resort, not the default.
4. **Human-in-the-loop on the exceptions, not on everything.** Confirmed, well-sourced
   lines pass through; only divergences, low-confidence, estimates, and not-founds are
   surfaced for review.

## Why this needed LLMs

The irreducibly-LLM parts: matching a free-text line like *"Painéis e ferragens
provadores — m²"* to the right table/layer/region across a heterogeneous drawing set **with
no fixed schema and varying per project**, and **reading a technical-drawing image** to
locate or confirm a stated quantity. Everything else (xlsx parsing, geometry computation,
price lookup) is classical code. That division is what makes the result both *possible* and
*accurate*.

## The pipeline

| Phase | Doc | LLM? |
|---|---|---|
| 0 · Ingestion (spreadsheet + drawing evidence pool) | [`02-ingestao.md`](02-ingestao.md) | 1 orientation pass |
| 1 · Classification (strategy per line item) | [`03-classificacao.md`](03-classificacao.md) | yes (batched) |
| 2 · Measurement resolution (the core) | [`04-medicao.md`](04-medicao.md) | agent w/ tools |
| 3 · Verification + 4 · Pricing | [`05-verificacao-precificacao.md`](05-verificacao-precificacao.md) | on divergence / fuzzy miss |
| 5 · Write-back + audit + review | [`06-escrita-e-revisao.md`](06-escrita-e-revisao.md) | no |

Cross-cutting:
- [`07-agentes-e-ferramentas.md`](07-agentes-e-ferramentas.md) — agent catalog, tool contracts, tech stack.
- [`08-roadmap.md`](08-roadmap.md) — build milestones (each independently shippable).

## Grounding evidence (from the real `254_BLN` project)

Measured against `celmar-files/Projetos inicial/` and `254_BLN_Planilha Civil.xlsx`:

- **Spreadsheet:** **227 priceable line items** (parsed). **112 already have a quantity**
  (→ verify), **115 do not** (→ find). A further **6 numbered rows are empty placeholders**
  (the "25 OMISSOS" reserve block + one blank line) — reported by the parser, excluded from
  scope. Units: `unid` 86, `m²` 66, `vb.` 30, `m` 16, `ml` 7, `m3` 1, plus admin (`dia`/`mês`).
  The ~30 `vb.`/admin lines need *pricing only*, no drawing.
- **Drawings:** 38 PDFs, a DWG for ~every sheet (27 current + an `Old/` set), 27 PNGs.
- **Stated-tier coverage:** 50 CEA-QNT tables across **20/38** PDFs, 182 area tags, 1191
  measure lines. Core civil/piso/forro/copa/sanitários/provadores sheets *have* tables;
  iluminação, layout, caixilhos, cremalheiras, doca, fachada-detail *do not* → those resolve
  via the geometry or vision tiers. **No single source covers everything** — hence 3 tiers.

## Open decisions

Tracked in each relevant doc; summarized here:

1. **MAT vs M.OBRA** — `precos.json` stores a combined `vlr`; the sheet wants the two split.
   Split the table, or write combined into `TOTAL` and leave MAT/M.OBRA blank? → [`05`](05-verificacao-precificacao.md)
2. **DWG→DXF conversion** — every drawing ships as `.dwg`; `ezdxf` cannot read DWG natively.
   A conversion step (ODA File Converter / LibreDWG `dwg2dxf`) is a hard dependency. → [`02`](02-ingestao.md)
3. **Verification tolerance** — what % delta between sheet `QDE` and drawing measure counts
   as a flaggable mismatch? → [`05`](05-verificacao-precificacao.md)
4. **Lump-sum (`vb.`) pricing** — from `precos.json`, or always manual/negotiated? → [`05`](05-verificacao-precificacao.md)
