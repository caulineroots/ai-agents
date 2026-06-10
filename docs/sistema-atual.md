# Orçamento Construtora — Architecture & Internals

Automated pre-budget (*pré-orçamento*) generation for store fit-out projects (cliente C&A / Celmar). The system ingests project sheets (*pranchas*) as **PNG + PDF + DXF**, extracts what it can **deterministically by code**, then uses **Claude (vision)** in a **3-stage pipeline** to read drawings, plan gaps, and fill in missing quantities — all surfaced for human review and priced against a fixed table.

> Feature route: `/orcamento-construtora` · Learning tool: `/orcamento-construtora/aprender`

---

## 1. Tech stack & process model

| Layer | Tech | Notes |
|---|---|---|
| Frontend + API | **Next.js 15** (App Router), React 19, TypeScript, Tailwind v3 | `app/orcamento-construtora/**` |
| LLM SDK | `@anthropic-ai/sdk` (also called from Python) | |
| Extraction service | **FastAPI + uvicorn** on `:8000` | `extractor_service.py` |
| PDF parsing | `pdfplumber` | tables, finish schedules, height cotas |
| DXF parsing | line-by-line code/value reader (no `ezdxf` at runtime) | layers, blocks, dims, texts |
| Image render | PNG supplied by user (or pre-rendered from PDF) | client compresses to JPEG before upload |

**Two-process architecture.** The Node server **auto-spawns** the Python service on the first API call and proxies to it. Nothing manual is needed.

```
Browser ──HTTP──▶ Next.js API routes ──HTTP/proxy──▶ FastAPI (:8000) ──▶ extractors + Claude
   localStorage + IndexedDB (images)                  pdfplumber / dxf / orchestrator.py / ai_client.py
```

Key env vars (`.env.local`): `ANTHROPIC_API_KEY`, `EXTRACTOR_SERVICE_URL` (default `http://localhost:8000`), `EXTRACTOR_PYTHON` (python exe — points at the project venv), optional `EXTRACTOR_SERVICE_PATH`, `PROJECT_BASE_DIR`.

---

## 2. The wizard (frontend flow)

`app/orcamento-construtora/page.tsx` orchestrates step components; state lives in `hooks/useOrcamentoSession.ts` (localStorage key `orc-construtora-v3`).

| Step | Component | Action | Produces |
|---|---|---|---|
| 1 · Upload | `StepUpload` | drag/drop PNG+PDF+DXF | `groups: PranchaGroup[]` → IndexedDB |
| 2 · Extract | `StepExtract` | "Extrair por Código" (per prancha) | `extractResults` (classificação + itens) |
| 3 · IA | `StepIA` | runs the 3 AI stages | `leituraMap`, `orchResult`, merged `folha` |
| 4 · Review | `StepReview` | edit qty/price, add/remove, image sidebar | edited `folha` |
| 5 · Orçamento | `StepOrcamento` | final pricing view | `resultado` (totals by categoria/ambiente) |

### File grouping & storage
`lib/orcamento-construtora/image-store.ts` → `groupFilesByStem()` keys files by filename stem:
- `.png/.jpg/.jpeg/.webp` → `imageFile` · `.pdf` → `pdfFile` · `.dxf/.dwg` → `dxfFile`

```ts
interface PranchaGroup { stem: string; imageFile?: File; pdfFile?: File; dxfFile?: File }
```

Files are held in an **in-memory singleton** (never React state — avoids OOM on large image sets) and persisted to **IndexedDB** (`image-db.ts`, DB `orcamento-images-v1`, store `files`, keys `${stem}:{image|pdf|dxf}`).

> ⚠️ **Images only live in the browser.** Exported session JSON contains *metadata only* — no blobs. After import / browser switch / cache clear you must re-upload files in Step 1, or the AI stages have nothing to look at. The AI stages strictly require `imageFile`; PDFs are **not** auto-rasterized for vision.

---

## 3. Code-based extraction (Step 2 — no AI, no token cost)

`POST /extrair-codigo` (per prancha). Combines PDF + DXF signals, classifies the sheet, and emits items.

### PDF (`extractors/pdf_extractor.py`)
- Opens with `pdfplumber`; filters ~25 noise patterns (carimbo, notas, revisão, escalas…).
- **CEA-QNT tables** (`CEA-QNT` regex) and **QUADRO DE ACABAMENTOS** → structured quantities = **confirmed items** (`status="confirmado"`, confiança 95).
- Unit handling: `m²`→`m2`, `m.l.`→`ml`, `un`; **rodapé** tables (header "metro linear"/"rodap") default to **`ml`**, else `m2`.
- **Height context (cotas):** patterns like `H CERAMICA 140`, `H = 140 cm` → `height_context = {"ceram":140, "pint":110}` (cm). Fed to AI Stage 3 to estimate wall/forro areas.
- Sheets without quantity tables → `extract_partial_items_from_text()` = **partial items** (`status="aguardando"`, qty 0, confiança 30, pendência *"quantidade ausente no PDF — verificar na imagem"*).

