# Relatório: Extração PDF vs Gabarito Celmar BLN

> **Projeto:** CEA-254 · Shopping Norte Blumenau · Loja Nova Full  
> **Referência:** `Gabarito Celmar BLN.md` (exportação de `1ª Proposta CELMAR BLN.xlsx`)  
> **Fonte analisada:** saída bruta da extração PDF do módulo `orcamento-construtora`  
> **Data:** 24/06/2026

---

## 1. Resumo executivo

A extração PDF captura **quantitativos de projeto** presentes nas pranchas arquitetônicas (tabelas de acabamentos, legendas de caixilhos, memoriais de piso/forro). O gabarito contém **~160 itens com quantidade > 0** na proposta Celmar, incluindo custos indiretos, serviços globais e detalhamento de provadores que **não existem como tabela no PDF**.

| Métrica | Valor |
|---|---|
| Pranchas processadas | 28 |
| Pranchas com extração útil | 21 |
| Pranchas vazias / pendentes IA | 7 |
| Itens únicos extraídos (deduplicados, estimativa) | ~85 linhas de orçamento |
| Match exato ou ±5% vs gabarito | **~28 itens** |
| Match parcial (5–15%) | **~5 itens** |
| Divergência relevante ou ausente | **~35+ itens** |
| Fora do escopo de PDF (custos indiretos, MO, etc.) | **~90 itens** |

**Conclusão:** a extração está **forte em acabamentos quantificados nas pranchas civis** (piso vinílico, forro, rodapés, divisórias, portas codificadas, RFID, cerâmica de parede, laminados de provador). Está **fraca ou ausente** em custos indiretos, serralheria estrutural, marcenaria detalhada de provadores (unidades), mobiliário ADM, granitos/bancadas, louças, e pranchas gráficas/axonometricas.

---

## 2. Cobertura por prancha

| Prancha | Status | Itens | Observação |
|---|---|---:|---|
| R02-203 INT AXONOMETRICAS | IA_NECESSARIA | 0 | Conteúdo gráfico 3D — sem tabelas |
| R02-302 ARQ TAPUME | DIRETO | 1 | Tapume 104 m² ✓ |
| R02-303 AREA TÉCNICA | DIRETO | 37 | Paredes + GLOBAL_SCAN ambientes |
| R02-305 ARQ SANITARIOS | DIRETO | 28 | Paredes + pintura + duplicatas |
| R02-306 ARQ CAIXILHOS | IA_NECESSARIA | 18 | Portas/esquadrias ✓ (mesmo com flag IA) |
| R02-307 ARQ DIVISORIAS | DIRETO | 22 | Repete tabela de paredes |
| R02-308 CORREIO PNEUMATICO | SEM_CONTEUDO | 0 | Esperado — detalhe pontual |
| R02-310 PAREDE CREMALHEIRAS | IA_NECESSARIA | 0 | **Gap:** cremalheiras não extraídas |
| R02-311 CORTES GERAIS | DIRETO | 0 | **Gap:** cortes sem quantitativo |
| R02-312 SALA DE REUNIOES | DIRETO | 22 | Pisos + rodapés + pintura |
| R02-313 ELEVADORES | DIRETO | 23 | Repete piso/rodapé |
| R02-314 ARQ DOCA | IA_NECESSARIA | 0 | **Gap:** doca/porta corta-fogo |
| R02-315 ARQ ESTANTES | IA_AUDITORIA | 2 | Linear 273,93 ml + 131 pontos |
| R02-341 FACHADAS E VITRINES | DIRETO | 8 | Só rodapés (faltam ACM/vidro aqui) |
| R02-351 ESCADA FIXA | IA_NECESSARIA | 1 | Podotátil 16 un ✓ |
| R02-602 CVS VINHETES | IA_NECESSARIA | 0 | CV parcialmente em R03-601 |
| R03-131/132 DEC PROVADORES | DIRETO / AUDITORIA | 8 / 0 | Rodapés ok; **decoração provadores vazia** |
| R03-201 INT ILUMINAÇÃO | IA_AUDITORIA | 8 | Wall washers — unidade errada (m²) |
| R03-301 ARQ CIVIL | DIRETO | 62 | **Prancha mais completa** |
| R03-304 ARQ COPA | DIRETO | 6 | Pintura + cerâmica parede |
| R03-309 DESCOMPRESSÃO | DIRETO | 25 | Paredes + pintura |
| R03-321 ARQ FORRO | DIRETO | 8 | Forros por PD ✓ |
| R03-331 ARQ PISO | DIRETO | 19 | Pisos + rodapés + grama sintética |
| R03-501 LAY LAYOUT | IA_AUDITORIA | 64 | Ambientes comerciais (áreas, não orçamento) |
| R03-502 LAY ÁREAS | IA_AUDITORIA | 13 | ABL/AVL — metragens de referência |
| R03-601 CVS COMUNICAÇÃO VISUAL | IA_NECESSARIA | 18 | Itens CV (fora do gabarito civil) |

