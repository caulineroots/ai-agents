# Plano de Validação — Pós-Implementação dos 13 Bugs

> Gerado em: 2026-06-08  
> Status: 3 pranchas validadas, 24 pendentes

---

## Resumo da rodada atual

| Prancha | Esperado | Obtido | Status |
|---------|----------|--------|--------|
| **321 – ARQ FORRO** | 7 itens (5 NEVE por PD + 1 MENINA + 1 FÓRMICA) | 3 itens — NEVE colapsa | ⚠️ Fix aplicado (PD no início) — **re-testar** |
| **315 – ARQ ESTANTES** | 3 itens (LINEAR + PONTO FIXO + PONTO PAREDE) | 3 itens mas "PLANTA BAIXA…315" como lixo, "PONTO" sem sufixo | ⚠️ Fixes aplicados — **re-testar** |
| **341 – ARQ FACHADAS** | 10 itens (8 RODAPÉS + 2 LOGO) | 10 itens ✓ | ✅ OK |

---

## Correções aplicadas mas ainda não re-testadas

### FIX-A — BUG-11: PD no início da descrição (321)
- Antes: `"...EMENDAS (PD=2.30m)"` → truncado em [:120], colide em normalize_key[:60]  
- Depois: `"[PD=2.30m] FORRO LISO TABICADO..."` → PD nos primeiros 60 chars, chave única  
- **Ação:** re-rodar 321 e confirmar 7 registros

### FIX-B — BUG-6: Sufixo em linha separada e lixo de título (315)
- Buffer `pending` acumula sufixo antes de fazer `_cea_add` → "PONTO FIXO" e "PONTO PAREDE" corretos  
- `_RE_PLANTA_TITLE` adicionado ao noise filter → bloqueia "PLANTA BAIXA … 315"  
- **Ação:** re-rodar 315 e confirmar 3 itens limpos

---

## 306 — ARQ CAIXILHOS (análise detalhada)

**Resultado:** 11 registros — 7 corretos + 4 lixo. Faltam 9 itens reais.

### Itens corretos (7)
PA 048, PD 031, PD 032, PD 034, PD 037, PF 025, PM 014

### Itens perdidos (9)
PA 044, PD 030, PF 017, PM 001, PM 003, PM 006, PM 029, ALÇAPÃO 50x50, PORTA TAPUME

### Itens lixo (4)
| Lixo | Origem |
|------|--------|
| `PV 043 VÃO ELEVADOR 1 0.00 0.00 PLANTA BAIXA 2º PAVIMENTO - ADM ESC.: 1:100` | pdfplumber funde linha do item com título de vista |
| `PD 030 PD 031 PD 032 PD 034 PF 25 un` | Índice de detalhes capturado como item; `025` no final vira qty |
| `PM 003 PM 006 1 : 50 1 : 50 PM 14 un` | Rótulos de escala fundidos com códigos |
| `PM 045 PG 049 NÚMERO DATA DESCRIÇÃO DAS REVISÕES 20 un` | Cabeçalho de revisão com qty="20" |

### Causas raiz

#### BUG-306-A: Continuação contamina QTD já resolvido
Quando pdfplumber divide uma linha de porta em 2 (ex: `PA 044 PORTA DE ENROLAR... 1 11.02 5.00` + `PAINEL CENTRALIZADO...`),
o parser appenda a continuação **depois** do QTD, tornando a string `...5.00 PAINEL...METALIZADO.`.
`_DIMS_END` e `_QTD_END` ancoram em `$` e não encontram mais o número → item descartado no flush.

**Fix:** em `elif code and s:`, antes de `desc = desc + s`, verificar se desc já tem QTD via `_DIMS_END.search(desc) or _QTD_END.search(desc)`. Se sim, **não** appenda a continuação.

#### BUG-306-B: `_SEC_END` não para na borda do quadro
Após `PV 043 VÃO ELEVADOR 1 0.00 0.00`, as linhas seguintes (`PLANTA BAIXA 2º PAVIMENTO - ADM`, `ESC.: 1 : 100`, `306 - LOCALIZAÇÃO PORTAS`) não estão no `_SEC_END`, então o loop continua coletando lixo.

