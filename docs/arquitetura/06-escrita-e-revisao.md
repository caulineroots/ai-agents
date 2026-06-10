# 06 · Phase 5 — Write-back, Audit & Human Review

The final phase puts numbers back into the client's own spreadsheet and surfaces only the
items that need a human. No LLM.

## Write-back

Fill the **original** `*.xlsx` (a copy of it) in place, using `row_ref` captured at parse
time, with `openpyxl`:

- `QDE` ← `medida.valor` for `encontrado` items (the 121 that lacked a measure).
- `MAT.` / `M.OBRA` / `TOTAL` ← `preco` (per the MAT/M.OBRA decision in [`05`](05-verificacao-precificacao.md)).
- `divergente` items: **keep** the original `QDE`; do not overwrite. The divergence lives in
  the audit report and the UI, not in the cell.

**Formatting, formulas, cost-center grouping, and the summary block are preserved** —
we edit cells, we do not regenerate the workbook. The deliverable is the same spreadsheet the
client sent, now filled.

## Audit report

Alongside the filled sheet, emit a per-line audit (JSON + a human-readable view):

```jsonc
{
  "item": "8.5", "descricao": "Guarda corpo de ferro...",
  "valor": 14.2, "unidade": "ml",
  "fonte": "DXF:8-MEZANINO / layer 'GUARDA-CORPO' (soma de comprimentos)",
  "metodo": "computed", "confianca": 88,
  "status": "encontrado", "flag": null,
  "preco": { "total": 1278.0, "match": "keyword", "price_ref": "Guarda-corpo metálico" }
}
```

This is the traceability layer that the old system never had: every filled number points
back to a table cell or a DXF layer.

## Human-in-the-loop — on exceptions only

The reviewer is shown a **work-list of flagged lines**, not all 233:

| Flag / status | Why it surfaces | Reviewer action |
|---|---|---|
| `divergente` (`QTY_MISMATCH`) | sheet vs drawing disagree | accept sheet, accept drawing, or edit |
| `manual` (`NOT_FOUND`) | no measure could be derived | enter a measure (with the sheet/image beside it) |
| `ESTIMATED` | vision last-resort number | confirm or correct |
| `LOW_CONFIDENCE` | soft `computed`/`stated` match | confirm |

Everything `confirmado`/`encontrado` at high confidence passes through untouched. This keeps
human effort proportional to genuine uncertainty — the opposite of today, where every number
is equally untrustworthy.

The review UI lives in the existing wizard (`app/orcamento-construtora/**`), reusing the
image sidebar so the reviewer sees the cited `fonte` next to the drawing.

## Optional: missing-scope suggestions

A final, **non-binding** LLM pass may compare the drawings against the filled sheet and
*suggest* scope the drawings imply but the sheet omits. These are surfaced as **suggestions
only — never auto-added** — preserving the "spreadsheet is ground truth" discipline while not
silently losing genuinely missing scope. The reviewer chooses whether to add each.

## Done definition

A project is "done" when the spreadsheet is filled, every number carries provenance in the
audit report, and the flagged work-list is empty (all exceptions resolved by the reviewer).
