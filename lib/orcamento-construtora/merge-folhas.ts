import type { FolhaOrcamento, ItemOrcamento } from './types';

export function normalizeItemKey(desc: string): string {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^a-z0-9]/g, ' ')        // só letras/números
    .replace(/\b(em|de|do|da|das|dos|com|para|e|a|o|as|os|um|uma|no|na)\b/g, ' ') // remove stop-words
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 45);
}

/**
 * Extrai o código de rodapé (R1–R9) de uma descrição, se existir.
 * Ex.: "RODAPÉ R3 — PRIMER TARKET..." → "rodape_R3"
 * Ex.: "R6 — RODAPÉ PRIMER TARKET 50×240mm" → "rodape_R6"
 * Retorna null se não for um item de rodapé codificado.
 */
function rodapeCode(desc: string): string | null {
  const m = desc.match(/\bR([1-9])\b/i);
  if (!m) return null;
  const upper = desc.toUpperCase();
  if (upper.includes('RODAP') || upper.includes('PRIMER') || upper.includes('RODAP')) {
    return `rodape_R${m[1]}`;
  }
  return null;
}

export function mergeFolhas(folhas: FolhaOrcamento[]): FolhaOrcamento {
  if (folhas.length === 0) throw new Error('Nenhuma folha para mesclar');
  if (folhas.length === 1) return folhas[0];

  const seenKeys = new Map<string, number>();
  const itens: ItemOrcamento[] = [];
  const divergencias: FolhaOrcamento['divergencias'] = [];
  const erros_ia: string[] = [];

  for (const folha of folhas) {
    for (const item of folha.itens) {
      // Rodapés codificados (R1-R9) usam o código como chave de deduplicação
      // para evitar contar o mesmo rodapé de pranchas diferentes
      const rCode = rodapeCode(item.descricao);
      const key   = rCode ?? normalizeItemKey(item.descricao);

      const existingIdx = seenKeys.get(key);
      if (existingIdx !== undefined) {
        // Mantém a maior quantidade encontrada (a fonte mais detalhada)
        if (item.quantidade > itens[existingIdx].quantidade) {
          itens[existingIdx] = { ...itens[existingIdx], quantidade: item.quantidade };
        }
      } else {
        const idx = itens.length;
        seenKeys.set(key, idx);
        itens.push({ ...item, id: idx + 1 });
      }
    }
    for (const d of folha.divergencias ?? []) (divergencias as NonNullable<typeof divergencias>).push(d);
    for (const e of folha.erros_ia ?? []) erros_ia.push(e);
  }

  return {
    projeto: folhas[0].projeto,
    cliente: folhas[0].cliente,
    itens,
    divergencias,
    erros_ia,
  };
}
