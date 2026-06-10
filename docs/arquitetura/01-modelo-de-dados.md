# 01 · Data Model — the LineItem with provenance

Everything in the pipeline hangs off one object: the **line item**, sourced from the
spreadsheet and progressively enriched as it flows through the phases. The single most
important field is `medida.metodo` — it makes the difference between a number we *read* and
a number we *guessed* explicit and auditable.

## `LineItem`

```ts
type Metodo = "stated" | "computed" | "estimated";
type Estrategia = "AREA" | "LINEAR" | "COUNT" | "VOLUME" | "LUMP_SUM" | "TIME";
type Status = "confirmado" | "divergente" | "encontrado" | "manual" | "lump_sum";

interface LineItem {
  // ── From the spreadsheet (ground truth, Phase 0) ──────────────────────────
  item: string;            // hierarchical number, e.g. "8.5"
  cc: string;              // cost-center code, e.g. "810021"
  descricao: string;       // free-text description as written
  unidade_raw: string;     // unit as written ("unid", "vb.", "m", "m²"…)
  qde_inicial: number | null;  // present on 112/233 items; null/0 otherwise
  row_ref: number;         // 1-based row in the sheet — for write-back w/ formatting

  // ── Assigned by the Classifier (Phase 1, LLM) ─────────────────────────────
  unidade: string;         // normalized: "m2" | "ml" | "un" | "m3" | "vb" | "dia" | "mes"
  estrategia: Estrategia;
  categoria: string;       // civil | eletrica | hidraulica | marcenaria | vidros |
                           // revestimento | pintura | fachada | climatizacao | outro
  needs_drawing: boolean;  // false for LUMP_SUM / TIME
  candidatos: string[];    // likely source sheet stems, e.g. ["301-ARQ CIVIL","331-ARQ PISO"]

  // ── Produced by the Medidor agent (Phase 2) ───────────────────────────────
  medida?: {
    valor: number;
    unidade: string;
    fonte: string;         // CITED: "PDF:301-ARQ CIVIL / tabela CEA-QNT linha 'PISO VINÍLICO'"
                           //     or "DXF:331-ARQ PISO / layer 'PISO-VINIL' (hatch area)"
                           //     or "VISION:331-ARQ PISO (estimativa)"
    metodo: Metodo;        // stated > computed > estimated (preference order)
    confianca: number;     // 0..100
  };

  // ── Verification (Phase 3) ────────────────────────────────────────────────
  status: Status;
  flag?: "QTY_MISMATCH" | "NOT_FOUND" | "LOW_CONFIDENCE" | "ESTIMATED";
  nota_verificacao?: string;   // LLM one-liner, only when divergent

  // ── Pricing (Phase 4) ─────────────────────────────────────────────────────
  preco?: {
    mat: number;
    mobra: number;
    total: number;
    match: "exact" | "keyword" | "fuzzy" | "fallback";
    price_ref: string;     // descricao matched in precos.json
  };
}
```

## The provenance hierarchy (`metodo`)

This is the antidote to the current inaccuracy. The Medidor must prefer, in order:

| `metodo` | Meaning | Example source | Trust |
|---|---|---|---|
| `stated` | The drawing **states** the quantity directly | CEA-QNT table cell, `A = 123 m²` area tag, schedule count | highest |
| `computed` | We **computed** it from drawing geometry | sum of DXF hatch areas on a layer, polyline lengths, block counts | high |
| `estimated` | An LLM **estimated** it visually | vision read of a plan with a scale bar | lowest — always flagged |

Today, effectively *everything* is `estimated` and unmarked. The new system makes
`estimated` rare, visible, and routed to a human (`flag: "ESTIMATED"`).

## Status lifecycle

```
qde_inicial present? ──yes──▶ measure found ──match?──▶ confirmado
                     │                        └─mismatch─▶ divergente (sheet value kept, flagged)
                     │
                     └──no───▶ measure found ─────────────▶ encontrado
                              measure not found ───────────▶ manual (needs human)
                              estrategia LUMP_SUM/TIME ─────▶ lump_sum (pricing only)
```

## Notes

- `row_ref` is captured at parse time so write-back edits the **original sheet in place**,
  preserving its formatting, formulas, and cost-center grouping.
- `unidade_raw` is retained alongside the normalized `unidade` because the raw string is
  evidence for the Classifier and useful when a human reviews a mismatch.
- The canonical list of `unidade` / `categoria` values mirrors `precos.json._meta`
  (`unidades_validas`, `categorias_validas`) so pricing never sees an unknown enum.