**Fix:** adicionar ao `_SEC_END`:
```python
r"PLANTA\s+(BAIXA|ALTA)\b|ESC\s*\.\s*:\s+1\s*:|DETALHES?\s+[\"']?P[\"']?|NOTAS\s*[-–]"
```

#### BUG-306-C: Índice de detalhes capturado como itens
Linhas como `PD 030 PD 031 PD 032 PD 034 PF 025` — referências a detalhes da prancha — são interpretadas como código "PD 030" com desc "PD 031 PD 032 PD 034 PF 025", onde "025" no final vira qty=25.

**Fix:** em `m_door` match, checar se `desc` começa com outro código de porta (`_DOOR_CODE.match(desc)`). Se sim, descartar como índice.

Adicionar também filtro para linhas com escala: `re.search(r"\b1\s*:\s*\d{2,3}\b", s)` → skip.

#### BUG-306-D: Itens sem código (ALÇAPÃO, PORTA TAPUME)
Primeiras linhas do quadro não têm código `PA/PD/PM/PF`. O parser ignora por não ter match em `_DOOR_CODE`.

**Fix (baixa prioridade):** adicionar fallback para linhas que não têm código e têm `_DIMS_END` ou `_QTD_END` ao final — parsear como item genérico de porta com código "" ou código derivado da descrição.

---

## Pranchas ainda não validadas nesta rodada

### Grupo 1 — Novos parsers (alta prioridade)

| Prancha | Bug | O que validar |
|---------|-----|---------------|
| **306 – ARQ CAIXILHOS** | BUG-3 | `parse_special_tables_from_text` deve extrair `CEA - QUADRO DE PORTAS` (PA/PD/PM + qtd + dims) |
| **306 – ARQ CAIXILHOS** | BUG-4 | `in_materiais` deve suprimir specs de porta no extract_partial |
| ~~**601 – CVS COMUNICAÇÃO VISUAL**~~ | BUG-13 | ✅ **18/19 itens** — CV_722 ausente (linha de continuação Revit sem qty própria — não crítico) |
| **131 – DEC PROVADORES** | BUG-9 | ⚠️ Analisado — ver seção detalhada abaixo |
| **201 – INT ILUMINAÇÃO** | BUG-9 | Pendente (estrutura provavelmente similar a 131) |

### Grupo 2 — Guards / skip (média prioridade)

| Prancha | Bug | O que validar |
|---------|-----|---------------|
| **501 – LAY LAYOUT** | BUG-8 | `_RE_VISUAL_PRANCHA` deve fazer skip de `extract_partial` → zero aguardando |
| **502 – LAY ÁREAS** | BUG-8 | ⚠️ **FALHOU** — 14 aguardando garbage — ver BUG-502-A abaixo |
| ~~**311 – ARQ CORTES GERAIS**~~ | BUG-5 + BUG-8 | ✅ **0/0** — guards funcionaram, sem lixo |
| **203 – INT AXONOMÉTRICAS** | BUG-8 | Deve zerar aguardando |
| **132 – DEC PROVADORES** | BUG-5 | Prancha de referência → sem itens aguardando |

### Grupo 3 — Re-testar fixes já aplicados anteriormente

| Prancha | Fix re-testado? | Comportamento esperado |
|---------|-----------------|------------------------|
| **302 – ARQ TAPUME** | ❌ | Sem lixo de notas/metragem nos aguardando |
| **303 – ÁREA TÉCNICA** | ❌ | Itens confirmados intactos; aguardando reduzido |
| **305 – ARQ SANITÁRIOS** | ❌ | Prefixo "PLANTA BAIXA" removido das descrições |
| **307 – ARQ DIVISÓRIAS** | ❌ | Sem truncação de sufixo |
| **312 – ARQ SALA REUNIÕES** | ❌ | Normal |
| **313 – ARQ ELEVADORES** | ❌ | Normal |
| **351 – ARQ ESCADA FIXA** | ❌ | CEA QUADRO PISO PODOTÁTIL extraído |
| **304 – ARQ COPA** | ❌ | Último item PINTURA não descartado (BUG-10) |
| **309 – ARQ DESCOMPRESSÃO** | ❌ | Idem + NEVE não deduplicado |

---

## 131 — DEC PROVADORES (análise detalhada)

