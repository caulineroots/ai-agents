# Pipeline de Extração — C&A (multi-fonte + auditoria IA)

## Fontes por ordem de confiança

| Fonte | Confiança | O que entrega |
|---|---|---|
| **DXF/DWG** | 95%+ | Geometria exata, contagem de blocos, tabelas ACAD_TABLE, cotas como números |
| **PDF texto** | 88%+ | Tabelas QNT*, Quadro de Acabamentos, anotações, cotas impressas |
| **IA visual** | 60–85% | Interpretação, itens sem tabela, relações espaciais |

---

## Fluxo completo

```
[1] INGEST — usuário sobe qualquer arquivo (PDF / PNG / DWG)
     └── auto-lookup: busca mesmo nome nos outros formatos na mesma pasta
     └── ex: "ARQ-304-COPA.pdf" → encontra ARQ-304-COPA.dwg + ARQ-304-COPA.png

[2] EXTRACT — paralelo por fonte encontrada
     ├── DXF: geometria (polylines/hatches → m²/ml), blocos (INSERT → un), tabelas
     ├── PDF: tabelas QNT, Quadro de Acabamentos, cotas textuais
     └── PNG: guardado para as chamadas de IA

[3] MERGE ESTRUTURAL — sem IA, só código
     └── consolida DXF + PDF em "structural_json" (itens com fonte e valor)
     └── marca divergências entre fontes (ex: DXF diz 320m², PDF diz 318m²)

[4] CHAMADA A — IA visual + comparação
     prompt: "Aqui está a imagem e o JSON extraído programaticamente.
              Liste TUDO que você vê. Para cada item indique:
              - se confirma, diverge ou não encontra no JSON estrutural
              - confiança (0–100%)
              - o que não conseguiu identificar (log de erro)"
     output: tabela IA + divergências + error_log

[5] CHAMADA B — correção cirúrgica
     prompt: "Aqui está a tabela consolidada após a primeira análise.
              Olhe a imagem novamente. Seja mais rigoroso.
              Foque APENAS nos itens com confiança < 80% e nos [FALTANDO].
              Para cada um: confirme, corrija ou marque para revisão humana."
     output: itens corrigidos + novos itens encontrados

[6] OUTPUT FINAL — JSON com metadados completos
```

---

## Estrutura de cada item no JSON final

```json
{
  "id": 1,
  "descricao": "Piso vinílico salão",
  "categoria": "revestimento",
  "unidade": "m2",
  "quantidade": 320.5,

  "confianca": 95,
  "fonte_primaria": "dwg",
  "fontes_confirmadas": ["dwg", "pdf", "ai-visual"],
  "divergencias": [
    { "fonte": "pdf", "valor": 318.0, "delta": "0.8%" }
  ],

  "precisa_revisao": false,
  "erros_ia": [],
  "pendencias": []
}
```

**Regras de `confianca`:**
| Origem do valor | Score base |
|---|---|
| DXF geometry (medido) | 95 |
| PDF tabela QNT (lida) | 88 |
| DXF + PDF concordam | +5 (cap 99) |
| IA confirma fonte estrutural | +3 |
| IA sozinha, item visível e cotado | 75 |
| IA sozinha, item visível sem cota | 60 |
| IA estimou por proporção | 45 |
| IA inferiu (não viu, deduziu) | 30 |

**`precisa_revisao: true` quando:**
- `confianca < 70`, OU
- `divergencias` com `delta > 5%`, OU
- `erros_ia` não vazio

---

## Error log da IA (exemplos reais esperados)

```json
"erros_ia": [
  "Escala da prancha não identificada — cota usada como referência",
  "Rodapé copa não mensurável — elevação CO03 cortada na borda da prancha",
  "Não foi possível distinguir impermeabilização de contrapiso na seção de detalhe"
]
```

---

## Lookup de arquivos companheiros

```
pasta/
  ARQ-304-COPA.pdf   ← usuário sobe este
  ARQ-304-COPA.dwg   ← encontrado automaticamente
  ARQ-304-COPA.png   ← encontrado automaticamente
```

Regra de busca: mesmo `basename` (sem extensão), nas extensões `[.dwg, .dxf, .pdf, .png, .jpg]`, na mesma pasta e uma pasta acima/abaixo.

---

## Prioridade de extração por tipo de prancha

| Prancha | Fonte primária | IA necessária? |
|---|---|---|
| ARQ-301 Civil (mestre) | DXF blocos + PDF tabelas QNT | Só auditoria |
| ARQ-321 Forro | PDF tabela QNT Forros | Só auditoria |
| ARQ-331 Piso | PDF tabela QNT Pisos | Só auditoria |
| ARQ-304 Copa | DXF polylines + PDF Quadro Acabamentos | Sim (elevações) |
| ARQ-341 Fachadas | DXF geometria fachada | Sim (separar C&A vs Celmar) |
| DEC-131/132 Provadores | DXF blocos PROVADOR + tabelas | Sim (detalhes cabine) |
| INT-203 Axonométricas | — | Não processar |
| CVS-602 Vinhetes | — | Não processar |

---

## Chamadas de IA por projeto (estimativa)

| Etapa | Chamadas |
|---|---|
| Chamada A (visual+comparação) | 1 por prancha processada (~20) |
| Chamada B (correção) | 1 por prancha com itens < 80% (~8–12) |
| Auditoria final consolidada | 1–2 |
| **Total** | **~30–35 chamadas/projeto** |

Vs. abordagem somente imagem: 40–240 chamadas com menor confiança.