---

## 3. O que está funcionando bem

Itens em que a extração PDF **bate ou aproxima** o gabarito (±5%, salvo nota):

### 3.1 Quantidades com match forte

| Cód. gabarito | Descrição | PDF | Gabarito | Δ |
|---|---|---:|---:|---|
| **14.1** | Piso vinílico SV (rustico + stone) | 1.019,77 m² | 1.024,98 m² | −0,5% |
| **12.9** | Forro gesso tabicado (soma PDs) | 1.445,19 m² | 1.457,44 m² | −0,8% |
| **25.1** | RFID | 158 m² | 158 m² | 0% |
| **22.3** | Laminado branco provadores | 243 m² | 243 m² | 0% |
| **22.1** | Laminado ártico provadores | 42 m² | 42 m² | 0% |
| **22.14** | Rodapé MDF Tarkett cabines | 99,26 ml | 99,30 m | 0% |
| **22.15** | Rodapé fórmica Prattan | 43,68 ml | 43,70 m | 0% |
| **25.4** | Rodapé escada provadores granito | 16,21 ml | 16,21 ml | 0% |
| **25.5** | Rodapé MDP tablado vitrine | 5,05 ml | 5,05 ml | 0% |
| **10.2** | Impermeabilização sanitários | 28,87 m² | 28,87 m² | 0% |
| **13.2** | Porta divisória sanitário | 10 un | 10 un | 0% |
| **13.3** | Porta divisória alavanca | 3 un | 3 un | 0% |
| **14.6** | Piso podotátil | 16 un | 16 vb | 0% |
| **14.13** | Rodapé madeira 7 cm | 42,50 ml | 42,50 ml | 0% |
| **18.4** | Pintura branco neve | 60 m² | 60 m² | 0% |
| **18.8** | Pintura Diário de Menina | 15 m² | 15 m² | 0% |
| **20.2** | Porta madeira 0,72 m | 2 un | 2 un | 0% |
| **20.3** | Porta madeira 0,82 m | 6 un | 6 un | 0% |
| **21.14** | Caixa hidrante | 3 un | 3 un | 0% |
| **21.15** | Vidro hidrante | 3 un | 3 un | 0% |
| **25.2** | Alvenaria bloco celular (omissos) | 10 m² | 10 m² | 0% |
| **15.1** | Cerâmica/azulejo parede | 80 m² | 81 m² | −1,2% |
| **10.1** | Manta impermeabilizante | 42,96 m² | 43,70 m² | −1,7% |
| **19.4** | Vidro temperado vitrine | 12 m² | 11,61 m² | +3,4% |
| **14.14** | Rodapé madeira 20 cm | 134,03 ml | 140,39 ml | −4,5% |
| **14.5** | Rodapé Primer Tarkett SV | 131,70 ml | 130,84 ml | +0,7% |
| **12.11** | Alçapão forro | 14 un | 15 un | −6,7% |
| **23.4** | ACM fachada | 52 m² | 55,68 m² | −6,6% |
| **9.5** | Alvenaria bloco concreto | 204 m² | 230 m² | −11,3% |
| **25.7** | Grama sintética descompressão | 8,58 m² | 10 m² | −14,2% |

### 3.2 Capacidades técnicas que funcionam

