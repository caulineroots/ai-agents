# -*- coding: utf-8 -*-
"""
orchestrator.py — prompts para o novo pipeline de especialistas:
  /especialista  — 1 chamada por grupo (G1-G6), checklist-driven
  /auditar       — 1 chamada texto puro, compara totais por seção vs XLSX

  Funções legadas (build_leitura_geral_prompt, build_orchestrator_prompt,
  build_batch_prompt) são mantidas para backward compat com o endpoint
  /ler-prancha, /orquestrar e /analisar-batch, que permanecem disponíveis.
"""

import re
import json


# ─────────────────────────────────────────────────────────────────────────────
# NORMALIZAÇÃO: categorias semânticas padronizadas para tabelas QNT
# ─────────────────────────────────────────────────────────────────────────────

CATEGORIAS_PADRAO = [
    # Paredes drywall gesso
    "drywall_st_1f",          # Standard 1 face (825mm)
    "drywall_st_2f",          # Standard 2 faces (950mm)
    "drywall_ru",             # Resistente à Umidade (qualquer espessura/faces)
    "drywall_rf",             # Resistente ao Fogo (qualquer espessura/faces)
    "drywall_rfid_1f",        # ST com manta RFID / eletromagnética 1 face
    "drywall_rfid_2f",        # ST com manta RFID / eletromagnética 2 faces
    "drywall_rf_rfid",        # RF com manta RFID
    # Alvenaria
    "alvenaria_bloco_concreto",   # Bloco de concreto 14cm
    "alvenaria_bloco_celular",    # Bloco celular / Ytong
    # Divisórias e painéis
    "divisoria_eucatex",          # Divilux 35 / Eucatex sanitários
    "divisoria_laminado_provadores",  # Laminado fórmica / Cumaru / Essencial Wood
    "painel_mdf_laminado",        # Painel MDF/MDP com laminado
    "fechamento_cortina_enrolar", # Cortina de enrolar / tela
    # Fachada e vidros
    "acm_fachada",               # ACM branco brilho / alumínio composto
    "vidro_temperado",           # Vidro temperado (vitrine, hidrante)
    "espelho",                   # Espelho cristal
    "estrutura_metalon",         # Metalon para estrado / fachada
    # Pisos
    "piso_vinilico",             # Vinílico Tarkett / similar
    "piso_porcelanato",          # Porcelanato (qualquer referência)
    "piso_ceramica",             # Cerâmica 45x45 (piso)
    "piso_epoxi",                # Epóxi / contrapiso pintado
    "piso_tatil",                # Piso tátil / podotátil
    # Rodapés
    "rodape_madeira_7cm",        # Curupixá/Tauari h=7cm
    "rodape_madeira_20cm",       # Curupixá/Tauari h=20cm
    "rodape_tarkett",            # Primer Tarkett 10cm / Tarkett 50x240mm
    "rodape_inox",               # Chapa de aço inox escovado
    "rodape_poliestireno",       # Santa Luzia poliestireno / similar
    # Pinturas
    "pintura_branco_gelo_fosca",      # Acrílica fosca Branco Gelo
    "pintura_branco_gelo_semibrilho", # Acrílica semi-brilho Branco Gelo (ADM)
    "pintura_branco_neve",           # Látex Branco Neve (forro/laje)
    "pintura_diario_de_menina",      # Diário de Menina (descompressão/ADM)
    "pintura_vila_grega",            # Vila Grega SW7551 (salão de vendas)
    "pintura_textura",               # Textura acrílica (Terracor Velvet etc.)
    "pintura_epoxi",                 # Epóxi (piso/áreas técnicas)
    # Forros
    "forro_gypsum",              # Gypsum liso tabicado estruturado
    "forro_inox",                # Aço inox escovado estruturado
    "forro_ripado_mdf",          # Ripado MDF (Essencial Wood / Carvalho Mel)
    # Cerâmica parede
    "ceramica_parede_20x20",     # Eliane Forma White 20x20 (sanitários / copa)
    # Impermeabilização e contrapiso
    "impermeabilizacao",         # Manta líquida / asfáltica / butílica
    "contrapiso",                # Enchimento contrapiso h=X cm
    # RFID manta
    "rfid_manta",                # Manta aluminizada Durafoil RFID (piso/mezanino)
    # Soleiras e bancadas
    "soleira_granito",           # Soleira Branco Cearense / Cinza Andorinha
    "bancada_granito",           # Bancada granito (copa / vestiário)
    # Categoria genérica
    "desconhecido",              # Não foi possível classificar
]