**Resultado:** 7 registros — 7 RODAPÉS corretos, 0 luminárias, 0 cantoneiras.

### BUG-131-A: R5 perdido — pdfplumber funde escala com descrição
A linha de R5 no PDF aparece fundida com rótulos de escala de outras vistas na mesma página:
```
ESC.: 1 : 75 ESC.: 1 : 75 ESC.: 1 : 75 RODAPÉ EM LAMINADO MELAMÍNICO REF. FORMICA PRATTAN L151,
```
`_RE_ESC` descarta essa linha inteira → `prev_desc` nunca recebe a descrição de R5 → `R5 43.68 H=10cm` não encontra `prev_desc` → item descartado.

**Fix:** coletar RODAPES também a partir de `raw_text_lines` (como as seções genéricas), não apenas de `text_lines`. Ou: usar `_RE_RODAPE_QTY` com fallback que busca a descrição também na raw lines.  
**Impacto:** +1 item (R5, presente em 341 e 131)

### BUG-131-B: Parser LU — QTD no início de linha, não no fim
Estrutura real da tabela LU:
```
LU01
EMBUTIDO REDONDO 1XLED COB
1000LM 36º, EMBUTIDA EM FORRO DE   [MODULO LED COB 1000LM]
7 GESSO, ACABAMENTO PINTURA         [10W]      ← QTD=7 está no INÍCIO da linha
BRANCA
```
O parser usa `_QTD_END = re.compile(r"\s+(\d{1,4})\s*$")` que ancora no fim da string. Para LU01, "7" aparece no começo de uma linha de continuação, não no fim → nunca detectado.

**Fix:** adicionar `_QTD_START = re.compile(r"^(\d{1,4})\s+\S")` como alternativa ao `_QTD_END` no parser LU. Quando a linha começa com 1–4 dígitos seguidos de espaço + texto → extrair como QTD + instalação note.  
**Atenção:** não confundir com linhas que começam com dimensões (ex: "1000LM", "14,4W") — usar filtro: QTD válido só se o número for ≤ 3 dígitos sem letra imediatamente após.

### BUG-131-C: LU02 — QTD distribuído em múltiplas linhas
LU02 tem quantidades parciais espalhadas no texto:
```
= 62m   (fita de LED — ml)
= 50    (perfil translúcido — un)
= 17 un (driver)
= 34 un (perfil alumínio)
8       (perfil 1000mm)
19      (perfil 1500mm)
```
Cada sub-item é um material/componente diferente. O parser LU atual trata LU como uma única luminária com QTD inteiro. Para LU02 seria necessário quebrar em 5–6 sub-itens distintos.

**Fix (complexidade alta):** tratar LU02 de forma especial — quando `lu_desc` contém `=` + número (padrão Revit schedule "= XX un"), extrair cada ocorrência como sub-item separado.  
**Alternativa (pragmática):** manter LU02 como item único com descrição parcial e QTD do total (ex: fita = 90ml ou total).

### BUG-131-D: "Cantoneiras Provadores" — tabela sem prefixo CEA
```
Cantoneiras Provadores
DECRIÇÃO     QUANT
PERFIL EM ALUMÍNIO EXTRUDADO...     50 UNID.
FITA DE LED 14,4W/m...              90,00ml
DRIVER MEANWELL...                  25
```
Nenhum cabeçalho `CEA -` → `parse_special_tables_from_text` não detecta.

**Fix (baixa prioridade):** adicionar `_HDR_CANTONEIRA = re.compile(r"^Cantoneiras?\s+Provadores?", re.IGNORECASE)` como header adicional, parseando as linhas seguintes com `_RE_SIMPLE_ROW`.

---

## 502 — LAY ÁREAS (análise detalhada)

**Resultado:** 0 confirmados, 14 aguardando — todo garbage da IA.

### BUG-502-A: `_RE_VISUAL_PRANCHA` não cobre "LAY ÁREAS"
O stem do arquivo é `"502-LAY ÁREAS"`. O pattern atual:
```
\b(CVS|COMUNICAÇÃO VISUAL|VINHETE|AXONOMÉTRICA|CORTE GERAL|DET LOGO|LAY[_\s]?OUT|ÁREAS? TOTAIS|LAYOUT)\b
```
- `LAY[_\s]?OUT` → cobre "LAYOUT" ou "LAY OUT", mas **não cobre "LAY ÁREAS"**
- `ÁREAS?\s+TOTAIS` → exige "TOTAIS", não casa com "ÁREAS" simples

