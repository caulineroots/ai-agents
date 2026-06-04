# -*- coding: utf-8 -*-
"""
orchestrator.py — prompts para o fluxo de três estágios:
  1. Leitura Geral: lê TODAS as pranchas em batches de 3, documentando o projeto.
  2. Orquestrador: recebe o mapa completo de leitura e decide o que falta.
  3. Batch de Detalhe: analisa pranchas específicas para preencher quantidades.
"""

import json


def build_leitura_geral_prompt(batch_items: list[dict]) -> str:
    """
    Prompt para o Estágio 1 — Leitura Geral.

    batch_items: [{stem, itens_extraidos, classificacao, height_context}]
    Imagens enviadas na mesma ordem: PRANCHA A, B, C.

    Objetivo: documentar o projeto inteiro sem pressão de precisão de quantidades.
    A IA deve entender o que cada prancha mostra, se é relevante, e listar o que vê.
    """
    labels = ["A", "B", "C"]

    prancha_ctx = []
    for i, item in enumerate(batch_items):
        label = labels[i]
        itens = item.get("itens_extraidos", [])
        hctx  = item.get("height_context", {})
        hctx_str = (
            "  " + ", ".join(f"H {k.upper()}={v:.0f}cm" for k, v in hctx.items())
            if hctx else "  (sem cotas de altura)"
        )
        itens_str = (
            "  " + ", ".join(it.get("descricao", "") for it in itens[:8] if it.get("descricao"))
            if itens else "  (nenhum item extraído pelo código)"
        )

        prancha_ctx.append(f"""[PRANCHA {label}] stem: {item['stem']}
Classificação da extração: {item.get('classificacao', 'IA_NECESSARIA')}
Itens extraídos pelo código: {itens_str}
Cotas de altura no texto: {hctx_str}""")

    prancha_section = "\n\n".join(prancha_ctx)

    return f"""Você é um arquiteto experiente analisando pranchas de projeto executivo de fit-out de loja.

Você receberá {len(batch_items)} imagem(ns) nesta mensagem, na ordem:
{"  ".join(f"[PRANCHA {labels[i]}] = {batch_items[i]['stem']}" for i in range(len(batch_items)))}

DADOS JÁ EXTRAÍDOS PELO CÓDIGO PARA CADA PRANCHA:
{prancha_section}

OBJETIVO DESTA LEITURA:
Documentar o que cada prancha mostra. NÃO precisa de quantidades precisas agora.
Apenas confirme o que você consegue ver e entender em cada imagem.

PARA CADA PRANCHA, responda:
- relevante: esta prancha contém informações úteis para orçamento? (true/false)
- ambiente: qual espaço representa (ex: "Sanitários Femininos", "Provadores", "Copa", "Loja Geral")
- tipo: tipo de desenho (ex: "planta baixa", "elevação", "detalhe construtivo", "axonométrica", "legenda")
- resumo: 1-2 frases descrevendo o que a prancha mostra
- itens_vistos: lista simples de materiais/serviços visíveis (ex: ["piso vinílico", "cerâmica parede", "forro gesso", "drywall"])
- cobertura_codigo: o código extraiu bem os dados desta prancha? ("boa" / "parcial" / "minima" / "nenhuma")
- observacoes: algo importante que o código não capturou (alturas visíveis, materiais específicos, etc.)

Responda SOMENTE com JSON válido:

{{
  "leituras": [
    {{
      "prancha": "A",
      "stem": "{batch_items[0]['stem']}",
      "relevante": true,
      "ambiente": "Sanitários",
      "tipo": "planta baixa de acabamentos",
      "resumo": "Planta dos sanitários com especificação de cerâmica nas paredes e piso antiderrapante",
      "itens_vistos": ["cerâmica parede branca", "piso cerâmico antiderrapante", "louças sanitárias", "divisórias drywall"],
      "cobertura_codigo": "parcial",
      "observacoes": "H CERAMICA visível = 140cm. Área do sanitário feminino aparenta ~12m²"
    }}
  ]
}}"""


