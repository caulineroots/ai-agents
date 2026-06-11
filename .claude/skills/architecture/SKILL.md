---
name: architecture
description: Read this to understand HOW the whole system fits together end-to-end — the next-app/worker/DB services, the async job queue, and the scope-driven measurement pipeline (parse → classify → measure → verify → price → write-back) with its provenance tiers. The big-picture map that ties every part together. Pair with the `domain` skill (the problem) and the per-service skills.
---

# Architecture — how it all comes together

> The **problem** this solves is in the `domain` skill. This is the **solution shape**.
> Deep design lives in [`docs/arquitetura/`](../../../docs/arquitetura/README.md) (00–10).

## One sentence
A client **spreadsheet defines the scope**; a **Python worker** measures each line item from
the project's **drawings** (provenance: stated > computed > estimated), prices it, and writes
the filled spreadsheet back — all driven by a **Postgres-backed job queue** so long AI runs
survive reloads. A **Next.js app** owns the UI, the DB, and the job API.

## The pieces (monorepo)

```
next-app/  ── Next.js: UI + job API + Drizzle/Postgres (owns the DB)   [skills: next-app, db]
worker/    ── Python: the measurement pipeline + the job worker        [skill: worker]
Postgres   ── Docker, :5444, the `jobs` table = source of truth
```

The worker talks to next-app **only over HTTP** — it never touches the DB. The DB and Drizzle
live entirely on the Next side. See [`docs/arquitetura/10-estrutura-e-operacao.md`](../../../docs/arquitetura/10-estrutura-e-operacao.md).

## Flow 1 — the job queue (async orchestration)

```
Browser ─upload─▶ next-app  POST /jobs   (save planilha+desenhos to storage/jobs/<id>/, insert pending)
                            ─redirect─▶ jobs list / detail  (poll GET /jobs, /jobs/[id])
worker  ─poll─▶ next-app  POST /jobs/claim   (atomic: pending→in_progress, FOR UPDATE SKIP LOCKED)
        ─run the pipeline─▶ writes preenchida.xlsx
        ─PATCH /jobs/[id]─▶ progress … then completed + result  (or failed + error)
```
Result lives in Postgres + on disk → **survives reloads**, and long runs never hit a request
timeout (the worker isn't on the HTTP path). Run multiple workers for parallelism.
Detail: [`09-fila-de-jobs.md`](../../../docs/arquitetura/09-fila-de-jobs.md).

## Flow 2 — the measurement pipeline (`worker/extractors/pipeline.py: processar`)

For one job, per line item:

```
1. parse_planilha   ─ .xlsx → line items (scope). Header detected by content.        [01,02]
2. classify         ─ strategy (AREA/LINEAR/COUNT/VOLUME/LUMP_SUM/TIME), unit,        [03]
                      categoria, FORA_ESCOPO vs MATERIAL_CLIENTE, candidate sheets.
3. measure          ─ resolve the quantity, with provenance:                          [04]
                      • STATED   — read from a PDF table (medidor / medidor_agent[LLM])
                      • COMPUTED — DXF geometry: LLM picks layer/block, ezdxf computes
                      • ESTIMATED— LLM visual guess (last resort, flagged)
                      deterministic mode (use_llm=false) = stated tier only, no geometry.
4. verify           ─ has a sheet qty? compare (tolerance) → confirmado | divergente   [05]
                      (sheet value kept, flagged). No qty? → encontrado | manual.
5. price            ─ match description → precos.json (exact/keyword/fuzzy/fallback).   [05]
6. write-back       ─ fill QDE + TOTAL into a copy of the sheet; emit audit + work-list [06]
```

**Key principle:** the LLM is the *semantic glue and the eyes* (matching lines to drawing
data, reading drawings); **deterministic code does the measuring** (table lookup, polygon
area, block count). Estimation is the flagged exception, never the default. Agents & tools:
[`04-medicao.md`](../../../docs/arquitetura/04-medicao.md), [`07-agentes-e-ferramentas.md`](../../../docs/arquitetura/07-agentes-e-ferramentas.md).

## The data, end to end

```
planilha.xlsx  ─┐
desenhos (PDF) ─┼─▶ evidence pool ─▶ per-item measure (+fonte, +confiança) ─▶ filled .xlsx
desenhos (DWG) ─┘    (PDF tables,                                              + audit report
                      DXF geometry)                                            + review work-list
prices: precos.json (worker/)
```

The filled spreadsheet is the deliverable; the work-list is the human's queue of exceptions
(divergences, not-founds, low-confidence/estimated lines).

## Two AI modes (the "Usar IA" toggle)
- **off** (`use_llm=false`): deterministic, fast, free — stated/table tier only; **DWGs unused**.
  More items land in `manual`.
- **on** (`use_llm=true`): LLM stated resolver (ambiente disambiguation) + geometry tier
  (DXF) → higher coverage, but minutes of sequential Anthropic calls and API cost.

## A second, smaller subsystem
The **aprender** tool (nomenclature learning) is a separate flow: a Next page proxies to a
small FastAPI service in `worker/` that matches/learns item descriptions against
`nomenclaturas_db.json`. Not part of the job pipeline; spawned on demand by next-app.

## Where to go next
- The problem & vocabulary: **`domain`** skill.
- Operate a service: **`db`**, **`worker`**, **`next-app`** skills.
- Full design + decisions + roadmap: [`docs/arquitetura/`](../../../docs/arquitetura/README.md).
