import type { FolhaOrcamento, ResultadoOrcamento } from './types';

const LS_KEY = 'orcamento-construtora-v1';

export interface PersistedState {
  step: number;
  folha?: FolhaOrcamento;
  resultado?: ResultadoOrcamento;
  tokenLogs?: Array<{ stage: string; usage: { input_tokens: number; output_tokens: number } }>;
  savedAt?: number;
}

export function savePersisted(s: PersistedState): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch { return null; }
}

export function clearPersisted(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
}
