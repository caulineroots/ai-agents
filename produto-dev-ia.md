# Produto: AI Agent Router para Times de Desenvolvimento

> Rascunho interno — Cauline Roots · Junho 2026

---

## O Problema

Todo time de desenvolvimento que usa IA hoje está pagando preço de varejo por tokens — sem nenhuma otimização de roteamento. Um desenvolvedor sênior rodando Claude Code + Cursor no modo pesado gasta entre **$340–$540/mês** em ferramentas de IA. Uma software house com 30 devs está queimando **$6.000–$12.000/mês** sem perceber.

O problema não é que a IA é cara. O problema é que 70–80% das tarefas executadas por modelos frontier ($3–15/MTok) poderiam ser feitas por modelos de alta qualidade e baixo custo ($0.27–0.50/MTok) com resultado equivalente.

---

## A Solução

Um sistema de roteamento inteligente que:

1. **Detecta automaticamente** o stack do projeto (linguagem, framework, banco, etc.)
2. **Gera contexto otimizado** para o agente de IA sem configuração manual
3. **Roteia cada tarefa** para o modelo mais barato capaz de resolvê-la com qualidade
4. **Mede e reporta** a economia real em tempo real

```
Tarefa chega
      ↓
Classificador decide o tipo
      ↓
┌─────────────────────────────────────────┐
│ Autocomplete / função simples           │ → Qwen2.5-Coder  ($0.30/MTok)
│ Refactoring / implementação definida    │ → DeepSeek Coder ($0.27/MTok)
│ Debug complexo / arquitetura nova       │ → Claude Sonnet  ($3.00/MTok)
│ Verificação / testes / lint             │ → Claude Haiku   ($0.80/MTok)
└─────────────────────────────────────────┘
      ↓
Resultado entregue ao dev
```

---

## Cálculo Financeiro — Software House Típica

### Custo atual de um dev (sem otimização)

| Perfil | Cursor Pro | Claude Code/API | Total/mês |
|---|---|---|---|
| Dev sênior | $40 | $300–500 | **$340–540** |
| Dev médio | $40 | $100–200 | **$140–240** |
| Dev júnior | $20 | $30–80 | **$50–100** |

### Time: 1 sênior + 2 médios (squad pequena)

| | Sem produto | Com produto | Diferença |
|---|---|---|---|
| Custo mensal API | $500–900 | $150–270 | **-$350–630** |
| Custo do produto | — | $200/mês | +$200 |
| **Economia líquida** | — | — | **$150–430/mês** |
| **Economia anual** | — | — | **$1.800–5.160/ano** |

### Software house: 30 devs (5 sênior, 15 médio, 10 júnior)

| | Valor |
|---|---|
| Gasto mensal em AI hoje | **~$8.500/mês** |
| Com roteamento inteligente (60% saving) | **~$3.400/mês** |
| Economia bruta | **$5.100/mês** |
| Preço do produto | **$1.500/mês** |
| **Economia líquida** | **$3.600/mês = $43.200/ano** |

### Software house: 100 devs

| | Valor |
|---|---|
| Gasto mensal em AI hoje | **~$25.000/mês** |
| Com roteamento (60% saving) | **~$10.000/mês** |
| Economia bruta | **$15.000/mês** |
| Preço do produto | **$4.000/mês** |
| **Economia líquida** | **$11.000/mês = $132.000/ano** |

**ROI médio para o cliente: 3–7x o valor pago.**

---

## Como o Produto Funciona na Prática

### Para o dev — experiência zero fricção

O dev continua usando as ferramentas que já usa. Muda apenas onde as requisições são roteadas.

**Claude Code:**
- O `CLAUDE.md` gerado automaticamente injeta contexto do projeto
- O agente já sabe o stack, as convenções, as regras — sem o dev configurar nada

**OpenHands (alternativa open-source ao Claude Code):**
- `.openhands_instructions` gerado automaticamente pelo script
- UI no browser, experiência equivalente ao Claude Code, modelos baratos como backend

**Cursor:**
- API key aponta para o proxy do produto (LiteLLM)
- Ask/Plan mode usa modelos baratos automaticamente
- Dev não percebe diferença na interface

### Para o gestor — visibilidade e controle

Dashboard com:
- Custo por dev, por projeto, por tipo de tarefa
- Taxa de qualidade (tarefas sem retrabalho)
- Comparativo: "você gastaria $X sem o produto, gastou $Y"
- Alerta se um dev está usando modelos caros para tarefas simples

---

## Auto-detecção de Stack — Como Funciona

O script `setup-openhands.js` roda uma vez na raiz do projeto:

```bash
node scripts/setup-openhands.js
```

Ele lê:
- `package.json` → detecta Next.js, React, NestJS, TypeScript, Prisma, Tailwind, Anthropic SDK...
- `requirements.txt` / `pyproject.toml` → detecta Django, FastAPI, SQLAlchemy, Pydantic...
- `go.mod` → detecta Gin, Fiber, Echo...
- `Cargo.toml` → detecta Actix, Axum, Rocket...
- `.csproj` → detecta .NET, C#

E gera automaticamente:
- **`CLAUDE.md`** — carregado pelo Claude Code em toda sessão
- **`.openhands_instructions`** — carregado pelo OpenHands automaticamente

