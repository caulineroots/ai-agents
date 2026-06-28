/**
 * Vault — armazenamento estruturado de dados do negócio no Supabase.
 * Tipos suportados: lead, client, project, task, financial.
 */

import { supabase } from '@/lib/supabase/client';

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