def build_normalizacao_prompt(itens: list[dict]) -> str:
    """
    Prompt para o Claude Haiku classificar itens QNT brutos do PDF
    em categorias semânticas padronizadas.

    REGRA DE SEGURANÇA: a IA nunca altera os valores numéricos —
    apenas copia quantidade e unidade exatamente do input.
    """
    cats_str = "\n".join(f"  - {c}" for c in CATEGORIAS_PADRAO)

    linhas = []
    for i, it in enumerate(itens):
        d = it.get("descricao", "")
        q = it.get("quantidade")
        u = it.get("unidade", "")
        linhas.append(f'  {i + 1}. descricao="{d}" | quantidade={q} | unidade="{u}"')
    itens_str = "\n".join(linhas)

    exemplo = json.dumps({
        "itens_normalizados": [
            {"categoria": "drywall_st_1f", "original": "DRYWALL GESSO ST - 825mm", "quantidade": 559, "unidade": "m2"},
            {"categoria": "alvenaria_bloco_concreto", "original": "ALVENARIA EM BLOCO DE CONCRETO - 14CM", "quantidade": 266, "unidade": "m2"},
            {"categoria": "desconhecido", "original": "ITEM NÃO RECONHECIDO", "quantidade": 5, "unidade": "un"},
        ]
    }, ensure_ascii=False, indent=2)

    return f"""Classifique cada item de tabela QNT de projeto de arquitetura C&A em uma categoria padronizada.

CATEGORIAS DISPONÍVEIS:
{cats_str}

REGRAS CRÍTICAS:
- Copie os campos "quantidade" e "unidade" EXATAMENTE como estão no input. NUNCA altere esses valores numéricos.
- Use "desconhecido" se não tiver certeza sobre a categoria.
- Retorne TODOS os {len(itens)} itens do input, na mesma ordem.
- O campo "original" deve conter a descrição exata do input.

ITENS PARA CLASSIFICAR:
{itens_str}

Responda SOMENTE com JSON válido no formato abaixo (sem texto fora do JSON):
{exemplo}"""


