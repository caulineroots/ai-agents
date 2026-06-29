/**
 * Cron endpoint — briefings diários via WhatsApp.
 *
 * Configurar no Railway (cron separado do de lembretes):
 *   Schedule: * * * * *   (a cada 1 minuto)
 *   URL: https://<seu-domínio>/api/cron/diario
 *   Header: Authorization: Bearer <CRON_SECRET>
 *
 * Horários BRT:
 *   06:00 — bom dia: objetivo da semana + tarefas de hoje
 *   12:00 — meio-dia: objetivo + tarefas pendentes
 *   16:00 — tarde: objetivo + tarefas pendentes
 *   19:00 — fim do dia: concluídas hoje + ainda pendentes
 *   +2h após prazo_hora — check de conclusão de tarefa
 */

import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { criarPendingAction } from '@/lib/whatsapp/pending-actions';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;
const CRON_SECRET = process.env.CRON_SECRET!;
const OWNER_PHONE = process.env.OWNER_PHONE!;

const JANELA_MS = 90_000; // 90 segundos de tolerância

interface VaultDoc {
  id: string;
  title: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function agoraBRT(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function hojeStr(brt: Date): string {
  return brt.toISOString().slice(0, 10);
}

/** Verifica se o horário atual BRT está dentro da janela de 90s após o target (HH:MM) */
function dentroJanela(brt: Date, targetHora: string): boolean {
  const [h, m] = targetHora.split(':').map(Number);
  const target = new Date(brt);
  target.setHours(h, m, 0, 0);
  const diffMs = brt.getTime() - target.getTime();
  return diffMs >= 0 && diffMs < JANELA_MS;
}

async function jáEnviou(phone: string, refKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('daily_briefings')
    .select('id')
    .eq('phone', phone)
    .eq('ref_key', refKey)
    .limit(1)
    .single();
  return !!data;
}

async function marcarEnviado(phone: string, refKey: string): Promise<void> {
  await supabase
    .from('daily_briefings')
    .upsert({ phone, ref_key: refKey }, { onConflict: 'phone,ref_key' });
}

async function enviar(phone: string, texto: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ number: phone, text: texto }),
      },
    );
    return res.ok;
  } catch (err) {
    console.error('[cron/diario] erro ao enviar:', err);
    return false;
  }
}

// ── Busca de dados ────────────────────────────────────────────────────────────

async function buscarTarefas(filtro?: Record<string, unknown>, limit = 10): Promise<VaultDoc[]> {
  let query = supabase
    .from('vault_documents')
    .select('id, title, metadata, created_at')
    .eq('type', 'task')
    .eq('phone', OWNER_PHONE)
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data } = await query;
  let docs = (data ?? []) as VaultDoc[];

  if (filtro) {
    docs = docs.filter((d) =>
      Object.entries(filtro).every(([k, v]) => d.metadata[k] === v),
    );
  }

  return docs;
}

