/**
 * Prompts editáveis em produção — armazenados no Supabase.
 * Cache em memória de 60s para evitar hits por mensagem.
 */

import { supabase } from '@/lib/supabase/client';

interface CacheEntry {
  content: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export async function getPrompt(name: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(name);
  if (cached && cached.expiresAt > now) {
    return cached.content;
  }

  const { data, error } = await supabase
    .from('prompts')
    .select('content')
    .eq('name', name)
    .single();

  if (error || !data) {
    console.error(`[prompts-db] erro ao buscar prompt "${name}":`, error?.message);
    return null;
  }

  cache.set(name, { content: data.content, expiresAt: now + CACHE_TTL_MS });
  return data.content;
}

export async function setPrompt(name: string, content: string): Promise<boolean> {
  const { error } = await supabase
    .from('prompts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('name', name);

  if (error) {
    console.error(`[prompts-db] erro ao salvar prompt "${name}":`, error.message);
    return false;
  }

  cache.delete(name);
  return true;
}

export async function listPrompts(): Promise<string[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('name')
    .order('name');

  if (error || !data) {
    console.error('[prompts-db] erro ao listar prompts:', error?.message);
    return [];
  }

  return data.map((row) => row.name);
}
