# 05 · Phases 3 & 4 — Verification and Pricing

## Phase 3 — Verification

Splits on whether the spreadsheet already carried a measure.

### Items that HAD `qde_inicial` (112/233) — verify & flag

Compare the sheet's `qde_inicial` against the Medidor's `medida.valor`:

- Within tolerance → `status: "confirmado"`.
- Diverges → `status: "divergente"`, `flag: "QTY_MISMATCH"`. An LLM writes a one-line
  `nota_verificacao` (e.g. *"planilha 99 m² vs CEA-QNT 112 m² na prancha 301"*).
- **Policy (per project owner): the spreadsheet value is kept as the value; the mismatch is
  flagged for human review — the drawing does not silently overwrite the sheet.**

This is mostly deterministic; the LLM is invoked **only** to phrase the divergence note.

> Open decision #3: the tolerance. A flat % (e.g. ±5%) is the simple default, but linear and
> count items may warrant tighter bounds than area. Make it per-`estrategia` configurable.

### Items that LACKED a measure (121/233) — find

- Medidor resolved it → `status: "encontrado"` (carries `medida` + provenance).
- Medidor failed (no table, no usable geometry, vision too uncertain) → `status: "manual"`,
  `flag: "NOT_FOUND"` — surfaced for a human to fill.
- `LUMP_SUM`/`TIME` → `status: "lump_sum"`, skipped here, priced directly.

Any `metodo: "estimated"` or `confianca` below a threshold also gets `flag: "LOW_CONFIDENCE"`
/ `"ESTIMATED"` regardless of branch, so review always catches soft numbers.

## Phase 4 — Pricing

Deterministic-first, LLM only for the long tail.

### Deterministic match against `precos.json`

`precos.json` holds 168 priced services with `{descricao, categoria, vlr, keywords}` plus a
`fallback_por_categoria`. Match order:

1. **exact** — normalized description equals a table `descricao`.
2. **keyword** — any of an entry's `keywords` appears in the line description.
3. **fuzzy** — best token/embedding similarity above a threshold.
4. **fallback** — `fallback_por_categoria[categoria] × medida.valor` when nothing matches.

Record which path hit in `preco.match` and the matched entry in `preco.price_ref`.

### LLM fallback (the fuzzy tail)

On a fuzzy/fallback miss, a small **Pricing agent** picks the best `precos.json` entry for
the description, or routes the unmatched description into the existing **Aprender**
nomenclatura loop (`aprender.py` + `nomenclaturas_db.json`) so the price table *learns* the
new term and the next project matches it deterministically. This preserves the one genuinely
useful learning mechanism from the old system.

### MAT vs M.OBRA

`precos.json` stores a **combined** `vlr` (material + mão de obra), but the spreadsheet has
**separate** `MAT.` and `M.OBRA` columns.

> Open decision #1, two options:
> - **(a)** Extend `precos.json` entries to `{mat, mobra}` and write both columns. Most
>   faithful to the sheet; requires splitting the 168 existing values.
> - **(b)** Write the combined `vlr × qty` into `TOTAL`, leave `MAT.`/`M.OBRA` blank. Zero
>   data work; loses the material/labor breakdown the sheet asks for.
>
> Recommendation: ship (b) for the first end-to-end loop, migrate to (a) once the table is
> being actively curated through Aprender.

### Lump-sum pricing

> Open decision #4: do `vb.` lines (ART, seguro, EPI, administração) price from `precos.json`
> too (many already exist there with `vlr` and `un: vb`), or are they always manually
> negotiated per project? Default: price from the table where an entry exists, flag the rest
> `manual`.

## Output of these phases

Every `LineItem` now has a `status`, an optional `flag`, a `medida` (except lump-sum), and a
`preco`. The set is ready for write-back and review ([`06`](06-escrita-e-revisao.md)).