- **Tabelas de acabamento de paredes** (`PAREDES`): leitura consistente de drywall, divisórias, laminados, vidros, ACM.
- **Aba PISOS / RODAPES / FORROS**: separação correta por tipo de elemento.
- **Legendas de caixilhos** (R02-306): códigos PA/PD/PF/PM/PV com quantidades unitárias.
- **RFID dedicado** (`RFID_PAREDES_RFID`): total 158 m² capturado na prancha civil.
- **Estantes** (R02-315): linear + pontos extraídos (ver divergência de mapeamento abaixo).
- **Tapume** (R02-302): 104 m² — projeto traz quantidade mesmo com item zerado na proposta (2.1).
- **Comunicação visual** (R03-601): códigos CV extraídos com quantidade (não estão no gabarito civil).

### 3.3 Taxa de confirmação

Todos os itens listados na saída aparecem como **`[✓] confirmados`** — não há itens aguardando revisão na extração bruta. O gargalo está em **cobertura** e **mapeamento para códigos da planilha**, não em confiança dos itens já extraídos.

---

## 4. O que está faltando na extração PDF

Itens presentes no gabarito com **QDE > 0** que **não aparecem** ou aparecem **incompletos/incorretos** na extração.

### 4.1 Pranchas sem nenhuma extração (gaps estruturais)

| Gap | Cód. gabarito afetados | Impacto |
|---|---|---|
| R02-310 Cremalheiras | 21.x painéis vendas | Estrutura de estantes/painéis |
| R02-311 Cortes gerais | 12.x, 18.x | Detalhes verticais |
| R02-314 Doca | 8.15 porta corta-fogo | 1 un — esquadria crítica |
| R02-308 Correio pneumático | 24.15 portinhola | 1 un |
| R03-132 Dec provadores | 22.7–22.13, 22.18–22.26 | **Maior gap de provadores** |
| R02-602 Vinhetas CV | — | Parcialmente coberto em R03-601 |

### 4.2 Itens de orçamento ausentes (por seção)

#### Seção A — Custos indiretos (100% ausente)

Todos os itens 1.1–5.1, 2.2–2.9, 3.1–3.5, 4.1–4.5: ART, seguro, topografia, EPI, vigilância, canteiro, entulho, engenheiro, limpeza, etc.  
**Motivo:** não constam nas pranchas ARQ — são premissas contratuais da construtora.

#### Seção 8 — Serralheria / estruturas metálicas

| Cód. | Descrição | QDE gabarito |
|---|---|---:|
| 8.5 | Guarda-corpo ferro escada/mezanino | 19 m |
| 8.6 | Estrutura metalon fachada | 1 vb |
| 8.8 | Estrutura septo AC | 1 vb |
| 8.9 | Estrutura porta enrolar | 1 vb |
| 8.11 | Adequação elevador | 1 vb |
| 8.14 | Porta ferro C. Máquinas | 1 un |
| 8.15 | Porta corta-fogo docas | 1 un |
| 8.18–8.19 | Visores back office / gerência | 2 un |

Extraído parcialmente: **PA 044** porta enrolar (1 un), **PF 017/025** portas ferro — mas **não mapeados** aos códigos 8.x da planilha.

#### Seção 9 — Civil complementar

| Cód. | Descrição | QDE | Status PDF |
|---|---|---:|---|
| 9.7 | Chapisco e emboço | 460 m² | **Ausente** |
| 9.3 | Sóculos bancadas | 1 vb | Ausente |
| 9.4 | Bases concreto equipamentos | 1 vb | Ausente |
| 9.12 | Furação lajes | 1 vb | Ausente |
| 9.13 | Arremates gerais | 1 vb | Ausente |

#### Seção 12 — Gesso (mapeamento incompleto)

| Cód. | Descrição | QDE gab. | PDF | Problema |
|---|---|---:|---:|---|
| 12.1 | Drywall STD 1 face | 672 m² | 385 m² (ST 825) | Soma parcial / nomenclatura diferente |
| 12.2 | Drywall STD 2 faces | 274 m² | 182 m² | Falta ST+RFID 55 m² + ST/ST parcial |
| 12.3 | Drywall RU 1 face | 40,84 m² | 98 m² (umidade) | **Classificação cruzada** com 12.4 |
| 12.4 | Drywall RU 2 faces | 98 m² | — | Não identificado separadamente |
| 12.5 | Drywall RF 1 face | 3 m² | — | Ausente |
| 12.7 | Reforço cedrinho | 1 vb | — | Ausente |
| 12.12 | Aberturas forro (luminárias) | 176 un | — | Ausente |
| 12.13 | Reforço placas CV / trilho | 1 vb | — | Ausente |