### DXF (`extractors/dxf_extractor.py`)
- Lightweight code/value reader (tries utf-8/cp1252/latin-1). Collects `layers` (≤50), `dims` (≤50), `blocks` (top-30 by count, e.g. door frames), `texts` (≤60).

### Classification score (`extractors/context_builder.py`)
Points from CEA-QNT tables (+4 each), finish schedules (+3), measure lines, DXF dims/blocks/layers →

| score | classificação | meaning |
|---|---|---|
| ≥ 6 | `DIRETO` | code is enough, AI optional |
| ≥ 3 | `IA_AUDITORIA` | partial — AI confirms |
| < 3 | `IA_NECESSARIA` | AI essential |
| (none) | `SEM_CONTEUDO` | nothing usable |

**Response** (`extrair-codigo`): `{ stem, classificacao, precisa_ia, n_itens_extraidos, itens_extraidos[], height_context, fontes:{pdf,dxf,image}, debug{score,...} }`. Net effect: **confirmed quantities** (from tables) vs **partial items awaiting AI** (seen but unquantified).

---

## 4. The 3-stage AI pipeline (Step 3)

Model: **`claude-sonnet-4-6`** (`config.py:35`). Prompts built in `extractors/orchestrator.py`; calls in `extractors/ai_client.py` (`call_claude_multi`, `max_tokens=16000`). Cost = `tokens_in·$3/M + tokens_out·$15/M`, returned per call as `metadata.{tokens_input,tokens_output,custo_usd}`.

Images are JPEG-compressed **client-side** (`compressImageFile`, max 2048px, q0.85) and again **server-side** if needed (`compress_to_jpeg`, ≤~9.9 MB base64). Each call sends 1–3 images labelled **A/B/C**, mapped back to stems via `label_to_stem`.

```
Stage 1  Leitura Geral ──leitura_map──▶ Stage 2  Orquestrador ──escopo+perguntas──▶ Stage 3  Detalhe
 (images, batches of 6)                  (NO images, JSON only)                       (images, batches of 3)
```

### Stage 1 — Leitura Geral · `POST /ler-prancha`
Reads every relevant prancha to build a project map (no quantity pressure). Frontend: batches of **6 images**, **3 concurrent**.

Output per prancha: `{ prancha, stem, relevante, ambiente, tipo, resumo, itens_vistos[], cobertura_codigo: boa|parcial|minima|nenhuma, observacoes }`. Server indexes results by stem → accumulated into `leituraMap`.

### Stage 2 — Orquestrador de Gaps · `POST /orquestrar`
Senior-engineer role. Receives the **full `leitura_map` + `extract_summary`** (no images) and decides strategy.

Output: `{ contexto_projeto, cliente, projeto, categorias_cobertas[], categorias_ausentes[], gaps_globais[], fontes_primarias{piso_m2,forro_m2,rodape_ml,...}, pranchas_para_detalhar[], pranchas_dispensadas[] }`.

Each `pranchas_para_detalhar[]` entry carries `{ stem, motivo, prioridade, perguntas[], escopo_permitido[], escopo_proibido[] }` — a **whitelist/blacklist** so each sheet only contributes its authoritative data (prevents double-counting piso/forro across drawings). This is the "GAPS IDENTIFICADOS / categorias em falta" view in the UI.

### Stage 3 — Batches de Detalhe · `POST /analisar-batch`
Fills missing quantities and answers the orchestrator's `perguntas`, constrained by escopo. Frontend: batches of **3 stems**, **3 concurrent**. Requires images → returns **400 "Nenhuma imagem recebida"** if a batch has none.

Output: `{ itens[], divergencias[], erros_limitacoes[] }`, where each item = `{ prancha, ambiente, descricao, categoria, unidade, quantidade, confianca, fonte, status, r (≤6-keyword reasoning), pendencias[] }`. Server partitions `itens` back to stems (`batched: {stem: items[]}`).

**Hard rules:** items with `fonte="PDF"` are **immutable** — never duplicated/overwritten; conflicts are logged as `divergencias`. Frontend stats track `enviado/retornado/descartados` (fix-2 = out-of-escopo, fix-3 = PDF duplicate).

### Robustness — `parse_ai_json` (`ai_client.py`)
4-tier recovery: fenced ```json``` block → first-`{`-to-last-`}` → raw `json.loads` → **truncation repair** (close dangling braces/brackets, keep complete items). Raw responses saved to `leitura_last_response.json` / `orchestrator_last_response.json` / `batch_last_response.json` for debugging.

---

## 5. Merge & pricing

**Merge** (`result_builder.py` server-side, `merge-folhas.ts` client-side): dedup by a normalized key (lowercase, de-accented, stop-words removed, ~40–45 chars); PDF quantities win over AI; keep max qty on overlap; filter area-reference noise (ABL/SV/AVL).

**Pricing** (`lib/orcamento-construtora/calcular.ts`): `TABELA_CELMAR` (~250 entries, each `{descricao, vlr, categoria?, keywords[]}`, vlr = MAT+M.O.). `resolvePreco()` is a 5-level fallback: exact → keyword → substring → 3+ letter word-overlap (≥2 words, score ≥0.4) → category fallback.