async function buscarObjetivoAtivo(): Promise<VaultDoc | null> {
  const { data } = await supabase
    .from('vault_documents')
    .select('id, title, metadata, created_at')
    .eq('type', 'goal')
    .eq('phone', OWNER_PHONE)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data) return null;

  // Semana ISO atual
  const agora = agoraBRT();
  const d = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const semanaAtual = `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  const mesAtual = agora.toISOString().slice(0, 7);

  return (data as VaultDoc[]).find((d) => {
    const m = d.metadata;
    return m.status === 'ativo' &&
      (m.semana_ref === semanaAtual || m.mes_ref === mesAtual);
  }) ?? null;
}

function formatarTarefasBreve(tarefas: VaultDoc[]): string {
  if (tarefas.length === 0) return 'Nenhuma tarefa pendente.';
  return tarefas
    .map((t, i) => {
      const m = t.metadata;
      const prazo = m.prazo ? ` · prazo ${m.prazo as string}` : '';
      const urg = m.urgencia === 'alta' ? ' 🔴' : m.urgencia === 'media' ? ' 🟡' : ' 🟢';
      return `${i + 1}. ${t.title}${prazo}${urg}`;
    })
    .join('\n');
}

function formatarObjetivoBreve(goal: VaultDoc): string {
  const m = goal.metadata;
  const pct = (m.meta_valor as number) > 0
    ? Math.round(((m.progresso_atual as number) / (m.meta_valor as number)) * 100)
    : 0;
  const barra = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
  return `🎯 ${goal.title}\n${barra} ${m.progresso_atual}/${m.meta_valor} ${m.unidade} (${pct}%)`;
}

// ── Briefings ─────────────────────────────────────────────────────────────────

async function briefingManha(phone: string, hoje: string): Promise<string | null> {
  const refKey = `manha_${hoje}`;
  if (await jáEnviou(phone, refKey)) return null;

  const [goal, tarefasHoje] = await Promise.all([
    buscarObjetivoAtivo(),
    buscarTarefas({ status: 'pendente' }, 8),
  ]);

  const tarefasComPrazoHoje = tarefasHoje.filter(
    (t) => (t.metadata.prazo as string | undefined) === hoje,
  );
  const demaisPendentes = tarefasHoje.filter(
    (t) => !(t.metadata.prazo as string | undefined) || (t.metadata.prazo as string) >= hoje,
  ).slice(0, 5);

  // Não envia se não há nada relevante
  if (!goal && tarefasHoje.length === 0) return null;

  const partes: string[] = ['🌅 Bom dia!\n'];

  if (goal) partes.push(formatarObjetivoBreve(goal));

  if (tarefasComPrazoHoje.length > 0) {
    partes.push(`\n📋 Tarefas de hoje:\n${formatarTarefasBreve(tarefasComPrazoHoje)}`);
  } else if (demaisPendentes.length > 0) {
    partes.push(`\n📋 Tarefas pendentes:\n${formatarTarefasBreve(demaisPendentes)}`);
  }

  await marcarEnviado(phone, refKey);
  return partes.join('\n');
}

async function briefingMeioTarde(
  phone: string,
  hoje: string,
  tipo: 'meio' | 'tarde',
): Promise<string | null> {
  const refKey = `${tipo}_${hoje}`;
  if (await jáEnviou(phone, refKey)) return null;

  const [goal, pendentes] = await Promise.all([
    buscarObjetivoAtivo(),
    buscarTarefas({ status: 'pendente' }, 5),
  ]);

  if (!goal && pendentes.length === 0) return null;

  const emoji = tipo === 'meio' ? '☀️' : '🌆';
  const saudacao = tipo === 'meio' ? 'Resumo do meio-dia' : 'Resumo da tarde';
  const partes = [`${emoji} ${saudacao}\n`];

  if (goal) partes.push(formatarObjetivoBreve(goal));
  if (pendentes.length > 0) {
    partes.push(`\n📋 Pendentes:\n${formatarTarefasBreve(pendentes)}`);
  }

  await marcarEnviado(phone, refKey);
  return partes.join('\n');
}

async function briefingFimDia(phone: string, hoje: string): Promise<string | null> {
  const refKey = `fim_${hoje}`;
  if (await jáEnviou(phone, refKey)) return null;

  const [concluidas, pendentes] = await Promise.all([
    buscarTarefas({ status: 'concluida' }, 10),
    buscarTarefas({ status: 'pendente' }, 8),
  ]);

  // Filtra concluídas de hoje (por updated_at aproximado, usa created_at como fallback)
  const concluidasHoje = concluidas.filter((t) => {
    const prazo = t.metadata.prazo as string | undefined;
    return prazo === hoje || t.created_at.startsWith(hoje);
  }).slice(0, 5);

  if (concluidasHoje.length === 0 && pendentes.length === 0) return null;

  const partes = ['🌙 Finalizando o dia\n'];

  if (concluidasHoje.length > 0) {
    const lista = concluidasHoje.map((t, i) => `${i + 1}. ✅ ${t.title}`).join('\n');
    partes.push(`Concluídas hoje:\n${lista}`);
  }

  if (pendentes.length > 0) {
    partes.push(`\nAinda pendentes:\n${formatarTarefasBreve(pendentes.slice(0, 5))}`);
  }

  await marcarEnviado(phone, refKey);
  return partes.join('\n');
}

// ── Task check (+2h após prazo_hora) ─────────────────────────────────────────

async function processarTaskChecks(
  phone: string,
  hoje: string,
  agora: Date,
): Promise<number> {
  // Busca tarefas com prazo hoje e hora definida, status pendente/em_andamento
  const { data } = await supabase
    .from('vault_documents')
    .select('id, title, metadata')
    .eq('type', 'task')
    .order('created_at', { ascending: true });

  if (!data) return 0;

  const tarefasHoje = (data as VaultDoc[]).filter((t) => {
    const m = t.metadata;
    return m.prazo === hoje &&
      m.prazo_hora &&
      (m.status === 'pendente' || m.status === 'em_andamento');
  });

  let enviados = 0;

  for (const tarefa of tarefasHoje) {
    const prazoHora = tarefa.metadata.prazo_hora as string;
    const [h, m] = prazoHora.split(':').map(Number);

    // Alvo: prazo_hora + 2 horas
    const alvo = new Date(agora);
    alvo.setHours(h + 2, m, 0, 0);

    const diffMs = agora.getTime() - alvo.getTime();
    if (diffMs < 0 || diffMs >= JANELA_MS) continue;

    const refKey = `task_check_${hoje}_${tarefa.id}`;
    if (await jáEnviou(phone, refKey)) continue;

    const msg = `Oi! A tarefa "${tarefa.title}" estava programada para às ${prazoHora}.\n\nFoi concluída?\n\nResponda:\nSIM — concluída ✅\nADIADO — ainda vou fazer\nCANCELADO — não vou mais fazer`;

    const ok = await enviar(phone, msg);
    if (!ok) continue;

    // Cria pending action para capturar a resposta no webhook (TTL 4h)
    // Permite múltiplas task_checks simultâneas (cancelarAnterior = false)
    await criarPendingAction(phone, 'task_check', {
      task_id: tarefa.id,
      task_title: tarefa.title,
    }, 240, false);

    await marcarEnviado(phone, refKey);
    enviados++;
  }

  return enviados;
}

/** Versão de teste: ignora janela de tempo, envia para todas as tarefas de hoje com prazo_hora */
async function processarTaskChecksForced(phone: string, hoje: string): Promise<number> {
  const { data } = await supabase
    .from('vault_documents')
    .select('id, title, metadata')
    .eq('type', 'task');

  if (!data) return 0;

  const tarefasHoje = (data as VaultDoc[]).filter((t) => {
    const m = t.metadata;
    return m.prazo === hoje &&
      m.prazo_hora &&
      (m.status === 'pendente' || m.status === 'em_andamento');
  });

  let enviados = 0;

  for (const tarefa of tarefasHoje) {
    const prazoHora = tarefa.metadata.prazo_hora as string;
    const refKey = `task_check_${hoje}_${tarefa.id}`;

    // Apaga deduplicação para permitir reenvio no force
    await supabase
      .from('daily_briefings')
      .delete()
      .eq('phone', phone)
      .eq('ref_key', refKey);

    const msg = `⏰ *Check de tarefa*\n\n"${tarefa.title}" estava programada para às ${prazoHora}.\n\nFoi concluída? Responda:\n*SIM* — concluída ✅\n*ADIADO* — ainda vou fazer ⏸️\n*CANCELADO* — não vou mais fazer ❌`;

    const ok = await enviar(phone, msg);
    if (!ok) continue;

    // Permite múltiplas task_checks simultâneas
    await criarPendingAction(phone, 'task_check', {
      task_id: tarefa.id,
      task_title: tarefa.title,
    }, 240, false);

    await marcarEnviado(phone, refKey);
    enviados++;
  }

  return enviados;
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!OWNER_PHONE) {
    return Response.json({ error: 'OWNER_PHONE não configurado' }, { status: 500 });
  }

  try {
    const agora = agoraBRT();
    const hoje = hojeStr(agora);
    const log: string[] = [];
    let totalEnviados = 0;

    // ?force=manha|meio|tarde|fim — ignora janela de horário e deduplicação (para testes)
    const force = req.nextUrl.searchParams.get('force');

    // ── Briefings fixos ──────────────────────────────────────────────────────

    const briefings: Array<{ horario: string; chave: string; fn: () => Promise<string | null> }> = [
      { horario: '06:00', chave: 'manha', fn: () => briefingManha(OWNER_PHONE, hoje) },
      { horario: '12:00', chave: 'meio',  fn: () => briefingMeioTarde(OWNER_PHONE, hoje, 'meio') },
      { horario: '16:00', chave: 'tarde', fn: () => briefingMeioTarde(OWNER_PHONE, hoje, 'tarde') },
      { horario: '19:00', chave: 'fim',   fn: () => briefingFimDia(OWNER_PHONE, hoje) },
    ];

    for (const { horario, chave, fn } of briefings) {
      const isForced = force === chave;
      if (!isForced && !dentroJanela(agora, horario)) continue;

      // Em modo force, apaga o registro de "já enviado" para permitir reenvio
      if (isForced) {
        await supabase
          .from('daily_briefings')
          .delete()
          .eq('phone', OWNER_PHONE)
          .eq('ref_key', `${chave}_${hoje}`);

      }

      const msg = await fn();
      if (!msg) {
        log.push(`${horario}: sem conteúdo ou já enviado`);
        continue;
      }

      const ok = await enviar(OWNER_PHONE, msg);
      if (ok) {
        totalEnviados++;
        log.push(`${horario}: ✓ enviado`);
      } else {
        log.push(`${horario}: ✗ falha no envio`);
      }
    }

    // ── Task checks (+2h após prazo_hora) ────────────────────────────────────

    // ?force=task_check — ignora janela de horário, envia para todas as tarefas de hoje com prazo_hora
    if (force === 'task_check') {
      const checks = await processarTaskChecksForced(OWNER_PHONE, hoje);
      if (checks > 0) {
        totalEnviados += checks;
        log.push(`task_check (forced): ${checks} enviado(s)`);
      } else {
        log.push('task_check (forced): nenhuma tarefa com prazo_hora hoje');
      }
    } else {
      const checks = await processarTaskChecks(OWNER_PHONE, hoje, agora);
      if (checks > 0) {
        totalEnviados += checks;
        log.push(`task_check: ${checks} enviado(s)`);
      }
    }

    return Response.json({ enviados: totalEnviados, log });
  } catch (err) {
    console.error('[cron/diario] erro inesperado:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
