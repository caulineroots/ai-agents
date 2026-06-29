/**
 * Cron endpoint — processa e envia lembretes pendentes.
 *
 * Configurar no Railway:
 *   Schedule: * * * * *   (a cada 1 minuto)
 *   URL: https://<seu-domínio>/api/cron/lembretes
 *   Header: Authorization: Bearer <CRON_SECRET>
 */

import { supabase } from '@/lib/supabase/client';
import { NextRequest } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;
const CRON_SECRET = process.env.CRON_SECRET!;

// Janela de busca: lembretes que deveriam ter sido enviados até agora
// (com até 90s de atraso tolerado, para cobrir execuções atrasadas)
const JANELA_ATRASO_MS = 90_000;

interface ReminderRow {
  id: string;
  vault_document_id: string;
  phone: string;
  send_at: string;
  offset_label: string;
}

async function enviarMensagemWhatsApp(phone: string, texto: string): Promise<boolean> {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phone, text: texto }),
    });
    return res.ok;
  } catch (err) {
    console.error('[cron/lembretes] erro no envio:', err);
    return false;
  }
}

function formatarMensagemLembrete(
  titulo: string,
  offsetLabel: string,
  prazo: string,
  prazoHora: string | null,
): string {
  const dataFormatada = new Date(`${prazo}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });

  const horaStr = prazoHora ? ` às ${prazoHora}` : '';

  const prefixo = {
    '24h': 'Lembrete: falta 1 dia',
    '12h': 'Lembrete: faltam 12 horas',
    '6h': 'Lembrete: faltam 6 horas',
    '2h': 'Lembrete: faltam 2 horas',
    '1h': 'Lembrete: falta 1 hora',
    '30m': 'Lembrete: faltam 30 minutos',
    '10m': 'Lembrete: faltam 10 minutos',
    '2m': 'Lembrete: AGORA em 2 minutos',
    'manhã': 'Bom dia! Lembrete do dia',
  }[offsetLabel] ?? `Lembrete (${offsetLabel})`;

  return `${prefixo}\n"${titulo}"\n${dataFormatada}${horaStr}`;
}

export async function GET(req: NextRequest) {
  // Autenticação
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const agora = new Date();
    const limite = new Date(agora.getTime() - JANELA_ATRASO_MS).toISOString();
    const agoraISO = agora.toISOString();

    // Busca lembretes que vencem agora (incluindo até 90s no passado)
    const { data: lembretes, error } = await supabase
      .from('reminders')
      .select('id, vault_document_id, phone, send_at, offset_label')
      .eq('sent', false)
      .gte('send_at', limite)
      .lte('send_at', agoraISO)
      .order('send_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('[cron/lembretes] erro ao buscar:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!lembretes || lembretes.length === 0) {
      return Response.json({ enviados: 0, mensagem: 'Nenhum lembrete pendente.' });
    }

    // Busca títulos e metadados das tarefas relacionadas
    const taskIds = [...new Set(lembretes.map((r: ReminderRow) => r.vault_document_id).filter(Boolean))];
    const { data: tarefas } = await supabase
      .from('vault_documents')
      .select('id, title, metadata')
      .in('id', taskIds);

    const tarefaMap = new Map(
      (tarefas ?? []).map((t) => [t.id as string, t as { id: string; title: string; metadata: Record<string, unknown> }])
    );

    const resultados: { id: string; ok: boolean }[] = [];

    for (const lembrete of lembretes as ReminderRow[]) {
      const tarefa = tarefaMap.get(lembrete.vault_document_id);
      const titulo = tarefa?.title ?? 'Tarefa';
      const meta = tarefa?.metadata ?? {};
      const prazo = (meta.prazo as string) ?? lembrete.send_at.slice(0, 10);
      const prazoHora = (meta.prazo_hora as string) ?? null;

      const mensagem = formatarMensagemLembrete(titulo, lembrete.offset_label, prazo, prazoHora);
      const ok = await enviarMensagemWhatsApp(lembrete.phone, mensagem);

      // Marca como enviado independente do resultado (evita spam em falha temporária)
      await supabase
        .from('reminders')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', lembrete.id);

      resultados.push({ id: lembrete.id, ok });
      console.log(`[cron/lembretes] lembrete ${lembrete.id} → ${lembrete.phone} "${titulo}" (${lembrete.offset_label}): ${ok ? '✓' : '✗'}`);
    }

    const enviados = resultados.filter((r) => r.ok).length;
    const falhas = resultados.filter((r) => !r.ok).length;

    // ── Também dispara o cron de briefings diários (mesmo job, mesma autenticação) ──
    let diario: Record<string, unknown> = {};
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
        ?? process.env.VERCEL_URL
        ?? 'http://localhost:3000';
      const protocol = baseUrl.startsWith('localhost') ? 'http' : 'https';
      const url = baseUrl.startsWith('http') ? baseUrl : `${protocol}://${baseUrl}`;

      const res = await fetch(`${url}/api/cron/diario`, {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      });
      if (res.ok) diario = await res.json();
    } catch (err) {
      console.error('[cron/lembretes] erro ao chamar /api/cron/diario:', err);
    }

    return Response.json({
      enviados,
      falhas,
      total: resultados.length,
      ids: resultados.map((r) => r.id),
      diario,
    });
  } catch (err) {
    console.error('[cron/lembretes] erro inesperado:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
