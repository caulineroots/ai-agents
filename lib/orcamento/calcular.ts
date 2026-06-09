import type {
  FolhaMedicao,
  ItemMedicao,
  ItemOrcado,
  DetServico,
  ResultadoOrcamento,
} from './types';

const PRECO_MATERIAL: Record<string, number> = {
  'Granito Tabaco': 1000,
  'Granito Branco Siena': 760,
  'Branco Parana': 1800,
  'Marmore Parana': 1800,
  'Quartzo White': 1250,
  'Quartzo Branco Norte': 1200,
  'Onix Cristallo': 4250,
  'Granito padrao': 850,
};

const PRECO_SERVICO: Record<string, number> = {
  'Rebaixo Italiano cozinha': 950,
  'Rebaixo Italiano lavanderia': 650,
  'Rebaixo Italiano outros': 650,
  'Recorte cooktop': 50,
  'Furo cuba embutir': 80,
  'Furo torneira': 20,
  'Furo dispenser': 20,
  'Furo para torre de tomada': 20,
  'Borda Reta Meia Esquadria': 100,
  'Acabamento Slim': 30,
  'Instalacao tampo sobre base': 120,
  'Instalacao rodape': 40,
  'Instalacao sobre movel': 120,
  'Instalacao revestimento': 100,
  'Canaleta LED': 22,
  'Cuba esculpida simples': 900,
  'Cuba esculpida com bandeja': 1350,
  'Champanheira': 750,
  'Tampa removivel': 300,
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

  // borda_ml: campo separado gerado pelo Stage 3 — convertido em DetServico
  if (item.borda_ml && item.borda_ml > 0) {
    const pBorda = PRECO_SERVICO['Borda Reta Meia Esquadria'] ?? 100;
    const totalBorda = pBorda * item.borda_ml;
    vlrServicos += totalBorda;
    detServicos.push({
      nome: 'Borda Reta Meia Esquadria',
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
