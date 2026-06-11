# Orçamento Construtora

Geração de orçamento a partir da **planilha inicial do cliente** (define o escopo) + os
desenhos do projeto (PDF/DWG/DXF). Para cada item de linha o sistema **mede** nos desenhos
(verifica os que já têm medida, encontra os que faltam — com provenance: tabela > geometria
> estimativa), **precifica** contra `precos.json` e devolve a planilha preenchida, com uma
lista do que precisa de revisão humana. O processamento roda como **job assíncrono**.

Arquitetura detalhada: [`docs/arquitetura/`](docs/arquitetura/README.md).

## Estrutura (monorepo)

```
ai-agents/
  next-app/   # aplicação Next.js: UI + API de jobs + banco (Drizzle/Postgres)
  worker/     # backend Python: pipeline de medição + worker da fila + serviço aprender
  docs/       # arquitetura e decisões
```

- **next-app** — dono do banco (fila de jobs), salva uploads, expõe a API e a UI.
- **worker** — faz o trabalho pesado (extração, medição, IA, precificação). Fala só HTTP
  com o Next; nunca acessa o banco direto.

## Pré-requisitos
Node 18+, Python 3.10+, Docker (Postgres), e uma `ANTHROPIC_API_KEY` (para o modo IA).

## Como rodar (local)

**1. Banco + app web** (terminal 1, em `next-app/`):
```bash
cd next-app
cp .env.local.example .env.local      # preencha ANTHROPIC_API_KEY e os caminhos do worker
npm install
docker compose up -d                  # Postgres em :5444   (ou: npm run db:up)
npm run db:push                        # aplica o schema (primeira vez / após mudanças)
npm run dev                            # Next em :3000
```

**2. Worker** (terminal 2, em `worker/`):
```bash
cd worker
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # primeira vez
cp .env.local.example .env.local      # preencha ANTHROPIC_API_KEY
.venv/bin/python worker.py            # faz polling do Next e processa os jobs
```

Abra `http://localhost:3000/orcamento-construtora`, envie a planilha + desenhos, e acompanhe
o job nas páginas de lista/detalhe. Rode mais de um `worker.py` para processar em paralelo.

> Conversão DWG→DXF (modo geometria) precisa de `dwg2dxf` (LibreDWG) ou ODA File Converter
> no PATH — veja `worker/requirements.txt`.

## Testes
```bash
cd worker && .venv/bin/python -m pytest -q     # 48 testes do pipeline
```
