/**
 * Vault — armazenamento estruturado de dados do negócio no Supabase.
 * Tipos suportados: lead, client, project, task, financial.
 */

import { supabase } from '@/lib/supabase/client';
import { getPrompt } from './prompts-db';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type VaultType = 'lead' | 'client' | 'project' | 'task' | 'financial';

export interface VaultDocument {
  id: string;
  type: VaultType;
  title: string;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Metadados específicos por tipo
export interface TarefaMetadata {
  prazo?: string;           // ISO date string, ex: "2026-07-10"
  prazo_hora?: string;      // Horário, ex: "10:00" — opcional
  urgencia?: 'baixa' | 'media' | 'alta';
  status?: 'pendente' | 'em_andamento' | 'concluida';
  projeto_id?: string | null;
  calendar_event_id?: string | null;
}

export interface LeadMetadata {
  empresa?: string;
  telefone?: string;
  interesse?: string;
  qualificado?: boolean;
  status?: 'novo' | 'em_contato' | 'qualificado' | 'perdido' | 'fechado';
}

export interface ProjetoMetadata {
  cliente?: string;
  status?: 'ativo' | 'pausado' | 'concluido';
  valor_estimado?: number;
}

export interface FinanceiroMetadata {
  valor: number;
  tipo: 'receita' | 'despesa';
  projeto?: string;
  data?: string;
}

// ─── CRUD genérico ────────────────────────────────────────────────────────────

export async function criar(
  type: VaultType,
  title: string,
  content?: string,
  metadata?: Record<string, unknown>,
): Promise<VaultDocument | null> {
  const { data, error } = await supabase
    .from('vault_documents')
    .insert({ type, title, content: content ?? null, metadata: metadata ?? {} })
    .select()
    .single();

  if (error) {
    console.error('[vault] erro ao criar:', error);
    return null;
  }
  return data as VaultDocument;
}

export async function listar(
  type?: VaultType,
  filtros?: Record<string, unknown>,
  limit = 20,
): Promise<VaultDocument[]> {
  let query = supabase
    .from('vault_documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) {
    console.error('[vault] erro ao listar:', error);
    return [];
  }

  // Filtros opcionais sobre metadata (client-side após query)
  let docs = (data ?? []) as VaultDocument[];
  if (filtros) {
    docs = docs.filter((doc) =>
      Object.entries(filtros).every(([k, v]) => doc.metadata[k] === v),
    );
  }
  return docs;
}

export async function atualizar(
  id: string,
  updates: Partial<{ title: string; content: string; metadata: Record<string, unknown> }>,
): Promise<boolean> {
  const { error } = await supabase
    .from('vault_documents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[vault] erro ao atualizar:', error);
    return false;
  }
  return true;
}

export async function deletar(id: string): Promise<boolean> {
  const { error } = await supabase.from('vault_documents').delete().eq('id', id);
  if (error) {
    console.error('[vault] erro ao deletar:', error);
    return false;
  }
  return true;
}

// ─── Helpers por módulo ───────────────────────────────────────────────────────

export async function criarTarefa(
  titulo: string,
  meta?: TarefaMetadata,
): Promise<VaultDocument | null> {
  return criar('task', titulo, undefined, {
    prazo: meta?.prazo ?? null,
    prazo_hora: meta?.prazo_hora ?? null,
    urgencia: meta?.urgencia ?? 'media',
    status: meta?.status ?? 'pendente',
    projeto_id: meta?.projeto_id ?? null,
    calendar_event_id: null,
  });
}

export async function criarLead(
  nome: string,
  meta?: LeadMetadata,
): Promise<VaultDocument | null> {
  return criar('lead', nome, undefined, {
    empresa: meta?.empresa ?? null,
    telefone: meta?.telefone ?? null,
    interesse: meta?.interesse ?? null,
    qualificado: meta?.qualificado ?? false,
    status: meta?.status ?? 'novo',
  });
}