def parse_normalizacao_json(raw_text: str) -> list[dict]:
    """
    Parse seguro para resposta de normalização.
    Retorna [] em qualquer falha — nunca levanta exceção.
    Valida que os valores numéricos não foram alterados (são copiados do input).
    """
    try:
        parsed = None

        m = re.search(r"```(?:json)?\s*(.*?)```", raw_text, re.DOTALL)
        if m:
            try:
                parsed = json.loads(m.group(1).strip())
            except Exception:
                pass

        if not parsed:
            start = raw_text.find("{")
            end   = raw_text.rfind("}")
            if start != -1 and end > start:
                try:
                    parsed = json.loads(raw_text[start:end + 1])
                except Exception:
                    pass

        if not parsed:
            return []

        itens = parsed.get("itens_normalizados", [])
        if not isinstance(itens, list):
            return []

        result = []
        for it in itens:
            if not isinstance(it, dict):
                continue
            categoria = str(it.get("categoria", "desconhecido"))
            original  = str(it.get("original", ""))
            try:
                quantidade = float(it.get("quantidade") or 0)
            except (TypeError, ValueError):
                quantidade = 0.0
            unidade = str(it.get("unidade", ""))
            result.append({
                "categoria":  categoria,
                "original":   original,
                "quantidade": quantidade,
                "unidade":    unidade,
            })
        return result

    except Exception:
        return []


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

        # Texto limpo do PDF — enviado apenas quando a extração por código foi fraca (< 5 confirmados).
        # Permite que a IA leia tabelas (Quadro de Áreas, Quadro de Luminárias, etc.)
        # diretamente do texto, sem depender da resolução da imagem comprimida.
        pdf_clean_lines = item.get("pdf_clean_lines")
        if pdf_clean_lines:
            pdf_text_str = "\n".join(pdf_clean_lines)
            pdf_section = f"""
TEXTO EXTRAÍDO DO PDF (use para ler tabelas se a imagem estiver ilegível):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{pdf_text_str}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÕES PARA USO DO TEXTO PDF:
- Se encontrar valores numéricos (m², un, ml) em tabelas do texto que não estão nos itens acima,
  extraia-os com fonte="PDF" e confianca 80-95.
- Se o texto confirmar uma quantidade que já está como "aguardando" (qty=0), preencha com fonte="PDF".
- Prefira o texto para dados de tabelas; prefira a imagem para contagem visual e layout.
"""
        else:
            pdf_section = ""

        prancha_ctx.append(f"""
[PRANCHA {label}] — stem: {item['stem']}
Resumo da leitura geral: {resumo_leitura or '(sem resumo)'}

ITENS COM QUANTIDADE CONFIRMADA DO PDF ({len(confirmados)}):
{conf_str}

ITENS ENCONTRADOS SEM QUANTIDADE — PREENCHA VISUALMENTE ({len(aguardando)}):
{agrd_str}

COTAS DE ALTURA:
{hctx_str}
{pdf_section}
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
ANTES DE QUALQUER COISA — FILTRO DE LIXO:
Ignore completamente (não retorne no JSON) qualquer item "aguardando" cuja descrição seja:
- Texto de nota técnica ou regulamento (ex: contém "NÃO PODERÃO SOFRER", "HAVENDO NECESSIDADE",
  "VERIFICAR NO LOCAL", "SERÁ OBRIGATÓRIO", "ACOMPANHAMENTO DO MESMO")
- Metadado de metragem/legenda (ex: "METRAGEM LINEAR TOTAL", "ALTURA PISO - FORRO MALL",
  "AFASTAMENTO TAPUME x RODATETO")
- Qualquer texto que claramente não é um material ou serviço de construção
Esses textos são artefatos de extração de PDF — descarte-os silenciosamente.
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


# ─────────────────────────────────────────────────────────────────────────────
# NOVO PIPELINE: prompts checklist-driven
# ─────────────────────────────────────────────────────────────────────────────

def build_especialista_prompt(
    grupo: str,
    secoes: list[str],
    checklist: list[dict],
    pdf_tables: list[dict],
    obra: str = "",
    pdf_tables_normalized: "list[dict] | None" = None,
    pdf_tables_aggregated: "list[dict] | None" = None,
) -> str:
    """
    Prompt para o endpoint /especialista.

    grupo                 : "G1" … "G6"
    secoes                : ["A", "7", "8"] etc.
    checklist             : [{cod, descricao, unidade, zona, vlrUnit, totalEsperado, zerado}]
    pdf_tables            : [{stem, itens: [{descricao, quantidade, unidade, status, fonte}]}]
    pdf_tables_normalized : [{stem, itens: [{categoria, original, quantidade, unidade}]}] (opcional)
    pdf_tables_aggregated : [{stem="_TOTAL_GRUPO_", itens: [{categoria, quantidade, unidade, n_pranchas}]}]

    Lógica (table-only):
    - A IA recebe APENAS os dados QNT extraídos do PDF — sem imagens.
    - Para cada item do checklist, ela cruza com as tabelas fornecidas.
    - Prioridade: TOTAIS AGREGADOS > tabela QNT por prancha.
    - Se não encontrado em nenhuma tabela → quantidade=0, status="aguardando".
    - Itens zerados (materialCliente ou inaplicáveis) são confirmados diretamente.
    """
    secoes_str = ", ".join(secoes)

    # Tabela do checklist — sem ref de quantidade e sem flag zerado (agnóstico de projeto)
    checklist_rows = []
    for it in checklist:
        mat_cliente = " [MAT C&A — só MO]" if it.get("materialCliente") else ""
        checklist_rows.append(
            f"  {it['cod']:<8} | {it['descricao'][:55]:<55} | {it['unidade']:<4}"
            f" | vlr={it['vlrUnit']:.2f}{mat_cliente}"
        )
    checklist_table = "\n".join(checklist_rows) if checklist_rows else "  (nenhum item neste grupo)"

    # Tabelas QNT já extraídas do PDF
    pdf_section_parts = []
    for entry in pdf_tables:
        stem = entry.get("stem", "?")
        itens = entry.get("itens", [])
        if not itens:
            continue
        linhas = [f"  [QNT PDF — {stem}]"]
        for it in itens[:40]:
            linhas.append(
                f"    {it.get('descricao','')[:50]:<50} | qty={it.get('quantidade',0)} {it.get('unidade','')} | {it.get('status','')}"
            )
        pdf_section_parts.append("\n".join(linhas))

    pdf_section = (
        "\n\n".join(pdf_section_parts)
        if pdf_section_parts
        else "  (nenhuma tabela QNT extraída do PDF para este grupo)"
    )

    # Seção de tabelas normalizadas pelo Haiku (opcional).
    # Suprimida quando TOTAIS AGREGADOS já está disponível — dados redundantes.
    norm_section = ""
    if pdf_tables_normalized and not pdf_tables_aggregated:
        norm_parts = []
        for entry in pdf_tables_normalized:
            stem  = entry.get("stem", "?")
            itens = entry.get("itens", [])
            if not itens:
                continue
            linhas = [f"  [NORMALIZADO — {stem}]"]
            for it in itens[:40]:
                cat = it.get("categoria", "desconhecido")
                orig = it.get("original", "")[:50]
                qty  = it.get("quantidade", 0)
                un   = it.get("unidade", "")
                linhas.append(f"    categoria: {cat:<30} | original: \"{orig}\" | {qty} {un}")
            norm_parts.append("\n".join(linhas))
        if norm_parts:
            norm_section = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABELAS QNT NORMALIZADAS (categorias semânticas — use para cruzar com o checklist)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{chr(10).join(norm_parts)}
"""

    # Seção de totais agregados de todas as pranchas do grupo (fonte primária)
    agg_section = ""
    if pdf_tables_aggregated:
        agg_parts = []
        for entry in pdf_tables_aggregated:
            itens = entry.get("itens", [])
            if not itens:
                continue
            for it in itens[:60]:
                cat    = it.get("categoria", "desconhecido")
                qty    = it.get("quantidade", 0)
                un     = it.get("unidade", "")
                n      = it.get("n_pranchas", 1)
                agg_parts.append(
                    f"  {cat:<35} | total: {qty} {un:<4} | em {n} prancha(s)"
                )
        if agg_parts:
            agg_section = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAIS AGREGADOS — SOMA DE TODAS AS PRANCHAS DO GRUPO
(Use estes totais como FONTE PRIMÁRIA para quantidades.
 As tabelas por prancha abaixo são referência secundária.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{chr(10).join(agg_parts)}
"""

    obra_line = f"OBRA: {obra}\n" if obra else ""

    # Regras de cálculo derivado — injetadas apenas nos grupos relevantes
    calc_rules = ""
    if grupo == "G2":
        calc_rules = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE CÁLCULO ESPECÍFICAS — G2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- item 9.7 (Chapisco e emboço): NÃO copie a área de alvenaria diretamente.
  Calcule: (bloco_concreto + bloco_celular já encontrados acima) × 2 faces
  + paredes existentes a revestir indicadas nas pranchas (se houver).
  Mínimo garantido: alvenaria_nova × 2. Campo "r": "chapisco 2× alvenaria [X]m2".
"""
    elif grupo == "G3":
        calc_rules = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE CÁLCULO ESPECÍFICAS — G3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Pinturas de forro e laje: zona vendas e zona ADM têm áreas DISTINTAS — nunca some as duas.
  item 18.10 (pintura forro vendas): use somente a área de forro da zona de vendas,
    não o total geral de forro. O forro ADM é contabilizado separadamente.
  item 18.11 (pintura laje ADM/reservas): a área de teto sem forro de gesso na zona ADM.
    Procure nas pranchas de forro a área sem cobertura de gypsum. Não retorne 0 por padrão.
  item 18.12 (pintura forro Diário de Menina ADM): somente a área de forro ADM com essa cor.
- Pinturas de parede: as áreas vendas e ADM são independentes — não confunda zonas.
"""

    return f"""Você é um engenheiro orcamentista experiente analisando pranchas de projeto executivo
de fit-out de loja C&A.

{obra_line}GRUPO: {grupo} | SEÇÕES XLSX: {secoes_str}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHECKLIST — itens a preencher SE existirem nas tabelas
(cod | descrição | un | vlrUnit)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{checklist_table}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABELAS QNT JÁ EXTRAÍDAS DOS PDFs (referência por prancha)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{agg_section}{pdf_section}{norm_section}{calc_rules}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUAS TAREFAS (em ordem de prioridade):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PARA CADA ITEM DO CHECKLIST, verifique se existe correspondência nas tabelas QNT acima:
   a) Encontrou nos TOTAIS AGREGADOS → retorne o item com a quantidade, fonte="PDF", status="confirmado".
   b) Encontrou na tabela QNT por prancha (sem totais agregados) → some ocorrências, fonte="PDF", status="confirmado".
   c) NÃO encontrou em nenhuma tabela → OMITA o item completamente do JSON. Não retorne linha com qty=0.
   d) Item marcado [MAT C&A] com dado nas tabelas → registre somente a MO (mão de obra).

