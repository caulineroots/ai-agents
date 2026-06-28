// ─── Domínio: Orçamento de Construtora (lojas de varejo) ────────────────────
// Clientes típicos: C&A, Centauro, Renner, Americanas e similares.
// Independente do módulo de marmoraria.

export type Categoria =
  | 'civil'
  | 'eletrica'
  | 'hidraulica'
  | 'marcenaria'
  | 'vidros'
  | 'revestimento'
  | 'pintura'
  | 'fachada'
  | 'climatizacao'
  | 'outro';

export type Unidade = 'm2' | 'ml' | 'un' | 'm3' | 'vb' | 'kg' | 'hr';

export type FonteItem = 'PDF' | 'DXF' | 'IA' | 'PDF+DXF' | 'PDF+IA' | 'DXF+IA' | 'PDF+DXF+IA';

export interface Divergencia {
  campo: string;
  valor_pdf?: string;
  valor_dxf?: string;
  valor_ia?: string;
  recomendacao: string;
}

export interface ItemOrcamento {
  id: number;
  /** Índice 0-based da imagem de entrada que contém a vista principal do item. */
  prancha_idx?: number | null;
  status: 'confirmado' | 'parcial' | 'aguardando';
  /** Área da loja (setor, ambiente), ex: "Vitrine", "Setor Feminino", "Caixa". */
  ambiente: string;
  descricao: string;
  categoria: Categoria;
  unidade: Unidade;
  quantidade: number;
  pendencias: string[];
  /** Fonte de onde o item foi extraído. */
  fonte?: FonteItem;
  /** Confiança 0-100% na quantidade informada. */
  confianca?: number;
  /** Raciocínio curto da IA explicando a origem da quantidade. */
  raciocinio?: string;
  /** Código XLSX quando mapeado pelo pipeline determinístico. */
  cod?: string;
  /** Sugestão de qty da auditoria Haiku (Passo 3). */
  iaSugestao?: {
    qty: number;
    motivo: string;
    confianca: number;
    decisao?: 'aceita' | 'mantida';
  };
}

export interface IaReconcileResult {
  duplicatas: Array<{
    tipo: string;
    descricao: string;
    pranchas_envolvidas: string[];
    cods_afetados: string[];
  }>;
  cods_revisados: Array<{
    cod: string;
    qty_deterministico: number;
    qty_sugerida: number;
    unidade: string;
    confianca: number;
    motivo: string;
    linhas_manter?: string[];
    linhas_descartar?: string[];
  }>;
  observacoes: string[];
  metadata?: {
    tokens_input: number;
    tokens_output: number;
    custo_usd: number;
  };
}

export interface FolhaOrcamento {
  projeto: string;
  /** Nome do cliente (rede varejista), ex: "C&A", "Centauro". */
  cliente: string;
  itens: ItemOrcamento[];
  divergencias?: Divergencia[];
  erros_ia?: string[];
  orcarMeta?: {
    residual: { cod: string; descricao: string; unidade: string }[];
    dedup_log: { tabela: string; kept: string | null; dropped: string[]; gt: number | null; motivo?: string }[];
    iaReconcile?: IaReconcileResult;
    linhas_pre_agregacao?: Array<{
      cod?: string;
      descricao: string;
      quantidade: number;
      unidade: string;
      tabela?: string;
      fonte_pranchas?: string[];
    }>;
  };
}

// ─── Orçado (após aplicar tabela de preços) ──────────────────────────────────

export interface ItemOrcado extends ItemOrcamento {
  vlrUnit: number;
  vlrTotal: number;
  mat?: number;
  mo?: number;
  vlrMat?: number;
  vlrMo?: number;
  materialCliente?: boolean;
  erros: string[];
}

export interface ResultadoOrcamento {
  itens: ItemOrcado[];
  totalGeral: number;
  totalMat: number;
  totalMo: number;
  porCategoria: Record<string, number>;
  porAmbiente: Record<string, number>;
}
