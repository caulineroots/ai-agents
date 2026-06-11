---
name: worker
description: Use when running, debugging, or extending the Python worker that processes orçamento jobs — the polling loop, the measurement pipeline (extractors/), running the pipeline standalone, the pytest suite, DWG→DXF conversion, or the aprender FastAPI service. All Python lives in worker/.
---

# Worker (Python backend)

The `worker/` folder is the **Python backend**: the job-processing worker, the measurement
pipeline, and the small FastAPI service used by the *aprender* tool. It talks to the rest of
the system **only over HTTP** (the Next API) — it never touches the database.

## Run the worker
```bash
cd worker
.venv/bin/python worker.py        # polls the Next API, claims jobs, processes, reports back
```
- Config: **`worker/.env.local`** — `ANTHROPIC_API_KEY`, `ORCAMENTO_API_URL`
  (the Next base URL; currently `http://localhost:3001`), `WORKER_POLL_SECONDS` (default 3).
- Loop: `POST /jobs/claim` → read files in the job's `input_dir` → group drawings
  (DWG→DXF) → run the pipeline → write `input_dir/preenchida.xlsx` → `PATCH /jobs/[id]`
  (progress, then `completed` + `result`, or `failed` + `error`).
- Run **multiple** `worker.py` for parallelism (claim is atomic, `FOR UPDATE SKIP LOCKED`).

## venv / deps
```bash
cd worker
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first time / rebuild
```
Key deps: fastapi/uvicorn, openpyxl, pdfplumber, **ezdxf + shapely** (geometry), anthropic.
**DWG→DXF** needs a system tool on PATH: `dwg2dxf` (LibreDWG) or ODA File Converter —
without it the geometry tier is unavailable (items fall back to stated/manual).

## The pipeline (`extractors/pipeline.py: processar`)
`planilha → classify → measure → verify → price → write-back`. Provenance on every number:
**stated (PDF tables) > computed (DXF geometry) > estimated**. Modules:
- `planilha_parser.py` — parse the client `.xlsx` into line items (detects header by content).
- `classifier.py` — strategy/unit/categoria, FORA_ESCOPO vs MATERIAL_CLIENTE, candidate sheets.
- `evidence.py` — per-sheet evidence pool (PDF tables/area tags + DXF path).
- `medidor.py` — deterministic stated matcher; `medidor_agent.py` — LLM stated resolver
  (ambiente disambiguation); `medidor_geometry.py` — LLM picks DXF layer/block, `geometry.py` computes.
- `pricing.py` — match → `precos.json`. `writeback.py` — fill the sheet + audit/work-list.
- `use_llm=False` → deterministic only (fast, free, no geometry). `True` → LLM + geometry (slow, costs API).

## Run the pipeline standalone (no queue, for debugging)
```bash
cd worker && .venv/bin/python - <<'PY'
import glob, os
from extractors.pipeline import processar
xlsx = "celmar-files/Projetos inicial/254_BLN_Planilha Civil.xlsx"
sheets = [{"stem": os.path.splitext(os.path.basename(p))[0], "pdf": p}
          for p in glob.glob("celmar-files/Projetos inicial/PDF/*.pdf")]
res = processar(xlsx, sheets, os.environ.get("ANTHROPIC_API_KEY",""), use_llm=False)
print(res["resumo"])
PY
```

## Tests
```bash
cd worker && .venv/bin/python -m pytest -q        # 48 tests (deterministic; no API calls)
```
Fixtures: `worker/celmar-files/` (114 MB, gitignored — the real 254_BLN project).

## The aprender FastAPI service
`worker/extractor_service.py` (uvicorn on :8000) serves `/health`, `/parse-planilha`, and the
`/aprender/*` routes. It is **spawned on demand by next-app** (via `EXTRACTOR_SERVICE_PATH` +
`EXTRACTOR_PYTHON` in `next-app/.env.local`) — only the *aprender* tool needs it; the job flow
does not. To run it by hand: `.venv/bin/python -m uvicorn extractor_service:app --port 8000`.

## Gotchas
- The venv was moved here intact; data-file lookups (`precos.json`, `nomenclaturas_db.json`,
  `celmar-files`, `.env.local`) are `__file__`-relative, so they resolve from `worker/`.
- A full `use_llm=True` run is hundreds of sequential Anthropic calls (minutes, costs money) —
  that's why processing is a background job.

See also: [`docs/arquitetura/`](../../../docs/arquitetura/README.md), and the `db` / `next-app` skills.
