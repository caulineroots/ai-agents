// ─── Prancha Router — Orçamento Construtora ──────────────────────────────────
// Deterministic routing: zero API calls.
// Maps the prancha number extracted from the filename stem → specialist group.
//
// Filename pattern: CEA-254-BLN-ARQ_R03-{NUMBER}-{LABEL}
// Examples:
//   "CEA-254-BLN-ARQ_R03-331-ARQ PISO"     → number "331" → G4
//   "CEA-254-BLN-ARQ_R03-301-ARQ CIVIL"    → number "301" → G2

import type { GrupoEspecialista } from './xlsx-checklist-bln';

// ─── Mapeamento prancha → grupo ───────────────────────────────────────────────
// G1 — Indiretos + Serralheria         | Seções A, 7, 8
// G2 — Civil + Impermeabilização + Div | Seções 9, 10, 11, 13, 25(struct)
// G3 — Gesso + Forro + Pintura         | Seções 12, 18
// G4 — Piso + Revestimento + Vidros    | Seções 14, 15, 16, 19, 25(floors)
// G5 — Provadores                      | Seção 22
// G6 — ADM + Marcenaria + Louças       | Seções 17, 20, 21, 23, 24

const PRANCHA_PARA_GRUPO: Record<string, GrupoEspecialista> = {
  // G1 — Indiretos + Serralheria
  '302': 'G1', '303': 'G1', '306': 'G1', '341': 'G1', '351': 'G1',
  // G2 — Civil + Impermeabilização + Divisórias
  '301': 'G2', '305': 'G2', '307': 'G2', '308': 'G2',
  // G3 — Gesso + Forro + Pintura
  '309': 'G3', '310': 'G3', '321': 'G3',
  // G4 — Piso + Revestimento + Vidros + Granito
  '131': 'G4', '313': 'G4', '315': 'G4', '331': 'G4',
  // G5 — Provadores
  '132': 'G5',
  // G6 — ADM + Marcenaria + Louças + Portas
  '304': 'G6', '312': 'G6',
};

// Pranchas que aparecem em múltiplos grupos (enviadas a ambos)
const PRANCHA_MULTI_GRUPO: Record<string, GrupoEspecialista[]> = {
  '303': ['G1', 'G2', 'G3'],  // ARQ CIVIL / planta geral → múltiplos grupos
  '301': ['G2', 'G3'],        // ARQ CIVIL planta 1
  '305': ['G2', 'G6'],        // ADM + Civil
  '308': ['G2', 'G6'],        // ADM + Civil
  '341': ['G1', 'G4'],        // Serralheria + Piso
  '351': ['G1', 'G4'],        // Serralheria + Piso
  '131': ['G4', 'G5'],        // Piso provadores + detalhes provador
};

/**
 * Extrai o número da prancha a partir do stem do arquivo.
 * Ex: "CEA-254-BLN-ARQ_R03-331-ARQ PISO" → "331"
 *     "CEA-254-BLN-ARQ_R03-301-ARQ CIVIL" → "301"
 *     "331-ARQ PISO" → "331"
 *
 * Estratégia:
 * 1. Tenta extrair o número APÓS o marcador de revisão (_R\d+-)
 *    porque o stem costuma ser "CEA-254-BLN-ARQ_R03-NNN-LABEL" e "-254-"
 *    seria extraído erroneamente pela regex genérica.
 * 2. Pega a ÚLTIMA ocorrência de "-NNN-" (ou "-NNN fim/espaço"),
 *    evitando capturar o número do projeto que fica no prefixo.
 * 3. Fallback: qualquer palavra de 3 dígitos no stem.
 */
export function extractPranchaNumber(stem: string): string | null {
  // 1. Padrão com marcador de revisão: _R03-301-...
  const revMatch = stem.match(/_R\d+-(\d{3})(?:-|$| )/i);
  if (revMatch) return revMatch[1];

  // 2. Última ocorrência de -NNN- (ou -NNN no fim / antes de espaço)
  const all = [...stem.matchAll(/-(\d{3})(?=-|$| )/g)];
  if (all.length > 0) return all[all.length - 1][1];

  // 3. Número de 3 dígitos no início do stem separado por _ ou espaço
  //    Ex: "301_ARQ CIVIL" ou "301 ARQ CIVIL"
  //    Nota: \b não funciona antes de _ pois _ é \w em regex.
  const startMatch = stem.match(/^(\d{3})[-_ ]/);
  if (startMatch) return startMatch[1];

  // 4. Qualquer sequência isolada de exatamente 3 dígitos (sem dígitos adjacentes)
  const m = stem.match(/(?<!\d)(\d{3})(?!\d)/);
  return m ? m[1] : null;
}

/**
 * Retorna os grupos aos quais esta prancha pertence (pode ser mais de um).
 */
export function getGruposForPrancha(stem: string): GrupoEspecialista[] {
  const num = extractPranchaNumber(stem);
  if (!num) return [];
  if (PRANCHA_MULTI_GRUPO[num]) return PRANCHA_MULTI_GRUPO[num];
  if (PRANCHA_PARA_GRUPO[num]) return [PRANCHA_PARA_GRUPO[num]];
  return [];
}

/**
 * Rota um array de stems → Record<grupo, stems[]>
 * Pranchas não reconhecidas são colocadas em 'G1' como fallback.
 * Pranchas multi-grupo aparecem em todos os seus grupos.
 */
export function routeByFilename(stems: string[]): Record<GrupoEspecialista, string[]> {
  const result: Record<GrupoEspecialista, string[]> = {
    G1: [], G2: [], G3: [], G4: [], G5: [], G6: [],
  };

  for (const stem of stems) {
    const grupos = getGruposForPrancha(stem);
    if (grupos.length === 0) {
      // Prancha não mapeada → G1 como fallback (indiretos/geral)
      result['G1'].push(stem);
    } else {
      for (const g of grupos) {
        if (!result[g].includes(stem)) {
          result[g].push(stem);
        }
      }
    }
  }

  return result;
}

export const GRUPO_LABELS: Record<GrupoEspecialista, string> = {
  G1: 'Indiretos + Serralheria',
  G2: 'Civil + Impermeabilização + Divisórias',
  G3: 'Gesso + Forro + Pintura',
  G4: 'Piso + Revestimento + Vidros + Granito',
  G5: 'Provadores',
  G6: 'ADM + Marcenaria + Louças + Portas',
};

export const GRUPO_SECOES: Record<GrupoEspecialista, string[]> = {
  G1: ['A', '7', '8'],
  G2: ['9', '10', '11', '13'],
  G3: ['12', '18'],
  G4: ['14', '15', '16', '19'],
  G5: ['22'],
  G6: ['17', '20', '21', '23', '24', '25'],
};
