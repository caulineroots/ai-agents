# 09 · Async Processing — the Job Queue

Processing a project (especially with IA on) is minutes of work and hundreds of LLM
calls. Doing it inside one synchronous HTTP request is fragile: a page reload throws
the result away, there's no progress, and the request times out. So processing is a
**background job** backed by **Postgres**, with the DB as the source of truth.

## Flow

```
Browser ──upload──▶ Next: POST /jobs
                      • saves planilha + desenhos to storage/jobs/<id>/
                      • inserts a row: status=pending
                      • returns { id }  (fast — no processing)
                    ▼
Browser ──redirect──▶ /orcamento-construtora/jobs  (list, polls every 3s)
                                                    /jobs/[id] (detail, polls)

Python worker (separate process, polls Next):
   POST /jobs/claim   ── atomically pending → in_progress (FOR UPDATE SKIP LOCKED)
   → reads storage/jobs/<id>/, groups drawings (DWG→DXF), runs the pipeline
   → writes storage/jobs/<id>/preenchida.xlsx
   → PATCH /jobs/[id]  status=in_progress (+progress), then completed (+result) | failed (+error)
```

**Key property:** the result lives in Postgres + on disk, never in browser state. Reload,
close the tab, come back later via the list — nothing is lost, and long runs never hit a
request timeout (the worker isn't on the HTTP path).

## Components

| Piece | Where | Role |
|---|---|---|
| Postgres | Docker (`docker-compose.yml`, host `:5433`) | the `jobs` table — source of truth |
| Drizzle | `db/schema.ts`, `db/index.ts` | schema + typed client (TS side only) |
| Job API | `app/api/orcamento-construtora/jobs/**` | create/list/detail/claim/update/download |
| Worker | `worker.py` | claims → runs `extractors/pipeline.processar` → reports |
| UI | `app/orcamento-construtora/{page,jobs}` | upload→job, list, detail (all polling) |

The worker **never touches the DB** — it only calls the Next API. Drizzle/Postgres stay
entirely on the Next side, exactly one owner of the schema.

## `jobs` table

`id, status (pending|in_progress|completed|failed), filename, input_dir, n_desenhos,
use_llm, progress, result (jsonb: resumo + relatorio + work_list + writeback), error,
created_at, started_at, finished_at`.

The filled `.xlsx` is **not** in the DB — it's written to `storage/jobs/<id>/preenchida.xlsx`
and streamed by `GET /jobs/[id]/download` (keeps the DB lean).

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/orcamento-construtora/jobs` | UI | create job, store files |
| GET | `/api/orcamento-construtora/jobs` | UI | list (polled) |
| GET | `/api/orcamento-construtora/jobs/[id]` | UI | detail + result (polled) |
| GET | `/api/orcamento-construtora/jobs/[id]/download` | UI | filled `.xlsx` |
| POST | `/api/orcamento-construtora/jobs/claim` | worker | atomic claim of next pending |
| PATCH | `/api/orcamento-construtora/jobs/[id]` | worker | update status/progress/result/error |

`claim` uses `UPDATE jobs SET status='in_progress' WHERE id = (SELECT id ... WHERE
status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING` — so
multiple workers can run safely; none grab the same job.

## Running it locally

```bash
# 1. database
docker compose up -d                      # postgres on :5433 (persistent volume)
npx drizzle-kit push                       # apply the schema (first time / after changes)

# 2. web app
npm run dev                                # Next on :3000

# 3. worker (separate terminal) — does the actual processing
.venv/bin/python worker.py                 # polls :3000, runs the pipeline
```

Env (`.env.local`): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ORCAMENTO_API_URL`
(default `http://localhost:3000`), `WORKER_POLL_SECONDS` (default 3).

Then open `http://localhost:3000/orcamento-construtora`, upload, and watch the job on the
list / detail pages. Run more than one `worker.py` to process jobs in parallel.

## Notes / follow-ups
- Progress is coarse (`medindo 120/227`) via a throttled PATCH; finer per-stage progress is
  easy to add through `processar(progress_cb=…)`.
- No auth yet (local/dev). Concurrency is one worker by default; the claim is multi-worker safe.
- `docker compose down -v` resets the DB (drops the volume).