export async function criarProjeto(
  nome: string,
  meta?: ProjetoMetadata,
): Promise<VaultDocument | null> {
  return criar('project', nome, undefined, {
    cliente: meta?.cliente ?? null,
    status: meta?.status ?? 'ativo',
    valor_estimado: meta?.valor_estimado ?? null,
  });
}

export async function criarFinanceiro(
  descricao: string,
  meta: FinanceiroMetadata,
): Promise<VaultDocument | null> {
  const sinal = meta.tipo === 'receita' ? '+' : '-';
  const titulo = `${sinal} R$${meta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — ${descricao}`;
  return criar('financial', titulo, descricao, {
    valor: meta.valor,
    tipo: meta.tipo,
    projeto: meta.projeto ?? null,
    data: meta.data ?? new Date().toISOString().slice(0, 10),
  });
}

// ─── Formatação para WhatsApp ─────────────────────────────────────────────────

export function formatarTarefas(docs: VaultDocument[]): string {
  if (docs.length === 0) return 'Nenhuma tarefa encontrada.';
  return docs
    .map((d, i) => {
      const m = d.metadata as TarefaMetadata;
      const prazo = m.prazo ? ` · prazo ${m.prazo}` : '';
      const urg = m.urgencia === 'alta' ? ' 🔴' : m.urgencia === 'media' ? ' 🟡' : ' 🟢';
      const status = m.status === 'concluida' ? ' ✅' : m.status === 'em_andamento' ? ' 🔄' : ' ⏳';
      return `${i + 1}. ${d.title}${prazo}${urg}${status}`;
    })
    .join('\n');
}

export function formatarLeads(docs: VaultDocument[]): string {
  if (docs.length === 0) return 'Nenhum lead encontrado.';
  return docs
    .map((d, i) => {
      const m = d.metadata as LeadMetadata;
      const empresa = m.empresa ? ` (${m.empresa})` : '';
      const status = m.status ?? 'novo';
      return `${i + 1}. ${d.title}${empresa} · ${status}`;
    })
    .join('\n');
}

