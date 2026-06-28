import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/config/ai';
import { calcularOrcamento } from '@/lib/orcamento/calcular';
import type { FolhaMedicao } from '@/lib/orcamento/types';
import { marmorariaError, marmorariaLog, formatMarmorariaApiError } from '@/lib/orcamento/debug';

const client = new Anthropic();

// ─── Prompt 1 — Análise inicial ───────────────────────────────────────────────

const PROMPT_1 = `Você é um orçamentista sênior de marmoraria analisando pranchas de projeto arquitetônico.
Analise todas as imagens em conjunto (estão em ordem).

═══════════════════════════════════════════════════════
REGRAS DE DOMÍNIO — aplique em TODOS os projetos
═══════════════════════════════════════════════════════

R1 — BANCADA COM PÉ
Se a perspectiva ou vista frontal mostra face vertical de pedra ALÉM do tampo horizontal (painel lateral de encerramento, fechamento frontal em pedra, saia alta), inclua a área da face vertical NO MESMO ITEM DE TAMPO — NÃO crie item separado.
Cálculo: area_m2 = (comprimento × profundidade_tampo) + (comprimento × altura_face_vertical).
Forneça area_m2 explicitamente no JSON — o sistema respeita area_m2 quando fornecido (não recalcula C × L).
Altura da face vertical: use a cota visível na vista frontal/lateral. Se não houver cota: use 0,40 m (padrão — altura típica de fechamento lateral de bancada).
NUNCA use a altura total do armário (80–90 cm) — a pedra cobre apenas a faixa exposta.
borda_ml da "bancada com pé" = todos os metros lineares expostos do conjunto (frente tampo + lateral tampo + descida da face + base da face).

R2 — RODAPIA E RODAPÉ — COZINHA E LAVANDERIA
Rodapia (5 cm): 1 item por módulo × comprimento frontal × 0,05 m. Para tampo em L: usar apenas ala principal.
Rodapé de base (10 cm): 1 item por módulo. Comprimento = PERÍMETRO DE TODAS AS FACES EXPOSTAS em granito.
  — Tampo reto: comprimento = frontal do granito.
  — Tampo em L: comprimento = frontal ala principal + lateral exposta da ala retorno (o lado voltado ao interior do cômodo — NÃO a soma das duas alas frontais).
    Exemplo: ala principal 2,10 m + ala retorno 0,81 m com 0,60 m de profundidade → rodapé = 2,10 + 0,60 = 2,70 m.
  — "Bancada com pé": comprimento = todas as faces expostas do módulo (frente + laterais + eventualmente fundo), pois a faixa de rodapé envolve toda a base do conjunto em pedra.
O serviço "Instalacao rodape" usa qtd = este comprimento em ML.
Exceção rodapia: se o projeto indicar explicitamente ausência de saia frontal.

R3 — COMPRIMENTO DA PEDRA ≠ LARGURA DO MÓDULO
Use sempre a cota da vista GRANITO ou SUPERIOR para o comprimento do granito.
Não use a largura total do módulo (pode incluir geladeira, vãos, nichos em MDF).
Se divergirem: registre os dois e use o comprimento da pedra.

R4 — TAMPO EM L: 2 itens de tampo, mas 1 rodapé e 1 rodapia
Tampos em L = 2 peças de tampo (ex: ala principal 2,10 m + ala retorno 0,81 m). Liste cada tampo separado.
Rodapia = 1 item, comprimento = ala principal apenas.
Rodapé = 1 item, comprimento = frontal ala principal + lateral exposta da ala retorno.
  Lateral exposta da ala retorno = profundidade da ala retorno (o lado perpendicular que fica visível voltado ao cômodo).
  Exemplo: ala principal 2,10 m, ala retorno 0,81 m com 0,60 m de profundidade → rodapé = 2,10 + 0,60 = 2,70 m.

R5 — MÓDULO CAFÉ / BAR / NICHO
O tampo é apenas o trecho com pedra visível nos CORTES (vistas A, B, C do módulo) — use a largura do nicho interno nos cortes, NÃO a largura total do módulo na vista frontal ou superior.
A área do tampo de café/bar/nicho é tipicamente pequena (0,20–0,50 m²). Se a leitura resultar em área > 0,60 m², reavalie — provavelmente a dimensão usada é do módulo inteiro, não do trecho de pedra.
O rodapé desses módulos só existe se houver callout explícito de pedra. Sem callout → sem rodapé (plinto é MDF).

R6 — BANHEIRO
Tampo: espessura 2 cm (Slim), profundidade padrão 0,57 m, sem rodapé em pedra (o banheiro usa plinto de MDF).
Sem Rebaixo Italiano a menos que o detalhe de granito mostre explicitamente "Rebaixo Italiano".
Serviços padrão banheiro: Acabamento Slim + Furo cuba embutir + Furo torneira + Instalacao tampo sobre base.
borda_ml banheiro = comprimento + profundidade (2 faces: frente + 1 lateral). A bancada encosta na parede no lado oposto à cuba — NÃO conte 3 faces (frente + 2 laterais).
Furo torneira: incluir SEMPRE para banheiro. Remover apenas se o projeto mostrar EXPLICITAMENTE "torneira de parede — sem furo no tampo".

R7 — LAVANDERIA
Tampo: profundidade padrão 0,60 m, RI quando indicado (RI lavanderia ≠ RI cozinha — preço diferente).
Cada módulo da lavanderia = seu próprio tampo + rodapé. MOB. TANQUE e MOB. MULTIUSO frequentemente têm rodapé.
MOB. TANQUE: incluir sempre Furo cuba embutir + Furo torneira. RI lavanderia quando a vista GRANITO mostrar rebaixo.
Rodapé de lavanderia: manter quando o módulo tem Granito Tabaco na legenda — mesmo sem callout textual explícito.

R8 — FALLBACK OBRIGATÓRIO (nunca marque como ❓ um item que existe)
"❓ Pendente" = apenas quando a EXISTÊNCIA da peça é incerta.
"⚠️ Estimado" = peça EXISTE com certeza, mas alguma dimensão não está legível → use fallback:
  • Cozinha/Lavanderia profundidade: 0,60 m
  • Banheiro profundidade: 0,57 m
  • Altura rodapé: 0,10 m  |  Altura rodapia: 0,05 m
Nunca área = 0 para item cuja existência está confirmada. Isso causa subestimação de R$ 1.000+.

R9 — BORDA MEIA-ESQUADRIA (borda_ml)
Granito 3 cm (Tabaco, Branco): borda reta meia-esquadria no perímetro exposto do tampo.
Granito 2 cm (Siena, Slim): acabamento slim no perímetro exposto.
Estime os metros lineares das faces livres (frente + laterais não encostadas em parede). Anote como borda_ml.

═══════════════════════════════════════════════════════
ETAPA 1 — CONTEXTO
═══════════════════════════════════════════════════════
Descreva: ambientes com pedra, material(is) e espessura(s) identificados na legenda, observações gerais.

═══════════════════════════════════════════════════════
ETAPA 2 — INVENTÁRIO COMPLETO DE PEÇAS
═══════════════════════════════════════════════════════
Para cada módulo com pedra, liste TODOS os subcomponentes usando R1–R9 acima.
Por módulo considere obrigatoriamente:
• Tampo (horizontal) — pode ser 2 peças se for L (R4)
• Face vertical / pé — se visível na perspectiva ou frontal (R1)
• Rodapia 5 cm — cozinha/lavanderia (R2)
• Rodapé de base — faixa escura na base do módulo (distinto da rodapia)
• Respaldo / painel de parede — se indicado no projeto
• Prateleira / nicho — se em pedra

═══════════════════════════════════════════════════════
ETAPA 3 — DIMENSÕES
═══════════════════════════════════════════════════════
Para cada subcomponente: cota da vista GRANITO/SUPERIOR para tampos; vista FRONTAL para rodapés/saias.
Se a cota não estiver legível: aplique fallback de R8 e marque "(padrão)".

IMPORTANTE — CAMADA DE TEXTO PDF: antes de cada prancha há um bloco [CAMADA DE TEXTO PDF] com os valores
extraídos automaticamente do arquivo. Esses números são EXATOS (origem digital) — use-os como verdade
para comprimentos e larguras sempre que disponíveis. Confirme visualmente na imagem para associar cada
número ao item correto (qual peça corresponde a qual cota).

Formato — tabela markdown:
| Ambiente | Módulo | Subcomponente | Comp (m) | Larg/Alt (m) | Borda (ml) | Status | Obs |
(Status: ✅ Confirmado | ⚠️ Estimado | ❓ Pendente)`;

