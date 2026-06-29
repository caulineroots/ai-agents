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
): Promise<PendingAction | null> {
  // Cancela qualquer ação pendente anterior do mesmo phone+type
  await cancelarPendingAction(phone, type);

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
