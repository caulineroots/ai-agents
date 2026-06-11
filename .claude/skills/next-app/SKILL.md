---
name: next-app
description: Use when running, debugging, or extending the Next.js app — the UI pages, the job API endpoints (the contract the worker polls), env/ports, the Drizzle/Postgres ownership, the filled-spreadsheet download, or the spawned aprender service. The web app lives in next-app/.
---

# Next app (web + job API + DB)

`next-app/` is the **Next.js 15 (App Router)** application: the UI, the job API, and it owns
the database (Drizzle/Postgres). It does **no** heavy processing — that's the worker. It just
stores uploads, creates jobs, and serves status/results.

## Run
```bash
cd next-app
npm install                 # first time
npm run dev                 # http://localhost:3000   (default)
npm run dev -- -p 3001      # if :3000 is taken (this project is often run on :3001)
npm run build && npm start  # production
```
- Env: **`next-app/.env.local`** — `DATABASE_URL` (Postgres on **:5444**), `ANTHROPIC_API_KEY`,
  and `EXTRACTOR_PYTHON` / `EXTRACTOR_SERVICE_PATH` pointing at the **worker** (for *aprender*).
- The DB must be up first (`npm run db:up`) and the schema applied (`npm run db:push`).
- The **worker** must run separately to actually process jobs (see the `worker` skill).
- `@/*` import alias → the `next-app/` root.

## Routes
Pages (`app/orcamento-construtora/`):
- `page.tsx` — upload planilha + desenhos → creates a job → redirects to the jobs list.
- `jobs/page.tsx` — jobs list (polls `GET /jobs` every 3s).
- `jobs/[id]/page.tsx` — job detail (polls until done; shows progress, summary, review
  work-list, download).
- `aprender/page.tsx` — nomenclature-learning tool (proxies to the worker's FastAPI service).

Job API (`app/api/orcamento-construtora/jobs/`) — **the contract the worker uses**:
| Method | Path | Who |
|---|---|---|
| POST | `/jobs` | UI — create job, save files to `storage/jobs/<id>/` |
| GET | `/jobs` | UI — list |
| GET | `/jobs/[id]` | UI — detail + result |
| GET | `/jobs/[id]/download` | UI — stream `preenchida.xlsx` |
| POST | `/jobs/claim` | worker — atomic claim of the oldest pending |
| PATCH | `/jobs/[id]` | worker — update status/progress/result/error |

Other API: `aprender/` (proxy + spawns the Python service), `_python-service.ts` (spawn/proxy
helper), `processar/` (legacy synchronous endpoint — **unused by the UI**, kept for direct tests).

## Files & storage
- `storage/jobs/<id>/` holds a job's uploads + `preenchida.xlsx` (gitignored, runtime).
- `db/schema.ts` + `db/index.ts` — see the `db` skill.

## Known issues / cruft (pre-existing, worth cleaning)
- **`app/api/orcamento-construtora/aprender/route.ts` has TypeScript errors** → `next build`
  fails until fixed (`next dev` still runs). Also `aprender/page.tsx` has a type error.
- **`next.config.ts`** carries unrelated redirects (caulineroots.com / "offer" pages) from a
  prior app bootstrapped in this repo — safe to delete.
- The viewport-lock in `globals.css`/`layout.tsx` was removed (pages now scroll); if a page
  won't scroll after an edit, check for `overflow:hidden`/`100vh` on `html`/`body`.
- The legacy `/processar` endpoint (sync) and the worker's `/orcamento/processar` are unused.

## Verify it's working
- `http://localhost:<port>/orcamento-construtora/jobs` loads the list (not a 404).
- `GET /api/orcamento-construtora/jobs` returns `200` with a JSON array.
- `/` 307-redirects to `/orcamento-construtora`.

See also: [`docs/arquitetura/09-fila-de-jobs.md`](../../../docs/arquitetura/09-fila-de-jobs.md),
and the `db` / `worker` skills.
