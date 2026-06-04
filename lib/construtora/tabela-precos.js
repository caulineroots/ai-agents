/**
 * Tabela de preços CELMAR BLN — 1ª Proposta (valores reais pós-negociação)
 * Fonte: 1ª Proposta CELMAR BLN.xlsx
 *
 * Estrutura de cada item:
 *   cod          {string}  código do item (ex: "9.5")
 *   descricao    {string}  descrição padrão
 *   cat          {number}  número da categoria
 *   unidPadrao   {string}  unidade de medida padrão
 *   mat          {number}  preço unitário de material (R$)
 *   mObra        {number}  preço unitário de mão de obra (R$)
 *   materialCliente {boolean} true = material fornecido pelo contratante (cobrar só M.O.)
 *
 * Quando há código duplicado na proposta original (ex: 8.6 aparece duas vezes),
 * mantém-se o primeiro item com valor > 0.
 */

export const CATEGORIAS = {
  1: 'CUSTOS INDIRETOS — Grupo 1 (ART, Seguro, Topografia)',
  2: 'CUSTOS INDIRETOS — Grupo 2 (Canteiro, Vigilância)',
  3: 'CUSTOS INDIRETOS — Grupo 3 (Proteção, Entulho, Transporte)',
  4: 'CUSTOS INDIRETOS — Grupo 4 (Equipe e Mobilização)',
  5: 'CUSTOS INDIRETOS — Grupo 5 (Limpeza Final)',
  7: 'ADAPTAÇÃO DE SHELL',
  8: 'SERRALHERIA',
  9: 'CIVIL',
  10: 'IMPERMEABILIZAÇÃO',
  11: 'TRATAMENTO DE JUNTA DE DILATAÇÃO',
  12: 'PAREDES E FORROS EM GESSO',
  13: 'DIVISÓRIAS',
  14: 'REVESTIMENTO DE PISO',
  15: 'REVESTIMENTO DE PAREDE',
  16: 'MÁRMORES E GRANITOS',
  17: 'LOUÇAS E METAIS',
  18: 'PINTURA',
  19: 'VIDROS E ESPELHOS',
  20: 'PORTAS EM MADEIRA E ACESSÓRIOS',
  21: 'MARCENARIA — ÁREA DE VENDAS',
  22: 'PROVADORES',
  23: 'FACHADAS',
  24: 'MARCENARIA E ENXOVAL — ESTOQUE E ADM',
  25: 'OMISSOS',
};

