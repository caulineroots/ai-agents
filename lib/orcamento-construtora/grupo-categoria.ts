import type { Categoria } from './types';
import type { GrupoEspecialista } from './xlsx-checklist-bln';

const GRUPO_CATEGORIA: Record<GrupoEspecialista, Categoria> = {
  G1: 'civil',
  G2: 'civil',
  G3: 'pintura',
  G4: 'revestimento',
  G5: 'marcenaria',
  G6: 'marcenaria',
};

/** Mapeia grupo XLSX (G1–G6) para categoria da UI. */
export function categoriaFromGrupo(
  grupo: GrupoEspecialista | string | undefined,
  descricao?: string,
): Categoria {
  const g = (grupo ?? 'G1') as GrupoEspecialista;
  const desc = descricao ?? '';
  if (g === 'G6' && /vidro/i.test(desc)) return 'vidros';
  if (g === 'G1' && /fachada|marquise|vitrine/i.test(desc)) return 'fachada';
  return GRUPO_CATEGORIA[g] ?? 'outro';
}

/** Divergência vs qdeReferencia: verde ≤5%, amarelo ≤15%, vermelho >15%. */
export function divergenciaRef(
  quantidade: number,
  qdeReferencia?: number | null,
): 'ok' | 'warn' | 'bad' | null {
  if (!qdeReferencia || qdeReferencia <= 0) return null;
  const pct = Math.abs(quantidade - qdeReferencia) / qdeReferencia;
  if (pct <= 0.05) return 'ok';
  if (pct <= 0.15) return 'warn';
  return 'bad';
}