#### Seção 13 — Divisórias

| Cód. | Descrição | QDE gab. | PDF | Problema |
|---|---|---:|---:|---|
| 13.1 | Fecham. Divilux 35 | 30 m² | 13 m² | Só uma linha; falta consolidar 29 m² sanitários |
| 13.5 | Porta box chuveiro | 2 un | — | Ausente |

#### Seção 14 — Pisos (serviços MO)

| Cód. | Descrição | QDE | Status |
|---|---|---:|---|
| 14.2 | Autonivelante | 1.024,98 m² | **Ausente** (só área de material) |
| 14.11 | Assentamento cerâmico piso ADM | 361 m² | **Ausente** (só cerâmica parede 80 m²) |
| 14.8 | Soleira granito Branco Ceará | 11,4 ml | **Ausente** como ml |
| 14.7 | Sóculo granito vitrine | 7,12 ml | Ausente |
| 14.16 | Revestimento escada ardósia | 1 vb | Ausente |
| 14.17 | Escada podotátil + fita | 1 cj | Parcial (só 16 placas podotátil) |

#### Seção 15–17 — Revestimentos, granitos, louças

| Cód. | Descrição | QDE |
|---|---|---:|
| 15.2 | Perfil alumínio azulejo | 23 m |
| 15.3 | Cantoneira alumínio | 12 m |
| 16.1–16.4 | Bancadas/nichos granito | 4 itens |
| 17.1–17.2 | Cubas inox/louça | 5 un |

#### Seção 18 — Pintura (agregação errada)

O PDF traz **subtotais por prancha**, não o **total de proposta**:

| Cód. | Descrição | QDE gab. | PDF | Nota |
|---|---|---:|---:|---|
| 18.3 | Pintura branco gelo vendas | 1.153 m² | 371 m² | Falta agregar pranchas / zonas |
| 18.5 | Pintura branco gelo ADM | 708 m² | (em 371?) | Não separado |
| 18.10 | Pintura forro vendas | 1.044 m² | 663 m² | Parcial |
| 18.11 | Pintura forro ADM | 408 m² | — | Não separado |
| 18.2 | Esmalte amarelo bases | 1 vb | — | Ausente |
| 18.18 | Pintura corrimão epóxi | 39,9 ml | — | Ausente |

#### Seção 19 — Vidros/espelhos

| Cód. | Descrição | QDE | PDF |
|---|---|---:|---|
| 19.1 | Espelho sobre bancada sanitário | 4 un | 7–8 m² (unidade errada) |
| 19.2 | Espelho vestiário | 2 un | — |

#### Seção 20 — Portas madeira (parcial)

Extraídas PM/PD/PF, mas **faltam**:

| Cód. | Descrição | QDE |
|---|---|---:|
| 20.4 | Porta cantina c/ visor | 1 un |
| 20.5 | Porta CFTV c/ visor | 1 un |
| 20.6 | Mola porta | 2 un |
| 20.7 | Tetra-chave | 1 un |
| 20.8 | Prendedor porta | 4 un |

#### Seção 21 — Marcenaria vendas

| Cód. | Descrição | QDE | PDF |
|---|---|---:|---|
| 21.4 | Réguas união painéis | 10 m | — |
| 21.6 | Revestimento colunas | 3 un | — |
| 21.10–21.13 | Portas ártico TX | 4 un | Parcial (PM 045 etc.) |
| 21.16 | Arquibancada tablado | 1 un | 3,14 m² OSB (unidade errada) |
| 21.18–21.21 | Estrados vitrine, fixadores | vários | Parcial/ausente |

#### Seção 22 — Provadores (maior lacuna)

Extraídos **m² de laminado** e **rodapés**. **Não extraídos** (detalhamento unitário):

