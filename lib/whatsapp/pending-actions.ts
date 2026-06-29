/**
 * Ações pendentes — estado temporário para fluxos de confirmação
 * (delete com dupla confirmação, edição de prompt via chat, etc.)
 */

import { supabase } from '@/lib/supabase/client';

export interface PendingAction {
  id: string;
  phone: string;
  type: 'delete' | 'delete_selection' | 'prompt_edit' | 'task_check';
  metadata: Record<string, unknown>;
  expires_at: string;
  created_at: string;
}

export async function criarPendingAction(
  phone: string,
  type: PendingAction['type'],
  metadata: Record<string, unknown>,
  ttlMinutos = 10,
  cancelarAnterior = true,
): Promise<PendingAction | null> {
  // task_check permite múltiplos simultâneos (um por tarefa)
  if (cancelarAnterior) {
    await cancelarPendingAction(phone, type);
  }

  const expiresAt = new Date(Date.now() + ttlMinutos * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('pending_actions')
    .insert({ phone, type, metadata, expires_at: expiresAt })
    .select()
    .single();

  if (error || !data) {
    console.error('[pending-actions] erro ao criar:', error?.message);
    return null;
  }

  return data as PendingAction;
}

/** Retorna TODAS as task_checks pendentes de um phone, ordenadas da mais antiga para a mais recente */
export async function getTodasTaskChecks(phone: string): Promise<PendingAction[]> {
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('phone', phone)
    .eq('type', 'task_check')
    .gt('expires_at', now)
    .order('created_at', { ascending: true });

  return (data ?? []) as PendingAction[];
}

/** Cancela uma task_check específica pelo id */
export async function cancelarPendingActionById(id: string): Promise<void> {
  await supabase.from('pending_actions').delete().eq('id', id);
}

export async function getPendingAction(
  phone: string,
  type: PendingAction['type'],
): Promise<PendingAction | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('phone', phone)
    .eq('type', type)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as PendingAction;
}

export async function getAnyPendingAction(phone: string): Promise<PendingAction | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('pending_actions')
    .select('*')
    .eq('phone', phone)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as PendingAction;
}

export async function cancelarPendingAction(
  phone: string,
  type?: PendingAction['type'],
): Promise<void> {
  let query = supabase.from('pending_actions').delete().eq('phone', phone);
  if (type) query = query.eq('type', type) as typeof query;
  await query;
}
