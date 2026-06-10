# 07 · Agents, Tools & Tech Stack

## Agent catalog

The LLM work is concentrated in a few small, well-scoped agents. Most of the system is
deterministic; agency sits at the semantic edges.

| Agent | Phase | Tools | Runs | Job |
|---|---|---|---|---|
| **Project Mapper** | 0c | vision | 1×/project | Drawing inventory, total area, ambientes |
| **Classifier** | 1 | none | batched (~25 items) | strategy + normalized unit + candidate sheets |
| **Medidor** ⭐ | 2 | table + geometry + vision | per item (fan-out) | derive measure **with provenance** |
| **Pricing** | 4 | precos.json + Aprender | on fuzzy/fallback miss | match description → price; grow nomenclatura |

The **Medidor is the heart**; the others are thin. Verification (Phase 3) is deterministic
with an LLM only to phrase divergence notes — not a standing agent.

## Tool contracts (Medidor)

All tools are deterministic Python functions over the cached evidence pool. Each returns a
value **and** the provenance string the agent puts in `medida.fonte`.

| Tool | Reads | Returns | `metodo` |
|---|---|---|---|
| `find_table_value(descricao, stem?)` | cached PDF tables/schedules | `{valor, unidade, cell, stem}` | stated |
| `read_area_tags(stem)` | cached PDF area tags | `[{label, valor_m2}]` | stated |
| `compute_dxf_area(stem, layer)` | converted DXF + shapely | `{valor_m2, n_polygons}` | computed |
| `compute_dxf_length(stem, layer)` | converted DXF | `{valor_m, n_entities}` | computed |
| `count_dxf_blocks(stem, pattern)` | converted DXF | `{count, block_names}` | computed |
| `read_dimensions(stem, near?)` | converted DXF | `[{valor, posicao}]` | computed |
| `estimate_from_image(stem, item)` | rendered image (vision) | `{valor, unidade, confianca}` | estimated |

## Onboarding codegen (high-leverage, optional Tier-2)

Layer naming is per-client. Rather than pay the LLM layer-matching cost on every item of
every project, an **onboarding agent** can be pointed at a new client's DXF set once to
**write and validate a `layer-map` config** (layer → category/finish) against a known-good
gabarito. Production runs then use the captured deterministic mapping, and the Medidor's
geometry tools resolve without per-item LLM layer-guessing. Pay exploration **once per
drawing standard**, not per budget.

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Service / UI | **FastAPI** (`:8000`) + **Next.js 15** | keep; Node auto-spawns the Python service |
| Spreadsheet I/O | **openpyxl** | read + write-back preserving formatting |
| DWG → DXF | **ODA File Converter** or **LibreDWG `dwg2dxf`** | required — drawings ship as DWG |
| DXF parse + geometry | **ezdxf** + **shapely** | areas, lengths, counts, overlap dedup |
| PDF tables | **pdfplumber** (keep) | `camelot` for ruled tables, `ocrmypdf`/`tesseract` for scanned |
| Vision render | **pymupdf** | render PDF → image when no PNG supplied |
| LLM | **Anthropic SDK**, structured **tool-use** | drop the old `parse_ai_json` truncation repair |
| Nomenclatura / price match | embeddings (**Voyage** or local `bge-m3`) + LLM adjudication | feeds Aprender |
| Eval | pytest harness vs a known-good gabarito | per-item qty error, provenance split, match precision |

## What carries over from the current system

- The PDF/DXF **extractors** (extended with geometry).
- **`precos.json`** (price table) and the **Aprender** nomenclatura learning loop.
- The **wizard UI shell** and image sidebar (`app/orcamento-construtora/**`).

## What is retired

- The `template C&A` heuristics in `lib/orcamento-construtora/prompts.ts` (the universal
  guessed checklist).
- The *"Identifique o que FALTA"* discovery prompt.
- The multi-stage *leitura → orquestrar → consolidação → recheck* discovery chain (replaced
  by spreadsheet scope + per-item resolution).
- `parse_ai_json` (replaced by structured tool-use).