| Cód. | Descrição | QDE gab. |
|---|---|---:|
| 22.2 | Laminado gelo L106 | 25 m² |
| 22.5 | Laminado Prattan L151 | 30 m² |
| 22.7–22.13 | Laterais, colunas, frontais, travessas | 24–50 un cada |
| 22.18–22.19 | Espelhos cabine + chassis | 25+25 un |
| 22.21 | Porta provador 70 cm | 21 un |
| 22.24–22.26 | Portas PNE/família/correr | 4 un |
| 22.28–22.31 | Cabideiros, tubos inox PNE | 36 un |

#### Seção 23 — Fachadas

| Cód. | Descrição | QDE | PDF |
|---|---|---:|---|
| 23.2 | Tablado vitrine MDP | 1 un | — |
| 23.9 | Rodapé inox 200 mm | 9,36 m | 9,88 ml H=10 cm (próximo) |
| 23.1 | Cantoneira alumínio | 2 un | — |

#### Seção 24 — Mobiliário ADM

**100% ausente** (armários, bancadas copa, locker, bebedouro, lixeiras, etc.) — 17 itens com QDE > 0.

#### Estantes — mapeamento

| PDF | Gabarito 14.15 |
|---|---|
| 273,93 ml linear + 131 pontos | 108 peças (montagem) |

A extração traz **métrica de projeto** (linear de cremalheira + pontos); o gabarito pede **peças montadas**. Requer regra de conversão, não leitura literal.

---

## 5. O que não pode ser obtido por extração de texto/PDF

Estes itens **não são estimáveis** a partir das pranchas ARQ com extração textual/tabelada. Devem entrar por **tabela fixa**, **IA sobre desenho**, ou **input manual**.

### 5.1 Fora do documento (contrato / premissa)

- **Toda a Seção A** — custos indiretos (~R$ 234 mil): mobilização, equipe, canteiro, ART, seguro, topografia.
- **Preços unitários** (MAT, M.O., Total) — planilha comercial, não projeto.
- **Itens “fornecido C&A”** — escopo de material do cliente (piso vinílico, cerâmica, estantes metálicas).
- **Contratação direta C&A** — mezanino, escada metálica, painel wall (8.1–8.3).
- **Serviços globais** — 14.2 autonivelante, 14.1 MO assentamento (só área inferível).

### 5.2 Exige interpretação visual / prancha não tabular

- **Axonometrias** (R02-203) — volumes 3D sem quantitativo.
- **Detalhes constructivos** em corte (R02-311) — espessuras, ferragens, fixações.
- **Decoração provadores** (R03-132) — elevações/desenhos executivos com peças unitárias.
- **Cremalheiras / painéis** (R02-310) — layout gráfico de estantes.
- **Contagem de aberturas de forro** (12.12 — 176 und) — requer cruzamento com projeto elétrico/HVAC.
- **Guarda-corpos, estruturas metalon** — detalhes em pranchas estruturais ou notas de serviço.

### 5.3 Agregação multi-zona / multi-prancha

- **Pintura 18.3 + 18.5** — gabarito separa vendas vs ADM; PDF repete parcialmente em várias pranchas sem deduplicação por zona.
- **Drywall 12.1–12.6** — projeto usa siglas (ST, RF, RU, RFID, espessuras); planilha usa “1 face / 2 faces”. Exige **motor de mapeamento**, não OCR puro.
- **Chapisco/emboço 9.7** — derivado de área de alvenaria × fator; não aparece como linha nas tabelas de acabamento.

### 5.4 Ruído que não vira orçamento

Extraído mas **não correspondente** a linhas do gabarito:

- **GLOBAL_SCAN** — nomes de ambientes com m² (SALÃO DE VENDAS, RESERVA, CALÇADOS ACE…) → úteis para layout, não para CC 810xxx.
- **Layout comercial** (R03-501) — 64 zonas de merchandising.
- **Áreas ABL/AVL** (R03-502) — metragens de locação.
- **Comunicação visual** (CV_711, CV_5137…) — escopo de outro fornecedor; não está na planilha civil Celmar.
- **Wall washers** — luminárias com quantidade em m² incorreta; gabarito nem possui linha equivalente na civil.

---

## 6. Problemas de qualidade na extração atual

