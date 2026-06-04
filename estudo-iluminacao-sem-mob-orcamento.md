# Estudo: Prancha INT-201 (INT ILUMINAÇÃO SEM MOB) → Orçamento CELMAR BLN

## O que a prancha 201 contém

A prancha 201 é a planta de **iluminação interior sem mobiliário** — uma prancha de instalações (MEP), não de arquitetura civil. Ela documenta o posicionamento, tipo e quantidade de cada luminária em toda a loja. O prefixo "INT" (Interior) a distingue das pranchas "ARQ" (Arquitetura) e "CVS" (Comunicação Visual).

| Elemento | Descrição |
|---|---|
| 201 — Térreo Iluminação (grande planta) | Planta completa do térreo com todos os pontos de luz: spots (cruzes rosa/vermelhas), trilhos LED (retângulos ciano), emergências e outros — denso grid de símbolos sobre o forro |
| 202 — Mezanino SCM Mobília (planta inferior) | Planta do mezanino/2º pavimento com iluminação dos provadores, ADM e circulações |
| CÉA — Quadro de Luminárias (tabela central) | Finish schedule de luminárias: código, descrição, quantidade — **fonte direta para contagem de aberturas no forro** |
| Corte Orientativo Altura Instalações (canto direito) | Corte esquemático mostrando altura de instalação de cada camada: forro, trilho, spot, AC, etc. |
| LUM-01 — DET-01 (detalhe base) | Detalhe de montagem de spot no forro — profundidade de embutimento |
| LJ EX0365007 — DET-02 | Detalhe de luminária específica |
| LUM DET-03 | Detalhe de outro tipo de luminária |
| Ampliação (corte esquemático 1:1) | Ampliação circular — detalhe de rosácea ou spot de superfície |
| LJ R004003728 — DET-04 | Detalhe de trilho de iluminação (track light) |
| Ampliação (planta esquemática) | Vista superior do detalhe de trilho |
| Notas Gerais (coluna direita) | Requisitos de instalação, referências de normas, responsabilidades |
| Dados de projeto | ILUMINÂNCIA SALÃO DE VENDAS: **2.711,66 lux** / MÉDIA: **1.501,85 lux** |

---

## A lógica desta prancha no orçamento civil

```mermaid
flowchart LR
    PRANCHA["Prancha INT-201\nILUMINAÇÃO SEM MOB"]

    PRANCHA --> LUM["Luminárias\n(spots, trilhos LED, emergência)"]
    PRANCHA --> TRILHO["Trilho de iluminação\n(track lights)"]
    PRANCHA --> PLANTA["Planta de pontos\n(posições no forro)"]

    LUM -->|"Fornecimento: C&A Brand\nInstalação: eletricista\n(orçamento elétrico separado)"| FORA["Fora do escopo\ncivil Celmar"]
    TRILHO -->|"Fornecimento: C&A Brand"| FORA

    PLANTA -->|"Cada ponto de luz\n= 1 abertura no forro\nde gesso"| I1["12.12 — Abertura no forro\npara luminários/spots/difusores\n176 unid — R$ 6.160"]

    TRILHO -->|"Reforço estrutural\nno forro para trilho"| I2["12.13 — Reforço: placas\naéreas cv + trilho vitrine\n1 vb — R$ 3.789"]

    PRANCHA -->|"Fixadores de teto\n(pendentes/fixtures)"| I3["21.21 — Fixadores de teto\n6 unid — R$ 939"]
```

**Princípio central:** a Celmar não instala luminárias, mas **faz os buracos** no forro de gesso para elas. Cada símbolo de spot ou grelha na planta de iluminação = 1 unidade do item `12.12`. O Quadro de Luminárias é a fonte de contagem que justifica as **176 unidades** orçadas.

---

## Mapeamento: Fonte na imagem → Linha no XLSX

```mermaid
flowchart TD
    PRANCHA["Prancha INT-201 ILUMINAÇÃO SEM MOB"]

    PRANCHA --> QUAD_L["CÉA — Quadro de Luminárias\n(contagem por tipo de luminária)"]
    PRANCHA --> GRID["Grid de símbolos no forro\n(posição de cada ponto de luz)"]
    PRANCHA --> TRILHO_DET["DET-04 — Trilho de iluminação\n(tipo de suporte no forro)"]
    PRANCHA --> CORTE_H["Corte altura instalações\n(altura do forro vs. estrutura)"]
    PRANCHA --> NOTAS["Notas Gerais\n(responsabilidades eletricista vs. civil)"]

    QUAD_L --> SOMA["Soma de todas as luminárias\nque requerem abertura no forro\n= 176 unid"]
    GRID --> SOMA

    SOMA --> I1["12.12 — Abertura no forro\npara luminários/spots/difusores\n176 unid — M.O. R$35/unid\nTotal R$ 6.160"]

    TRILHO_DET --> I2["12.13 — Reforço estrutural\ntrilho vitrine + placas aéreas cv\n1 vb — R$ 3.789"]

    CORTE_H --> REF["Referência para coordenação:\naltura do forro → `12.9`\npé-direito confirmado → `Cortes Gerais`"]

    NOTAS --> FLAG["Luminárias = C&A supply\nEletricista = contratação direta\nNão geram MAT no XLSX civil"]

    I1 --> ORC["Orçamento XLSX"]
    I2 --> ORC
```

---

## Itens do XLSX vinculados a esta prancha

