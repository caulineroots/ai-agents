# MEMÓRIA — Track Record

> Última atualização: 31/05/2026 — 15:30

---

## OBJETIVO ATIVO

**Construir o agente de orçamento para fit-out comercial — cliente Celmar (Construtora Moim), projeto C&A Blumenau.**

Agente multi-stage (5 fases) que recebe PNGs das pranchas, extrai quantitativos com L e C por ambiente, e aplica tabela de preços determinística para gerar pré-orçamento.

---

## STATUS DOS PROJETOS

| Projeto | Status | Próximo passo |
|---|---|---|
| **Marmoraria** (primo) | ✅ Entregue 29/05 | Aguardando feedback. Em standby. |
| **Marcenaria** (Goldline — Marcio) | ⏸ Standby | Aguardando Marcio devolver planilha + referências. |
| **Construtora Celmar** | 🔨 Em desenvolvimento | Construir UI + integrar stages do agente |

---

## PIPELINE DE OPORTUNIDADES

1. **Marmoraria** (primo) — ✅ entregue. Aguardando feedback do beta tester.
2. **Construtora Celmar** — ativo. Produto: agente de pré-orçamento de fit-out.
3. **Marcio Megiolaro / Goldline Marcenaria** (São Bernardo do Campo) — pipeline de alto valor. Standby aguardando Marcio.

---

## PLANO DE AÇÃO — CONSTRUTORA CELMAR

1. ✅ Analisar pranchas e proposta 1ª CELMAR BLN.xlsx
2. ✅ Definir arquitetura: 5 stages (Scanner, Mapeador, Levantador, Verificador, Gerador)
3. ✅ `lib/construtora/tabela-precos.js` — todos os preços reais da 1ª Proposta
4. ✅ `lib/construtora/calcular-orcamento.js` — motor determinístico L × C
5. ✅ `app/api/orcamento-construtora/calcular/route.js` — POST endpoint
6. ✅ `app/orcamento-construtora/page.js` — stub de rota
7. ⬜ UI completa: upload de PNGs → execução sequencial dos stages → download do orçamento
8. ⬜ Integração com API Anthropic para os stages 1-5
9. ⬜ Testar com pranchas reais (ponto de partida: `304-ARQ COPA.png` como gabarito)

---

## HISTÓRICO

### 25/05/2026
- Setup inicial do projeto AI-Agents (Next.js)
- Criação de arquivos de referência em `transcripts-and-others/`:
  - Transcrição de reunião comercial (Kevin, Mateus, Roberto)
  - Arquivo sobre marcenaria (Marcio)
  - Materiais sobre processos de vendas (Conrado Adolpho)
- Contexto: os materiais de vendas sugerem que há interesse paralelo em processos comerciais, mas foco principal definido é o agente de marmoraria.

### 26/05/2026 — tarde

**Projeto real testado: Caderno Executivo — Luísa Marques, Apto 305 (29 pranchas)**

- Primeira rodada com o STAGE1_Scanner.md:
  - Testou com PDF do caderno executivo
  - Identificou 8 itens de pedra: tampos e rodapés em Granito Tabaco (cozinha e lavanderia) + Granito Branco Siena (banheiro)
  - Alertas gerados: Rebaixo Italiano confirmado na cozinha, rodapés a confirmar no MOB. CAFÉ e lavanderia, furo dispenser pendente

- Primeira versão do Orçamentista de Marmoraria:
  - Prompt gerou orçamento direto do PDF sem levantamento formal de áreas cobradas
  - Identificou problema: o caderno executivo não tem "área cobrada" — é um projeto de interiores, não um levantamento de marmoraria
  - Resultado: calculou áreas a partir das dimensões das pranchas (estimativas)
  - Total estimado: ~R$ 7.968,40 para o projeto Luísa Marques

- Segunda versão do Orçamentista (iteração significativa):
  - Adicionou regras mais rígidas de leitura de dimensões (hierarquia vista superior > frontal > lateral)
  - Criou regra específica para módulos café/bar/nicho (não usar largura frontal como área)
  - Adicionou regra de Rebaixo Italiano por presunção em todos os módulos com cuba
  - Adicionou regra de borda e acabamento de aresta
  - Adicionou regra de furos de banheiro por padrão
  - Testou novamente com imagens (29 JPGs) em vez do PDF — mesmo projeto Luísa Marques

**Decisões tomadas:**
- O fluxo tem dois stages: STAGE1 (scanner) → STAGE2 (orçamentista)
- O orçamentista deve usar "área cobrada" quando disponível; quando não, extrai da vista superior
- Rodapés de banheiro e módulo café precisam de confirmação explícita nas pranchas antes de incluir
- Furo dispenser só entra se aparecer no detalhe do tampo, não apenas na planta hidráulica

