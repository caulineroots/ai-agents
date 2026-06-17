const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;

const DELAY_ENTRE_MENSAGENS_MS = 45_000; // 45 segundos entre cada envio
const LIMITE_DIARIO = 30;

interface Lead {
  nome: string;
  numero: string; // formato: 5511999999999
  segmento: 'marmoraria' | 'marcenaria';
}

function montarMensagem(lead: Lead): string {
  const produto =
    lead.segmento === 'marmoraria'
      ? 'orçamentos de marmoraria a partir de projetos arquitetônicos'
      : 'orçamentos de marcenaria a partir de projetos arquitetônicos';

  return `Oi${lead.nome ? ` ${lead.nome.split(' ')[0]}` : ''}, tudo bem?

Desenvolvemos um agente de IA que lê projetos arquitetônicos e gera ${produto} automaticamente — o que leva horas hoje passa a levar minutos.

Faz sentido eu te mostrar como funciona?`;
}

async function enviarMensagem(numero: string, texto: string): Promise<boolean> {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: numero, text: texto }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const { leads }: { leads: Lead[] } = await request.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return Response.json({ error: 'Lista de leads obrigatória' }, { status: 400 });
    }

    const lote = leads.slice(0, LIMITE_DIARIO);
    const resultados: { numero: string; nome: string; ok: boolean }[] = [];

    for (const lead of lote) {
      const mensagem = montarMensagem(lead);
      const ok = await enviarMensagem(lead.numero, mensagem);
      resultados.push({ numero: lead.numero, nome: lead.nome, ok });

      console.log(`[enviar] ${lead.nome} (${lead.numero}): ${ok ? '✓' : '✗'}`);

      // Não espera o delay após o último lead
      if (lead !== lote[lote.length - 1]) {
        await delay(DELAY_ENTRE_MENSAGENS_MS);
      }
    }

    const enviados = resultados.filter((r) => r.ok).length;
    const falhas = resultados.filter((r) => !r.ok).length;

    return Response.json({ enviados, falhas, resultados });
  } catch (error) {
    console.error('[enviar] erro:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
