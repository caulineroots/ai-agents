---
name: db
description: Use when working with this project's Postgres job database — starting/stopping/resetting it (Docker), connecting, inspecting jobs, or applying Drizzle schema changes. The DB is the source of truth for the orçamento job queue and is owned by next-app.
---

# Database (Postgres — job queue)

Postgres 16 in Docker. It holds the **`jobs`** table — the source of truth for async
orçamento processing (Next creates jobs, the Python worker claims/completes them).

**Owned by `next-app`** (Drizzle lives on the TS side). The worker never touches the DB
directly — it only calls the Next API.

## Facts
- Container: **`orcamento-db`**, image `postgres:16`.
- Host port: **`5444`** → 5432 in the container. (5432/5433 were already in use.)
- Compose file: **`next-app/docker-compose.yml`**. Persistent volume `orcamento-pgdata`.
- Connection: `postgres://orcamento:orcamento@localhost:5444/orcamento`
  (set as `DATABASE_URL` in `next-app/.env.local`).
- Schema: **`next-app/db/schema.ts`**. Client: `next-app/db/index.ts` (drizzle + postgres-js).
- Drizzle config: `next-app/drizzle.config.ts` (loads `.env.local` itself for the CLI).

## Common operations (run from `next-app/`)
```bash
cd next-app
npm run db:up        # docker compose up -d   (start; or: docker compose up -d)
npm run db:down      # docker compose down     (stop; data persists in the volume)
npm run db:push      # drizzle-kit push        (apply schema changes — no migration files)
npm run db:studio    # drizzle-kit studio      (browse data in the browser)
```

Reset everything (drops the volume → empty DB, then re-push schema):
```bash
cd next-app && docker compose down -v && docker compose up -d && npm run db:push
```

Health / inspect directly:
```bash
docker inspect -f '{{.State.Health.Status}}' orcamento-db          # healthy?
docker exec orcamento-db psql -U orcamento -d orcamento -c "\dt"   # tables
docker exec orcamento-db psql -U orcamento -d orcamento -c \
  "select id,status,filename,progress from jobs order by created_at desc limit 10;"
docker exec orcamento-db psql -U orcamento -d orcamento -c "truncate jobs;"   # clear queue
```

## `jobs` table
`id (uuid)`, `status` (`pending|in_progress|completed|failed`), `filename`, `input_dir`
(absolute path under `next-app/storage/jobs/<id>/`), `n_desenhos`, `use_llm`, `progress`,
`result` (jsonb: resumo + relatorio + work_list + writeback), `error`, `created_at`,
`started_at`, `finished_at`. The filled `.xlsx` is on disk (not in the DB).

## Gotchas
- Migrations are **push-based** (`drizzle-kit push`) for local dev — no migration files.
  After editing `db/schema.ts`, run `npm run db:push`.
- The container was created from `next-app/` — manage it from there (compose project name).
- If `npm run db:push` can't connect, the DB isn't up or `DATABASE_URL` is wrong/stale.

See also: [`docs/arquitetura/09-fila-de-jobs.md`](../../../docs/arquitetura/09-fila-de-jobs.md),
and the `next-app` and `worker` skills.
