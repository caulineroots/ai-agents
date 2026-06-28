// ─── Checklist XLSX — BLK (Shopping Neumarkt Blumenau) 1ª revisão ───────────
// Fonte: BLK_ Equalização Civil- 1ª revisão (1).xlsx
// Gerado automaticamente — NÃO editar manualmente.

export type GrupoEspecialista = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

export interface XlsxItem {
  cod:             string;
  secao:           number | 'A';
  grupo:           GrupoEspecialista;
  descricao:       string;
  zona:            string;
  unidade:         string;
  mat:             number;
  mo:              number;
  vlrUnit:         number;
  materialCliente: boolean;
  qdeReferencia?:  number;
  totalEsperado?:  number;
  zerado?:         boolean;
}

// ─── SEÇÃO A — Custos Indiretos ────────────────────────────────── //
const secaoA: XlsxItem[] = [
  { cod: '1.1', secao: 'A', grupo: 'G1', descricao: 'ART contemplando todos os serviços + placa de obra', zona: '', unidade: 'vb', mat: 0, mo: 1100, vlrUnit: 1100, materialCliente: true, qdeReferencia: 1, totalEsperado: 1100 },
  { cod: '1.2', secao: 'A', grupo: 'G1', descricao: 'Seguro de obra com responsabilidade civil.', zona: '', unidade: 'vb', mat: 3400, mo: 0, vlrUnit: 3400, materialCliente: false, qdeReferencia: 1, totalEsperado: 3400 },
  { cod: '1.3', secao: 'A', grupo: 'G1', descricao: 'Topografia (5 visitas)', zona: '', unidade: 'dia', mat: 150, mo: 1070, vlrUnit: 1220, materialCliente: false, qdeReferencia: 5, totalEsperado: 6100 },
  { cod: '2.1', secao: 'A', grupo: 'G1', descricao: 'Tapume em placas de divisória tipo Eucatex estruturado com pontaletes 3”x3”.(cor branco)', zona: '', unidade: 'm2', mat: 25, mo: 50, vlrUnit: 75, materialCliente: false, qdeReferencia: 213, totalEsperado: 15975 },
  { cod: '2.2', secao: 'A', grupo: 'G1', descricao: 'Equipamentos de proteção individual (EPI), comunicação visual', zona: '', unidade: 'vb', mat: 2500, mo: 0, vlrUnit: 2500, materialCliente: false, qdeReferencia: 1, totalEsperado: 2500 },
  { cod: '2.3', secao: 'A', grupo: 'G1', descricao: 'Vigilância normal de obra (segunda a sexta feira das 19h às 07h. Sábados, domingos e feriados 24h), período 30 dias', zona: '', unidade: 'dia', mat: 0, mo: 100, vlrUnit: 100, materialCliente: true, qdeReferencia: 30, totalEsperado: 3000 },
  { cod: '2.4', secao: 'A', grupo: 'G1', descricao: 'Dependências para administração da obra: escritórios para gerenciador (com internet,mobiliário, ar condicionado, inclusive sala de reunião, frigobar, civil, instalações, ar condicionado e decoração, refeitório, WC para operários e WC para fiscal, incluindo instalação elétrica, hidráulica e cobertura (área de 130m²)', zona: '', unidade: 'vb', mat: 15980, mo: 3800, vlrUnit: 19780, materialCliente: false, qdeReferencia: 1, totalEsperado: 19780 },
  { cod: '2.5', secao: 'A', grupo: 'G1', descricao: 'Material de limpeza e administrativo (Xerox e Plotagens)', zona: '', unidade: 'vb', mat: 3500, mo: 0, vlrUnit: 3500, materialCliente: false, qdeReferencia: 1, totalEsperado: 3500 },
  { cod: '2.6', secao: 'A', grupo: 'G1', descricao: 'Extintores para a Obra e Bebedouro para funcionários', zona: '', unidade: 'vb', mat: 1030, mo: 0, vlrUnit: 1030, materialCliente: false, qdeReferencia: 1, totalEsperado: 1030 },
  { cod: '2.7', secao: 'A', grupo: 'G1', descricao: 'Ligação Elétrica tomadas e Iluminação para Canteiro de Obra e Escritórios', zona: '', unidade: 'vb', mat: 2500, mo: 0, vlrUnit: 2500, materialCliente: false, qdeReferencia: 1, totalEsperado: 2500 },
  { cod: '2.8', secao: 'A', grupo: 'G1', descricao: 'Ligação Elétrica Iluminação Provisória de Obra e Quadro para entrada de energia provisória (se necessário).', zona: '', unidade: 'vb', mat: 3000, mo: 0, vlrUnit: 3000, materialCliente: false, qdeReferencia: 1, totalEsperado: 3000 },
  { cod: '2.9', secao: 'A', grupo: 'G1', descricao: 'Eletricista durante a obra, e após a entrega de civil deve permanecer disponível até a abertura para dar suporte as outras equipes.', zona: '', unidade: 'vb', mat: 0, mo: 4500, vlrUnit: 4500, materialCliente: true, qdeReferencia: 1, totalEsperado: 4500 },
  { cod: '3.1', secao: 'A', grupo: 'G1', descricao: 'Lona proteção - piso, marcenaria, equipamentos em geral', zona: '', unidade: 'vb', mat: 4580, mo: 0, vlrUnit: 4580, materialCliente: false, qdeReferencia: 1, totalEsperado: 4580 },
  { cod: '3.2', secao: 'A', grupo: 'G1', descricao: 'Lona transparente proteção equipamentos', zona: '', unidade: 'vb', mat: 4200, mo: 0, vlrUnit: 4200, materialCliente: false, qdeReferencia: 1, totalEsperado: 4200 },
  { cod: '3.3', secao: 'A', grupo: 'G1', descricao: 'Retirada periódica de entulhos e caçamba ( lonas, sacarias, materiais demolições, etc.)', zona: '', unidade: 'mes', mat: 200, mo: 6000, vlrUnit: 6200, materialCliente: false, qdeReferencia: 3, totalEsperado: 18600 },
  { cod: '3.4', secao: 'A', grupo: 'G1', descricao: 'Locação de equipamentos manuais', zona: '', unidade: 'vb', mat: 0, mo: 6900, vlrUnit: 6900, materialCliente: true, qdeReferencia: 1, totalEsperado: 6900 },
  { cod: '3.5', secao: 'A', grupo: 'G1', descricao: 'Transporte vertical e horizontal', zona: '', unidade: 'vb', mat: 0, mo: 7700, vlrUnit: 7700, materialCliente: true, qdeReferencia: 1, totalEsperado: 7700 },
  { cod: '4.1', secao: 'A', grupo: 'G1', descricao: 'Engenheiro residente - full time', zona: '', unidade: 'mes', mat: 0, mo: 10500, vlrUnit: 10500, materialCliente: true, qdeReferencia: 3, totalEsperado: 31500 },
  { cod: '4.2', secao: 'A', grupo: 'G1', descricao: 'Técnico de segurança - full time', zona: '', unidade: 'mes', mat: 0, mo: 1500, vlrUnit: 1500, materialCliente: true, qdeReferencia: 3, totalEsperado: 4500 },
  { cod: '4.3', secao: 'A', grupo: 'G1', descricao: 'Estadias e refeições', zona: '', unidade: 'vb', mat: 0, mo: 35000, vlrUnit: 35000, materialCliente: true, qdeReferencia: 1, totalEsperado: 35000 },
  { cod: '4.4', secao: 'A', grupo: 'G1', descricao: 'Mobilização e desmobilização', zona: '', unidade: 'vb', mat: 0, mo: 28000, vlrUnit: 28000, materialCliente: true, qdeReferencia: 1, totalEsperado: 28000 },
  { cod: '4.5', secao: 'A', grupo: 'G1', descricao: 'Limpeza permanente da obra (2 operários)', zona: '', unidade: 'mes', mat: 0, mo: 500, vlrUnit: 500, materialCliente: true, qdeReferencia: 3, totalEsperado: 1500 },
  { cod: '5.1', secao: 'A', grupo: 'G1', descricao: 'Limpeza Final de obra', zona: '', unidade: 'vb', mat: 0, mo: 9000, vlrUnit: 9000, materialCliente: true, qdeReferencia: 1, totalEsperado: 9000 },
];