def build_orchestrator_prompt(
    leitura_map: list[dict],
    extract_summary: list[dict],
) -> str:
    """
    Prompt para o Estágio 2 — Orquestrador.

    Recebe o mapa completo de leitura de TODAS as pranchas (Estágio 1)
    + o sumário da extração por código. SEM imagens.

    Objetivo: identificar gaps, decidir quais pranchas precisam de análise de detalhe.
    """
    leitura_json  = json.dumps(leitura_map,  ensure_ascii=False, indent=2)
    extract_json  = json.dumps(extract_summary, ensure_ascii=False, indent=2)

    return f"""Você é um engenheiro sênior de orçamento analisando um projeto completo de fit-out de loja.

Você recebeu o resultado de uma LEITURA GERAL de todas as pranchas do projeto (feita pela IA na etapa anterior)
e o sumário da extração programática por código.

LEITURA GERAL DE TODAS AS PRANCHAS (Estágio 1):
{leitura_json}

SUMÁRIO DA EXTRAÇÃO POR CÓDIGO:
{extract_json}

TAREFA — responda SOMENTE com JSON válido, sem texto fora do JSON:

Com base em toda essa informação:
1. Descreva o contexto geral do projeto (cliente, tipo de loja, ambientes identificados)
2. Liste as CATEGORIAS DE SERVIÇO que já têm dados suficientes
3. Liste as CATEGORIAS que estão faltando ou com dados incompletos
4. Identifique os GAPS globais (ex: "forro não quantificado em nenhuma prancha", "marcenaria de provadores sem m²")
5. Selecione as pranchas que precisam de ANÁLISE DE DETALHE (Estágio 3):
   - Pranchas com cobertura_codigo = "parcial" ou "minima" onde a IA Leitura encontrou itens relevantes
   - Pranchas com categorias ausentes que poderiam ter dados úteis
   - NÃO selecionar: pranchas com cobertura_codigo = "boa" e n_confirmados ≥ 5
   - NÃO selecionar: pranchas irrelevantes (relevante = false)
   - Para cada prancha selecionada, liste PERGUNTAS ESPECÍFICAS que o Estágio 3 deve responder

Formato de resposta:
{{
  "contexto_projeto": "Descrição em 2-3 frases do projeto e seus ambientes",
  "cliente": "C&A",
  "projeto": "CEA-254-BLN",
  "categorias_cobertas": ["civil", "revestimento"],
  "categorias_ausentes": ["forro", "marcenaria"],
  "gaps_globais": [
    "Forro dos sanitários não quantificado",
    "Marcenaria dos provadores sem área definida"
  ],
  "fontes_primarias": {{
    "piso_m2": "stem-exato-da-prancha-de-piso",
    "forro_m2": "stem-exato-da-prancha-de-forro",
    "rodape_ml": "stem-exato-da-prancha-de-rodapé",
    "portas_un": "stem-exato-da-prancha-de-caixilhos",
    "divisorias_m2": "stem-exato-da-prancha-de-divisorias"
  }},
  "pranchas_para_detalhar": [
    {{
      "stem": "nome-exato-do-stem",
      "motivo": "cobertura parcial — itens vistos sem quantidade",
      "prioridade": 1,
      "escopo_permitido": ["especificações de material", "quantidades de sanitários"],
      "escopo_proibido": ["quantidades de piso (fonte: prancha-de-piso)", "quantidades de forro (fonte: prancha-de-forro)"],
      "perguntas": [
        "Qual a área do piso vinílico nos provadores?",
        "Quantas divisórias drywall existem?"
      ]
    }}
  ],
  "pranchas_dispensadas": [
    {{
      "stem": "nome-exato-do-stem",
      "motivo": "cobertura boa pelo código / prancha irrelevante"
    }}
  ]
}}"""