### 6.1 Duplicação entre pranchas

Mesma tabela de paredes repetida em **R02-303, 305, 307, R03-301, 309** sem deduplicação global. Infla contagem bruta (~400+ linhas) vs ~85 únicas.

### 6.2 Poluição de cabeçalho

Exemplos capturados como item:

- `PLANTA BAIXA 2º PAVIMENTO - ADM PAREDE MDF LAMINADO...`
- `CÓDIGO DESCRIÇÃO ÁREA PERIM.`
- `ACARTONADO 264.34`
- Texto de elevação colado em pintura (`04 - ELEVAÇÃO DESCOMPRESSÃO`)

### 6.3 Unidades inconsistentes

| Item | PDF | Esperado |
|---|---|---|
| Espelho padrão C&A | 7–8 m² | un (4+2 no gabarito) |
| Wall washers | m² | un |
| Arquibancada OSB | 3,14 m² | un (21.16) |
| Soleira Cinza Andorinha | ~~1,49 m²~~ **5,88 ml** (R03-331) | 5,88 ml |
| Soleira Branco Ceará | 22,62 ml (soma comprimentos) | 11,4 ml — regra de agregação |

### 6.4 Itens parcialmente mergeados

Na prancha R03-301:

- `PM 014 ... PM 029 PORTA DE MADEIRA TIPO VAI-VEM` — duas portas em uma linha.
- `PM 006` ausente como linha isolada (presente em R02-306).

### 6.5 Divergências numéricas a investigar

| Item | PDF | Gabarito | Hipótese |
|---|---:|---:|---|
| Fecham. Divilux (13.1) | 42 m² (13+29) | 30 m² | Soma fechamento + divisorias sanitário; possível dupla contagem |
| Epóxi piso (18.1) | 64,69 m² | 39,61 m² | Pode incluir área além da técnica |
| Estantes | 131 pt | 108 pç | Métricas diferentes (ponto vs peça) |

---

## 7. Matriz resumida por centro de custo

| Centro de custo | Cobertura PDF | Comentário |
|---|---|---|
| 810080 Administração obra | ❌ Nenhuma | Custos indiretos |
| 810020 Adaptação shell | ⚠️ Parcial | Demolições/elevador não explícitos |
| 810021–810031 Serralheria/esquadrias | ⚠️ Parcial | Caixilhos ok; estruturas vb ausentes |
| 810030 Alvenaria/divisórias | ✅ Boa | Alvenaria, divisórias, portas sanitário |
| 810040 Revestimentos parede | ⚠️ Parcial | Cerâmica ok; perfis/granitos não |
| 810041 Pinturas | ⚠️ Parcial | Cores ok; totais por zona incompletos |
| 810051 Piso ADM/reserva | ⚠️ Parcial | Rodapés/imp. ok; cerâmico piso ADM não |
| 810230 Forro vendas | ✅ Boa | 12.9 ~99% match |
| 810250 Piso vendas | ✅ Boa | Vinílico ~99% match |
| 810260 Fachadas | ⚠️ Parcial | ACM/vidro ok; tablado/estrutura não |
| 810210 Painéis vendas | ⚠️ Parcial | Laminados/hidrante; colunas/réguas não |
| 810213 Provadores | ⚠️ M² only | Falta detalhamento unitário (22.7+) |
| 810162 Mobiliário ADM | ❌ Nenhuma | Pranchas DEC não extraídas |
| Omissos 25.x | ✅ Boa | RFID, celular, rodapés, grama |

---

## 8. Recomendações

1. **Deduplicar globalmente** por `(descrição normalizada, unidade)` antes de comparar com gabarito — usar R03-301 como fonte primária para civil.
2. **Implementar mapa PDF → código planilha** para drywall (ST/RF/RU/1F/2F) e pintura (por zona vendas/ADM).
3. **Marcar pranchas IA_NECESSARIA** para pipeline vision: 310, 314, 132, 602, 203.
4. **Separar escopo** “quantitativo de projeto” vs “linha de orçamento” — GLOBAL_SCAN e layout não devem ir para checklist Celmar.
5. **Conversão estantes**: regra `linear + pontos → peças` ou manter métrica de projeto separada do 14.15.
6. **Custos indiretos (Seção A)**: pré-preencher da planilha; nunca esperar do PDF.
7. **Provadores 22.x**: exigir prancha DEC + IA auditoria; m² de laminado sozinho cobre ~15% do CC 810213.

