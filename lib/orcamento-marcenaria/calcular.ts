import type {
  FolhaMedicao,
  ItemMedicao,
  ItemOrcado,
  DetServico,
  ResultadoOrcamento,
} from './types';

// ─── Tabela de preços PLACEHOLDER — substituir com planilha real ──────────────

const PRECO_MATERIAL: Record<string, number> = {
  'MDF Branco':       450,
  'MDP Branco':       380,
  'Laca Branca':      650,
  'Folha Natural':    950,
  'Vidro temperado':  520,
  'MDF padrao':       450,
};

const PRECO_SERVICO: Record<string, number> = {
  'Instalacao movel':       80,   // ml
  'Ferragens dobradica':    25,   // un
  'Ferragens corredica':    45,   // un
  'Fita de borda':          12,   // ml
  'Porta de correr':       350,   // un
  'Montagem in loco':      120,   // un
  'Puxadores':              35,   // un
  'Projeto executivo':     800,   // un
};

function resolvePrecoMaterial(nome: string): number | null {
  if (PRECO_MATERIAL[nome] !== undefined) return PRECO_MATERIAL[nome];
  for (const [k, v] of Object.entries(PRECO_MATERIAL)) {
    if (nome.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return null;
}

function resolvePrecoServico(nome: string): number | null {
  if (PRECO_SERVICO[nome] !== undefined) return PRECO_SERVICO[nome];
  for (const [k, v] of Object.entries(PRECO_SERVICO)) {
    if (nome.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return null;
}

function calcularItem(item: ItemMedicao): ItemOrcado {
  const erros: string[] = [];

  const pmaterial = resolvePrecoMaterial(item.material);
  if (pmaterial === null) {
    erros.push(`Material "${item.material}" não encontrado na tabela — usando R$ 0`);
  }
  const vlrMaterial = (pmaterial ?? 0) * (item.area_m2 ?? 0);

  let vlrServicos = 0;
  const detServicos: DetServico[] = [];
  for (const s of item.servicos ?? []) {
    const p = resolvePrecoServico(s.nome);
    if (p === null) {
      erros.push(`Serviço "${s.nome}" não encontrado na tabela`);
      detServicos.push({ ...s, vlrUnit: 0, total: 0 });
      continue;
    }
    const total = p * (s.qtd ?? 1);
    vlrServicos += total;
    detServicos.push({ ...s, vlrUnit: p, total });
  }

  if (item.borda_ml && item.borda_ml > 0) {
    const pBorda = PRECO_SERVICO['Fita de borda'] ?? 12;
    const totalBorda = pBorda * item.borda_ml;
    vlrServicos += totalBorda;
    detServicos.push({
      nome: 'Fita de borda',
      qtd: item.borda_ml,
      unidade: 'ml',
      vlrUnit: pBorda,
      total: totalBorda,
    });
  }

  return {
    ...item,
    vlrMaterial,
    vlrServicos,
    vlrTotal: vlrMaterial + vlrServicos,
    detServicos,
    erros,
  };
}

export function calcularOrcamento(folha: FolhaMedicao): ResultadoOrcamento {
  const itens = folha.itens.map(calcularItem);

  const confirmados = itens.filter((i) => i.status !== 'aguardando');

  const totalMaterial = confirmados.reduce((s, i) => s + i.vlrMaterial, 0);
  const totalServicos = confirmados.reduce((s, i) => s + i.vlrServicos, 0);
  const totalGeral = totalMaterial + totalServicos;

  const porAmbiente: Record<string, number> = {};
  for (const item of confirmados) {
    const amb = item.ambiente ?? '?';
    porAmbiente[amb] = (porAmbiente[amb] ?? 0) + item.vlrTotal;
  }

  const porMaterial: Record<string, { area: number; valor: number }> = {};
  for (const item of confirmados) {
    const chave = `${item.material} (${item.espessura_cm ?? '?'}cm)`;
    if (!porMaterial[chave]) porMaterial[chave] = { area: 0, valor: 0 };
    porMaterial[chave].area += item.area_m2 ?? 0;
    porMaterial[chave].valor += item.vlrMaterial;
  }

  return { itens, totalMaterial, totalServicos, totalGeral, porAmbiente, porMaterial };
}