def build_batch_prompt(
    contexto_projeto: str,
    batch_items: list[dict],
) -> str:
    """
    Prompt para o Estágio 3 — Análise de Detalhe.

    batch_items: [{stem, itens_extraidos, classificacao, height_context, resumo_leitura, perguntas}]
    As imagens são enviadas na mesma ordem que batch_items — a IA as vê como PRANCHA A, B, C.
    """
    labels = ["A", "B", "C"]

    prancha_ctx = []
    for i, item in enumerate(batch_items):
        label = labels[i]
        itens = item.get("itens_extraidos", [])
        confirmados = [it for it in itens if it.get("status") != "aguardando" and (it.get("quantidade") or 0) > 0]
        aguardando  = [it for it in itens if it.get("status") == "aguardando" or (it.get("quantidade") or 0) == 0]
        hctx = item.get("height_context", {})
        perguntas = item.get("perguntas", [])
        resumo_leitura = item.get("resumo_leitura", "")

        conf_str = json.dumps(confirmados, ensure_ascii=False, indent=2) if confirmados else "  (nenhum)"
        agrd_str = json.dumps(aguardando,  ensure_ascii=False, indent=2) if aguardando  else "  (nenhum)"
        hctx_str = (
            "\n".join(
                f"  H {k.upper()} = {v:.0f}cm  (material vai até {v:.0f}cm de altura)"
                for k, v in hctx.items()
            ) if hctx else "  (sem cotas de altura)"
        )
        perguntas_str = (
            "\n".join(f"  - {q}" for q in perguntas)
            if perguntas else "  (preencha todas as quantidades faltantes)"
        )

        escopo_perm = item.get("escopo_permitido", [])
        escopo_prob = item.get("escopo_proibido", [])
        escopo_perm_str = (
            "\n".join(f"  ✓ {s}" for s in escopo_perm)
            if escopo_perm else "  (sem restrições — extraia o que for relevante)"
        )
        escopo_prob_str = (
            "\n".join(f"  ✗ {s}" for s in escopo_prob)
            if escopo_prob else "  (sem proibições específicas)"
        )

        prancha_ctx.append(f"""
[PRANCHA {label}] — stem: {item['stem']}
Resumo da leitura geral: {resumo_leitura or '(sem resumo)'}

ITENS COM QUANTIDADE CONFIRMADA DO PDF ({len(confirmados)}):
{conf_str}

ITENS ENCONTRADOS SEM QUANTIDADE — PREENCHA VISUALMENTE ({len(aguardando)}):
{agrd_str}

COTAS DE ALTURA:
{hctx_str}

ESCOPO PERMITIDO para esta prancha (o que você DEVE extrair):
{escopo_perm_str}

ESCOPO PROIBIDO para esta prancha (o que você NÃO deve extrair — já coberto por outra prancha):
{escopo_prob_str}

PERGUNTAS ESPECÍFICAS DO ORQUESTRADOR:
{perguntas_str}
""")

    prancha_section = "\n".join(prancha_ctx)

    return f"""Você é um engenheiro orcamentista experiente revisando pranchas de projeto executivo de fit-out (loja C&A).

CONTEXTO DO PROJETO:
{contexto_projeto}

Você receberá {len(batch_items)} imagem(ns) nesta mensagem, na ordem:
{"  ".join(f"[PRANCHA {labels[i]}] = {batch_items[i]['stem']}" for i in range(len(batch_items)))}

DADOS EXTRAÍDOS POR CÓDIGO + CONTEXTO DA LEITURA GERAL:
{prancha_section}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUAS TAREFAS — em ordem de prioridade:

1. RESPONDER AS PERGUNTAS DO ORQUESTRADOR:
   - Foco nas perguntas específicas listadas para cada prancha.

2. PREENCHER QUANTIDADES (itens "aguardando"):
   - Olhe a imagem e determine a quantidade de cada item sem qty.
   - Use cotas de altura como referência para calcular m².
   - Se conseguir estimar: status="parcial", confianca 40-70.
   - Se impossível: mantenha status="aguardando" e quantidade=0.

3. ITENS COM FONTE="PDF" SÃO IMUTÁVEIS — REGRA CRÍTICA:
   - Itens com fonte="PDF" vêm das tabelas oficiais do projeto. São as quantidades corretas.
   - NUNCA crie um item novo com descrição igual ou similar a um item PDF existente.
   - NUNCA altere a quantidade de um item PDF — nem que a imagem mostre diferente.
   - Se a imagem mostrar uma quantidade diferente da que está no PDF: registre SOMENTE em "divergencias", com o valor visual e o valor PDF. NÃO crie item duplicado.

4. ADICIONAR ITENS AUSENTES (dentro do escopo permitido):
   - Adicione SOMENTE itens que: (a) não aparecem em nenhuma lista acima E (b) pertencem ao ESCOPO PERMITIDO desta prancha.
   - Não adicione itens do ESCOPO PROIBIDO — mesmo que você os veja na imagem.
   - Prefira não adicionar a duplicar.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use o campo "prancha" ("{labels[0]}", "{labels[1] if len(batch_items) > 1 else ''}"...) para indicar de qual imagem é cada item.

CATEGORIAS: civil | revestimento | pintura | marcenaria | vidros | eletrica | hidraulica | climatizacao | outro
UNIDADES: m2 | ml | un | m3 | vb | kg | hr
STATUS: "confirmado" | "parcial" | "aguardando"

Campo "r": raciocínio em até 6 palavras-chave (ex: "cota H=140 visível", "similar PDF ignorado", "fora escopo corte", "tabela ilegível resolução").

Responda SOMENTE com JSON válido:

{{
  "projeto": "CEA-254-BLN",
  "cliente": "C&A",
  "itens": [
    {{
      "prancha": "A",
      "id": 1,
      "ambiente": "Sanitários",
      "descricao": "CERÂMICA ELIANE 20X20cm COR BRANCA",
      "categoria": "revestimento",
      "unidade": "m2",
      "quantidade": 42.0,
      "confianca": 55,
      "fonte": "IA",
      "status": "parcial",
      "r": "cota H=140 visível tabela",
      "pendencias": ["estimado com base em H CERAMICA=140cm"]
    }}
  ],
  "divergencias": [],
  "erros_limitacoes": []
}}"""