---

## 9. Conclusão

| Categoria | % estimado do gabarito (por valor ou itens QDE>0) |
|---|---|
| ✅ Funcionando (match útil) | ~35–40% dos quantitativos de projeto |
| ⚠️ Parcial / divergente | ~25–30% |
| ❌ Ausente na extração | ~25–30% |
| 🚫 Não extraível por PDF/texto | ~30–35% (overlap com ausente) |

A extração PDF **já serve como base sólida** para: piso vinílico, forro, impermeabilização, rodapés, laminados de provador (m²), portas codificadas, RFID, cerâmica de parede, caixilhos e tapume.

Para **fechar o orçamento Celmar**, ainda falta: custos indiretos, provadores unitários, mobiliário ADM, serralheria estrutural, granitos, serviços de MO (autonivelante, assentamentos), deduplicação/agregação de pintura e gesso, e pranchas pendentes de IA visual.

---

*Gerado por comparação automatizada (`compare_pdf_gabarito_bln.py`) + revisão manual contra `Gabarito Celmar BLN.md`.*

---

## 10. Anexo — Segundo chunk (pranchas R03 civil)

Análise detalhada da saída **BRUTO / RUIDO / LIMPO** do segundo lote enviado, com foco nas tabelas `CEA - QNT ...` e `CEA - QUADRO DE ...` que são a fonte autoritativa para quantitativos.

### 10.1 Fonte primária por prancha (política de deduplicação)

| Prancha | Tabela autoritativa | Uso no orçamento |
|---|---|---|
| **R03-301** | `CEA - QNT PAREDES`, `QNT PINTURA`, `QUADRO DE PORTAS`, `QUADRO DE ÁREAS` | Drywall, pintura parede, portas PM, áreas globais |
| **R03-321** | `CEA - QNT FORROS` | Forro 12.9 — total **1.457,44 m²** |
| **R03-331** | `CEA - QNT PISOS`, `QNT RODAPÉS`, `CEA -QNT SOLEIRAS` | Vinílico, cerâmica ADM, rodapés, soleiras |
| **R03-501** | Nota layout **194 estantes / 26.194 peças** | Referência de merchandising — **≠ 14.15 (108 pç montagem)** |
| **R03-502** | ABL / AVL / SV | Metragens de locação — não entram no checklist civil |
| **R03-601** | `CEA - COMUNICAÇÃO VISUAL` | CV_5145, CV_5146 etc. — escopo outro fornecedor |
| **R03-201** | `CEA - QUADRO DE LUMINÁRIAS` | Specs + quantidades misturadas — filtradas como `[not_budget_relevant]` |
| **R03-304 / 309** | Repetem subconjuntos de paredes/pintura | Ignorar após merge com R03-301 |

### 10.2 O que o chunk 2 confirma que funciona bem

| Cód. | Item | PDF (LIMPO) | Gabarito | Status |
|---|---|---:|---:|---|
| **12.9** | Forro gesso tabicado | 1.445,19 m² (R03-321) | 1.457,44 m² | OK −0,8% |
| **14.1** | Piso vinílico SV | 1.019,77 m² (R03-331) | 1.024,98 m² | OK −0,5% |
| **14.11** | Cerâmica piso ADM P3 | 362,24 m² (350,88+11,36) | 361 m² | OK +0,3% |
| **14.19** | Soleira Cinza Andorinha | **5,88 ml** (soma 2ª dim.) | 5,88 ml | OK 0% |
| **14.5–14.14** | Rodapés madeira/Tarkett | R03-331 QNT RODAPÉS | ±5% | OK |
| **13.2 / 13.3** | Portas divisória | QUADRO DE PORTAS R03-301 | 10+3 un | OK |
| **25.1** | RFID | QNT PAREDES | 158 m² | OK |
| **22.1 / 22.3** | Laminados provador | R03-301 / DEC | 42+243 m² | OK |