export function formatarProjetos(docs: VaultDocument[]): string {
  if (docs.length === 0) return 'Nenhum projeto encontrado.';
  return docs
    .map((d, i) => {
      const m = d.metadata as ProjetoMetadata;
      const cliente = m.cliente ? ` · ${m.cliente}` : '';
      const valor = m.valor_estimado
        ? ` · R$${m.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : '';
      return `${i + 1}. ${d.title}${cliente}${valor} [${m.status ?? 'ativo'}]`;
    })
    .join('\n');
}

export function formatarFinanceiro(docs: VaultDocument[]): string {
  if (docs.length === 0) return 'Nenhum lançamento encontrado.';
  let totalReceita = 0;
  let totalDespesa = 0;
  const linhas = docs.map((d) => {
    const m = d.metadata as FinanceiroMetadata;
    if (m.tipo === 'receita') totalReceita += m.valor;
    else totalDespesa += m.valor;
    return `• ${d.title}`;
  });
  const saldo = totalReceita - totalDespesa;
  const saldoStr = `\nSaldo: R$${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (↑${totalReceita.toLocaleString('pt-BR')} / ↓${totalDespesa.toLocaleString('pt-BR')})`;
  return linhas.join('\n') + saldoStr;
}

// ─── Lembretes ────────────────────────────────────────────────────────────────

interface ReminderConfig {
  offsets_com_hora: number[];
  offsets_sem_hora: number[];
  labels: Record<string, string>;
}

const DEFAULT_CONFIG: ReminderConfig = {
  offsets_com_hora: [-1440, -720, -360, -120, -60, -30, -10, -2],
  offsets_sem_hora: [-1440, -60],
  labels: {
    '-1440': '24h', '-720': '12h', '-360': '6h', '-120': '2h',
    '-60': '1h', '-30': '30m', '-10': '10m', '-2': '2m', 'manha': 'manhã',
  },
};

/**
 * Agenda lembretes no Supabase para uma tarefa com prazo.
 * Retorna o número de lembretes inseridos.
 */
export async function agendarLembretes(
  taskId: string,
  phone: string,
  prazo: string,        // "YYYY-MM-DD"
  prazoHora?: string,   // "HH:MM" — opcional
): Promise<number> {
  try {
    const configRaw = await getPrompt('reminder_config');
    const config: ReminderConfig = configRaw ? JSON.parse(configRaw) : DEFAULT_CONFIG;

    const temHora = Boolean(prazoHora);
    const hora = prazoHora ?? '09:00';  // hora default para tarefas sem horário
    const [hh, mm] = hora.split(':').map(Number);

    // Monta o datetime do evento em Brasília (UTC-3)
    const eventoBRT = new Date(`${prazo}T${hora}:00-03:00`);

    const offsets = temHora ? config.offsets_com_hora : config.offsets_sem_hora;
    const agora = new Date();

    const rows = offsets
      .map((offsetMin) => {
        const sendAt = new Date(eventoBRT.getTime() + offsetMin * 60 * 1000);
        // Não agenda lembretes no passado
        if (sendAt <= agora) return null;
        const label = config.labels[String(offsetMin)] ?? `${Math.abs(offsetMin)}m`;
        return {
          vault_document_id: taskId,
          phone,
          send_at: sendAt.toISOString(),
          offset_label: label,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) return 0;

    // Para tarefas sem hora específica, adiciona lembrete especial na manhã do dia
    if (!temHora) {
      const manhaEvento = new Date(`${prazo}T08:00:00-03:00`);
      if (manhaEvento > agora) {
        rows.push({
          vault_document_id: taskId,
          phone,
          send_at: manhaEvento.toISOString(),
          offset_label: 'manhã',
        });
      }
    }

    const { error } = await supabase.from('reminders').insert(rows);
    if (error) {
      console.error('[vault] erro ao agendar lembretes:', error.message);
      return 0;
    }

    return rows.length;
  } catch (err) {
    console.error('[vault] erro inesperado em agendarLembretes:', err);
    return 0;
  }
}

/**
 * Lista lembretes pendentes de um phone (próximos 7 dias).
 */
export async function listarLembretes(phone: string): Promise<string> {
  const agora = new Date().toISOString();
  const limite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('reminders')
    .select('send_at, offset_label, vault_document_id')
    .eq('phone', phone)
    .eq('sent', false)
    .gte('send_at', agora)
    .lte('send_at', limite)
    .order('send_at', { ascending: true })
    .limit(20);

  if (error || !data || data.length === 0) {
    return 'Nenhum lembrete agendado nos próximos 7 dias.';
  }

  // Busca títulos das tarefas
  const ids = [...new Set(data.map(r => r.vault_document_id).filter(Boolean))];
  const { data: tarefas } = await supabase
    .from('vault_documents')
    .select('id, title')
    .in('id', ids);

  const tituloMap = new Map((tarefas ?? []).map(t => [t.id, t.title as string]));

  const linhas = data.map(r => {
    const dt = new Date(r.send_at as string);
    const dtBRT = new Date(dt.getTime() - 3 * 60 * 60 * 1000);
    const dataStr = dtBRT.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const horaStr = dtBRT.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const titulo = tituloMap.get(r.vault_document_id as string) ?? 'tarefa';
    return `• ${dataStr} às ${horaStr} — "${titulo}" (falta ${r.offset_label})`;
  });

  return `Lembretes agendados:\n${linhas.join('\n')}`;
}

/**
 * Cancela lembretes de uma tarefa específica ou todos de um phone.
 */
export async function cancelarLembretes(phone: string, taskId?: string): Promise<number> {
  let query = supabase
    .from('reminders')
    .delete()
    .eq('phone', phone)
    .eq('sent', false);

  if (taskId) query = query.eq('vault_document_id', taskId) as typeof query;

  const { error, count } = await query;
  if (error) {
    console.error('[vault] erro ao cancelar lembretes:', error.message);
    return 0;
  }
  return count ?? 0;
}