O arquivo inclui regras específicas por framework (ex: "Next.js → use Server Components por padrão"), regras de TypeScript strict, convenções de teste, e uma seção editável para o time adicionar suas próprias regras.

**Resultado:** o agente de IA já entende o projeto sem o dev precisar explicar nada nas primeiras mensagens. Menos tokens desperdiçados com contexto repetitivo. Mais qualidade desde a primeira resposta.

---

## Os Desafios Reais

### Desafio 1 — Cursor e Anthropic já estão indo nessa direção

**A ameaça:** Cursor provavelmente adiciona roteamento multi-modelo nativo em 6–12 meses. Anthropic já tem Haiku (barato) e Sonnet (médio) como opções. OpenRouter já oferece acesso a múltiplos modelos via uma API.

**A resposta:** O produto não compete com a infra — compete com o *know-how de roteamento calibrado*. Saber exatamente qual tipo de tarefa vai para qual modelo, com qual contexto, com qual prompt, sem degradar qualidade — isso não vem pronto no Cursor. Vem de semanas de teste em projetos reais.

O moat é: **regras de roteamento validadas + contexto automático de qualidade + dashboard de prova**. Isso leva tempo para construir e não é trivial de copiar.

### Desafio 2 — Qualidade do código dos modelos baratos

**A objeção:** "Se usar modelo barato, meu dev vai perder tempo corrigindo."

**A resposta baseada em dados (a coletar no beta):**

Hipótese a validar: modelos como Qwen2.5-Coder-32B e DeepSeek Coder V2 entregam qualidade equivalente ao Claude Sonnet em 75–85% das tarefas de código. O 15–25% restante (debugging complexo, arquitetura nova, integração de sistemas desconhecidos) continua no Sonnet.

O produto roteia automaticamente para Sonnet quando detecta complexidade alta. O dev não decide — o classificador decide.

**Métrica de sucesso:** taxa de retrabalho ≤ 10% maior que no baseline com Claude puro.

### Desafio 3 — Segurança: "nosso código vai passar pelo seu servidor"

**A objeção real de qualquer CTO de empresa séria.**

**Solução para MVP:** modelo **BYOK (Bring Your Own Keys)**.

- O cliente usa as próprias API keys da Together.ai e Anthropic
- O produto fornece apenas a lógica de roteamento e o contexto gerado
- O código nunca passa pelos servidores da Cauline Roots
- Zero risco de exposição de propriedade intelectual

Trade-off: você perde a arbitragem de tokens (não compra barato e revende caro). Mas ganha velocidade de venda e confiança do cliente.

Quando validar e ter tração: oferecer deploy on-premise (o cliente instala na infra deles).

### Desafio 4 — "Já uso Claude Code / Cursor, por que mudaria?"

**A objeção mais comum.**

**A resposta:**

> "Você não muda. O produto se encaixa em cima do que você já usa. Claude Code continua sendo o Claude Code — você só para de usar o Claude para escrever funções simples que um modelo 11x mais barato faria igual."

O posicionamento não é "troque o Claude Code". É "use o Claude Code de forma mais inteligente".

Para o CTO/CFO: é uma linha diferente no orçamento que se paga sozinha em 30 dias.

---

## Roadmap de Validação

### Fase 0 — Semana 1 (agora)
- Roberto usa OpenHands com Qwen2.5-Coder-32B no projeto AI-Agents
- Preenche log diário: tarefa, resultado, retrabalho, custo
- Meta: 30+ tarefas registradas

### Fase 1 — Semanas 2–4
- Kevin testa com um projeto real de dev
- Coleta os números de qualidade para tarefas de dev sênior
- Define: qual % de tarefas do Kevin o modelo barato resolve bem?

### Fase 2 — Meses 2–3
- Beta com 3–5 devs externos (amigos, contatos do Kevin)
- Sem custo para eles, com acesso ao dashboard de economia
- Coleta depoimentos com números reais

### Fase 3 — Meses 3–6
- Primeira abordagem para software houses
- Produto: script de setup + proxy configurado + dashboard
- Preço: baseado em saving real validado
- Meta: 2–3 clientes pagando

### Fase 4 — Meses 6+
- Com MRR estável: hardware próprio ou investidor
- Hardware só entra quando volume de API justificar o capex

---

## Modelo de Precificação Sugerido

| Plano | Devs | Preço/mês | Saving típico |
|---|---|---|---|
| Startup | até 10 devs | $299/mês | $800–2.000/mês |
| Growth | até 50 devs | $999/mês | $4.000–8.000/mês |
| Scale | 50+ devs | $2.500/mês | $10.000+/mês |

ROI mínimo para o cliente: **3x**. Argumento de venda: "se não economizarmos pelo menos 3x o valor do plano em 60 dias, cancelamento sem custo."

---

## Script de Setup — Como Usar Já

```bash
# Na raiz de qualquer projeto:
node scripts/setup-openhands.js

# Saída:
#   .openhands_instructions  → carregado pelo OpenHands automaticamente
#   CLAUDE.md                → carregado pelo Claude Code automaticamente
```

O script detecta o stack, gera as instruções otimizadas e escreve os dois arquivos. O dev só abre o OpenHands ou Claude Code e começa a usar — com contexto de projeto já injetado.

---

*Próximo passo: Roberto usa por uma semana e preenche o log. Kevin usa na semana seguinte. Com os dois logs em mão, a conversa com as primeiras software houses tem números reais.*