// ─── Prompt 2 — Revisão + JSON ────────────────────────────────────────────────
// Merged: review the analysis AND produce the final JSON in a single call.
// No separate Call 3 — area_m2 is computed in code from comprimento_m × largura_m.

function buildReviewPrompt(output1: string): string {
  return `Você é um revisor sênior de orçamentos de marmoraria. Recebeu a análise abaixo e deve fazer uma revisão crítica com as mesmas pranchas à vista.

───────────────────
${output1}
───────────────────

## PARTE 1 — CHECKLIST R1–R9

Percorra cada regra e anote APENAS as correções necessárias (itens sem problema não precisam aparecer):

R1 — BANCADA COM PÉ: o item de tampo deve incluir face vertical como area_m2 explícita? area_m2 = (C × prof_tampo) + (C × altura_face). Altura padrão face = 0,40 m (não 0,10 m — esse é rodapé). Verificar se o Scanner separou incorretamente em item extra — se sim, unificar e fornecer area_m2 total.
R2 — RODAPIA: 1 único item por módulo (comprimento frontal, não soma de alas).
R3 — COMPRIMENTO: usar sempre cota da vista GRANITO, não largura total do módulo.
R4 — TAMPO EM L: 2 tampos, mas 1 rodapé e 1 rodapia por módulo. Rodapé = frontal ala principal + lateral exposta da ala retorno.
R5 — CAFÉ/BAR (COZINHA): rodapé sem callout explícito → remover. Tampo = apenas trecho com pedra (dimensões dos CORTES, não módulo inteiro). EXCEÇÃO: módulos de LAVANDERIA (Mob. Tanque, Mob. Multiuso etc.) têm rodapé padrão com Granito Tabaco — NÃO remover rodapé de lavanderia por ausência de callout textual.
R6 — BANHEIRO: remover RI sem confirmação explícita no detalhe; remover rodapé em pedra. NÃO remover furo torneira — é serviço padrão do banheiro. borda_ml = comprimento + profundidade (2 faces: frente + 1 lateral), não 3 faces.
R7 — LAVANDERIA: tampo + rodapé separados por módulo. RI lavanderia ≠ RI cozinha. Mob. Tanque: confirmar Furo cuba embutir + Furo torneira.
R8 — FALLBACK: peça visivelmente existente → nunca ❓. Usar ⚠️ + fallback (prof. 0,60/0,57, rodapé 0,10, rodapia 0,05).
R9 — BORDA: borda_ml em todos os tampos (3 cm → meia-esquadria; 2 cm → slim).

## PARTE 2 — JSON FINAL

Após o checklist, produza APENAS o bloco JSON abaixo — sem texto extra antes ou depois do JSON.
Para a maioria dos itens: informe comprimento_m e largura_m — o sistema calcula area_m2 = C × L.
EXCEÇÃO: para "bancada com pé", forneça area_m2 explicitamente (tampo + face vertical). O sistema respeita area_m2 quando fornecido.

\`\`\`json
{
  "projeto": "nome do projeto ou 'Projeto sem nome'",
  "itens": [
    {
      "id": 1,
      "prancha_idx": null,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.10,
      "largura_m": 0.60,
      "borda_ml": 2.1,
      "servicos": [
        {"nome":"Rebaixo Italiano cozinha","qtd":1,"unidade":"un"},
        {"nome":"Borda Reta Meia Esquadria","qtd":2.1,"unidade":"ml"},
        {"nome":"Instalacao tampo sobre base","qtd":2.1,"unidade":"ml"}
      ],
      "pendencias": []
    }
  ]
}
\`\`\`

MAPEAMENTO:
status: ✅ → "confirmado" | ⚠️ → "parcial" | ❓ → "aguardando" (só existência incerta)
tipo: tampo | rodape | saia | revestimento | prateleira | outro
espessura_cm: 3 para Granito Tabaco/3cm | 2 para Siena/Slim/2cm
comprimento_m: coluna "Comp" da tabela
largura_m: coluna "Larg/Alt" — fallback: tampo coz/lav → 0.60 | banheiro → 0.57 | rodapé → 0.10 | rodapia → 0.05
area_m2: omitir na maioria dos itens (calculado C × L). Para "bancada com pé": fornecer explicitamente = (C × prof_tampo) + (C × altura_face).
borda_ml: coluna "Borda (ml)". Banheiro = comprimento + profundidade (2 faces). Bancada com pé = todas as faces expostas do conjunto.

Serviços — nomes EXATOS:
  RI coz  → {"nome":"Rebaixo Italiano cozinha","qtd":1,"unidade":"un"}
  RI lav  → {"nome":"Rebaixo Italiano lavanderia","qtd":1,"unidade":"un"}
  Cooktop → {"nome":"Recorte cooktop","qtd":1,"unidade":"un"}
  Cuba    → {"nome":"Furo cuba embutir","qtd":1,"unidade":"un"}
  Torneira→ {"nome":"Furo torneira","qtd":1,"unidade":"un"}
  Dispenser→{"nome":"Furo dispenser","qtd":1,"unidade":"un"}
  Torre   → {"nome":"Furo para torre de tomada","qtd":1,"unidade":"un"}
  3cm borda→{"nome":"Borda Reta Meia Esquadria","qtd":borda_ml,"unidade":"ml"}
  2cm borda→{"nome":"Acabamento Slim","qtd":borda_ml,"unidade":"ml"}
  Tampo   → {"nome":"Instalacao tampo sobre base","qtd":comprimento_m,"unidade":"ml"}
  Rodapé  → {"nome":"Instalacao rodape","qtd":PERIMETRO_EXPOSTO_ML,"unidade":"ml"}
            (onde PERIMETRO_EXPOSTO_ML = frontal + laterais expostas conforme R2/R4)`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMediaType(filename: string): 'image/jpeg' | 'image/png' {
  const lower = filename.toLowerCase();
  return (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) ? 'image/jpeg' : 'image/png';
}

async function buildImageBlocks(files: File[], pageTexts: string[]): Promise<Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>> {
  const blocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    if (files.length > 1) {
      blocks.push({ type: 'text', text: `--- Prancha ${idx + 1} de ${files.length} ---` });
    }
    // Inject text layer so AI has exact dimension values as ground truth
    const pageText = (pageTexts[idx] ?? '').trim();
    if (pageText) {
      blocks.push({
        type: 'text',
        text: `[CAMADA DE TEXTO PDF — Prancha ${idx + 1}]\n${pageText}`,
      });
    }
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: getMediaType(file.name), data: base64 },
    } satisfies Anthropic.ImageBlockParam);
  }
  return blocks;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];
    const pageTexts = formData.getAll('pageTexts') as string[];

    marmorariaLog('api/chamada-controlada', 'request received', {
      images: files.length,
      totalImageKB: Math.round(files.reduce((s, f) => s + f.size, 0) / 1024),
      pageTextsWithContent: pageTexts.filter((t) => t.trim()).length,
    });

    if (files.length === 0) {
      marmorariaError('api/chamada-controlada', 'no images in request');
      return Response.json({ error: 'Nenhuma imagem recebida' }, { status: 400 });
    }

    const imageBlocks = await buildImageBlocks(files, pageTexts);
    marmorariaLog('api/chamada-controlada', 'image blocks built', { blocks: imageBlocks.length });

    // ── Chamada 1 — Análise inicial ────────────────────────────────────────────
    marmorariaLog('api/chamada-controlada', 'Claude call 1 starting…');
    const res1 = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: PROMPT_1 }] }],
    });
    const output1 = res1.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n');
    marmorariaLog('api/chamada-controlada', 'Claude call 1 done', {
      ms: Date.now() - t0,
      outputChars: output1.length,
      inputTokens: res1.usage.input_tokens,
      outputTokens: res1.usage.output_tokens,
    });

    // ── Chamada 2 — Revisão + JSON ────────────────────────────────────────────
    marmorariaLog('api/chamada-controlada', 'Claude call 2 starting…');
    const res2 = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [
        { role: 'user', content: [...imageBlocks, { type: 'text', text: PROMPT_1 }] },
        { role: 'assistant', content: output1 },
        { role: 'user', content: buildReviewPrompt(output1) },
      ],
    });
    const output2 = res2.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n');
    marmorariaLog('api/chamada-controlada', 'Claude call 2 done', {
      ms: Date.now() - t0,
      outputChars: output2.length,
      inputTokens: res2.usage.input_tokens,
      outputTokens: res2.usage.output_tokens,
    });

    // ── Cálculo — sem chamada API, só código ──────────────────────────────────
    // Extract the JSON block from output2 and compute area_m2 = comprimento_m × largura_m
    let folha: FolhaMedicao | null = null;
    let resultado = null;
    let parseError: string | null = null;
    try {
      // Grab the last ```json ... ``` block in output2 (or bare JSON object)
      const jsonMatch = output2.match(/```(?:json)?\s*([\s\S]*?)```/g);
      let jsonRaw = '';
      if (jsonMatch) {
        jsonRaw = jsonMatch[jsonMatch.length - 1]
          .replace(/^```(?:json)?\s*/, '')
          .replace(/\s*```$/, '')
          .trim();
      } else {
        // fallback: find first { ... } spanning the whole object
        const start = output2.indexOf('{');
        const end = output2.lastIndexOf('}');
        if (start !== -1 && end !== -1) jsonRaw = output2.slice(start, end + 1);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = JSON.parse(jsonRaw) as { projeto: string; itens: any[] };

      folha = {
        projeto: raw.projeto,
        itens: raw.itens.map((item) => {
          const c = Number(item.comprimento_m ?? 0);
          const l = Number(item.largura_m ?? 0);
          // Se o AI forneceu area_m2 explicitamente (ex: bancada com pé = tampo + face vertical),
          // respeita o valor. Caso contrário calcula c × l normalmente.
          const aiArea = Number(item.area_m2 ?? 0);
          return {
            ...item,
            comprimento_m: c,
            largura_m: l,
            area_m2: aiArea > 0 ? parseFloat(aiArea.toFixed(4)) : parseFloat((c * l).toFixed(4)),
          };
        }),
      } as FolhaMedicao;

      resultado = calcularOrcamento(folha);
      marmorariaLog('api/chamada-controlada', 'calcularOrcamento OK', {
        itens: folha.itens.length,
        totalGeral: resultado.totalGeral,
        ms: Date.now() - t0,
      });
    } catch (e) {
      parseError = `Erro ao interpretar JSON: ${e instanceof Error ? e.message : String(e)}`;
      marmorariaError('api/chamada-controlada', 'JSON parse failed', e);
    }

    return Response.json({
      output1,
      output2,
      folha,
      resultado,
      parseError,
      usage1: res1.usage,
      usage2: res2.usage,
    });
  } catch (error) {
    marmorariaError('api/chamada-controlada', 'unhandled error', error);
    const msg = error instanceof Error ? error.message : String(error);
    const detail = (error as { status?: number; error?: unknown })?.error;
    const userMessage = formatMarmorariaApiError(msg);
    const status = /credit balance is too low/i.test(msg) ? 402 : 500;
    marmorariaLog('api/chamada-controlada', 'returning error to client', { status, userMessage });
    return Response.json({ error: userMessage, detail: detail ?? null, raw: msg }, { status });
  }
}