**Destaque:** a tabela `CEA -QNT SOLEIRAS` (R03-331) estava **presente no LIMPO** mas não entrava no comparador — interpretando a **2ª dimensão como comprimento linear**, Cinza Andorinha bate exatamente o gabarito.

### 10.3 Lacunas confirmadas no chunk 2 vs gabarito

| Cód. | Item | Situação no PDF | Impacto |
|---|---|---|---|
| **9.7** | Chapisco/emboço | Derivado de alvenaria — não há linha | MISSING |
| **12.4 / 12.5** | Drywall RU 2F / RF 1F | Siglas no QNT PAREDES sem mapeamento | MISSING |
| **12.1 / 12.2** | Drywall ST 1F/2F | 431 / 182 m² vs 672 / 274 m² | DIFF — classificação ST vs gabarito |
| **12.3 vs 12.4** | Drywall RU | 98 m² numa linha; gabarito separa 40,84 + 98 | Possível troca de código |
| **14.8** | Soleira Branco Ceará | 4 linhas (6,66+7,38+7,25+1,33 = **22,62 ml**) | DIFF vs 11,4 ml — regra de negócio |
| **14.15** | Montagem estante | Layout 194 und / 26.194 pç; gab 108 pç | Métrica incompatível |
| **18.3+18.5** | Pintura branco gelo | 371 m² parcial na QNT PINTURA | Falta split vendas/ADM + dedup |
| **18.10+18.11** | Pintura forro | 663 m² acartonado | Falta split vendas/ADM |
| **12.12** | Aberturas forro (176 und) | Não tabular | MISSING |
| **Seção A** | Custos indiretos | Ausente em todas as R03 | Fora do PDF |

### 10.4 Presente no PDF mas não confiável só com texto

1. **R03-201 — Luminárias:** quadro mistura modelo, potência, fluxo e quantidade; pipeline marca como `[not_budget_relevant]`. Contagem de **176 aberturas de forro (12.12)** exige cruzamento elétrico/HVAC.

2. **R03-501 — Layout:** 64 zonas comerciais + nota “194 estantes” é **layout de merchandising**, não linha 14.15 (montagem em peças). Conversão linear/pontos → peças não está no texto.

3. **R03-601 — CV:** itens `CV_5145: 23`, `CV_5146: 23` etc. são comunicação visual — não constam no gabarito civil Celmar.

4. **R03-502 — ABL/AVL/SV:** áreas de locação úteis para validação, não para CC 810xxx.

5. **Duplicação inter-prancha:** R03-304, R03-309 e cabeçalhos de R03-321/331 repetem trechos de QNT PAREDES/PINTURA já consolidados em R03-301 — sem dedup global, infla BRUTO.

6. **Drywall/pintura:** siglas de projeto (ST, RF, RU, RFID, espessuras 825/950 mm) ≠ nomenclatura planilha (1 face / 2 faces, vendas vs ADM). Exige **motor de mapeamento**, não OCR.

### 10.5 Resultado atualizado do comparador (`compare_pdf_gabarito_bln.py`)

Após incorporar R03-331 (soleiras) e R03-301 (fechamento 13+29):

| Status | Quantidade (subset ~48 itens) |
|---|---:|
| OK (≤5%) | **28** |
| CLOSE (5–15%) | **5** |
| DIFF | **10** |
| MISSING | **5** |

**Novos OK:** 14.19 soleira Cinza, 14.11 cerâmica piso ADM.  
**Ainda DIFF críticos:** drywall 12.x, pintura 18.3/18.10, soleira Branco 14.8, estantes, epóxi 18.1.

### 10.6 Próximos passos sugeridos (chunk 2)

1. Parser dedicado para `CEA -QNT SOLEIRAS` → ml pela 2ª dimensão; regra de negócio para Branco Ceará (metade das entradas?).
2. Agregador drywall: mapear linhas QNT PAREDES → códigos 12.1–12.6 antes de comparar.
3. Merge pintura: somar QNT PINTURA de R03-301 + pranchas zonais, deduplicar, split vendas/ADM.
4. Ignorar R03-501/502/601 no pipeline civil; manter em escopo separado.
5. Expandir `PDF` dict do comparador dos ~48 atuais para cobertura dos 160 códigos com QDE > 0.
