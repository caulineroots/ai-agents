# Sistema de Orçamento Automatizado — Celmar

Geração automática de pré-orçamentos a partir de pranchas de projeto (PDF, DXF, PNG).  
O sistema extrai dados por código, envia imagens para IA em 3 estágios e apresenta o orçamento para revisão humana.

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 18+ |
| Python | 3.10+ |
| pip packages | `pdfplumber`, `ezdxf`, `Pillow`, `fastapi`, `uvicorn`, `anthropic` |

```bash
pip install pdfplumber ezdxf Pillow fastapi uvicorn anthropic
```

---

## Iniciar o projeto

```bash
# Na pasta AI-Agents
npm install
npm run dev
```

Acesse **http://localhost:3000/orcamento-construtora**

> O serviço Python (FastAPI na porta 8000) sobe automaticamente na primeira chamada.

---

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
EXTRACTOR_SERVICE_URL=http://localhost:8000
PROJECT_BASE_DIR=C:/caminho/para/pasta/de/projetos
```

---

## Fluxo de uso

### Passo 1 — Upload das Pranchas

1. Arraste ou selecione os arquivos do projeto (PNG, PDF, DXF).
2. O sistema agrupa os arquivos por prancha (stem do nome).
3. Clique em **Próximo**.

> Dica: envie todos os arquivos de uma vez (PNG + PDF + DXF para cada prancha).

---

### Passo 2 — Extração por Código

Clique em **Extrair por Código**.

O sistema lê automaticamente:
- **PDF**: tabelas `CEA-QNT`, quadros de acabamentos, cotas de altura
- **DXF**: blocos, layers e textos com keywords de material

Resultado: lista de itens com quantidade (confirmados) e itens parciais sem quantidade (aguardando IA).

> Esta etapa não usa IA e não tem custo de tokens.

---

### Passo 3 — Análise IA (3 estágios)

#### Estágio 1 — Leitura Geral
- Envia **todas** as pranchas em batches de 6 imagens.
- A IA lê o projeto inteiro, documenta contexto e relevância de cada prancha.
- Clique em **Rodar Leitura Geral** e aguarde.

#### Estágio 2 — Orquestrador
- A IA analisa o mapa gerado no Estágio 1 + dados extraídos por código.
- Identifica lacunas e define quais pranchas precisam de análise de detalhe.
- Clique em **Rodar Orquestrador**.

#### Estágio 3 — Batches de Detalhe
- Envia batches de 3 imagens das pranchas priorizadas.
- A IA confirma ou corrige quantidades e preenche itens sem quantidade.
- Clique em **Rodar Batches de Detalhe**.

> Custo estimado por projeto completo (27 pranchas): ~$2–3 USD em tokens.

---

### Passo 4 — Revisão do Orçamento

A tabela apresenta todos os itens agrupados por ambiente com:

| Campo | Descrição |
|---|---|
| Confirmado (verde) | Item com quantidade extraída do PDF/DXF |
| Estimativa (azul) | Quantidade definida pela IA |
| Não identificado (vermelho) | Item sem quantidade e sem preço mapeado |

**Ações disponíveis:**
- Editar quantidade ou preço de qualquer item
- Adicionar item manualmente
- Remover item
- Ajustar **% de Mobilização** (campo no topo do orçamento)

---

### Salvar e Importar Sessão

- **Salvar**: botão "Exportar Sessão" gera um arquivo `.json` com todos os dados.
- **Importar**: carregue o `.json` para retomar exatamente onde parou (inclui imagens via IndexedDB).

> As imagens ficam salvas no navegador (IndexedDB). Se mudar de navegador ou limpar o cache, será necessário re-enviar os arquivos no Passo 1 antes de rodar a IA novamente.

---

## Estrutura do projeto

```
AI-Agents/
├── app/
│   ├── api/orcamento-construtora/   # Rotas Next.js → proxy Python
│   └── orcamento-construtora/       # Frontend (páginas e componentes)
├── hooks/
│   └── useOrcamentoSession.ts       # Estado global da sessão
├── lib/orcamento-construtora/       # Lógica de cálculo, tipos, image-store
├── extractors/
│   ├── pdf_extractor.py             # Extração de texto e tabelas de PDF
│   ├── dxf_extractor.py             # Extração de blocos e layers de DXF
│   ├── orchestrator.py              # Prompts dos 3 estágios de IA
│   └── ai_client.py                 # Cliente Anthropic
├── extractor_service.py             # FastAPI — endpoints do serviço Python
├── config.py                        # Tabela de preços e keywords de material
└── nomenclaturas_db.json            # Banco de nomenclaturas aprendidas
```

---

## Banco de Preços

Os preços estão em `config.py` → `TABELA_CELMAR`.  
Para adicionar ou corrigir um preço, edite o dicionário diretamente:

```python
"RODAPE ACO INOX 100MM": {"preco": 180.0, "unidade": "ml"},
```

---

## Aprendizado de Nomenclaturas

Acesse **/orcamento-construtora/aprender** para:
1. Enviar um projeto e identificar itens não mapeados.
2. Chamar a IA para sugerir mapeamentos.
3. Aprovar e salvar no `nomenclaturas_db.json`.

---

## Troubleshooting

| Problema | Solução |
|---|---|
| Serviço Python não responde | Verifique se o Python está instalado e os pacotes instalados via `pip` |
| "Failed to fetch" no Orquestrador | Checar `ANTHROPIC_API_KEY` no `.env.local` |
| Orçamento não recalcula ao importar | Reabra a sessão e aguarde 2–3 segundos |
| Muitos "não identificados" | Rode novamente o Passo 2 (Extrair por Código) após qualquer atualização do extrator |