2. USE O CAMPO "cod" PARA IDENTIFICAR CADA ITEM — não altere os códigos.

3. RACIOCÍNIO: campo "r" em até 6 palavras-chave explicando de onde veio a qty.
   Exemplos: "tabela QNT PDF prancha 331", "total agregado 3 pranchas", "zerado inaplicável".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS CRÍTICAS:
- Retorne APENAS itens com quantidade encontrada nas tabelas. Itens ausentes das tabelas → omita.
- Não adicione itens que não estão no checklist.
- Não altere os campos "cod" ou "descricao" do checklist.
- As tabelas QNT do PDF são a ÚNICA fonte — nunca use suposições ou estimativas visuais.
- Se não há tabelas com dados relevantes, retorne itens: [] (array vazio).

Responda SOMENTE com JSON válido:

{{
  "grupo": "{grupo}",
  "itens": [
    {{
      "cod": "14.1",
      "descricao": "Piso vinílico vendas/provadores (MO — mat. C&A)",
      "unidade": "m2",
      "quantidade": 1024.98,
      "fonte": "PDF",
      "status": "confirmado",
      "r": "tabela QNT PDF prancha 331",
      "pendencias": []
    }}
  ]
}}"""


def build_auditoria_prompt(
    secao_totais: dict,
    totais_xlsx: dict,
    obra: str = "",
) -> str:
    """
    Prompt para o endpoint /auditar.

    secao_totais : {seção: {total_calculado, n_itens, itens_aguardando}}
    totais_xlsx  : {seção: total_esperado}

    Compara seção a seção e retorna flags de divergência.
    """
    linhas = []
    all_secoes = sorted(set(list(secao_totais.keys()) + list(totais_xlsx.keys())))
    for sec in all_secoes:
        calc  = secao_totais.get(sec, {})
        total = calc.get("total_calculado", 0) if isinstance(calc, dict) else calc
        esp   = totais_xlsx.get(sec, 0)
        delta = total - esp
        delta_pct = (delta / esp * 100) if esp else 0
        aguard = calc.get("itens_aguardando", 0) if isinstance(calc, dict) else 0
        linhas.append(
            f"  Seção {str(sec):<4} | calculado={total:>10,.0f} | esperado={esp:>10,.0f}"
            f" | delta={delta:>+10,.0f} ({delta_pct:+.1f}%) | aguardando={aguard}"
        )

    tabela = "\n".join(linhas)

    total_calc  = sum(
        (v.get("total_calculado", 0) if isinstance(v, dict) else v)
        for v in secao_totais.values()
    )
    total_esp   = sum(totais_xlsx.values())
    delta_total = total_calc - total_esp

    obra_line = f"OBRA: {obra}\n" if obra else ""

    return f"""Você é um engenheiro sênior de orçamento auditando o resultado de uma análise de projeto.

