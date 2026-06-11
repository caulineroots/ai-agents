# 10 · Repository Structure & Operation

The current state of the system as it actually runs — the monorepo layout, the three
services, ports, env, and how to operate each. The *design* of the measurement pipeline is in
docs 00–09; this doc is the **operational map**.

## Monorepo layout

```
ai-agents/
  next-app/   # Next.js 15 — UI + job API + Drizzle/Postgres (owns the DB)
  worker/     # Python — measurement pipeline + job worker + aprender FastAPI service
  docs/       # architecture (this folder)
  .claude/skills/{db,worker,next-app}/   # operational skills (how to run/debug each service)
```

> **Path note for docs 00–09:** those were written before the split. Read paths like
> `app/…`, `db/…` as `next-app/…`, and `extractors/…`, `worker.py`, `precos.json` as
> `worker/…`. The logic is unchanged; only the folder prefix moved (all via `git mv`).

## Three services

| Service | Runtime | Where | Port | Started by |
|---|---|---|---|---|
| **Database** | Postgres 16 (Docker) | `next-app/docker-compose.yml` | **5444** | `npm run db:up` |
| **Next app** | Node / Next.js | `next-app/` | **3000** (often run on **3001**) | `npm run dev` |
| **Worker** | Python | `worker/` | — (HTTP client) | `.venv/bin/python worker.py` |

Plus an on-demand **FastAPI service** (`worker/extractor_service.py`, :8000) used only by the
*aprender* tool — spawned by next-app, not part of the job flow.

## How they connect (async job queue)

```
Browser → next-app (POST /jobs: save files, insert pending) → returns job id, redirects to list
worker  → polls next-app (POST /jobs/claim) → runs the pipeline → writes preenchida.xlsx
        → PATCH /jobs/[id] (progress, then completed+result)
Browser → polls next-app (GET /jobs, /jobs/[id]) → shows progress, result, download
```

The **DB is the source of truth**; results survive page reloads. The worker reads the job's
`input_dir` (an absolute path under `next-app/storage/`) so it processes files written by
next-app across the folder boundary. Full detail: [`09-fila-de-jobs.md`](09-fila-de-jobs.md).

## Env (per folder, both gitignored)

- **`next-app/.env.local`**: `DATABASE_URL` (Postgres :5444), `ANTHROPIC_API_KEY`,
  `EXTRACTOR_SERVICE_URL` (:8000), `EXTRACTOR_PYTHON` + `EXTRACTOR_SERVICE_PATH` (abs paths
  into `worker/` so it can spawn the aprender service).
- **`worker/.env.local`**: `ANTHROPIC_API_KEY`, `ORCAMENTO_API_URL` (the Next base URL —
  must match the port Next runs on; currently `http://localhost:3001`), `WORKER_POLL_SECONDS`.

`*.env.local.example` files in each folder document the keys.

## Run all three (local)

```bash
# terminal 1 — DB + web
cd next-app && npm run db:up && npm run db:push && npm run dev      # (-- -p 3001 if needed)
# terminal 2 — worker
cd worker && .venv/bin/python worker.py
```
Then open `http://localhost:<port>/orcamento-construtora`. Per-service operational detail
(start/stop/reset/inspect/debug) lives in the **skills**: `.claude/skills/{db,worker,next-app}`.

## State / decisions worth remembering
- **Async job queue** replaced the old synchronous request (which lost results on reload and
  timed out). Postgres + a polling worker; the worker never touches the DB directly.
- **Monorepo split** into `next-app/` + `worker/` (history preserved via `git mv`).
- **DB on host port 5444** (5432/5433 were taken).
- **Old discovery wizard removed** — the scope-driven flow is the only flow; `/` redirects to
  `/orcamento-construtora`.
- **Measurement tiers wired**: stated (PDF tables) + computed (DXF geometry, LLM-selected) +
  the LLM stated resolver; deterministic mode (`use_llm=false`) skips the LLM/geometry.

## Known cruft / follow-ups
- `next-app/app/api/orcamento-construtora/aprender/route.ts` + `aprender/page.tsx` have
  pre-existing **TypeScript errors** → `next build` fails until fixed (`next dev` is fine).
- `next-app/next.config.ts` has unrelated redirects from a prior app — safe to delete.
- Legacy unused endpoints: next-app `/api/.../processar`, worker `/orcamento/processar`.
- Pipeline follow-ups (MAT/M.OBRA split, better candidate sheets, MATERIAL_CLIENTE labor-only
  pricing, vision/estimated tier) — see [`08-roadmap.md`](08-roadmap.md).
