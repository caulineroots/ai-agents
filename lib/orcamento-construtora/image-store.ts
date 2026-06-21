/**
 * image-store.ts
 *
 * Armazena os grupos de arquivos por prancha FORA do React state.
 * Blobs/Files nunca entram em useState — evita OOM no renderer.
 *
 * Cada PranchaGroup representa uma prancha com seus arquivos associados:
 *   - imageFile : PNG/JPG (para análise visual pela IA)
 *   - pdfFile   : PDF (extração programática)
 *   - dxfFile   : DXF ou DWG (extração programática)
 */

export interface PranchaGroup {
  stem: string;
  imageFile?: File;
  pdfFile?: File;
  dxfFile?: File;
}

let _groups: PranchaGroup[] = [];

export const imageStore = {
  set(groups: PranchaGroup[])  { _groups = groups; },
  get(): PranchaGroup[]         { return _groups; },
  clear()                       { _groups = []; },
  count(): number               { return _groups.length; },

  stems(): string[] { return _groups.map((g) => g.stem); },

  setImageFile(stem: string, file: File) {
    const g = _groups.find((g) => g.stem === stem);
    if (g) g.imageFile = file;
  },

  summary(): { stem: string; hasPdf: boolean; hasDxf: boolean; hasImage: boolean }[] {
    return _groups.map((g) => ({
      stem:     g.stem,
      hasPdf:   !!g.pdfFile,
      hasDxf:   !!g.dxfFile,
      hasImage: !!g.imageFile,
    }));
  },

  totalMB(): number {
    return _groups.reduce((sum, g) => {
      return (
        sum +
        (g.imageFile?.size ?? 0) +
        (g.pdfFile?.size ?? 0) +
        (g.dxfFile?.size ?? 0)
      );
    }, 0) / (1024 * 1024);
  },
};

/** Agrupa uma lista de File[] pelo stem (nome sem extensão). */
export function groupFilesByStem(files: File[]): PranchaGroup[] {
  const map = new Map<string, PranchaGroup>();

  for (const file of files) {
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? '';
    const stem = file.name.replace(/\.[^.]+$/, '');

    if (!map.has(stem)) map.set(stem, { stem });
    const g = map.get(stem)!;

    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      g.imageFile = file;
    } else if (ext === 'pdf') {
      g.pdfFile = file;
    } else if (['dxf', 'dwg'].includes(ext)) {
      g.dxfFile = file;
    }
  }

  // Remove grupos sem nenhum arquivo reconhecido e ordena por stem
  return Array.from(map.values())
    .filter((g) => g.imageFile || g.pdfFile || g.dxfFile)
    .sort((a, b) => a.stem.localeCompare(b.stem));
}