| Item | Zona | Descrição | Un | QDE | Total (R$) | Origem no desenho |
|---|---|---|---|---|---|---|
| `12.12` | — | Abertura no forro de gesso para luminários, spots, wall washer, grelhas, difusores e etc | und | **176** | **6.160** | Contagem no Quadro de Luminárias (todos os tipos com embutimento no forro) |
| `12.13` | — | Prever reforço para: placas aéreas cv, **trilho vitrine** | vb | 1 | **3.789** | Detalhe trilho DET-04 — reforço estrutural no forro |
| `21.21` | vendas | Fixadores de teto | unid | **6** | **939** | Pontos de fixação de pendentes ou CV aérea |
| `2.9` | — | Eletricista disponível durante a obra para suporte | vb | 1 | **4.500** | Presença necessária pós-entrega civil para conectar luminárias |

### Itens fora do XLSX civil (escopo separado)

| Categoria | Responsável | Observação |
|---|---|---|
| Fornecimento de luminárias (todos os tipos) | C&A Brand | Especificadas no Quadro de Luminárias mas não orçadas pela Celmar |
| Instalação elétrica (fiação, disjuntores, quadros) | Instaladora elétrica (contratação direta C&A) | Orçamento elétrico separado |
| Trilhos de iluminação (track lights) | C&A Brand | Celmar faz apenas o reforço estrutural no forro |
| Sistemas de emergência | Instaladora | Exigência do shopping — fora do escopo civil |

---

## Particularidades desta prancha

### 1. A prancha mais densa do conjunto — e a que menos gera itens civis
O grid de símbolos no térreo é o mais denso de todo o projeto (centenas de pontos de luz), mas gera apenas **4 itens** no XLSX civil. Toda a engenharia elétrica acontece em orçamentos separados — esta prancha serve ao civil apenas como referência para o item `12.12`.

### 2. O `12.12` é o item mais diretamente derivado desta prancha
"Abertura no forro de gesso para luminários, spots, wall washer, grelhas, difusores e etc" — 176 unidades a R$35/unid (M.O. pura, sem material). Cada tipo de luminária que precisa de abertura no forro gera uma unidade:
- Spots embutidos (a maioria dos símbolos rosa)
- Wall washers (iluminação rasante de parede)
- Grelhas de difusor de ar (compartilhadas com o projeto de AC)
- O número 176 vem da soma no Quadro de Luminárias filtrada pelos tipos que requerem abertura física no gesso

### 3. Luminárias de superfície e pendentes **não** geram abertura
Luminárias de sobrepor ou pendentes (sem embutimento no forro) **não entram** no item `12.12`. Isso explica porque a contagem de 176 é menor que o total de símbolos na planta — alguns pontos de luz são fixados na superfície do forro ou suspensos por cabo, sem abertura.

### 4. Iluminância: dado de projeto, não de orçamento
Os valores de projeto (2.711,66 lux total / 1.501,85 lux médio no salão de vendas) são métricas de qualidade luminosa para aprovação do projeto, não entram no XLSX. São referência para o laudo de luminotecnia da C&A.

### 5. O Corte de Altura é a ponte com os Cortes Gerais (prancha 311)
O "Corte Orientativo Altura Instalações" coordena:
- Altura do forro de gesso (confirmada na prancha 311 — Cortes Gerais)
- Profundidade de embutimento dos spots (dados dos detalhes DET-01 a DET-04)
- Espaço livre acima do forro para passagem de dutos e cabos
Isso é coordenação, não orçamento — mas define se o forro de gesso será tabicado ou rebaixado localmente.

### 6. A planta do mezanino (202) cobre os provadores superiores
O segundo bloco de planta (mezanino SCM) documentada nesta prancha cobre os provadores do 2º pavimento — a iluminação específica das cabines. O item `22.18` (espelho com cava para iluminação — 25 unid) é a interseção entre esta prancha e a seção 22 do XLSX: a cava no espelho é a solução de iluminação *dentro* da cabine, que substitui spots no forro para o ambiente interno da cabine.

---

## Estratégia de extração automática

```mermaid
flowchart LR
    QUAD_L["CÉA — Quadro de Luminárias\n(tabela estruturada)"]
    QUAD_L --> OCR["OCR estruturado\n(PaddleOCR)"]
    OCR --> TIPO["Tipo de luminária\n+ código + quantidade"]
    TIPO --> FILTRO["Filtrar: quais tipos\nrequerem abertura no forro?"]
    FILTRO --> SOMA["Soma = 176 unid\n→ confirmar 12.12"]

    GRID_IMG["Grid de símbolos\nna planta"]
    GRID_IMG --> BLOB["Blob detection\n+ template matching"]
    BLOB --> COUNT["Contagem por símbolo"]
    COUNT --> CROSS_CHECK["Cruzar com Quadro\n→ validar 176"]
```

| Componente | Técnica | Ferramenta | Confiança |
|---|---|---|---|
| Contagem de luminárias por tipo | OCR na tabela Quadro de Luminárias | PaddleOCR | **Muito alta** |
| Contagem de símbolos na planta (validação) | Template matching + blob detection | OpenCV | Alta |
| Filtrar: embutido vs. sobrepor/pendente | GPT-4o Vision nos detalhes DET-01 a DET-04 | GPT-4o Vision | Alta |
| Total para item 12.12 | Soma dos tipos embutidos no forro | Cálculo | Alta |
| Identificar "C&A supply" nas notas | OCR + NLP nos textos das Notas Gerais | GPT-4o Vision | Alta |

---

*Referências: Prancha CEA-254-BLN-ARQ_R03-201 - INT ILUMINAÇÃO SEM MOB.png · 1ª Proposta CELMAR BLN.xlsx · Loja 254 Shopping Norte Blumenau*