- **Statuses:** `confirmado` (green, from PDF/DXF) · `parcial`/IA estimate (blue) · `aguardando` (red, no qty) — `aguardando` is **excluded from totals**.
- Fixed **Mobilização** ≈ R$28.000; a **% de mobilização** is adjustable at the top of the budget.
- `NON_BILLABLE` regex drops area refs, circulation, "LAJE APARENTE", pé-direito, iluminância, finish-spec headers.
- Result: `ResultadoOrcamento { itens[], totalGeral, porCategoria, porAmbiente }`.

Core types (`lib/orcamento-construtora/types.ts`): `Categoria` (civil|eletrica|hidraulica|marcenaria|vidros|revestimento|pintura|fachada|climatizacao|outro), `Unidade` (m2|ml|un|m3|vb|kg|hr), `ItemOrcamento`, `ItemOrcado`, `FolhaOrcamento`, `Divergencia`.

---

## 6. API surface

All Next routes are `force-dynamic`; most proxy via `proxyToPython()` (`_python-service.ts`).

| Next route | → FastAPI | maxDuration | Role |
|---|---|---|---|
| `extrair-codigo` | `/extrair-codigo` | 120s | code extraction (no AI) |
| `ler-prancha` | `/ler-prancha` | 180s | **Stage 1** |
| `orquestrar` | `/orquestrar` | 120s | **Stage 2** |
| `analisar-batch` | `/analisar-batch` | 180s | **Stage 3** |
| `aprender?action=…` | `/aprender/{action}` | 30–90s | learning tool (own spawn logic) |
| `chamada-controlada` | calls `/extrair` | 300s | single-image SSE flow (legacy/alt) |
| `calcular` (.js) | — | — | pure-JS pricing, no Python |
| `stage1` (.js) | — | — | direct Anthropic call (legacy/alt) |

FastAPI also exposes `GET /health` → `{status, model}` and `GET /reparse/{stem}` (cached result). Pydantic models in `schemas.py` (`ItemExtraido`, `Divergencia`, `Metadata`, `ExtractionResult`).

### Auto-spawn lifecycle (`_python-service.ts`)
Shared via `globalThis` flags `_pyBooting`/`_pyReady` (each route is a separate module).
1. `_pyReady` → return. 2. `GET /health` (1.5s) alive → ready. 3. booting → `waitForService` (poll 800ms, ≤60s). 4. else **spawn** `EXTRACTOR_PYTHON -m uvicorn extractor_service:app --host 0.0.0.0 --port 8000` (`stdio:'ignore'`, `unref`), wait for health.
On proxy failure → reset `_pyReady=false` (recheck next call); spawn failure → `503`.

---

## 7. Aprender (nomenclature learning) · `aprender.py`

Self-improving dictionary mapping messy extracted descriptions → canonical priced items (`nomenclaturas_db.json`: `{id, canonical_name, category, unit, price_key, has_price, variations[]}`).

Flow: **pre-scan** (which files need AI) → **analisar** (extract + match vs bank; `matched/unmatched/coverage_pct`) → **ia-sugerir** (Claude classifies each unmatched item as `variacao` | `novo` | `ruido`, with `is_orcavel`, `confidence`, `rationale`) → **approve/atualizar** (write to DB; UI auto-selects `is_orcavel && tipo≠ruido && confidence≥80`) → **re-match** (verify coverage rose). Matching: exact canonical → exact variation → substring (≥5 chars & ≥40% of name).

---

## 8. Failure modes worth knowing

| Symptom | Cause | Fix |
|---|---|---|
| Stage 1 "0 pranchas lidas" / Stage 3 **400** on every batch | groups have **no `imageFile`** (only PDF/DXF uploaded, or images dropped from IndexedDB) | upload PNG/JPG per prancha (same stem) in Step 1 |
| Proxy **503** | Python service didn't boot (missing dep / wrong python) | check `EXTRACTOR_PYTHON` venv has `pdfplumber, ezdxf, Pillow, fastapi, uvicorn, anthropic, python-multipart` |
| Proxy **502** | Python crashed mid-request | `_pyReady` auto-resets; retry. Python logs are `stdio:'ignore'` — run uvicorn manually to debug |
| Many "não identificados" | description didn't match `TABELA_CELMAR` | use **Aprender** to map nomenclatures, re-run Step 2 |
| DXF ignored | files are `.dwg` (only `.dxf` accepted at `image-store.ts`) | convert DWG→DXF |

---

### File map

```
app/orcamento-construtora/        page.tsx + components/Step*.tsx + aprender/page.tsx
app/api/orcamento-construtora/    *_python-service.ts + route.ts proxies
hooks/useOrcamentoSession.ts      wizard state, export/import
lib/orcamento-construtora/        image-store, image-db, calcular, merge-folhas, types
extractor_service.py              FastAPI endpoints
extractors/                       pdf_extractor, dxf_extractor, context_builder,
                                  orchestrator (3 prompts), ai_client, result_builder, image_processor
config.py                         MODEL, TABELA/categorias, PDF_SUBDIR/DXF_SUBDIR
aprender.py                       /aprender router · nomenclaturas_db.json
schemas.py                        Pydantic models
```