Resultado: `_skip_partial_visual = False`. Como não há `CEA-QNT` no PDF (só `CEA - ÁREA ABL`, `CEA - ÁREA SALÃO DE VENDAS`, etc. que não batem com `_RE_CEA_SEC`), `has_cea = False`, `pdf_items = []`, `len == 0` → `extract_partial` dispara → captura linhas das NOTAS GERAIS e das tabelas de área como se fossem itens.

Esta prancha não tem NENHUM item de obra — é puramente informativa (áreas de referência ABL, SV, ADM, AVL, SETORES).

**Fix:** Expandir `_RE_VISUAL_PRANCHA` para cobrir "LAY ÁREAS":
```python
_RE_VISUAL_PRANCHA = re.compile(
    r"\b(CVS|COMUNICAÇÃO\s+VISUAL|VINHETE|AXONOM[EÉ]TRICA|CORTE\s+GERAL"
    r"|DET\.?\s+LOGO|LAY[_\s]?OUT|ÁREAS?\s+TOTAIS|LAYOUT|LAY\s+[ÁA]REAS?)\b",
    re.IGNORECASE
)
```
Ou mais simples: adicionar `\bLAY\b` ao pattern quando o contexto indica prancha visual. Mas `LAY\b` sozinho pode ser muito amplo — `LAY\s+[ÁA]REAS?` é mais seguro.

**Impacto:** 502 deve passar de 14 aguardando → 0.

---

## Possíveis novos problemas a observar

### P1 — Sufixo "FIXO"/"PAREDE" pode aparecer em outras seções LINEAR/QNTD
O buffer `pending` resolve o padrão de pdfplumber, mas se o sufixo tiver > 30 chars ele não será acoplado. Verificar na prática.

### P2 — Header "Família e tipo Comentários Contagem" na seção LOGO
Não é filtrado pelo header guard atual (`^(LEGENDA|METRO LINEAR|...)`). Adicionar "Família" ao guard se necessário.

### P3 — Prancha 341: item R4 inexistente no PDF (vai de R3 para R5)
Não é bug — tabela original pula R4. Apenas documentar.

### P4 — `_SECTION_END` em parse_special_tables_from_text
O padrão atual inclui `CEA\s*[-–]` como stop. Se uma tabela CEA especial contiver referência a outra CEA no texto, pode terminar prematuramente. Monitorar em 306 e 131.

---

## Ordem de execução recomendada (atualizada)

```
1. Re-testar 321 (fix BUG-11 PD prepend)              ← fix aplicado, validar
2. Re-testar 315 (fix BUG-6 suffix + noise)            ← fix aplicado, validar
3. Implementar BUG-306-A + B + C → re-testar 306      ← 9 itens recuperáveis
4. ✅ 601 COMUNICAÇÃO VISUAL — concluído (18/19)
5. Rodar 131 / 201 (LUMINÁRIAS — parser LU)
6. Rodar 501 / 502 / 311 / 203 (guards visuais)
7. Varredura das demais 9 pranchas do Grupo 3
```

### Impacto estimado do BUG-306

| Fix | Itens recuperados |
|-----|-------------------|
| BUG-306-A (não contaminar QTD) | PA 044, PD 030, PF 017, PM 001, PM 003, PM 006, PM 029 → **+7** |
| BUG-306-B (_SEC_END ampliado) | Remove 4 itens lixo |
| BUG-306-C (filtro índice) | Remove 3 dos 4 itens lixo |
| BUG-306-D (sem código, baixa prior.) | ALÇAPÃO + PORTA TAPUME → **+2** |

---

## Critério de conclusão

Implementação considerada estável quando:
- 321: 7 itens confirmados
- 315: 3 itens limpos (sem título de vista)
- 306: porta(s) extraída(s) com qtd numérica
- 601: ≥ 10 itens CV_XXX
- 131/201: pelo menos 1 luminária LU extraída
- 501/502/311/203: zero ou mínimo de aguardando (sem lixo visual)