### 26/05/2026 — noite

- Setup do sistema brain no Cursor:
  - Criado `brain/core.md` (personalidade e regras do gestor)
  - Criado `brain/memory.md` (este arquivo)
  - Criado `.cursor/rules/brain.mdc` (injeção automática em todo chat)

---

## PENDÊNCIAS ABERTAS

1. **Prazo do objetivo** — não definido. Cobra quando aparecer.
2. **Plano de ação formal** — etapas e datas não confirmadas pelo usuário.
3. **Stage 2 ainda é manual** — o orçamentista ainda depende de input manual do usuário (colar o prompt + o arquivo). Não há automação de fluxo Stage1 → Stage2.
4. **Múltiplos projetos** — testado em apenas 1 projeto real até agora.
5. **Definir o que é "pronto"** — quando o agente estará em condição de uso real pelo cliente final?

---

## OPORTUNIDADE — GOLDLINE MARCENARIA (MARCIO)

**Quem é:** Marcio Megiolaro, dono da Goldline Marcenaria, São Bernardo do Campo. Marcenaria sob medida alto padrão, 40+ anos de história.

**Números do negócio:**
- Ticket médio: ~R$300k por projeto
- Meta mensal: R$300k faturado. Para isso, orça ~R$3M/mês e fecha ~10%
- Base: ~2.000 contatos (clientes antigos + arquitetos), nunca reativada
- Comercial 100% passivo. Sem CRM. Base em Excel.
- Tem planilha Excel com fórmula própria de precificação

**Produto mapeado:** Ecossistema "Sistema Goldline de Inteligência Comercial"
- Camada 0: Goldline Brain (alimenta todos os outros)
- Camada 1: Agentes de Marketing (Copywriter + Analista + Estrategista)
- Camada 2: Comercial — SDR Inbound, Reativação de Base, Follow-up Pós-Orçamento
- Camada 3: Operacional — Pré-Orçamento, Atualização de Obra, Compras, Reviews

**Proposta desenhada:** R$8k-12k setup + R$3.500-5.000/mês retainer

**Status do relacionamento:**
- Reunião de diagnóstico feita
- Follow-up enviado por Roberto após a reunião (vídeo Conrado Adolpho)
- Marcio ficou devendo: planilha de precificação + referências das campanhas antigas da Formas
- Próximo passo: proposta formal com fases de entrega e cronograma

**Argumento central:**
> "Marcio, você não tem problema de vendas. Você tem problema de processo comercial. A gente monta essa estrutura pra você — e os agentes rodam 24h por dia sem você precisar contratar ninguém."

---

## CONTEXTO DA EMPRESA

**Cauline Roots** — startup em fase de pós-pivotagem.
- **Roberto Vieira** (usuário) — sócio 50/50. Papel: criativo, vendas, operação.
- **Kevin** — sócio 50/50. Papel: investidor financeiro + dev.
- Último produto: focado em marketing. Fracassou.
- Pivotagem atual: agentes de IA como produto.
- O agente de orçamento de marmoraria é **um dos produtos em desenvolvimento**, não o único.

**Perfil do Roberto:** não é dev. Depende do Cursor e dos agentes para construir os produtos. Kevin entra na parte técnica de implementação quando necessário.

---

## DECISÕES TÉCNICAS — AGENTE DE ORÇAMENTO

- **PDF direto para Claude: DESCARTADO.** Testado, resultado ruim. Claude não lê as dimensões e detalhes das pranchas com qualidade suficiente quando o input é PDF.
- **Abordagem correta: PDF → PNG por página → Claude recebe imagens.** Conversão deve ser feita client-side no browser usando `pdfjs-dist` (roda nativamente no browser, sem dependências server-side).
- **Railway:** não precisa de config especial para a conversão se for client-side. Sem Dockerfile customizado.
- **Stage 4 não usa IA:** é um script determinístico (`calcular_orcamento.cjs`) que recebe o JSON do Stage 3 e aplica tabela de preços. Mais confiável e sem erro aritmético.

---

## NOTAS SOLTAS

- Os materiais de vendas (Conrado Adolpho) fazem sentido agora: Roberto está responsável por vendas/operação, faz sentido ele estudar processo comercial.
- A reunião transcrita (Kevin, Mateus, Roberto) provavelmente é de prospecção ou alinhamento com algum cliente/parceiro — contexto ainda não claro.
- O "gabriel constante" nas pastas de teste parece ser um arquiteto ou escritório de arquitetura que forneceu o projeto de teste (Luísa Marques). Provavelmente um cliente ou contato que está testando o produto.
