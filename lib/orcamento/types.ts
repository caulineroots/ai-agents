export interface Servico {
  nome: string;
  qtd: number;
  unidade: 'un' | 'ml';
}

export interface ItemMedicao {
  id: number;
  /** Índice 0-based da imagem de entrada que contém a vista principal do item. */
  prancha_idx?: number | null;
  status: 'confirmado' | 'parcial' | 'aguardando';
  ambiente: string;
  modulo: string;
  tipo: 'tampo' | 'rodape' | 'saia' | 'revestimento' | 'prateleira' | 'painel' | 'outro';
  material: string;
  espessura_cm: number;
  /** Dimensões individuais fornecidas pela IA — área calculada por código (C × L). */
  comprimento_m?: number;
  largura_m?: number;
  area_m2: number;
  /** Metros lineares de borda. Se presente, calculado separadamente de servicos. */
  borda_ml?: number;
  servicos: Servico[];
  pendencias: string[];
}

export interface FolhaMedicao {
  projeto: string;
  itens: ItemMedicao[];
}

export interface DetServico extends Servico {
  vlrUnit: number;
  total: number;
}

export interface ItemOrcado extends ItemMedicao {
  vlrMaterial: number;
  vlrServicos: number;
  vlrTotal: number;
  detServicos: DetServico[];
  erros: string[];
}

export interface ResultadoOrcamento {
  itens: ItemOrcado[];
  totalMaterial: number;
  totalServicos: number;
  totalGeral: number;
  porAmbiente: Record<string, number>;
  porMaterial: Record<string, { area: number; valor: number }>;
}

export interface ApiUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface TokenLog {
  stage: string;
  usage: ApiUsage;
  thinking?: string | null;
}