// ─── SEÇÃO 7 — Adaptação de Shell ──────────────────────────────── //
const secao7: XlsxItem[] = [
  { cod: '7.1', secao: 7, grupo: 'G1', descricao: 'Demolições e retiradas - incluir bota-fora', zona: '', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 8 — Serralheria ─────────────────────────────────────── //
const secao8: XlsxItem[] = [
  { cod: '8.1', secao: 8, grupo: 'G1', descricao: 'Mezanino metálico - contratação direta C&A', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.2', secao: 8, grupo: 'G1', descricao: 'Painel wall para mezanino - contratação direta C&A', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.3', secao: 8, grupo: 'G1', descricao: 'Escada metálica - contratação direta C&A', zona: 'estoque', unidade: 'um', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 3, zerado: true },
  { cod: '8.4', secao: 8, grupo: 'G1', descricao: 'Adequação de escada / mezanino / guarda corpo existente', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 1, zerado: true },
  { cod: '8.5', secao: 8, grupo: 'G1', descricao: 'Guarda corpo de ferro com pintura de fundo para escada e mezanino', zona: 'estoque', unidade: 'm', mat: 280, mo: 125.7, vlrUnit: 405.7, materialCliente: false, qdeReferencia: 19, totalEsperado: 7708.3 },
  { cod: '8.6', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica em metalon para revestimento de fachada', zona: 'fachada', unidade: 'vb', mat: 8190, mo: 5220, vlrUnit: 13410, materialCliente: false, qdeReferencia: 1, totalEsperado: 13410 },
  { cod: '8.6', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica em metalon para marquise', zona: 'fachada', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.7', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica auxiliar tipo gaiola para base e sustentação de vitrine', zona: 'fachada', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.8', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica auxiliar para septo de Ar Condicionado - Sobre o Forro', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.9', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica auxiliar para porta de enrolar', zona: 'fachada', unidade: 'vb', mat: 4000, mo: 3980, vlrUnit: 7980, materialCliente: false, qdeReferencia: 1, totalEsperado: 7980 },
  { cod: '8.10', secao: 8, grupo: 'G1', descricao: 'Guarda corpo em inox para salão de vendas (escadas rolantes e desnível de pisos) conforme projeto', zona: 'vendas', unidade: 'ml', mat: 284, mo: 125.7, vlrUnit: 409.7, materialCliente: false, qdeReferencia: 18.6, totalEsperado: 7620.42 },
  { cod: '8.11', secao: 8, grupo: 'G1', descricao: 'Gradil metálico para isolamento', zona: 'estoque', unidade: 'vb', mat: 3850, mo: 2510, vlrUnit: 6360, materialCliente: false, qdeReferencia: 1, totalEsperado: 6360 },
  { cod: '8.11', secao: 8, grupo: 'G1', descricao: 'Adequação estrutural para elevador', zona: 'vendas', unidade: 'vb', mat: 3500, mo: 4480, vlrUnit: 7980, materialCliente: false, qdeReferencia: 1, totalEsperado: 7980 },
  { cod: '8.11', secao: 8, grupo: 'G1', descricao: 'Adequação estrutural para escada rolante', zona: 'vendas', unidade: 'vb', mat: 3500, mo: 4480, vlrUnit: 7980, materialCliente: false, qdeReferencia: 1, totalEsperado: 7980 },
  { cod: '8.12', secao: 8, grupo: 'G1', descricao: 'Porta de ferro - Circulação', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.13', secao: 8, grupo: 'G1', descricao: 'Porta de ferro - Gerador', zona: 'área técnica', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.14', secao: 8, grupo: 'G1', descricao: 'Porta de ferro - C. Máquina', zona: 'área técnica', unidade: 'un', mat: 2390, mo: 480, vlrUnit: 2870, materialCliente: false, qdeReferencia: 2, totalEsperado: 5740 },
  { cod: '8.15', secao: 8, grupo: 'G1', descricao: 'Porta corta-fogo - Docas', zona: 'área técnica', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.16', secao: 8, grupo: 'G1', descricao: 'Esquadria metálica c/ tela', zona: 'área técnica', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.17', secao: 8, grupo: 'G1', descricao: 'Portinhola de alumínio sob bancada apenas na cantina', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.18', secao: 8, grupo: 'G1', descricao: 'Visor back office com vidro', zona: 'adm', unidade: 'un', mat: 600, mo: 400, vlrUnit: 1000, materialCliente: false, qdeReferencia: 1, totalEsperado: 1000 },
  { cod: '8.19', secao: 8, grupo: 'G1', descricao: 'Visor gerência com vidro', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.20', secao: 8, grupo: 'G1', descricao: 'Passa documentos', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 9 — Civil ───────────────────────────────────────────── //
const secao9: XlsxItem[] = [
  { cod: '9.1', secao: 9, grupo: 'G2', descricao: 'Enchimento de contrapiso (h=4cm)', zona: '', unidade: 'm2', mat: 630, mo: 150, vlrUnit: 780, materialCliente: false, qdeReferencia: 66, totalEsperado: 51480 },
  { cod: '9.2', secao: 9, grupo: 'G2', descricao: 'Piso Cimentado para áreas técnicas com 5cm de espessura', zona: 'área técnica', unidade: 'm2', mat: 130, mo: 900, vlrUnit: 1030, materialCliente: false, qdeReferencia: 51.02, totalEsperado: 52550.6 },
  { cod: '9.3', secao: 9, grupo: 'G2', descricao: 'Sóculos para bancadas', zona: 'adm', unidade: 'vb', mat: 840, mo: 510, vlrUnit: 1350, materialCliente: false, qdeReferencia: 1, totalEsperado: 1350 },
  { cod: '9.4', secao: 9, grupo: 'G2', descricao: 'Bases em concreto para equipamentos (ar condicionado, gerador, transformador)', zona: 'área técnica', unidade: 'vb', mat: 1079, mo: 870, vlrUnit: 1949, materialCliente: false, qdeReferencia: 1, totalEsperado: 1949 },
  { cod: '9.5', secao: 9, grupo: 'G2', descricao: 'Alvenaria em tijolo/bloco de concreto', zona: 'adm', unidade: 'm2', mat: 70, mo: 34, vlrUnit: 104, materialCliente: false, qdeReferencia: 314, totalEsperado: 32656 },
  { cod: '9.6', secao: 9, grupo: 'G2', descricao: 'Alvenaria em bloco sical', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.7', secao: 9, grupo: 'G2', descricao: 'Chapisco e emboço', zona: 'adm', unidade: 'm2', mat: 25.32, mo: 14.65, vlrUnit: 39.97, materialCliente: false, qdeReferencia: 630, totalEsperado: 25181.1 },
  { cod: '9.8', secao: 9, grupo: 'G2', descricao: 'Laje pré-moldada com capa de concreto', zona: 'área técnica', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.9', secao: 9, grupo: 'G2', descricao: 'Execução área técnica', zona: 'área técnica', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.10', secao: 9, grupo: 'G2', descricao: 'Concreto com vermiculita, areia e cimento para enchimento das bandejas do mezanino. Fck 30MPa; esp. 4cm', zona: 'mezanino', unidade: 'm3', mat: 900, mo: 300, vlrUnit: 1200, materialCliente: false, qdeReferencia: 20, totalEsperado: 24000 },
  { cod: '9.11', secao: 9, grupo: 'G2', descricao: 'Fornecimento e colocação de tela Telcon e Lona preta', zona: 'mezanino', unidade: 'm2', mat: 39.23, mo: 19.4, vlrUnit: 58.63, materialCliente: false, qdeReferencia: 483, totalEsperado: 28318.29 },
  { cod: '9.12', secao: 9, grupo: 'G2', descricao: 'Furação mecânica de lajes para Esgotos e tubulações.', zona: '', unidade: 'vb', mat: 2150, mo: 1290, vlrUnit: 3440, materialCliente: false, qdeReferencia: 1, totalEsperado: 3440 },
  { cod: '9.13', secao: 9, grupo: 'G2', descricao: 'Arremates gerais', zona: '', unidade: 'vb', mat: 4130, mo: 2260, vlrUnit: 6390, materialCliente: false, qdeReferencia: 1, totalEsperado: 6390 },
];

// ─── SEÇÃO 10 — Impermeabilização ──────────────────────────────── //
const secao10: XlsxItem[] = [
  { cod: '10.1', secao: 10, grupo: 'G2', descricao: 'Impermeabilização casa de máquinas, área técnica e área embaixo da cuba refeitório: manta butílica ou asfáltica tipo torodin ou similar (verificar projeto)', zona: 'adm', unidade: 'm2', mat: 107.36, mo: 98, vlrUnit: 205.36, materialCliente: false, qdeReferencia: 54.15, totalEsperado: 11120.244 },
  { cod: '10.2', secao: 10, grupo: 'G2', descricao: 'Impermeabilização sanitários: manta líquida (verificar projeto)', zona: 'adm', unidade: 'm2', mat: 87.2, mo: 52.4, vlrUnit: 139.6, materialCliente: false, qdeReferencia: 25.54, totalEsperado: 3565.384 },
];

// ─── SEÇÃO 11 — Junta de Dilatação ─────────────────────────────── //
const secao11: XlsxItem[] = [
  { cod: '11.1', secao: 11, grupo: 'G2', descricao: 'Enchimento de Juntas de dilatação com vedaflex', zona: '', unidade: 'ml', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 12 — Paredes e Forros em Gesso ──────────────────────── //
const secao12: XlsxItem[] = [
  { cod: '12.1', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO STD - 1 face - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'vendas', unidade: 'm2', mat: 60.8, mo: 45.7, vlrUnit: 106.5, materialCliente: false, qdeReferencia: 626, totalEsperado: 66669 },
  { cod: '12.2', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO STD - 2 faces - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'vendas', unidade: 'm2', mat: 60.8, mo: 56.7, vlrUnit: 117.5, materialCliente: false, qdeReferencia: 386, totalEsperado: 45355 },
  { cod: '12.3', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO RU - 1 face - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '12.4', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO RU - 2 faces - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'adm', unidade: 'm2', mat: 90.2, mo: 58.45, vlrUnit: 148.65, materialCliente: false, qdeReferencia: 88, totalEsperado: 13081.2 },
  { cod: '12.5', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO RF - 1 face - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'área técnica', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '12.6', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO RF - 2 faces - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'área técnica', unidade: 'm2', mat: 94.2, mo: 58.45, vlrUnit: 152.65, materialCliente: false, qdeReferencia: 33, totalEsperado: 5037.45 },
  { cod: '12.7', secao: 12, grupo: 'G3', descricao: 'Reforço em cedrinho para paredes', zona: '', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 1, zerado: true },
  { cod: '12.8', secao: 12, grupo: 'G3', descricao: 'Demolição forro/sancas de gesso', zona: '', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '12.9', secao: 12, grupo: 'G3', descricao: 'EXECUÇÃO DE FORRO DE GESSO FORRO GYPSUM LISO TABICADO ESTRUTURADO E REJUNTADO. ACABAMENTO EM PINTURA LÁTEX PVA FOSCO, COR BRANCO NEVE, APÓS EMASSADAS AS EMENDA (Massa fast fix/Tabicas/Suportes Nivelador e Conectores)', zona: '', unidade: 'm2', mat: 25.5, mo: 38, vlrUnit: 63.5, materialCliente: false, qdeReferencia: 1370, totalEsperado: 86995 },
  { cod: '12.10', secao: 12, grupo: 'G3', descricao: 'Fechamento em gesso para cortina porta de enrolar - Mat. + M.O.', zona: '', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '12.11', secao: 12, grupo: 'G3', descricao: 'Alçapão', zona: '', unidade: 'un', mat: 73, mo: 54, vlrUnit: 127, materialCliente: false, qdeReferencia: 55, totalEsperado: 6985 },
  { cod: '12.12', secao: 12, grupo: 'G3', descricao: 'Abertura no forro de gesso para luminárias , spots, wall washer, grelhas , difusores e etc', zona: '', unidade: 'un', mat: 0, mo: 35, vlrUnit: 35, materialCliente: true, qdeReferencia: 150, totalEsperado: 5250 },
  { cod: '12.13', secao: 12, grupo: 'G3', descricao: 'Prever reforço para: placas aéreas cv, trilho vitrine', zona: '', unidade: 'vb', mat: 2489, mo: 1300, vlrUnit: 3789, materialCliente: false, qdeReferencia: 1, totalEsperado: 3789 },
];

// ─── SEÇÃO 13 — Divisórias ─────────────────────────────────────── //
const secao13: XlsxItem[] = [
  { cod: '13.1', secao: 13, grupo: 'G2', descricao: 'Fecham. compartimentos: divisórias, ref. sistema divilux 35,  revest. formidur bp plus cor branco e montantes ntr branco, fabr. eucatex', zona: 'adm', unidade: 'm2', mat: 118.2, mo: 87, vlrUnit: 205.2, materialCliente: false, qdeReferencia: 29, totalEsperado: 5950.8 },
  { cod: '13.2', secao: 13, grupo: 'G2', descricao: 'Sanitário: porta 0.60x1.65 - divisória eucatex com maçaneta para cela sanitária - abrir - 1f', zona: 'adm', unidade: 'un', mat: 968.4, mo: 144.3, vlrUnit: 1112.7, materialCliente: false, qdeReferencia: 5, totalEsperado: 5563.5 },
  { cod: '13.3', secao: 13, grupo: 'G2', descricao: 'Porta para divisória eucatex com maçaneta tipo alavanca - abrir - 1f', zona: 'adm', unidade: 'un', mat: 982.3, mo: 232.45, vlrUnit: 1214.75, materialCliente: false, qdeReferencia: 4, totalEsperado: 4859 },
  { cod: '13.4', secao: 13, grupo: 'G2', descricao: 'Portas de divisória 1,20m (dupla)', zona: 'adm', unidade: 'un', mat: 1082.3, mo: 232.45, vlrUnit: 1314.75, materialCliente: false, qdeReferencia: 2, totalEsperado: 2629.5 },
  { cod: '13.5', secao: 13, grupo: 'G2', descricao: 'Porta e ferragens de Vidro ou Alumínio para Box chuveiro', zona: 'adm', unidade: 'un', mat: 989.2, mo: 165, vlrUnit: 1154.2, materialCliente: false, qdeReferencia: 2, totalEsperado: 2308.4 },
];

// ─── SEÇÃO 14 — Revestimento de Piso ───────────────────────────── //
const secao14: XlsxItem[] = [
  { cod: '14.1', secao: 14, grupo: 'G4', descricao: 'Assentamento de piso vinílico salão de vendas/provadores - material fornecido pela C&A', zona: 'vendas', unidade: 'm2', mat: 0, mo: 39.15, vlrUnit: 39.15, materialCliente: true, qdeReferencia: 1127.73, totalEsperado: 44150.6295 },
  { cod: '14.2', secao: 14, grupo: 'G4', descricao: 'Aplicação de autonivelante salão de vendas/provadores - material fornecido pela C&A', zona: 'vendas', unidade: 'm2', mat: 0, mo: 10.2, vlrUnit: 10.2, materialCliente: true, qdeReferencia: 1127.73, totalEsperado: 11502.846 },
  { cod: '14.3', secao: 14, grupo: 'G4', descricao: 'Assentamento de piso porcelanato', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.4', secao: 14, grupo: 'G4', descricao: 'Argamassa, rejunte e mão de obra para aplicação de piso cerâmico', zona: 'vendas', unidade: 'm2', mat: 0, mo: 23, vlrUnit: 23, materialCliente: true, qdeReferencia: 432.81, totalEsperado: 9954.63 },
  { cod: '14.5', secao: 14, grupo: 'G4', descricao: 'Rodapé Primer Tarket - 10 cm - SV', zona: 'vendas', unidade: 'ml', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.6', secao: 14, grupo: 'G4', descricao: 'Piso tátil (escada rolante e escada fixa) - Mat. + M.O.', zona: 'vendas', unidade: 'vb', mat: 220, mo: 150, vlrUnit: 370, materialCliente: false, qdeReferencia: 1, totalEsperado: 370 },
  { cod: '14.7', secao: 14, grupo: 'G4', descricao: 'Sóculos granito frente vitrine (largura 10cm)', zona: 'fachada', unidade: 'ml', mat: 237.2, mo: 87, vlrUnit: 324.2, materialCliente: false, qdeReferencia: 3.24, totalEsperado: 1050.408 },
  { cod: '14.8', secao: 14, grupo: 'G4', descricao: 'Soleira em granito - Mat. + M.O. (Branco Ceará)', zona: 'vendas', unidade: 'ml', mat: 550, mo: 296, vlrUnit: 846, materialCliente: false, qdeReferencia: 19.55, totalEsperado: 16539.3 },
  { cod: '14.9', secao: 14, grupo: 'G4', descricao: 'Capacho nômade 3M cinza grafite - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.10', secao: 14, grupo: 'G4', descricao: 'Fita antiderrapante Safety walk 50mm para entrada da loja', zona: 'vendas', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.11', secao: 14, grupo: 'G4', descricao: 'Aplicação de piso cerâmico c/ fornecimento de argamassa e rejunte  - Cerâmica ate 45x45 cm REF.: Cargo plus white Eliane - fornecido pela C&A', zona: 'adm', unidade: 'm2', mat: 0, mo: 58, vlrUnit: 58, materialCliente: true, qdeReferencia: 432.81, totalEsperado: 25102.98 },
  { cod: '14.12', secao: 14, grupo: 'G4', descricao: 'Assentamento de piso vinílico ADM - material fornecido pela C&A (EXCETO RESERVA E ÁRES MOLHADAS)', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.13', secao: 14, grupo: 'G4', descricao: 'Rodapé de madeira h=7cm', zona: 'adm', unidade: 'ml', mat: 35.9, mo: 17.43, vlrUnit: 53.33, materialCliente: false, qdeReferencia: 59.11, totalEsperado: 3152.3363 },
  { cod: '14.14', secao: 14, grupo: 'G4', descricao: 'Rodapé de madeira h=20cm', zona: 'adm', unidade: 'ml', mat: 43.67, mo: 17.45, vlrUnit: 61.12, materialCliente: false, qdeReferencia: 216.97, totalEsperado: 13261.2064 },
  { cod: '14.15', secao: 14, grupo: 'G4', descricao: 'Montagem de estante modular metálica - fornecido pela C&A', zona: 'adm', unidade: 'pç', mat: 150, mo: 3400, vlrUnit: 3550, materialCliente: false, qdeReferencia: 3, totalEsperado: 10650 },
  { cod: '14.16', secao: 14, grupo: 'G4', descricao: 'Revestimento da Escada (Degrau e espelho) em Ardósia', zona: 'adm', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.17', secao: 14, grupo: 'G4', descricao: 'ESCADA: Piso tátil e fita antiderrapante', zona: 'adm', unidade: 'cj', mat: 990, mo: 470, vlrUnit: 1460, materialCliente: false, qdeReferencia: 1, totalEsperado: 1460 },
  { cod: '14.18', secao: 14, grupo: 'G4', descricao: 'ESCADA: Revestimento degrau em Ardósia', zona: 'adm', unidade: 'm2', mat: 1500, mo: 560, vlrUnit: 2060, materialCliente: false, qdeReferencia: 8.4, totalEsperado: 17304 },
  { cod: '14.19', secao: 14, grupo: 'G4', descricao: 'Soleira em granito - Mat. + M.O. (Cinza Andorinha)', zona: 'adm', unidade: 'ml', mat: 635.6, mo: 333.2, vlrUnit: 968.8, materialCliente: false, qdeReferencia: 2.15, totalEsperado: 2082.92 },
];

// ─── SEÇÃO 15 — Revestimento de Parede ─────────────────────────── //
const secao15: XlsxItem[] = [
  { cod: '15.1', secao: 15, grupo: 'G4', descricao: 'Azulejo branco junta a prumo - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 89.75, mo: 36.75, vlrUnit: 126.5, materialCliente: false, qdeReferencia: 76, totalEsperado: 9614 },
  { cod: '15.2', secao: 15, grupo: 'G4', descricao: 'Perfil de alumínio branco 1/2" E 1/16" meia altura - Mat. + M.O.', zona: 'adm', unidade: 'm', mat: 32.2, mo: 16, vlrUnit: 48.2, materialCliente: false, qdeReferencia: 23, totalEsperado: 1108.6 },
  { cod: '15.3', secao: 15, grupo: 'G4', descricao: 'Arremate em cantoneira de alumínio nas quinas da circulação h=1,70m - Mat. + M.O.', zona: 'adm', unidade: 'm', mat: 32.2, mo: 18.4, vlrUnit: 50.6, materialCliente: false, qdeReferencia: 12, totalEsperado: 607.2 },
  { cod: '15.4', secao: 15, grupo: 'G4', descricao: 'Rodameio em madeira para sala de gerente - Mat. + M.O.', zona: 'adm', unidade: 'm', mat: 100, mo: 79, vlrUnit: 179, materialCliente: false, qdeReferencia: 4, totalEsperado: 716 },
];

// ─── SEÇÃO 16 — Mármores e Granitos ────────────────────────────── //
const secao16: XlsxItem[] = [
  { cod: '16.1', secao: 16, grupo: 'G4', descricao: 'Bancadas em granito para cantina (bancadas, área balcão térmico) - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 1785, mo: 1230, vlrUnit: 3015, materialCliente: false, qdeReferencia: 1.3, totalEsperado: 3919.5 },
  { cod: '16.2', secao: 16, grupo: 'G4', descricao: 'Bancadas em granito para vestiários - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 1785, mo: 1230, vlrUnit: 3015, materialCliente: false, qdeReferencia: 2.44, totalEsperado: 7356.6 },
  { cod: '16.3', secao: 16, grupo: 'G4', descricao: 'Aparadores para bancada de vestiários  - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 190, mo: 78, vlrUnit: 268, materialCliente: false, qdeReferencia: 2, totalEsperado: 536 },
  { cod: '16.4', secao: 16, grupo: 'G4', descricao: 'Nicho em granito nos box de chuveiro - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 190, mo: 78, vlrUnit: 268, materialCliente: false, qdeReferencia: 2, totalEsperado: 536 },
];

// ─── SEÇÃO 17 — Louças e Metais ────────────────────────────────── //
const secao17: XlsxItem[] = [
  { cod: '17.1', secao: 17, grupo: 'G1', descricao: 'Cuba de inox - copa', zona: 'adm', unidade: 'un', mat: 900, mo: 250, vlrUnit: 1150, materialCliente: false, qdeReferencia: 1, totalEsperado: 1150 },
  { cod: '17.2', secao: 17, grupo: 'G1', descricao: 'Cuba de embutir de louça oval', zona: 'adm', unidade: 'un', mat: 350, mo: 150, vlrUnit: 500, materialCliente: false, qdeReferencia: 4, totalEsperado: 2000 },
  { cod: '17.3', secao: 17, grupo: 'G1', descricao: 'Obs.: Demais louças e metais serão fornecidas e instaladas pela Instaladora de hidráulica.', zona: 'adm', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 1, zerado: true },
];

// ─── SEÇÃO 18 — Pintura ────────────────────────────────────────── //
const secao18: XlsxItem[] = [
  { cod: '18.1', secao: 18, grupo: 'G3', descricao: 'Epóxi sobre cimentado - Mat. + M.O. - áreas técnicas', zona: 'área técnica', unidade: 'm2', mat: 67.2, mo: 38.2, vlrUnit: 105.4, materialCliente: false, qdeReferencia: 51.02, totalEsperado: 5377.508 },
  { cod: '18.2', secao: 18, grupo: 'G3', descricao: 'Pintura esmalte cor amarela - Mat. + M.O. - bases casa de máquinas', zona: 'área técnica', unidade: 'vb', mat: 1250, mo: 750, vlrUnit: 2000, materialCliente: false, qdeReferencia: 1, totalEsperado: 2000 },
  { cod: '18.3', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura acrílica - branco gelo - vendas - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 29.68, mo: 22.9, vlrUnit: 52.58, materialCliente: false, qdeReferencia: 602, totalEsperado: 31653.16 },
  { cod: '18.4', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura acrílica - branco neve - vendas - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 30.68, mo: 22.9, vlrUnit: 53.58, materialCliente: false, qdeReferencia: 58, zerado: true },
  { cod: '18.5', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura acrílica - branco gelo - área administrativa - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 29.68, mo: 22.9, vlrUnit: 52.58, materialCliente: false, qdeReferencia: 903, totalEsperado: 47479.74 },
  { cod: '18.6', secao: 18, grupo: 'G3', descricao: 'Pintura latex branco - Mat. + M.O. - acima do nível do forro', zona: '', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.7', secao: 18, grupo: 'G3', descricao: 'Emassamento e aplicação de textura acrílica (h=1,70m) - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.8', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura Látex PVA COR DIÁRIO DE 
MENINA fosco- área administrativa - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 23.88, mo: 15.89, vlrUnit: 39.77, materialCliente: false, qdeReferencia: 25, totalEsperado: 994.25 },
  { cod: '18.9', secao: 18, grupo: 'G3', descricao: 'Pintura Látex PVA Fosco, cor branco neve para laje - Mat. + M.O. - área de vendas', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.10', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura Látex PVA branco neve fosco para forro - Mat. + M.O. - área de vendas', zona: 'vendas', unidade: 'm2', mat: 26.68, mo: 18.9, vlrUnit: 45.58, materialCliente: false, qdeReferencia: 1044.85, totalEsperado: 47624.263 },
  { cod: '18.11', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura Látex branco neve fosco forro - Mat. + M.O. - laje reservas/ administrativa', zona: 'adm', unidade: 'm2', mat: 26.68, mo: 18.9, vlrUnit: 45.58, materialCliente: false, qdeReferencia: 270.11, totalEsperado: 12311.6138 },
  { cod: '18.12', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura Látex PVA COR DIÁRIO DE 
MENINA fosco para forro - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 23.68, mo: 18.9, vlrUnit: 42.58, materialCliente: false, qdeReferencia: 9.97, totalEsperado: 424.5226 },
  { cod: '18.13', secao: 18, grupo: 'G3', descricao: 'Pintura latex branco - Mat. + M.O. - áreas técnicas', zona: 'área técnica', unidade: 'm2', mat: 26.68, mo: 18.9, vlrUnit: 45.58, materialCliente: false, qdeReferencia: 280.51, totalEsperado: 12785.6458 },
  { cod: '18.14', secao: 18, grupo: 'G3', descricao: 'Pintura latex branco neve fosco para laje - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.15', secao: 18, grupo: 'G3', descricao: 'Pintura de todas as infras e estruturas na branco neve forro - Mat. + M.O. - salão de vendas', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.16', secao: 18, grupo: 'G3', descricao: 'Pintura de todas as infras e estruturas na cor cinza clar ofosco forro - Mat. + M.O. - laje reservas/ administrativa', zona: 'adm', unidade: 'm2', mat: 26.68, mo: 18.9, vlrUnit: 45.58, materialCliente: false, qdeReferencia: 280.51, totalEsperado: 12785.6458 },
  { cod: '18.17', secao: 18, grupo: 'G3', descricao: 'Pintura esmalte cor Grafite em porta metálica - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.18', secao: 18, grupo: 'G3', descricao: 'Pintura com tinta epóxi amarelo para corrimão metálico - Mat. + M.O.', zona: 'adm', unidade: 'ml', mat: 44.7, mo: 15.89, vlrUnit: 60.59, materialCliente: false, qdeReferencia: 16.15, totalEsperado: 978.5285 },
];

// ─── SEÇÃO 19 — Vidros e Espelhos ──────────────────────────────── //
const secao19: XlsxItem[] = [
  { cod: '19.1', secao: 19, grupo: 'G4', descricao: 'Espelho Cristal 4mm para colocação sobre bancadas dos sanitários com moldura alumínio (1 por cuba) - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 498.3, mo: 196.19, vlrUnit: 694.49, materialCliente: false, qdeReferencia: 4, totalEsperado: 2777.96 },
  { cod: '19.2', secao: 19, grupo: 'G4', descricao: 'Espelho Cristal 4mm vertical com moldura para funcionários nos vestiários (1,40x0,50m) - 1 unidade por vestiário - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 498.3, mo: 196.19, vlrUnit: 694.49, materialCliente: false, qdeReferencia: 2, totalEsperado: 1388.98 },
  { cod: '19.3', secao: 19, grupo: 'G4', descricao: 'Vidro blindex 10mm para guarda corpo - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '19.4', secao: 19, grupo: 'G4', descricao: 'Vidro temperado incolor 10mm para vitrine (verificar exigência de especificação do manual técnico do shopping)', zona: 'fachada', unidade: 'm2', mat: 432.7, mo: 168.9, vlrUnit: 601.6, materialCliente: false, qdeReferencia: 9, totalEsperado: 5414.4 },
];

// ─── SEÇÃO 20 — Portas em Madeira ──────────────────────────────── //
const secao20: XlsxItem[] = [
  { cod: '20.1', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,62x2,10m) folhada Curupixa ou Tauari ou similar - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '20.2', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,72x2,10m) folhada Curupixa ou Tauari ou similar - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 1576, mo: 285, vlrUnit: 1861, materialCliente: false, qdeReferencia: 1, totalEsperado: 1861 },
  { cod: '20.3', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,82x2,10m) folhada Curupixa ou Tauari ou similar - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 1776, mo: 285, vlrUnit: 2061, materialCliente: false, qdeReferencia: 10, totalEsperado: 20610 },
  { cod: '20.4', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,92x2,10m) com visor Cantina foleada Curupixa ou Tauari ou similar - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 1876, mo: 285, vlrUnit: 2161, materialCliente: false, qdeReferencia: 1, totalEsperado: 2161 },
  { cod: '20.5', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,92x2,10m) folhada Curupixa ou Tauari ou similar com painel de vidro - Mat. + M.O. - copa', zona: 'adm', unidade: 'un', mat: 2110, mo: 285, vlrUnit: 2395, materialCliente: false, qdeReferencia: 1, totalEsperado: 2395 },
  { cod: '20.5', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,92x2,10m) folhada Curupixa ou Tauari ou similar com visor - Mat. + M.O. - Sala CFTV', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '20.6', secao: 20, grupo: 'G6', descricao: 'Mola para porta - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 125.6, mo: 95.4, vlrUnit: 221, materialCliente: false, qdeReferencia: 10, totalEsperado: 2210 },
  { cod: '20.7', secao: 20, grupo: 'G6', descricao: 'Tetra-chave - Mat. + M.O.', zona: 'estoque', unidade: 'un', mat: 289.4, mo: 145, vlrUnit: 434.4, materialCliente: false, qdeReferencia: 1, totalEsperado: 434.4 },
  { cod: '20.8', secao: 20, grupo: 'G6', descricao: 'Prendedor de porta - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 100, mo: 80, vlrUnit: 180, materialCliente: false, qdeReferencia: 10, totalEsperado: 1800 },
  { cod: '20.8', secao: 20, grupo: 'G6', descricao: 'Barra de apoio para porta - Mat. + M.O. - Sanitário PNE', zona: 'adm', unidade: 'un', mat: 579, mo: 370, vlrUnit: 949, materialCliente: false, qdeReferencia: 2, totalEsperado: 1898 },
  { cod: '20.9', secao: 20, grupo: 'G6', descricao: 'Fechadura elétrica com acionamento manual - porta back office', zona: 'adm', unidade: 'un', mat: 560, mo: 230, vlrUnit: 790, materialCliente: false, qdeReferencia: 1, totalEsperado: 790 },
];

// ─── SEÇÃO 21 — Marcenaria Área de Vendas ──────────────────────── //
const secao21: XlsxItem[] = [
  { cod: '21.1', secao: 21, grupo: 'G6', descricao: 'Revestimento em laminado - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 220, mo: 116, vlrUnit: 336, materialCliente: false, qdeReferencia: 45, totalEsperado: 15120 },
  { cod: '21.2', secao: 21, grupo: 'G6', descricao: 'Painel 120cm laminado Ártico TX - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.3', secao: 21, grupo: 'G6', descricao: 'Divisória em mdp 25mm laminado para fechamento lateral dos balcões - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.4', secao: 21, grupo: 'G6', descricao: 'Réguas para união de painéis - Mat. + M.O.', zona: 'vendas', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 10, zerado: true },
  { cod: '21.5', secao: 21, grupo: 'G6', descricao: 'Fornecimento e instalação de Hot Line - bancada com divisória', zona: 'vendas', unidade: 'cj', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.6', secao: 21, grupo: 'G6', descricao: 'Revestimento de colunas Área vendas padrão Ártico TX - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 1376, mo: 740, vlrUnit: 2116, materialCliente: false, qdeReferencia: 13, totalEsperado: 27508 },
  { cod: '21.7', secao: 21, grupo: 'G6', descricao: 'Rodapé em fórmica - Mat. + M.O.', zona: 'vendas', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.8', secao: 21, grupo: 'G6', descricao: 'Rodateto em fórmica - Mat. + M.O.', zona: 'vendas', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.9', secao: 21, grupo: 'G6', descricao: 'Espelho 4mm incolor Guardian class - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 480, mo: 168, vlrUnit: 648, materialCliente: false, qdeReferencia: 4, totalEsperado: 2592 },
  { cod: '21.10', secao: 21, grupo: 'G6', descricao: 'Porta completa simples Ártico TX 0.80m  - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 1, zerado: true },
  { cod: '21.11', secao: 21, grupo: 'G6', descricao: 'Porta completa simples  Ártico TX 1.00m - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 724.0172, mo: 229.4268, vlrUnit: 953.444, materialCliente: false, qdeReferencia: 2, totalEsperado: 1906.888 },
  { cod: '21.12', secao: 21, grupo: 'G6', descricao: 'Porta dupla 1.20m  Ártico TX - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 824.0172, mo: 229.4268, vlrUnit: 1053.444, materialCliente: false, qdeReferencia: 1, totalEsperado: 1053.444 },
  { cod: '21.13', secao: 21, grupo: 'G6', descricao: 'Porta vai vem  Ártico TX - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 2640, mo: 410, vlrUnit: 3050, materialCliente: false, qdeReferencia: 1, totalEsperado: 3050 },
  { cod: '21.14', secao: 21, grupo: 'G6', descricao: 'Caixa para hidrantes - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 900, mo: 490, vlrUnit: 1390, materialCliente: false, qdeReferencia: 4, totalEsperado: 5560 },
  { cod: '21.15', secao: 21, grupo: 'G6', descricao: 'Vidro temperado hidrante c/ ferragens - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 660, mo: 240, vlrUnit: 900, materialCliente: false, qdeReferencia: 4, totalEsperado: 3600 },
  { cod: '21.16', secao: 21, grupo: 'G6', descricao: 'Arquibancada: TABLADO FIXO EM MDP BRANCO 18mm. Prever estrutura  metálica interna em tubo de ferro metalon para sustentação a cada 1m.', zona: 'adm', unidade: 'un', mat: 2300, mo: 1228.29, vlrUnit: 3528.29, materialCliente: false, qdeReferencia: 1, totalEsperado: 3528.29 },
  { cod: '21.17', secao: 21, grupo: 'G6', descricao: 'Arremates de cantos / Cantoneira alumínio - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 88.6, mo: 33.5, vlrUnit: 122.1, materialCliente: false, qdeReferencia: 10, totalEsperado: 1221 },
  { cod: '21.18', secao: 21, grupo: 'G6', descricao: 'Tubo aço inox 2" para alimentação caixa - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 368, mo: 95, vlrUnit: 463, materialCliente: false, qdeReferencia: 2, totalEsperado: 926 },
  { cod: '21.19', secao: 21, grupo: 'G6', descricao: 'Estrado com laminado branco para vitrine  - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 129.4059, mo: 98.3169, vlrUnit: 227.7228, materialCliente: false, qdeReferencia: 8, totalEsperado: 1821.7824 },
  { cod: '21.20', secao: 21, grupo: 'G6', descricao: 'Estrutura metálica em tubo de ferro metalon para estrados - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 992.45, mo: 423.67, vlrUnit: 1416.12, materialCliente: false, qdeReferencia: 6.3, totalEsperado: 8921.556 },
  { cod: '21.21', secao: 21, grupo: 'G6', descricao: 'Fixadores de teto - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 6, zerado: true },
];

// ─── SEÇÃO 22 — Provadores ─────────────────────────────────────── //
const secao22: XlsxItem[] = [
  { cod: '22.1', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica artico l166 tx', zona: 'provador', unidade: 'm2', mat: 308.1, mo: 207, vlrUnit: 515.1, materialCliente: false, qdeReferencia: 266, totalEsperado: 137016.6 },
  { cod: '22.2', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica gelo l106 tx', zona: 'provador', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 25, zerado: true },
  { cod: '22.3', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica branco l120tx', zona: 'provador', unidade: 'm2', mat: 378.1, mo: 247, vlrUnit: 625.1, materialCliente: false, qdeReferencia: 187, totalEsperado: 116893.7 },
  { cod: '22.4', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica cobalto l118 tx', zona: 'provador', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.5', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica prattan l151 tx', zona: 'provador', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 30, zerado: true },
  { cod: '22.7', secao: 22, grupo: 'G5', descricao: 'lateral de provador branca', zona: 'provador', unidade: 'un', mat: 138.65, mo: 124.2, vlrUnit: 262.85, materialCliente: false, qdeReferencia: 11, totalEsperado: 2891.35 },
  { cod: '22.8', secao: 22, grupo: 'G5', descricao: 'painel liso laminado branco', zona: 'provador', unidade: 'un', mat: 138.65, mo: 124.2, vlrUnit: 262.85, materialCliente: false, qdeReferencia: 9, totalEsperado: 2365.65 },
  { cod: '22.9', secao: 22, grupo: 'G5', descricao: 'coluna simples', zona: 'provador', unidade: 'un', mat: 740, mo: 430, vlrUnit: 1170, materialCliente: false, qdeReferencia: 40, totalEsperado: 46800 },
  { cod: '22.10', secao: 22, grupo: 'G5', descricao: 'régua para união de painéis', zona: 'provador', unidade: 'un', mat: 132, mo: 37.8, vlrUnit: 169.8, materialCliente: false, qdeReferencia: 30, totalEsperado: 5094 },
  { cod: '22.11', secao: 22, grupo: 'G5', descricao: 'travessa', zona: 'provador', unidade: 'un', mat: 187.2, mo: 98.23, vlrUnit: 285.43, materialCliente: false, qdeReferencia: 30, totalEsperado: 8562.9 },
  { cod: '22.12', secao: 22, grupo: 'G5', descricao: 'frontal', zona: 'provador', unidade: 'un', mat: 423.13, mo: 223.13, vlrUnit: 646.26, materialCliente: false, qdeReferencia: 30, totalEsperado: 19387.8 },
  { cod: '22.13', secao: 22, grupo: 'G5', descricao: 'suporte "l" para lateral de provador', zona: 'provador', unidade: 'un', mat: 87.1, mo: 46.2, vlrUnit: 133.3, materialCliente: false, qdeReferencia: 50, totalEsperado: 6665 },
  { cod: '22.14', secao: 22, grupo: 'G5', descricao: 'rodapé em mdf branco 10mm x 5,0cm', zona: 'provador', unidade: 'm', mat: 76.23, mo: 53.12, vlrUnit: 129.35, materialCliente: false, qdeReferencia: 98.25, totalEsperado: 12708.6375 },
  { cod: '22.15', secao: 22, grupo: 'G5', descricao: 'rodapé em fórmica pratan 10cm', zona: 'provador', unidade: 'm', mat: 73.74, mo: 53.12, vlrUnit: 126.86, materialCliente: false, qdeReferencia: 66.45, totalEsperado: 8429.847 },
  { cod: '22.16', secao: 22, grupo: 'G5', descricao: 'rodapé/rodateto em mdf branco 10mm x 10,0cm', zona: 'provador', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.17', secao: 22, grupo: 'G5', descricao: 'Espelho 4mm incolor Guardian class - corredor provador', zona: 'provador', unidade: 'un', mat: 574.089, mo: 167.4, vlrUnit: 741.489, materialCliente: false, qdeReferencia: 4, totalEsperado: 2965.956 },
  { cod: '22.18', secao: 22, grupo: 'G5', descricao: 'Espelho 4mm incolor Guardian class com cava para iluminação - cabine provador', zona: 'provador', unidade: 'un', mat: 624.96, mo: 167.4, vlrUnit: 792.36, materialCliente: false, qdeReferencia: 23, totalEsperado: 18224.28 },
  { cod: '22.19', secao: 22, grupo: 'G5', descricao: 'Chassis para espelhos - cabine provador', zona: 'provador', unidade: 'un', mat: 419.958, mo: 265.98, vlrUnit: 685.938, materialCliente: false, qdeReferencia: 23, totalEsperado: 15776.574 },
  { cod: '22.20', secao: 22, grupo: 'G5', descricao: 'porta para provador 60,0cm x 180,0cm - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.21', secao: 22, grupo: 'G5', descricao: 'porta para provador 70,0cm x 180,0cm - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 837.6, mo: 216, vlrUnit: 1053.6, materialCliente: false, qdeReferencia: 19, totalEsperado: 20018.4 },
  { cod: '22.22', secao: 22, grupo: 'G5', descricao: 'porta para provador 80,0cm x 180,0cm - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.23', secao: 22, grupo: 'G5', descricao: 'porta para provador 90,0cm x 180,0cm - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.24', secao: 22, grupo: 'G5', descricao: 'porta provador PNE - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 900, mo: 240, vlrUnit: 1140, materialCliente: false, qdeReferencia: 1, totalEsperado: 1140 },
  { cod: '22.25', secao: 22, grupo: 'G5', descricao: 'porta provador família - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 900, mo: 340, vlrUnit: 1240, materialCliente: false, qdeReferencia: 1, totalEsperado: 1240 },
  { cod: '22.26', secao: 22, grupo: 'G5', descricao: 'Porta de correr provador', zona: 'provador', unidade: 'un', mat: 1680, mo: 300, vlrUnit: 1980, materialCliente: false, qdeReferencia: 1, totalEsperado: 1980 },
  { cod: '22.27', secao: 22, grupo: 'G5', descricao: 'Nichos lounge -', zona: 'provador', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.28', secao: 22, grupo: 'G5', descricao: 'Superficie para troca de roupas', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 1, zerado: true },
  { cod: '22.28', secao: 22, grupo: 'G5', descricao: 'Arremates de cantos / Cantoneira alumínio', zona: 'provador', unidade: 'un', mat: 89, mo: 68.3, vlrUnit: 157.3, materialCliente: false, qdeReferencia: 2, totalEsperado: 314.6 },
  { cod: '22.29', secao: 22, grupo: 'G5', descricao: 'cabideiro cromado (especificação em anexo)', zona: 'provador', unidade: 'un', mat: 58.2, mo: 14.4, vlrUnit: 72.6, materialCliente: false, qdeReferencia: 21, totalEsperado: 1524.6 },
  { cod: '22.30', secao: 22, grupo: 'G5', descricao: 'tubo em aço inox para provador deficiente 160,0cm', zona: 'provador', unidade: 'un', mat: 1032.6, mo: 95, vlrUnit: 1127.6, materialCliente: false, qdeReferencia: 1, totalEsperado: 1127.6 },
  { cod: '22.31', secao: 22, grupo: 'G5', descricao: 'tubo em aço inox para provador deficiente 80,0cm', zona: 'provador', unidade: 'un', mat: 590, mo: 95, vlrUnit: 685, materialCliente: false, qdeReferencia: 2, totalEsperado: 1370 },
  { cod: '22.32', secao: 22, grupo: 'G5', descricao: 'fixadores de teto', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.33', secao: 22, grupo: 'G5', descricao: 'Perfil metalico 30 x 30 mm com fechamento em acrílico em U. (Sem Led)', zona: 'provador', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.34', secao: 22, grupo: 'G5', descricao: 'Perfil metalico 30 x 30 mm para espelho de corredor', zona: 'provador', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 23 — Fachadas ───────────────────────────────────────── //
const secao23: XlsxItem[] = [
  { cod: '23.1', secao: 23, grupo: 'G6', descricao: 'Arremates de cantos / Cantoneira alumínio', zona: 'fachada', unidade: 'un', mat: 89, mo: 68.3, vlrUnit: 157.3, materialCliente: false, qdeReferencia: 2, totalEsperado: 314.6 },
  { cod: '23.2', secao: 23, grupo: 'G6', descricao: 'Vitrines: TABLADO FIXO EM MDP BRANCO. Prever estrutura  metálica interna em tubo de ferro metalon para sustentação.', zona: 'fachada', unidade: 'un', mat: 1440, mo: 1330, vlrUnit: 2770, materialCliente: false, qdeReferencia: 1, totalEsperado: 2770 },
  { cod: '23.3', secao: 23, grupo: 'G6', descricao: 'Perfil em aço inox escovado para caixilho dos vidros 150mm', zona: 'fachada', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.4', secao: 23, grupo: 'G6', descricao: 'Revestimento em ACM Branco Brilho', zona: 'fachada', unidade: 'm2', mat: 310, mo: 259, vlrUnit: 569, materialCliente: false, qdeReferencia: 70, totalEsperado: 39830 },
  { cod: '23.5', secao: 23, grupo: 'G6', descricao: 'Revestimento em formica', zona: 'fachada', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.6', secao: 23, grupo: 'G6', descricao: 'Revestimento para marquise', zona: 'fachada', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.7', secao: 23, grupo: 'G6', descricao: 'Porcelanato 1,20x0,60 - fornecido pela C&A', zona: 'fachada', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.8', secao: 23, grupo: 'G6', descricao: 'Argamassa, rejunte e mão de obra para aplicação de porcelanato na fachada', zona: 'fachada', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.9', secao: 23, grupo: 'G6', descricao: 'Rodapé em aço inox escovado 200mm', zona: 'fachada', unidade: 'm', mat: 256, mo: 119, vlrUnit: 375, materialCliente: false, qdeReferencia: 10.9, totalEsperado: 4087.5 },
  { cod: '23.10', secao: 23, grupo: 'G6', descricao: 'Porta de enrolar - fornecimento C&A', zona: 'fachada', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 2, zerado: true },
];

// ─── SEÇÃO 24 — Marcenaria e Enxoval ───────────────────────────── //
const secao24: XlsxItem[] = [
  { cod: '24.1', secao: 24, grupo: 'G6', descricao: 'Armário suspenso - refeitório', zona: 'adm', unidade: 'un', mat: 2175, mo: 460, vlrUnit: 2635, materialCliente: false, qdeReferencia: 1, totalEsperado: 2635 },
  { cod: '24.2', secao: 24, grupo: 'G6', descricao: 'Bancada/ armário da copa', zona: 'adm', unidade: 'un', mat: 2160, mo: 950, vlrUnit: 3110, materialCliente: false, qdeReferencia: 1, totalEsperado: 3110 },
  { cod: '24.3', secao: 24, grupo: 'G6', descricao: 'Armário suspenso e bancada - sala da gerência', zona: 'adm', unidade: 'un', mat: 2170, mo: 950, vlrUnit: 3120, materialCliente: false, qdeReferencia: 1, totalEsperado: 3120 },
  { cod: '24.4', secao: 24, grupo: 'G6', descricao: 'Prateleira na circulação para caixa geral', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 1, zerado: true },
  { cod: '24.5', secao: 24, grupo: 'G6', descricao: 'Moldura para cofre - boca de lobo', zona: 'adm', unidade: 'un', mat: 925, mo: 260, vlrUnit: 1185, materialCliente: false, qdeReferencia: 1, totalEsperado: 1185 },
  { cod: '24.6', secao: 24, grupo: 'G6', descricao: 'Estante sala de rack', zona: 'adm', unidade: 'un', mat: 1320, mo: 260, vlrUnit: 1580, materialCliente: false, qdeReferencia: 1, totalEsperado: 1580 },
  { cod: '24.7', secao: 24, grupo: 'G6', descricao: 'Armário boca de lobo - sala da gerência', zona: 'adm', unidade: 'un', mat: 1315, mo: 180, vlrUnit: 1495, materialCliente: false, qdeReferencia: 1, totalEsperado: 1495 },
  { cod: '24.8', secao: 24, grupo: 'G6', descricao: 'Base de alumínio para bebedouro', zona: 'adm', unidade: 'un', mat: 1190, mo: 0, vlrUnit: 1190, materialCliente: false, qdeReferencia: 2, totalEsperado: 2380 },
  { cod: '24.9', secao: 24, grupo: 'G6', descricao: 'Filtro para bebedouro Aqualar', zona: 'adm', unidade: 'un', mat: 735, mo: 0, vlrUnit: 735, materialCliente: false, qdeReferencia: 2, totalEsperado: 1470 },
  { cod: '24.10', secao: 24, grupo: 'G6', descricao: 'Porta e Tampa de alumínio para lixeira copa', zona: 'adm', unidade: 'un', mat: 920, mo: 0, vlrUnit: 920, materialCliente: false, qdeReferencia: 1, totalEsperado: 920 },
  { cod: '24.11', secao: 24, grupo: 'G6', descricao: 'Suporte para TV, Projetor e Microondas', zona: 'adm', unidade: 'un', mat: 545, mo: 95, vlrUnit: 640, materialCliente: false, qdeReferencia: 3, totalEsperado: 1920 },
  { cod: '24.12', secao: 24, grupo: 'G6', descricao: 'Lixeira para bancada da cantina', zona: 'adm', unidade: 'un', mat: 376.12, mo: 0, vlrUnit: 376.12, materialCliente: false, qdeReferencia: 1, totalEsperado: 376.12 },
  { cod: '24.13', secao: 24, grupo: 'G6', descricao: 'Lixeira para bancada dos sanitários', zona: 'adm', unidade: 'un', mat: 376, mo: 0, vlrUnit: 376, materialCliente: false, qdeReferencia: 2, totalEsperado: 752 },
  { cod: '24.14', secao: 24, grupo: 'G6', descricao: 'Lixeira para vasos sanitários', zona: 'adm', unidade: 'un', mat: 298.3, mo: 0, vlrUnit: 298.3, materialCliente: false, qdeReferencia: 5, totalEsperado: 1491.5 },
  { cod: '24.15', secao: 24, grupo: 'G6', descricao: 'Portinhola branca para correio pneumático', zona: 'vendas', unidade: 'un', mat: 436, mo: 83.65, vlrUnit: 519.65, materialCliente: false, qdeReferencia: 2, totalEsperado: 1039.3 },
  { cod: '24.16', secao: 24, grupo: 'G6', descricao: 'Locker para vestiário', zona: 'adm', unidade: 'un', mat: 560, mo: 156, vlrUnit: 716, materialCliente: false, qdeReferencia: 3, totalEsperado: 2148 },
  { cod: '24.17', secao: 24, grupo: 'G6', descricao: 'Banco para vestiário', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 2, zerado: true },
  { cod: '24.17', secao: 24, grupo: 'G6', descricao: 'Sapateira para vestiário', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 2, zerado: true },
];

// ─── SEÇÃO 25 — Omissos ────────────────────────────────────────── //
const secao25: XlsxItem[] = [
  { cod: '25.1', secao: 25, grupo: 'G2', descricao: 'PROTEÇÃO ELETROMAGNÉTICA EM MANTA ALUMINIZADA (RFID)', zona: '', unidade: 'm2', mat: 50, mo: 30, vlrUnit: 80, materialCliente: false, qdeReferencia: 220, totalEsperado: 17600 },
  { cod: '25.2', secao: 25, grupo: 'G2', descricao: 'Porta de madeira completa (0,82x2,10m) folhada Curupixa ou Tauari ou similar com revestimento em espelho - Mat. + M.O.', zona: '', unidade: 'un', mat: 987, mo: 450, vlrUnit: 1437, materialCliente: false, qdeReferencia: 1, totalEsperado: 1437 },
  { cod: '25.3', secao: 25, grupo: 'G2', descricao: 'Estrutura em Drywall para Paineis em MDF (M.O e INCLUSO Material)', zona: '', unidade: 'vb', mat: 6000, mo: 2000, vlrUnit: 8000, materialCliente: false, qdeReferencia: 1, totalEsperado: 8000 },
  { cod: '25.4', secao: 25, grupo: 'G2', descricao: 'REVESTIMENTO EM LAMINA DE MADEIRA CUMARU MEL', zona: '', unidade: 'm2', mat: 497, mo: 207, vlrUnit: 704, materialCliente: false, qdeReferencia: 136, totalEsperado: 95744 },
  { cod: '25.5', secao: 25, grupo: 'G2', descricao: 'Marcenaria Pulpitre provador', zona: '', unidade: 'vb', mat: 1100, mo: 780, vlrUnit: 1880, materialCliente: false, qdeReferencia: 1, totalEsperado: 1880 },
  { cod: '25.6', secao: 25, grupo: 'G2', descricao: 'Vidro pulprite', zona: '', unidade: 'vb', mat: 670, mo: 480, vlrUnit: 1150, materialCliente: false, qdeReferencia: 1, totalEsperado: 1150 },
  { cod: '25.7', secao: 25, grupo: 'G2', descricao: 'Revestimento da Escada (Degrau e espelho) em Granito Branco Ceará', zona: '', unidade: 'vb', mat: 5000, mo: 1500, vlrUnit: 6500, materialCliente: false, qdeReferencia: 1, totalEsperado: 6500 },
  { cod: '25.8', secao: 25, grupo: 'G2', descricao: 'Rodapé escada dos provadores em granito branco ceará', zona: '', unidade: 'ml', mat: 679, mo: 250, vlrUnit: 929, materialCliente: false, qdeReferencia: 15, totalEsperado: 13935 },
  { cod: '25.9', secao: 25, grupo: 'G2', descricao: 'Ripado em cumaru mel', zona: '', unidade: 'm2', mat: 672.5, mo: 439, vlrUnit: 1111.5, materialCliente: false, qdeReferencia: 20, totalEsperado: 22230 },
  { cod: '25.10', secao: 25, grupo: 'G2', descricao: 'Reforço em estrutura para suporte forro ripado', zona: '', unidade: 'vb', mat: 5007.63, mo: 3890.38, vlrUnit: 8898.01, materialCliente: false, qdeReferencia: 1, totalEsperado: 8898.01 },
  { cod: '25.11', secao: 25, grupo: 'G2', descricao: 'Porta de madeira Dupla casa de maquina', zona: '', unidade: 'un', mat: 987, mo: 360, vlrUnit: 1347, materialCliente: false, qdeReferencia: 1, totalEsperado: 1347 },
];

// ─── Tabela completa indexada por código ──────────────────────────────────────
export const XLSX_ITENS: XlsxItem[] = [
  ...secaoA, ...secao7, ...secao8, ...secao9,
  ...secao10, ...secao11, ...secao12, ...secao13,
  ...secao14, ...secao15, ...secao16, ...secao17,
  ...secao18, ...secao19, ...secao20, ...secao21,
  ...secao22, ...secao23, ...secao24, ...secao25,
];

export const XLSX_POR_COD: Record<string, XlsxItem> = Object.fromEntries(
  XLSX_ITENS.map((it) => [it.cod, it])
);

export function checklistDoGrupo(grupo: GrupoEspecialista): XlsxItem[] {
  return XLSX_ITENS.filter((it) => it.grupo === grupo);
}

export const TOTAIS_XLSX_POR_SECAO: Record<string, number> = {
  'A': 217865,
  '7': 0,
  '8': 65778.72,
  '9': 227314.99,
  '10': 14685.628,
  '11': 0,
  '12': 233161.65,
  '13': 21311.2,
  '14': 156581.2562,
  '15': 12045.8,
  '16': 12348.1,
  '17': 3150,
  '18': 174414.8775,
  '19': 9581.34,
  '20': 34159.4,
  '21': 76808.9604,
  '22': 432497.4945,
  '23': 47002.1,
  '24': 25621.92,
  '25': 178721.01,
};

export const TOTAL_GERAL_XLSX = 1943049.4466;