{obra_line}COMPARATIVO — CALCULADO vs ESPERADO{(' — ' + obra) if obra else ' (1ª Proposta CELMAR BLN)'}:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{tabela}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL CALCULADO: R$ {total_calc:,.0f}
TOTAL ESPERADO:  R$ {total_esp:,.0f}
DELTA TOTAL:     R$ {delta_total:+,.0f} ({(delta_total / total_esp * 100) if total_esp else 0:+.1f}%)

SUAS TAREFAS:
1. Para cada seção com |delta| > 10%: identifique a causa provável.
   - delta muito positivo → itens duplicados, quantidades superestimadas, itens errados
   - delta muito negativo → itens com quantidade=0 (aguardando), itens não identificados
2. Liste as seções OK (delta < ±10%) e as que precisam de revisão.
3. Sugira ações específicas de correção para as seções problemáticas.
4. Calcule a margem de erro geral do orçamento.

Responda SOMENTE com JSON válido:

{{
  "total_calculado": {total_calc:.0f},
  "total_esperado": {total_esp:.0f},
  "delta_total": {delta_total:.0f},
  "delta_pct": {(delta_total / total_esp * 100) if total_esp else 0:.1f},
  "secoes_ok": ["14", "22"],
  "secoes_problema": [
    {{
      "secao": "12",
      "delta": -12000,
      "delta_pct": -15.0,
      "causa_provavel": "Forro não quantificado (12 itens aguardando)",
      "acao": "Verificar quantidade de m² de forro nas pranchas 309 e 310"
    }}
  ],
  "itens_aguardando_total": 0,
  "qualidade_geral": "boa | aceitavel | ruim",
  "observacoes": "Texto livre com observações gerais"
}}
"""


def build_verificacao_prompt(
    grupos_resumo: list[dict],
    itens_aguardando: list[dict],
    obra: str = "",
) -> str:
    """
    Prompt para o endpoint /verificar.
    Usa Haiku para verificar rapidamente se a extração de tabelas está completa.

    grupos_resumo    : [{grupo, n_confirmados, n_aguardando, n_pranchas, categorias_encontradas}]
    itens_aguardando : [{cod, descricao, grupo}]
    """
    obra_line = f"OBRA: {obra}\n" if obra else ""

    grupos_str = ""
    for g in grupos_resumo:
        cats = ", ".join(g.get("categorias_encontradas", [])[:10]) or "(nenhuma)"
        grupos_str += (
            f"  {g.get('grupo','?')} | {g.get('n_confirmados', 0)} confirmados | "
            f"{g.get('n_aguardando', 0)} aguardando | {g.get('n_pranchas', 0)} pranchas\n"
            f"     categorias: {cats}\n"
        )

    aguardando_str = ""
    for it in itens_aguardando[:40]:
        aguardando_str += f"  [{it.get('cod','')}] {it.get('descricao','')[:60]} ({it.get('grupo','')})\n"
    if not aguardando_str:
        aguardando_str = "  (nenhum item aguardando)\n"

    exemplo = json.dumps({
        "qualidade_extracao": "parcial",
        "observacoes": [
            "G3 tem 0 pranchas — itens de forro/pintura não foram analisados",
            "Categoria forro_gypsum ausente em todos os grupos",
        ],
        "categorias_possivelmente_ausentes": ["forro_gypsum", "piso_vinilico"],
        "itens_provavelmente_em_tabela": ["12.1", "12.2"],
    }, ensure_ascii=False, indent=2)

    return f"""Você é um engenheiro verificando se a extração de tabelas de um projeto de fit-out está completa.
Analise SOMENTE os dados fornecidos — sem suposições visuais.

{obra_line}RESUMO POR GRUPO:
{grupos_str}
ITENS AGUARDANDO (não encontrados em tabelas):
{aguardando_str}
TAREFA:
1. Avalie a qualidade geral da extração: "boa" (>80% confirmados), "parcial" (40-80%), "insuficiente" (<40%).
2. Liste observações importantes (grupos sem pranchas, categorias ausentes, padrões suspeitos).
3. Identifique categorias que provavelmente deveriam ter sido extraídas mas estão ausentes.
4. Liste códigos de itens aguardando que provavelmente têm dados em tabelas mas não foram capturados.

Responda SOMENTE com JSON válido:
{exemplo}"""