/** Retorna o número da categoria a partir do código do item (ex: "12.9" → 12) */
export function catFromCod(cod) {
  const n = parseInt(String(cod).split('.')[0], 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Tabela de preços indexada por código.
 * Quando um código aparece mais de uma vez na proposta original,
 * o campo `variantes` lista as demais versões para consulta.
 */
export const TABELA = {
  // ─── CUSTOS INDIRETOS ──────────────────────────────────────────────────────
  '1.1': { descricao: 'ART contemplando todos os serviços + placa de obra', unidPadrao: 'vb', mat: 0, mObra: 1100 },
  '1.2': { descricao: 'Seguro de obra com responsabilidade civil', unidPadrao: 'vb', mat: 3400, mObra: 0 },
  '1.3': { descricao: 'Topografia (por visita/dia)', unidPadrao: 'dia', mat: 350, mObra: 2070 },

  '2.1': { descricao: 'Tapume em placas de divisória tipo Eucatex', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '2.2': { descricao: 'EPI e comunicação visual', unidPadrao: 'vb', mat: 3500, mObra: 0 },
  '2.3': { descricao: 'Vigilância noturna + fins de semana (por dia)', unidPadrao: 'dia', mat: 0, mObra: 150 },
  '2.4': { descricao: 'Dependências para administração da obra', unidPadrao: 'vb', mat: 17980, mObra: 5800 },
  '2.5': { descricao: 'Material de limpeza e administrativo', unidPadrao: 'vb', mat: 3500, mObra: 0 },
  '2.6': { descricao: 'Extintores para a obra + bebedouro', unidPadrao: 'vb', mat: 1830, mObra: 0 },
  '2.7': { descricao: 'Ligação elétrica tomadas e iluminação canteiro', unidPadrao: 'vb', mat: 3500, mObra: 0 },
  '2.8': { descricao: 'Iluminação provisória + quadro de energia', unidPadrao: 'vb', mat: 3400, mObra: 0 },
  '2.9': { descricao: 'Eletricista durante a obra', unidPadrao: 'vb', mat: 0, mObra: 4500 },

  '3.1': { descricao: 'Lona proteção — piso, marcenaria, equipamentos', unidPadrao: 'vb', mat: 4580, mObra: 0 },
  '3.2': { descricao: 'Lona transparente proteção equipamentos', unidPadrao: 'vb', mat: 4200, mObra: 0 },
  '3.3': { descricao: 'Retirada periódica de entulhos + caçamba', unidPadrao: 'mes', mat: 200, mObra: 8000 },
  '3.4': { descricao: 'Locação de equipamentos manuais', unidPadrao: 'vb', mat: 0, mObra: 6900 },
  '3.5': { descricao: 'Transporte vertical e horizontal', unidPadrao: 'vb', mat: 0, mObra: 9700 },

  '4.1': { descricao: 'Engenheiro residente (full time)', unidPadrao: 'mes', mat: 0, mObra: 10500 },
  '4.2': { descricao: 'Técnico de segurança (full time)', unidPadrao: 'mes', mat: 0, mObra: 3500 },
  '4.3': { descricao: 'Estadias e refeições', unidPadrao: 'vb', mat: 0, mObra: 35000 },
  '4.4': { descricao: 'Mobilização e desmobilização', unidPadrao: 'vb', mat: 0, mObra: 28000 },
  '4.5': { descricao: 'Limpeza permanente da obra (2 operários)', unidPadrao: 'mes', mat: 0, mObra: 5000 },

  '5.1': { descricao: 'Limpeza final de obra', unidPadrao: 'vb', mat: 0, mObra: 9000 },

  // ─── DIRETOS ───────────────────────────────────────────────────────────────
  '7.1': { descricao: 'Demolições e retiradas (inclui bota-fora)', unidPadrao: 'vb', mat: 3500, mObra: 6500 },

  // Serralheria
  '8.4': { descricao: 'Adequação de escada / mezanino / guarda corpo existente', unidPadrao: 'vb', mat: 0, mObra: 0 },
  '8.5': { descricao: 'Guarda corpo de ferro com pintura de fundo (escada/mezanino)', unidPadrao: 'ml', mat: 280, mObra: 125.7 },
  '8.6': { descricao: 'Estrutura metálica em metalon para revestimento de fachada', unidPadrao: 'vb', mat: 9190, mObra: 5220 },
  '8.7': { descricao: 'Estrutura metálica auxiliar tipo gaiola para vitrine', unidPadrao: 'vb', mat: 0, mObra: 0 },
  '8.8': { descricao: 'Estrutura metálica auxiliar para septo de AC sobre forro', unidPadrao: 'vb', mat: 5000, mObra: 4980 },
  '8.9': { descricao: 'Estrutura metálica auxiliar para porta de enrolar', unidPadrao: 'vb', mat: 5000, mObra: 3980 },
  '8.10': { descricao: 'Guarda corpo em inox para salão de vendas (desníveis/escadas)', unidPadrao: 'ml', mat: 0, mObra: 0 },
  '8.11': { descricao: 'Adequação estrutural para elevador', unidPadrao: 'vb', mat: 5000, mObra: 5980 },
  '8.11a': { descricao: 'Gradil metálico para isolamento (gerador/subestação)', unidPadrao: 'vb', mat: 0, mObra: 0 },
  '8.12': { descricao: 'Porta de ferro — Circulação', unidPadrao: 'unid', mat: 3700, mObra: 700 },
  '8.13': { descricao: 'Porta de ferro — Gerador', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '8.14': { descricao: 'Porta de ferro — Casa de Máquinas', unidPadrao: 'unid', mat: 2790, mObra: 480 },
  '8.15': { descricao: 'Porta corta-fogo — Docas', unidPadrao: 'unid', mat: 3760, mObra: 650 },
  '8.16': { descricao: 'Esquadria metálica c/ tela', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '8.17': { descricao: 'Portinhola de alumínio sob bancada (cantina)', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '8.18': { descricao: 'Visor back office com vidro', unidPadrao: 'unid', mat: 600, mObra: 400 },
  '8.19': { descricao: 'Visor gerência com vidro', unidPadrao: 'unid', mat: 600, mObra: 400 },
  '8.20': { descricao: 'Passa documentos', unidPadrao: 'unid', mat: 0, mObra: 0 },

  // Civil
  '9.1': { descricao: 'Enchimento de contrapiso (h=4cm)', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '9.2': { descricao: 'Piso cimentado para áreas técnicas (5cm)', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '9.3': { descricao: 'Sóculos em concreto para bancadas', unidPadrao: 'vb', mat: 840, mObra: 510 },
  '9.4': { descricao: 'Bases em concreto para equipamentos (AC, gerador, transformador)', unidPadrao: 'vb', mat: 1879, mObra: 970 },
  '9.5': { descricao: 'Alvenaria em tijolo/bloco de concreto', unidPadrao: 'm2', mat: 76, mObra: 34 },
  '9.6': { descricao: 'Alvenaria em bloco sical', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '9.7': { descricao: 'Chapisco e emboço', unidPadrao: 'm2', mat: 25.32, mObra: 14.65 },
  '9.8': { descricao: 'Laje pré-moldada com capa de concreto', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '9.9': { descricao: 'Execução área técnica', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '9.10': { descricao: 'Concreto com vermiculita para enchimento de bandejas de mezanino', unidPadrao: 'm3', mat: 0, mObra: 0 },
  '9.11': { descricao: 'Tela Telcon e lona preta (mezanino)', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '9.12': { descricao: 'Furação mecânica de lajes (esgotos e tubulações)', unidPadrao: 'vb', mat: 4150, mObra: 1290 },
  '9.13': { descricao: 'Arremates gerais', unidPadrao: 'vb', mat: 4130, mObra: 2260 },

  // Impermeabilização
  '10.1': { descricao: 'Impermeabilização — manta butílica/asfáltica (casa de máquinas, área técnica, sob cuba)', unidPadrao: 'm2', mat: 177.36, mObra: 120.68 },
  '10.2': { descricao: 'Impermeabilização — manta líquida (sanitários)', unidPadrao: 'm2', mat: 87.2, mObra: 52.4 },

  // Junta de dilatação
  '11.1': { descricao: 'Enchimento de juntas de dilatação com vedaflex', unidPadrao: 'ml', mat: 0, mObra: 0 },

  // Gesso
  '12.1': { descricao: 'Parede gesso STD — 1 face', unidPadrao: 'm2', mat: 75.8, mObra: 45.7 },
  '12.2': { descricao: 'Parede gesso STD — 2 faces', unidPadrao: 'm2', mat: 75.8, mObra: 56.7 },
  '12.3': { descricao: 'Parede gesso RU — 1 face', unidPadrao: 'm2', mat: 90.2, mObra: 58.45 },
  '12.4': { descricao: 'Parede gesso RU — 2 faces', unidPadrao: 'm2', mat: 90.2, mObra: 58.45 },
  '12.5': { descricao: 'Parede gesso RF — 1 face', unidPadrao: 'm2', mat: 90.2, mObra: 58.45 },
  '12.6': { descricao: 'Parede gesso RF — 2 faces', unidPadrao: 'm2', mat: 104.2, mObra: 58.45 },
  '12.7': { descricao: 'Reforço em cedrinho para paredes de gesso', unidPadrao: 'vb', mat: 5770, mObra: 2530 },
  '12.8': { descricao: 'Demolição forro/sancas de gesso', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '12.9': { descricao: 'Forro de gesso Gypsum liso tabicado (inclui estrutura)', unidPadrao: 'm2', mat: 25.5, mObra: 38 },
  '12.10': { descricao: 'Fechamento em gesso para cortina porta de enrolar', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '12.11': { descricao: 'Alçapão no forro de gesso', unidPadrao: 'unid', mat: 153, mObra: 64 },
  '12.12': { descricao: 'Abertura no forro de gesso para luminária/spot/grelha/difusor', unidPadrao: 'unid', mat: 0, mObra: 35 },
  '12.13': { descricao: 'Reforço no forro para placas aéreas CV / trilho vitrine', unidPadrao: 'vb', mat: 2489, mObra: 1300 },

  // Divisórias
  '13.1': { descricao: 'Divisória Divilux 35 (Formidur BP Plus branco)', unidPadrao: 'm2', mat: 118.2, mObra: 87 },
  '13.2': { descricao: 'Porta sanitário 0.60×1.65m — eucatex c/ maçaneta', unidPadrao: 'unid', mat: 1068.4, mObra: 144.3 },
  '13.3': { descricao: 'Porta eucatex maçaneta alavanca — 1F', unidPadrao: 'unid', mat: 1382.3, mObra: 232.45 },
  '13.4': { descricao: 'Porta divisória 1,20m (dupla)', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '13.5': { descricao: 'Porta vidro/alumínio para box de chuveiro', unidPadrao: 'unid', mat: 989.2, mObra: 165 },

  // Revestimento de piso
  '14.1': { descricao: 'Assentamento piso vinílico — salão de vendas/provadores', unidPadrao: 'm2', mat: 0, mObra: 40.15, materialCliente: true },
  '14.2': { descricao: 'Autonivelante — salão de vendas/provadores', unidPadrao: 'm2', mat: 0, mObra: 14.2, materialCliente: true },
  '14.3': { descricao: 'Assentamento de piso porcelanato', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '14.4': { descricao: 'Argamassa, rejunte e MO para piso cerâmico', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '14.5': { descricao: 'Rodapé Primer Tarket 10cm (salão de vendas)', unidPadrao: 'ml', mat: 20, mObra: 33.2 },
  '14.6': { descricao: 'Piso tátil (escada rolante e escada fixa)', unidPadrao: 'vb', mat: 220, mObra: 150 },
  '14.7': { descricao: 'Sóculo granito frente vitrine (largura 10cm)', unidPadrao: 'ml', mat: 237.2, mObra: 87 },
  '14.8': { descricao: 'Soleira em granito Branco Ceará — entrada principal', unidPadrao: 'ml', mat: 650, mObra: 360 },
  '14.9': { descricao: 'Capacho nômade 3M cinza grafite', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '14.10': { descricao: 'Fita antiderrapante Safety walk 50mm para entrada da loja', unidPadrao: 'vb', mat: 0, mObra: 0 },
  '14.11': { descricao: 'Aplicação de piso cerâmico c/ argamassa e rejunte (ADM)', unidPadrao: 'm2', mat: 0, mObra: 68, materialCliente: true },
  '14.12': { descricao: 'Assentamento piso vinílico ADM', unidPadrao: 'm2', mat: 0, mObra: 0, materialCliente: true },
  '14.13': { descricao: 'Rodapé de madeira h=7cm', unidPadrao: 'ml', mat: 35.9, mObra: 17.43 },
  '14.14': { descricao: 'Rodapé de madeira h=20cm', unidPadrao: 'ml', mat: 43.67, mObra: 17.45 },
  '14.15': { descricao: 'Montagem de estante modular metálica', unidPadrao: 'pe', mat: 0, mObra: 0, materialCliente: true },
  '14.16': { descricao: 'Revestimento da Escada (degrau e espelho) em Ardósia', unidPadrao: 'vb', mat: 16210.56, mObra: 0 },
  '14.17': { descricao: 'Escada: piso tátil + fita antiderrapante', unidPadrao: 'cj', mat: 1990, mObra: 970 },
  '14.18': { descricao: 'Escada: revestimento degrau em Ardósia', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '14.19': { descricao: 'Soleira em granito Cinza Andorinha', unidPadrao: 'ml', mat: 635.6, mObra: 333.2 },

  // Revestimento de parede
  '15.1': { descricao: 'Azulejo branco junta a prumo', unidPadrao: 'm2', mat: 89.75, mObra: 36.75 },
  '15.2': { descricao: 'Perfil de alumínio branco 1/2" meia altura', unidPadrao: 'ml', mat: 32.2, mObra: 16 },
  '15.3': { descricao: 'Cantoneira de alumínio nas quinas de circulação h=1,70m', unidPadrao: 'ml', mat: 32.2, mObra: 18.4 },
  '15.4': { descricao: 'Rodameio em madeira para sala de gerente', unidPadrao: 'ml', mat: 0, mObra: 0 },

  // Mármores e granitos
  '16.1': { descricao: 'Bancada em granito — cantina/balcão térmico', unidPadrao: 'm2', mat: 1785, mObra: 1230 },
  '16.2': { descricao: 'Bancada em granito — vestiários', unidPadrao: 'm2', mat: 1785, mObra: 1230 },
  '16.3': { descricao: 'Aparadores para bancada de vestiários', unidPadrao: 'unid', mat: 190, mObra: 78 },
  '16.4': { descricao: 'Nicho em granito nos box de chuveiro', unidPadrao: 'unid', mat: 190, mObra: 78 },

  // Louças e metais
  '17.1': { descricao: 'Cuba de inox — copa', unidPadrao: 'unid', mat: 900, mObra: 250 },
  '17.2': { descricao: 'Cuba de embutir de louça oval — sanitários', unidPadrao: 'unid', mat: 350, mObra: 150 },

  // Pintura
  '18.1': { descricao: 'Epóxi sobre cimentado — áreas técnicas (piso)', unidPadrao: 'm2', mat: 67.2, mObra: 38.2 },
  '18.2': { descricao: 'Pintura esmalte cor amarela — bases casa de máquinas', unidPadrao: 'vb', mat: 1250, mObra: 750 },
  '18.3': { descricao: 'Emassamento + pintura acrílica branco gelo — paredes vendas', unidPadrao: 'm2', mat: 30.68, mObra: 22.9 },
  '18.4': { descricao: 'Emassamento + pintura acrílica branco neve — paredes vendas', unidPadrao: 'm2', mat: 30.68, mObra: 22.9 },
  '18.5': { descricao: 'Emassamento + pintura acrílica branco gelo — área administrativa', unidPadrao: 'm2', mat: 30.68, mObra: 22.9 },
  '18.6': { descricao: 'Pintura latex branco — acima do nível do forro', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '18.7': { descricao: 'Emassamento + textura acrílica h=1,70m', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '18.8': { descricao: 'Emassamento + pintura látex PVA cor Diário de Menina — paredes ADM', unidPadrao: 'm2', mat: 23.88, mObra: 15.89 },
  '18.9': { descricao: 'Pintura látex branco neve para laje — área de vendas', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '18.10': { descricao: 'Emassamento + pintura látex branco neve — forro vendas', unidPadrao: 'm2', mat: 26.68, mObra: 18.9 },
  '18.11': { descricao: 'Emassamento + pintura látex branco neve — forro ADM/reserva', unidPadrao: 'm2', mat: 26.68, mObra: 18.9 },
  '18.12': { descricao: 'Emassamento + pintura látex cor Diário de Menina — forro ADM', unidPadrao: 'm2', mat: 23.68, mObra: 18.9 },
  '18.13': { descricao: 'Pintura latex branco — áreas técnicas', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '18.14': { descricao: 'Pintura latex branco neve — laje reservas/adm', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '18.15': { descricao: 'Pintura infras e estruturas branco neve — salão de vendas', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '18.16': { descricao: 'Pintura infras e estruturas cinza claro — reservas/adm', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '18.17': { descricao: 'Pintura esmalte grafite em porta metálica', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '18.18': { descricao: 'Pintura epóxi amarelo — corrimão metálico', unidPadrao: 'ml', mat: 44.7, mObra: 15.89 },

  // Vidros e espelhos
  '19.1': { descricao: 'Espelho cristal 4mm com moldura de alumínio (1 por cuba)', unidPadrao: 'unid', mat: 498.3, mObra: 196.19 },
  '19.2': { descricao: 'Espelho cristal 4mm vertical com moldura — vestiários (1,40×0,50m)', unidPadrao: 'unid', mat: 498.3, mObra: 196.19 },
  '19.3': { descricao: 'Vidro blindex 10mm para guarda corpo', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '19.4': { descricao: 'Vidro temperado incolor 10mm — vitrine', unidPadrao: 'm2', mat: 432.7, mObra: 168.9 },

  // Portas em madeira
  '20.1': { descricao: 'Porta de madeira completa 0,62×2,10m (Curupixa/Tauari)', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '20.2': { descricao: 'Porta de madeira completa 0,72×2,10m', unidPadrao: 'unid', mat: 1576, mObra: 285 },
  '20.3': { descricao: 'Porta de madeira completa 0,82×2,10m', unidPadrao: 'unid', mat: 1776, mObra: 285 },
  '20.4': { descricao: 'Porta de madeira completa 0,92×2,10m com visor (cantina)', unidPadrao: 'unid', mat: 1876, mObra: 285 },
  '20.5': { descricao: 'Porta de madeira completa 0,92×2,10m com visor (sala CFTV)', unidPadrao: 'unid', mat: 2110, mObra: 285 },
  '20.6': { descricao: 'Mola para porta', unidPadrao: 'unid', mat: 325.6, mObra: 95.4 },
  '20.7': { descricao: 'Tetra-chave', unidPadrao: 'unid', mat: 289.4, mObra: 145 },
  '20.8': { descricao: 'Prendedor de porta', unidPadrao: 'unid', mat: 100, mObra: 80 },
  '20.9': { descricao: 'Fechadura elétrica com acionamento manual — porta back office', unidPadrao: 'unid', mat: 0, mObra: 0 },

  // Marcenaria vendas
  '21.1': { descricao: 'Revestimento em laminado', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '21.2': { descricao: 'Painel 120cm laminado Ártico TX', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '21.3': { descricao: 'Divisória em MDP 25mm laminado — fechamento lateral dos balcões', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '21.4': { descricao: 'Réguas para união de painéis', unidPadrao: 'ml', mat: 28.5, mObra: 18.87 },
  '21.5': { descricao: 'Fornecimento e instalação de Hot Line — bancada com divisória', unidPadrao: 'cj', mat: 0, mObra: 0 },
  '21.6': { descricao: 'Revestimento de colunas área vendas padrão Ártico TX', unidPadrao: 'unid', mat: 2376, mObra: 1740 },
  '21.7': { descricao: 'Rodapé em fórmica', unidPadrao: 'ml', mat: 0, mObra: 0 },
  '21.8': { descricao: 'Rodateto em fórmica', unidPadrao: 'ml', mat: 0, mObra: 0 },
  '21.9': { descricao: 'Espelho 4mm incolor Guardian class', unidPadrao: 'm2', mat: 480, mObra: 168 },
  '21.10': { descricao: 'Porta completa simples Ártico TX 0,80m', unidPadrao: 'unid', mat: 624.02, mObra: 229.43 },
  '21.11': { descricao: 'Porta completa simples Ártico TX 1,00m', unidPadrao: 'unid', mat: 724.02, mObra: 229.43 },
  '21.12': { descricao: 'Porta dupla 1,20m Ártico TX', unidPadrao: 'unid', mat: 824.02, mObra: 229.43 },
  '21.13': { descricao: 'Porta vai-vem Ártico TX', unidPadrao: 'unid', mat: 2640, mObra: 410 },
  '21.14': { descricao: 'Caixa para hidrantes', unidPadrao: 'unid', mat: 1090, mObra: 490 },
  '21.15': { descricao: 'Vidro temperado hidrante c/ ferragens', unidPadrao: 'unid', mat: 660, mObra: 240 },
  '21.16': { descricao: 'Arquibancada em MDP branco 18mm', unidPadrao: 'unid', mat: 0, mObra: 1228.29 },
  '21.17': { descricao: 'Cantoneira de alumínio (arremates)', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '21.18': { descricao: 'Tubo aço inox 2" para alimentação caixa', unidPadrao: 'unid', mat: 368, mObra: 95 },
  '21.19': { descricao: 'Estrado com laminado branco para vitrine', unidPadrao: 'm2', mat: 129.41, mObra: 98.32 },
  '21.20': { descricao: 'Estrutura metálica em tubo de ferro metalon para estrados', unidPadrao: 'm2', mat: 992.45, mObra: 423.67 },
  '21.21': { descricao: 'Fixadores de teto', unidPadrao: 'unid', mat: 93.2, mObra: 63.4 },

  // Provadores
  '22.1': { descricao: 'Revestimento laminado fórmica Ártico L166 TX', unidPadrao: 'm2', mat: 378.1, mObra: 247 },
  '22.2': { descricao: 'Revestimento laminado fórmica Gelo L106 TX', unidPadrao: 'm2', mat: 378.1, mObra: 247 },
  '22.3': { descricao: 'Revestimento laminado fórmica Branco L120TX', unidPadrao: 'm2', mat: 378.1, mObra: 247 },
  '22.4': { descricao: 'Revestimento laminado fórmica Cobalto L118 TX', unidPadrao: 'm2', mat: 428.1, mObra: 247 },
  '22.5': { descricao: 'Revestimento laminado fórmica Prattan L151 TX', unidPadrao: 'm2', mat: 498.1, mObra: 247 },
  '22.7': { descricao: 'Lateral de provador branca', unidPadrao: 'unid', mat: 138.65, mObra: 124.2 },
  '22.8': { descricao: 'Painel liso laminado branco', unidPadrao: 'unid', mat: 138.65, mObra: 124.2 },
  '22.9': { descricao: 'Coluna simples (provador)', unidPadrao: 'unid', mat: 1340, mObra: 730 },
  '22.10': { descricao: 'Régua para união de painéis (provador)', unidPadrao: 'unid', mat: 132, mObra: 37.8 },
  '22.11': { descricao: 'Travessa (provador)', unidPadrao: 'unid', mat: 187.2, mObra: 98.23 },
  '22.12': { descricao: 'Frontal (provador)', unidPadrao: 'unid', mat: 623.13, mObra: 223.13 },
  '22.13': { descricao: 'Suporte "L" para lateral de provador', unidPadrao: 'unid', mat: 87.1, mObra: 46.2 },
  '22.14': { descricao: 'Rodapé em MDF branco 10mm×5cm — Tarket', unidPadrao: 'ml', mat: 76.23, mObra: 53.12 },
  '22.15': { descricao: 'Rodapé em fórmica Pratan 10cm', unidPadrao: 'ml', mat: 73.74, mObra: 53.12 },
  '22.16': { descricao: 'Rodapé/rodateto MDF branco 10mm×10cm', unidPadrao: 'ml', mat: 0, mObra: 0 },
  '22.17': { descricao: 'Espelho 4mm — corredor provador', unidPadrao: 'unid', mat: 574.09, mObra: 167.4 },
  '22.18': { descricao: 'Espelho 4mm com cava para iluminação — cabine provador', unidPadrao: 'unid', mat: 624.96, mObra: 167.4 },
  '22.19': { descricao: 'Chassi para espelhos — cabine provador', unidPadrao: 'unid', mat: 519.96, mObra: 265.98 },
  '22.20': { descricao: 'Porta provador 0,60×1,80m', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '22.21': { descricao: 'Porta provador 0,70×1,80m', unidPadrao: 'unid', mat: 837.6, mObra: 216 },
  '22.22': { descricao: 'Porta provador 0,80×1,80m', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '22.23': { descricao: 'Porta provador 0,90×1,80m', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '22.24': { descricao: 'Porta provador PNE', unidPadrao: 'unid', mat: 900, mObra: 240 },
  '22.25': { descricao: 'Porta provador família', unidPadrao: 'unid', mat: 900, mObra: 340 },
  '22.26': { descricao: 'Porta de correr — provador', unidPadrao: 'unid', mat: 1680, mObra: 300 },
  '22.28': { descricao: 'Cantoneira de alumínio — arremates provador', unidPadrao: 'unid', mat: 89, mObra: 68.3 },
  '22.29': { descricao: 'Cabideiro cromado', unidPadrao: 'unid', mat: 58.2, mObra: 14.4 },
  '22.30': { descricao: 'Tubo aço inox 160cm — provador deficiente', unidPadrao: 'unid', mat: 1032.6, mObra: 95 },
  '22.31': { descricao: 'Tubo aço inox 80cm — provador deficiente', unidPadrao: 'unid', mat: 590, mObra: 95 },
  '22.32': { descricao: 'Fixadores de teto (provador)', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '22.33': { descricao: 'Perfil metálico 30×30mm c/ fechamento acrílico em U', unidPadrao: 'ml', mat: 0, mObra: 0 },
  '22.34': { descricao: 'Perfil metálico 30×30mm para espelho de corredor', unidPadrao: 'ml', mat: 0, mObra: 0 },

  // Fachadas
  '23.1': { descricao: 'Cantoneira de alumínio — arremates fachada', unidPadrao: 'unid', mat: 89, mObra: 68.3 },
  '23.2': { descricao: 'Vitrine: tablado fixo em MDP branco com estrutura metálica', unidPadrao: 'unid', mat: 1440, mObra: 1330 },
  '23.3': { descricao: 'Perfil aço inox escovado para caixilho dos vidros 150mm', unidPadrao: 'ml', mat: 0, mObra: 0 },
  '23.4': { descricao: 'Revestimento em ACM Branco Brilho', unidPadrao: 'm2', mat: 380, mObra: 259 },
  '23.5': { descricao: 'Revestimento em fórmica (fachada)', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '23.6': { descricao: 'Revestimento para marquise', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '23.7': { descricao: 'Porcelanato 1,20×0,60 — fachada', unidPadrao: 'm2', mat: 0, mObra: 0, materialCliente: true },
  '23.8': { descricao: 'Argamassa, rejunte e MO — porcelanato fachada', unidPadrao: 'm2', mat: 0, mObra: 0 },
  '23.9': { descricao: 'Rodapé em aço inox escovado 200mm (fachada)', unidPadrao: 'ml', mat: 256, mObra: 119 },
  '23.10': { descricao: 'Porta de enrolar — fornecimento C&A', unidPadrao: 'unid', mat: 0, mObra: 0, materialCliente: true },

  // Marcenaria e enxoval
  '24.1': { descricao: 'Armário suspenso — refeitório', unidPadrao: 'unid', mat: 2175, mObra: 460 },
  '24.2': { descricao: 'Bancada/armário da copa', unidPadrao: 'unid', mat: 2160, mObra: 950 },
  '24.3': { descricao: 'Armário suspenso e bancada — sala da gerência', unidPadrao: 'unid', mat: 2170, mObra: 950 },
  '24.4': { descricao: 'Prateleira na circulação para caixa geral', unidPadrao: 'unid', mat: 0, mObra: 0 },
  '24.5': { descricao: 'Moldura para cofre — boca de lobo', unidPadrao: 'unid', mat: 925, mObra: 260 },
  '24.6': { descricao: 'Estante sala de rack', unidPadrao: 'unid', mat: 1320, mObra: 260 },
  '24.7': { descricao: 'Armário boca de lobo — sala da gerência', unidPadrao: 'unid', mat: 1315, mObra: 180 },
  '24.8': { descricao: 'Base de alumínio para bebedouro', unidPadrao: 'unid', mat: 1190, mObra: 0 },
  '24.9': { descricao: 'Filtro para bebedouro Aqualar', unidPadrao: 'unid', mat: 735, mObra: 0 },
  '24.10': { descricao: 'Porta e tampa de alumínio para lixeira copa', unidPadrao: 'unid', mat: 920, mObra: 0 },
  '24.11': { descricao: 'Suporte para TV, projetor e microondas', unidPadrao: 'unid', mat: 545, mObra: 95 },
  '24.12': { descricao: 'Lixeira para bancada da cantina', unidPadrao: 'unid', mat: 376.12, mObra: 0 },
  '24.13': { descricao: 'Lixeira para bancada dos sanitários', unidPadrao: 'unid', mat: 376, mObra: 0 },
  '24.14': { descricao: 'Lixeira para vasos sanitários', unidPadrao: 'unid', mat: 298.3, mObra: 0 },
  '24.15': { descricao: 'Portinhola branca para correio pneumático', unidPadrao: 'unid', mat: 436, mObra: 83.65 },
  '24.16': { descricao: 'Locker para vestiário', unidPadrao: 'unid', mat: 560, mObra: 156 },
  '24.17': { descricao: 'Banco para vestiário', unidPadrao: 'unid', mat: 0, mObra: 0 },

  // Omissos
  '25.1': { descricao: 'Proteção eletromagnética em manta aluminizada (RFID)', unidPadrao: 'm2', mat: 70, mObra: 50 },
  '25.2': { descricao: 'Alvenaria em bloco celular', unidPadrao: 'm2', mat: 66.3, mObra: 28.5 },
  '25.3': { descricao: 'Revestimento da Escada em Granito Branco Ceará', unidPadrao: 'm2', mat: 900, mObra: 250 },
  '25.4': { descricao: 'Rodapé escada dos provadores em granito Branco Ceará', unidPadrao: 'ml', mat: 879, mObra: 250 },
  '25.5': { descricao: 'Rodapé MDP Branco', unidPadrao: 'ml', mat: 340, mObra: 189 },
  '25.7': { descricao: 'Grama sintética — sala descompressão', unidPadrao: 'm2', mat: 393.3, mObra: 296.8 },
};
