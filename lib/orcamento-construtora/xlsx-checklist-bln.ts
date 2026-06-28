// ─── Checklist XLSX — BLN (Shopping Norte Blumenau) 1ª Proposta ─────────────
// Fonte: 1ª Proposta CELMAR BLN.xlsx — sheet '1ª Proposta'
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
  { cod: '1.3', secao: 'A', grupo: 'G1', descricao: 'Topografia (5 visitas)', zona: '', unidade: 'dia', mat: 350, mo: 2070, vlrUnit: 2420, materialCliente: false, qdeReferencia: 1, totalEsperado: 2420 },
  { cod: '2.1', secao: 'A', grupo: 'G1', descricao: 'Tapume em placas de divisória tipo Eucatex estruturado com pontaletes 3”x3”.(cor branco)', zona: '', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '2.2', secao: 'A', grupo: 'G1', descricao: 'Equipamentos de proteção individual (EPI), comunicação visual', zona: '', unidade: 'vb', mat: 3500, mo: 0, vlrUnit: 3500, materialCliente: false, qdeReferencia: 1, totalEsperado: 3500 },
  { cod: '2.3', secao: 'A', grupo: 'G1', descricao: 'Vigilância normal de obra (segunda a sexta feira das 19h às 07h. Sábados, domingos e feriados 24h), período 30 dias', zona: '', unidade: 'dia', mat: 0, mo: 150, vlrUnit: 150, materialCliente: true, qdeReferencia: 30, totalEsperado: 4500 },
  { cod: '2.4', secao: 'A', grupo: 'G1', descricao: 'Dependências para administração da obra: escritórios para gerenciador (com internet,mobiliário, ar condicionado, inclusive sala de reunião, frigobar, civil, instalações, ar condicionado e decoração, refeitório, WC para operários e WC para fiscal, incluindo instalação elétrica, hidráulica e cobertura (área de 130m²)', zona: '', unidade: 'vb', mat: 17980, mo: 5800, vlrUnit: 23780, materialCliente: false, qdeReferencia: 1, totalEsperado: 23780 },
  { cod: '2.5', secao: 'A', grupo: 'G1', descricao: 'Material de limpeza e administrativo (Xerox e Plotagens)', zona: '', unidade: 'vb', mat: 3500, mo: 0, vlrUnit: 3500, materialCliente: false, qdeReferencia: 1, totalEsperado: 3500 },
  { cod: '2.6', secao: 'A', grupo: 'G1', descricao: 'Extintores para a Obra e Bebedouro para funcionários', zona: '', unidade: 'vb', mat: 1830, mo: 0, vlrUnit: 1830, materialCliente: false, qdeReferencia: 1, totalEsperado: 1830 },
  { cod: '2.7', secao: 'A', grupo: 'G1', descricao: 'Ligação Elétrica tomadas e Iluminação para Canteiro de Obra e Escritórios', zona: '', unidade: 'vb', mat: 3500, mo: 0, vlrUnit: 3500, materialCliente: false, qdeReferencia: 1, totalEsperado: 3500 },
  { cod: '2.8', secao: 'A', grupo: 'G1', descricao: 'Ligação Elétrica Iluminação Provisória de Obra e Quadro para entrada de energia provisória (se necessário).', zona: '', unidade: 'vb', mat: 3400, mo: 0, vlrUnit: 3400, materialCliente: false, qdeReferencia: 1, totalEsperado: 3400 },
  { cod: '2.9', secao: 'A', grupo: 'G1', descricao: 'Eletricista durante a obra, e após a entrega de civil deve permanecer disponível até a abertura para dar suporte as outras equipes.', zona: '', unidade: 'vb', mat: 0, mo: 4500, vlrUnit: 4500, materialCliente: true, qdeReferencia: 1, totalEsperado: 4500 },
  { cod: '3.1', secao: 'A', grupo: 'G1', descricao: 'Lona proteção - piso, marcenaria, equipamentos em geral', zona: '', unidade: 'vb', mat: 4580, mo: 0, vlrUnit: 4580, materialCliente: false, qdeReferencia: 1, totalEsperado: 4580 },
  { cod: '3.2', secao: 'A', grupo: 'G1', descricao: 'Lona transparente proteção equipamentos', zona: '', unidade: 'vb', mat: 4200, mo: 0, vlrUnit: 4200, materialCliente: false, qdeReferencia: 1, totalEsperado: 4200 },
  { cod: '3.3', secao: 'A', grupo: 'G1', descricao: 'Retirada periódica de entulhos e caçamba ( lonas, sacarias, materiais demolições, etc.)', zona: '', unidade: 'mes', mat: 200, mo: 8000, vlrUnit: 8200, materialCliente: false, qdeReferencia: 3, totalEsperado: 24600 },
  { cod: '3.4', secao: 'A', grupo: 'G1', descricao: 'Locação de equipamentos manuais', zona: '', unidade: 'vb', mat: 0, mo: 6900, vlrUnit: 6900, materialCliente: true, qdeReferencia: 1, totalEsperado: 6900 },
  { cod: '3.5', secao: 'A', grupo: 'G1', descricao: 'Transporte vertical e horizontal', zona: '', unidade: 'vb', mat: 0, mo: 9700, vlrUnit: 9700, materialCliente: true, qdeReferencia: 1, totalEsperado: 9700 },
  { cod: '4.1', secao: 'A', grupo: 'G1', descricao: 'Engenheiro residente - full time', zona: '', unidade: 'mes', mat: 0, mo: 10500, vlrUnit: 10500, materialCliente: true, qdeReferencia: 3, totalEsperado: 31500 },
  { cod: '4.2', secao: 'A', grupo: 'G1', descricao: 'Técnico de segurança - full time', zona: '', unidade: 'mes', mat: 0, mo: 3500, vlrUnit: 3500, materialCliente: true, qdeReferencia: 3, totalEsperado: 10500 },
  { cod: '4.3', secao: 'A', grupo: 'G1', descricao: 'Estadias e refeições', zona: '', unidade: 'vb', mat: 0, mo: 35000, vlrUnit: 35000, materialCliente: true, qdeReferencia: 1, totalEsperado: 35000 },
  { cod: '4.4', secao: 'A', grupo: 'G1', descricao: 'Mobilização e desmobilização', zona: '', unidade: 'vb', mat: 0, mo: 28000, vlrUnit: 28000, materialCliente: true, qdeReferencia: 1, totalEsperado: 28000 },
  { cod: '4.5', secao: 'A', grupo: 'G1', descricao: 'Limpeza permanente da obra (2 operários)', zona: '', unidade: 'mes', mat: 0, mo: 5000, vlrUnit: 5000, materialCliente: true, qdeReferencia: 3, totalEsperado: 15000 },
  { cod: '5.1', secao: 'A', grupo: 'G1', descricao: 'Limpeza Final de obra', zona: '', unidade: 'vb', mat: 0, mo: 9000, vlrUnit: 9000, materialCliente: true, qdeReferencia: 1, totalEsperado: 9000 },
];

// ─── SEÇÃO 7 — Adaptação de Shell ──────────────────────────────── //
const secao7: XlsxItem[] = [
  { cod: '7.1', secao: 7, grupo: 'G1', descricao: 'Demolições e retiradas - incluir bota-fora', zona: '', unidade: 'vb', mat: 3500, mo: 6500, vlrUnit: 10000, materialCliente: false, qdeReferencia: 1, totalEsperado: 10000 },
];

// ─── SEÇÃO 8 — Serralheria ─────────────────────────────────────── //
const secao8: XlsxItem[] = [
  { cod: '8.1', secao: 8, grupo: 'G1', descricao: 'Mezanino metálico - contratação direta C&A', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.2', secao: 8, grupo: 'G1', descricao: 'Painel wall para mezanino - contratação direta C&A', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.3', secao: 8, grupo: 'G1', descricao: 'Escada metálica - contratação direta C&A', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.4', secao: 8, grupo: 'G1', descricao: 'Adequação de escada / mezanino / guarda corpo existente', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.5', secao: 8, grupo: 'G1', descricao: 'Guarda corpo de ferro com pintura de fundo para escada e mezanino', zona: 'estoque', unidade: 'm', mat: 280, mo: 125.7, vlrUnit: 405.7, materialCliente: false, qdeReferencia: 19, totalEsperado: 7708.3 },
  { cod: '8.6', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica em metalon para revestimento de fachada', zona: 'fachada', unidade: 'vb', mat: 9190, mo: 5220, vlrUnit: 14410, materialCliente: false, qdeReferencia: 1, totalEsperado: 14410 },
  { cod: '8.6', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica em metalon para marquise', zona: 'fachada', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.7', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica auxiliar tipo gaiola para base e sustentação de vitrine', zona: 'fachada', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.8', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica auxiliar para septo de Ar Condicionado - Sobre o Forro', zona: 'estoque', unidade: 'vb', mat: 5000, mo: 4980, vlrUnit: 9980, materialCliente: false, qdeReferencia: 1, totalEsperado: 9980 },
  { cod: '8.9', secao: 8, grupo: 'G1', descricao: 'Estrutura metálica auxiliar para porta de enrolar', zona: 'fachada', unidade: 'vb', mat: 5000, mo: 3980, vlrUnit: 8980, materialCliente: false, qdeReferencia: 1, totalEsperado: 8980 },
  { cod: '8.10', secao: 8, grupo: 'G1', descricao: 'Guarda corpo em inox para salão de vendas (escadas rolantes e desnível de pisos) conforme projeto', zona: 'vendas', unidade: 'ml', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.11', secao: 8, grupo: 'G1', descricao: 'Gradil metálico para isolamento', zona: 'estoque', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.11', secao: 8, grupo: 'G1', descricao: 'Adequação estrutural para elevador', zona: 'vendas', unidade: 'vb', mat: 5000, mo: 5980, vlrUnit: 10980, materialCliente: false, qdeReferencia: 1, totalEsperado: 10980 },
  { cod: '8.11', secao: 8, grupo: 'G1', descricao: 'Adequação estrutural para escada rolante', zona: 'vendas', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.12', secao: 8, grupo: 'G1', descricao: 'Porta de ferro - Circulação', zona: 'adm', unidade: 'un', mat: 3700, mo: 700, vlrUnit: 4400, materialCliente: false, zerado: true },
  { cod: '8.13', secao: 8, grupo: 'G1', descricao: 'Porta de ferro - Gerador', zona: 'área técnica', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.14', secao: 8, grupo: 'G1', descricao: 'Porta de ferro - C. Máquina', zona: 'área técnica', unidade: 'un', mat: 2790, mo: 480, vlrUnit: 3270, materialCliente: false, qdeReferencia: 1, totalEsperado: 3270 },
  { cod: '8.15', secao: 8, grupo: 'G1', descricao: 'Porta corta-fogo - Docas', zona: 'área técnica', unidade: 'un', mat: 3760, mo: 650, vlrUnit: 4410, materialCliente: false, qdeReferencia: 1, totalEsperado: 4410 },
  { cod: '8.16', secao: 8, grupo: 'G1', descricao: 'Esquadria metálica c/ tela', zona: 'área técnica', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.17', secao: 8, grupo: 'G1', descricao: 'Portinhola de alumínio sob bancada apenas na cantina', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '8.18', secao: 8, grupo: 'G1', descricao: 'Visor back office com vidro', zona: 'adm', unidade: 'un', mat: 600, mo: 400, vlrUnit: 1000, materialCliente: false, qdeReferencia: 1, totalEsperado: 1000 },
  { cod: '8.19', secao: 8, grupo: 'G1', descricao: 'Visor gerência com vidro', zona: 'adm', unidade: 'un', mat: 600, mo: 400, vlrUnit: 1000, materialCliente: false, qdeReferencia: 1, totalEsperado: 1000 },
  { cod: '8.20', secao: 8, grupo: 'G1', descricao: 'Passa documentos', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 9 — Civil ───────────────────────────────────────────── //
const secao9: XlsxItem[] = [
  { cod: '9.1', secao: 9, grupo: 'G2', descricao: 'Enchimento de contrapiso (h=4cm)', zona: '', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.2', secao: 9, grupo: 'G2', descricao: 'Piso Cimentado para áreas técnicas com 5cm de espessura', zona: 'área técnica', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.3', secao: 9, grupo: 'G2', descricao: 'Sóculos para bancadas', zona: 'adm', unidade: 'vb', mat: 840, mo: 510, vlrUnit: 1350, materialCliente: false, qdeReferencia: 1, totalEsperado: 1350 },
  { cod: '9.4', secao: 9, grupo: 'G2', descricao: 'Bases em concreto para equipamentos (ar condicionado, gerador, transformador)', zona: 'área técnica', unidade: 'vb', mat: 1879, mo: 970, vlrUnit: 2849, materialCliente: false, qdeReferencia: 1, totalEsperado: 2849 },
  { cod: '9.5', secao: 9, grupo: 'G2', descricao: 'Alvenaria em tijolo/bloco de concreto', zona: 'adm', unidade: 'm2', mat: 76, mo: 34, vlrUnit: 110, materialCliente: false, qdeReferencia: 230, totalEsperado: 25300 },
  { cod: '9.6', secao: 9, grupo: 'G2', descricao: 'Alvenaria em bloco sical', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.7', secao: 9, grupo: 'G2', descricao: 'Chapisco e emboço', zona: 'adm', unidade: 'm2', mat: 25.32, mo: 14.65, vlrUnit: 39.97, materialCliente: false, qdeReferencia: 460, totalEsperado: 18386.2 },
  { cod: '9.8', secao: 9, grupo: 'G2', descricao: 'Laje pré-moldada com capa de concreto', zona: 'área técnica', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.9', secao: 9, grupo: 'G2', descricao: 'Execução área técnica', zona: 'área técnica', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.10', secao: 9, grupo: 'G2', descricao: 'Concreto com vermiculita, areia e cimento para enchimento das bandejas do mezanino. Fck 30MPa; esp. 4cm', zona: 'mezanino', unidade: 'm3', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.11', secao: 9, grupo: 'G2', descricao: 'Fornecimento e colocação de tela Telcon e Lona preta', zona: 'mezanino', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '9.12', secao: 9, grupo: 'G2', descricao: 'Furação mecânica de lajes para Esgotos e tubulações.', zona: '', unidade: 'vb', mat: 4150, mo: 1290, vlrUnit: 5440, materialCliente: false, qdeReferencia: 1, totalEsperado: 5440 },
  { cod: '9.13', secao: 9, grupo: 'G2', descricao: 'Arremates gerais', zona: '', unidade: 'vb', mat: 4130, mo: 2260, vlrUnit: 6390, materialCliente: false, qdeReferencia: 1, totalEsperado: 6390 },
];

// ─── SEÇÃO 10 — Impermeabilização ──────────────────────────────── //
const secao10: XlsxItem[] = [
  { cod: '10.1', secao: 10, grupo: 'G2', descricao: 'Impermeabilização casa de máquinas, área técnica e área embaixo da cuba refeitório: manta butílica ou asfáltica tipo torodin ou similar (verificar projeto)', zona: 'adm', unidade: 'm2', mat: 177.36, mo: 120.68, vlrUnit: 298.04, materialCliente: false, qdeReferencia: 43.7, totalEsperado: 13024.348 },
  { cod: '10.2', secao: 10, grupo: 'G2', descricao: 'Impermeabilização sanitários: manta líquida (verificar projeto)', zona: 'adm', unidade: 'm2', mat: 87.2, mo: 52.4, vlrUnit: 139.6, materialCliente: false, qdeReferencia: 28.87, totalEsperado: 4030.252 },
];

// ─── SEÇÃO 11 — Junta de Dilatação ─────────────────────────────── //
const secao11: XlsxItem[] = [
  { cod: '11.1', secao: 11, grupo: 'G2', descricao: 'Enchimento de Juntas de dilatação com vedaflex', zona: '', unidade: 'ml', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 12 — Paredes e Forros em Gesso ──────────────────────── //
const secao12: XlsxItem[] = [
  { cod: '12.1', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO STD - 1 face - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'vendas', unidade: 'm2', mat: 75.8, mo: 45.7, vlrUnit: 121.5, materialCliente: false, qdeReferencia: 672, totalEsperado: 81648 },
  { cod: '12.2', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO STD - 2 faces - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'vendas', unidade: 'm2', mat: 75.8, mo: 56.7, vlrUnit: 132.5, materialCliente: false, qdeReferencia: 274, totalEsperado: 36305 },
  { cod: '12.3', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO RU - 1 face - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'adm', unidade: 'm2', mat: 90.2, mo: 58.45, vlrUnit: 148.65, materialCliente: false, qdeReferencia: 40.84, totalEsperado: 6070.866 },
  { cod: '12.4', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO RU - 2 faces - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'adm', unidade: 'm2', mat: 90.2, mo: 58.45, vlrUnit: 148.65, materialCliente: false, qdeReferencia: 98, totalEsperado: 14567.7 },
  { cod: '12.5', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO RF - 1 face - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'área técnica', unidade: 'm2', mat: 90.2, mo: 58.45, vlrUnit: 148.65, materialCliente: false, qdeReferencia: 3, totalEsperado: 445.95 },
  { cod: '12.6', secao: 12, grupo: 'G3', descricao: 'PAREDE EM PLACAS DE GESSO RF - 2 faces - acessórios para instalação, mão de obra e Chapas de Gesso ST STANDARD e Componentes (Massa fast fix/Guias 70M/Montantes/Tabicas/Suportes Nivelador e Conectores)', zona: 'área técnica', unidade: 'm2', mat: 104.2, mo: 58.45, vlrUnit: 162.65, materialCliente: false, qdeReferencia: 15, totalEsperado: 2439.75 },
  { cod: '12.7', secao: 12, grupo: 'G3', descricao: 'Reforço em cedrinho para paredes', zona: '', unidade: 'vb', mat: 5770, mo: 2530, vlrUnit: 8300, materialCliente: false, qdeReferencia: 1, totalEsperado: 8300 },
  { cod: '12.8', secao: 12, grupo: 'G3', descricao: 'Demolição forro/sancas de gesso', zona: '', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '12.9', secao: 12, grupo: 'G3', descricao: 'EXECUÇÃO DE FORRO DE GESSO FORRO GYPSUM LISO TABICADO ESTRUTURADO E REJUNTADO. ACABAMENTO EM PINTURA LÁTEX PVA FOSCO, COR BRANCO NEVE, APÓS EMASSADAS AS EMENDA (Massa fast fix/Tabicas/Suportes Nivelador e Conectores)', zona: '', unidade: 'm2', mat: 25.5, mo: 38, vlrUnit: 63.5, materialCliente: false, qdeReferencia: 1457.44, totalEsperado: 92547.44 },
  { cod: '12.10', secao: 12, grupo: 'G3', descricao: 'Fechamento em gesso para cortina porta de enrolar - Mat. + M.O.', zona: '', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '12.11', secao: 12, grupo: 'G3', descricao: 'Alçapão', zona: '', unidade: 'un', mat: 153, mo: 64, vlrUnit: 217, materialCliente: false, qdeReferencia: 15, totalEsperado: 3255 },
  { cod: '12.12', secao: 12, grupo: 'G3', descricao: 'Abertura no forro de gesso para luminárias , spots, wall washer, grelhas , difusores e etc', zona: '', unidade: 'un', mat: 0, mo: 35, vlrUnit: 35, materialCliente: true, qdeReferencia: 176, totalEsperado: 6160 },
  { cod: '12.13', secao: 12, grupo: 'G3', descricao: 'Prever reforço para: placas aéreas cv, trilho vitrine', zona: '', unidade: 'vb', mat: 2489, mo: 1300, vlrUnit: 3789, materialCliente: false, qdeReferencia: 1, totalEsperado: 3789 },
];

// ─── SEÇÃO 13 — Divisórias ─────────────────────────────────────── //
const secao13: XlsxItem[] = [
  { cod: '13.1', secao: 13, grupo: 'G2', descricao: 'Fecham. compartimentos: divisórias, ref. sistema divilux 35,  revest. formidur bp plus cor branco e montantes ntr branco, fabr. eucatex', zona: 'adm', unidade: 'm2', mat: 118.2, mo: 87, vlrUnit: 205.2, materialCliente: false, qdeReferencia: 30, totalEsperado: 6156 },
  { cod: '13.2', secao: 13, grupo: 'G2', descricao: 'Sanitário: porta 0.60x1.65 - divisória eucatex com maçaneta para cela sanitária - abrir - 1f', zona: 'adm', unidade: 'un', mat: 1068.4, mo: 144.3, vlrUnit: 1212.7, materialCliente: false, qdeReferencia: 10, totalEsperado: 12127 },
  { cod: '13.3', secao: 13, grupo: 'G2', descricao: 'Porta para divisória eucatex com maçaneta tipo alavanca - abrir - 1f', zona: 'adm', unidade: 'un', mat: 1382.3, mo: 232.45, vlrUnit: 1614.75, materialCliente: false, qdeReferencia: 3, totalEsperado: 4844.25 },
  { cod: '13.4', secao: 13, grupo: 'G2', descricao: 'Portas de divisória 1,20m (dupla)', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '13.5', secao: 13, grupo: 'G2', descricao: 'Porta e ferragens de Vidro ou Alumínio para Box chuveiro', zona: 'adm', unidade: 'un', mat: 989.2, mo: 165, vlrUnit: 1154.2, materialCliente: false, qdeReferencia: 2, totalEsperado: 2308.4 },
];

// ─── SEÇÃO 14 — Revestimento de Piso ───────────────────────────── //
const secao14: XlsxItem[] = [
  { cod: '14.1', secao: 14, grupo: 'G4', descricao: 'Assentamento de piso vinílico salão de vendas/provadores - material fornecido pela C&A', zona: 'vendas', unidade: 'm2', mat: 0, mo: 40.15, vlrUnit: 40.15, materialCliente: true, qdeReferencia: 1024.98, totalEsperado: 41152.947 },
  { cod: '14.2', secao: 14, grupo: 'G4', descricao: 'Aplicação de autonivelante salão de vendas/provadores - material fornecido pela C&A', zona: 'vendas', unidade: 'm2', mat: 0, mo: 14.2, vlrUnit: 14.2, materialCliente: true, qdeReferencia: 1024.98, totalEsperado: 14554.716 },
  { cod: '14.3', secao: 14, grupo: 'G4', descricao: 'Assentamento de piso porcelanato', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.4', secao: 14, grupo: 'G4', descricao: 'Argamassa, rejunte e mão de obra para aplicação de piso cerâmico', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.5', secao: 14, grupo: 'G4', descricao: 'Rodapé Primer Tarket - 10 cm - SV', zona: 'vendas', unidade: 'ml', mat: 20, mo: 33.2, vlrUnit: 53.2, materialCliente: false, qdeReferencia: 130.84, totalEsperado: 6960.688 },
  { cod: '14.6', secao: 14, grupo: 'G4', descricao: 'Piso tátil (escada rolante e escada fixa) - Mat. + M.O.', zona: 'vendas', unidade: 'vb', mat: 220, mo: 150, vlrUnit: 370, materialCliente: false, qdeReferencia: 16, totalEsperado: 5920 },
  { cod: '14.7', secao: 14, grupo: 'G4', descricao: 'Sóculos granito frente vitrine (largura 10cm)', zona: 'fachada', unidade: 'ml', mat: 237.2, mo: 87, vlrUnit: 324.2, materialCliente: false, qdeReferencia: 7.12, totalEsperado: 2308.304 },
  { cod: '14.8', secao: 14, grupo: 'G4', descricao: 'Soleira em granito - Mat. + M.O. (Branco Ceará)', zona: 'vendas', unidade: 'ml', mat: 650, mo: 360, vlrUnit: 1010, materialCliente: false, qdeReferencia: 11.4, totalEsperado: 11514 },
  { cod: '14.9', secao: 14, grupo: 'G4', descricao: 'Capacho nômade 3M cinza grafite - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.10', secao: 14, grupo: 'G4', descricao: 'Fita antiderrapante Safety walk 50mm para entrada da loja', zona: 'vendas', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.11', secao: 14, grupo: 'G4', descricao: 'Aplicação de piso cerâmico c/ fornecimento de argamassa e rejunte  - Cerâmica ate 45x45 cm REF.: Cargo plus white Eliane - fornecido pela C&A', zona: 'adm', unidade: 'm2', mat: 0, mo: 68, vlrUnit: 68, materialCliente: true, qdeReferencia: 361, totalEsperado: 24548 },
  { cod: '14.12', secao: 14, grupo: 'G4', descricao: 'Assentamento de piso vinílico ADM - material fornecido pela C&A (EXCETO RESERVA E ÁRES MOLHADAS)', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.13', secao: 14, grupo: 'G4', descricao: 'Rodapé de madeira h=7cm', zona: 'adm', unidade: 'ml', mat: 35.9, mo: 17.43, vlrUnit: 53.33, materialCliente: false, qdeReferencia: 42.5, totalEsperado: 2266.525 },
  { cod: '14.14', secao: 14, grupo: 'G4', descricao: 'Rodapé de madeira h=20cm', zona: 'adm', unidade: 'ml', mat: 43.67, mo: 17.45, vlrUnit: 61.12, materialCliente: false, qdeReferencia: 140.39, totalEsperado: 8580.6368 },
  { cod: '14.15', secao: 14, grupo: 'G4', descricao: 'Montagem de estante modular metálica - fornecido pela C&A', zona: 'adm', unidade: 'pç', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 108, zerado: true },
  { cod: '14.16', secao: 14, grupo: 'G4', descricao: 'Revestimento da Escada (Degrau e espelho) em Ardósia', zona: 'adm', unidade: 'vb', mat: 16210.56, mo: 0, vlrUnit: 16210.56, materialCliente: false, qdeReferencia: 1, totalEsperado: 16210.56 },
  { cod: '14.17', secao: 14, grupo: 'G4', descricao: 'ESCADA: Piso tátil e fita antiderrapante', zona: 'adm', unidade: 'cj', mat: 1990, mo: 970, vlrUnit: 2960, materialCliente: false, qdeReferencia: 1, totalEsperado: 2960 },
  { cod: '14.18', secao: 14, grupo: 'G4', descricao: 'ESCADA: Revestimento degrau em Ardósia', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '14.19', secao: 14, grupo: 'G4', descricao: 'Soleira em granito - Mat. + M.O. (Cinza Andorinha)', zona: 'adm', unidade: 'ml', mat: 635.6, mo: 333.2, vlrUnit: 968.8, materialCliente: false, qdeReferencia: 5.88, totalEsperado: 5696.544 },
];

// ─── SEÇÃO 15 — Revestimento de Parede ─────────────────────────── //
const secao15: XlsxItem[] = [
  { cod: '15.1', secao: 15, grupo: 'G4', descricao: 'Azulejo branco junta a prumo - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 89.75, mo: 36.75, vlrUnit: 126.5, materialCliente: false, qdeReferencia: 81, totalEsperado: 10246.5 },
  { cod: '15.2', secao: 15, grupo: 'G4', descricao: 'Perfil de alumínio branco 1/2" E 1/16" meia altura - Mat. + M.O.', zona: 'adm', unidade: 'm', mat: 32.2, mo: 16, vlrUnit: 48.2, materialCliente: false, qdeReferencia: 23, totalEsperado: 1108.6 },
  { cod: '15.3', secao: 15, grupo: 'G4', descricao: 'Arremate em cantoneira de alumínio nas quinas da circulação h=1,70m - Mat. + M.O.', zona: 'adm', unidade: 'm', mat: 32.2, mo: 18.4, vlrUnit: 50.6, materialCliente: false, qdeReferencia: 12, totalEsperado: 607.2 },
  { cod: '15.4', secao: 15, grupo: 'G4', descricao: 'Rodameio em madeira para sala de gerente - Mat. + M.O.', zona: 'adm', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 16 — Mármores e Granitos ────────────────────────────── //
const secao16: XlsxItem[] = [
  { cod: '16.1', secao: 16, grupo: 'G4', descricao: 'Bancadas em granito para cantina (bancadas, área balcão térmico) - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 1785, mo: 1230, vlrUnit: 3015, materialCliente: false, qdeReferencia: 1.47, totalEsperado: 4432.05 },
  { cod: '16.2', secao: 16, grupo: 'G4', descricao: 'Bancadas em granito para vestiários - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 1785, mo: 1230, vlrUnit: 3015, materialCliente: false, qdeReferencia: 2.18, totalEsperado: 6572.7 },
  { cod: '16.3', secao: 16, grupo: 'G4', descricao: 'Aparadores para bancada de vestiários  - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 190, mo: 78, vlrUnit: 268, materialCliente: false, qdeReferencia: 2, totalEsperado: 536 },
  { cod: '16.4', secao: 16, grupo: 'G4', descricao: 'Nicho em granito nos box de chuveiro - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 190, mo: 78, vlrUnit: 268, materialCliente: false, qdeReferencia: 2, totalEsperado: 536 },
];

// ─── SEÇÃO 17 — Louças e Metais ────────────────────────────────── //
const secao17: XlsxItem[] = [
  { cod: '17.1', secao: 17, grupo: 'G1', descricao: 'Cuba de inox - copa', zona: 'adm', unidade: 'un', mat: 900, mo: 250, vlrUnit: 1150, materialCliente: false, qdeReferencia: 1, totalEsperado: 1150 },
  { cod: '17.2', secao: 17, grupo: 'G1', descricao: 'Cuba de embutir de louça oval', zona: 'adm', unidade: 'un', mat: 350, mo: 150, vlrUnit: 500, materialCliente: false, qdeReferencia: 4, totalEsperado: 2000 },
  { cod: '17.3', secao: 17, grupo: 'G1', descricao: 'Obs.: Demais louças e metais serão fornecidas e instaladas pela Instaladora de hidráulica.', zona: 'adm', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 18 — Pintura ────────────────────────────────────────── //
const secao18: XlsxItem[] = [
  { cod: '18.1', secao: 18, grupo: 'G3', descricao: 'Epóxi sobre cimentado - Mat. + M.O. - áreas técnicas', zona: 'área técnica', unidade: 'm2', mat: 67.2, mo: 38.2, vlrUnit: 105.4, materialCliente: false, qdeReferencia: 39.61, totalEsperado: 4174.894 },
  { cod: '18.2', secao: 18, grupo: 'G3', descricao: 'Pintura esmalte cor amarela - Mat. + M.O. - bases casa de máquinas', zona: 'área técnica', unidade: 'vb', mat: 1250, mo: 750, vlrUnit: 2000, materialCliente: false, qdeReferencia: 1, totalEsperado: 2000 },
  { cod: '18.3', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura acrílica - branco gelo - vendas - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 30.68, mo: 22.9, vlrUnit: 53.58, materialCliente: false, qdeReferencia: 1153, totalEsperado: 61777.74 },
  { cod: '18.4', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura acrílica - branco neve - vendas - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 30.68, mo: 22.9, vlrUnit: 53.58, materialCliente: false, qdeReferencia: 60, totalEsperado: 3214.8 },
  { cod: '18.5', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura acrílica - branco gelo - área administrativa - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 30.68, mo: 22.9, vlrUnit: 53.58, materialCliente: false, qdeReferencia: 708, totalEsperado: 37934.64 },
  { cod: '18.6', secao: 18, grupo: 'G3', descricao: 'Pintura latex branco - Mat. + M.O. - acima do nível do forro', zona: '', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.7', secao: 18, grupo: 'G3', descricao: 'Emassamento e aplicação de textura acrílica (h=1,70m) - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.8', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura Látex PVA COR DIÁRIO DE  MENINA fosco- área administrativa - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 23.88, mo: 15.89, vlrUnit: 39.77, materialCliente: false, qdeReferencia: 15, totalEsperado: 596.55 },
  { cod: '18.9', secao: 18, grupo: 'G3', descricao: 'Pintura Látex PVA Fosco, cor branco neve para laje - Mat. + M.O. - área de vendas', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.10', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura Látex PVA branco neve fosco para forro - Mat. + M.O. - área de vendas', zona: 'vendas', unidade: 'm2', mat: 26.68, mo: 18.9, vlrUnit: 45.58, materialCliente: false, qdeReferencia: 1044, totalEsperado: 47585.52 },
  { cod: '18.11', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura Látex branco neve fosco forro - Mat. + M.O. - laje reservas/ administrativa', zona: 'adm', unidade: 'm2', mat: 26.68, mo: 18.9, vlrUnit: 45.58, materialCliente: false, qdeReferencia: 408, totalEsperado: 18596.64 },
  { cod: '18.12', secao: 18, grupo: 'G3', descricao: 'Emassamento e pintura Látex PVA COR DIÁRIO DE  MENINA fosco para forro - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 23.68, mo: 18.9, vlrUnit: 42.58, materialCliente: false, qdeReferencia: 8.6, totalEsperado: 366.188 },
  { cod: '18.13', secao: 18, grupo: 'G3', descricao: 'Pintura latex branco - Mat. + M.O. - áreas técnicas', zona: 'área técnica', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.14', secao: 18, grupo: 'G3', descricao: 'Pintura latex branco neve fosco para laje - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.15', secao: 18, grupo: 'G3', descricao: 'Pintura de todas as infras e estruturas na branco neve forro - Mat. + M.O. - salão de vendas', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.16', secao: 18, grupo: 'G3', descricao: 'Pintura de todas as infras e estruturas na cor cinza clar ofosco forro - Mat. + M.O. - laje reservas/ administrativa', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.17', secao: 18, grupo: 'G3', descricao: 'Pintura esmalte cor Grafite em porta metálica - Mat. + M.O.', zona: 'adm', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '18.18', secao: 18, grupo: 'G3', descricao: 'Pintura com tinta epóxi amarelo para corrimão metálico - Mat. + M.O.', zona: 'adm', unidade: 'ml', mat: 44.7, mo: 15.89, vlrUnit: 60.59, materialCliente: false, qdeReferencia: 39.9, totalEsperado: 2417.541 },
];

// ─── SEÇÃO 19 — Vidros e Espelhos ──────────────────────────────── //
const secao19: XlsxItem[] = [
  { cod: '19.1', secao: 19, grupo: 'G4', descricao: 'Espelho Cristal 4mm para colocação sobre bancadas dos sanitários com moldura alumínio (1 por cuba) - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 498.3, mo: 196.19, vlrUnit: 694.49, materialCliente: false, qdeReferencia: 4, totalEsperado: 2777.96 },
  { cod: '19.2', secao: 19, grupo: 'G4', descricao: 'Espelho Cristal 4mm vertical com moldura para funcionários nos vestiários (1,40x0,50m) - 1 unidade por vestiário - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 498.3, mo: 196.19, vlrUnit: 694.49, materialCliente: false, qdeReferencia: 2, totalEsperado: 1388.98 },
  { cod: '19.3', secao: 19, grupo: 'G4', descricao: 'Vidro blindex 10mm para guarda corpo - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '19.4', secao: 19, grupo: 'G4', descricao: 'Vidro temperado incolor 10mm para vitrine (verificar exigência de especificação do manual técnico do shopping)', zona: 'fachada', unidade: 'm2', mat: 432.7, mo: 168.9, vlrUnit: 601.6, materialCliente: false, qdeReferencia: 11.61, totalEsperado: 6984.576 },
];

// ─── SEÇÃO 20 — Portas em Madeira ──────────────────────────────── //
const secao20: XlsxItem[] = [
  { cod: '20.1', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,62x2,10m) folhada Curupixa ou Tauari ou similar - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '20.2', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,72x2,10m) folhada Curupixa ou Tauari ou similar - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 1576, mo: 285, vlrUnit: 1861, materialCliente: false, qdeReferencia: 2, totalEsperado: 3722 },
  { cod: '20.3', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,82x2,10m) folhada Curupixa ou Tauari ou similar - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 1776, mo: 285, vlrUnit: 2061, materialCliente: false, qdeReferencia: 6, totalEsperado: 12366 },
  { cod: '20.4', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,92x2,10m) com visor Cantina foleada Curupixa ou Tauari ou similar - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 1876, mo: 285, vlrUnit: 2161, materialCliente: false, qdeReferencia: 1, totalEsperado: 2161 },
  { cod: '20.5', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,92x2,10m) folhada Curupixa ou Tauari ou similar com painel de vidro - Mat. + M.O. - copa', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '20.5', secao: 20, grupo: 'G6', descricao: 'Porta de madeira completa (0,92x2,10m) folhada Curupixa ou Tauari ou similar com visor - Mat. + M.O. - Sala CFTV', zona: 'adm', unidade: 'un', mat: 2110, mo: 285, vlrUnit: 2395, materialCliente: false, qdeReferencia: 1, totalEsperado: 2395 },
  { cod: '20.6', secao: 20, grupo: 'G6', descricao: 'Mola para porta - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 325.6, mo: 95.4, vlrUnit: 421, materialCliente: false, qdeReferencia: 2, totalEsperado: 842 },
  { cod: '20.7', secao: 20, grupo: 'G6', descricao: 'Tetra-chave - Mat. + M.O.', zona: 'estoque', unidade: 'un', mat: 289.4, mo: 145, vlrUnit: 434.4, materialCliente: false, qdeReferencia: 1, totalEsperado: 434.4 },
  { cod: '20.8', secao: 20, grupo: 'G6', descricao: 'Prendedor de porta - Mat. + M.O.', zona: 'adm', unidade: 'un', mat: 100, mo: 80, vlrUnit: 180, materialCliente: false, qdeReferencia: 4, totalEsperado: 720 },
  { cod: '20.8', secao: 20, grupo: 'G6', descricao: 'Barra de apoio para porta - Mat. + M.O. - Sanitário PNE', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '20.9', secao: 20, grupo: 'G6', descricao: 'Fechadura elétrica com acionamento manual - porta back office', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 21 — Marcenaria Área de Vendas ──────────────────────── //
const secao21: XlsxItem[] = [
  { cod: '21.1', secao: 21, grupo: 'G6', descricao: 'Revestimento em laminado - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.2', secao: 21, grupo: 'G6', descricao: 'Painel 120cm laminado Ártico TX - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.3', secao: 21, grupo: 'G6', descricao: 'Divisória em mdp 25mm laminado para fechamento lateral dos balcões - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.4', secao: 21, grupo: 'G6', descricao: 'Réguas para união de painéis - Mat. + M.O.', zona: 'vendas', unidade: 'm', mat: 28.5, mo: 18.87, vlrUnit: 47.37, materialCliente: false, qdeReferencia: 10, totalEsperado: 473.7 },
  { cod: '21.5', secao: 21, grupo: 'G6', descricao: 'Fornecimento e instalação de Hot Line - bancada com divisória', zona: 'vendas', unidade: 'cj', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.6', secao: 21, grupo: 'G6', descricao: 'Revestimento de colunas Área vendas padrão Ártico TX - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 2376, mo: 1740, vlrUnit: 4116, materialCliente: false, qdeReferencia: 3, totalEsperado: 12348 },
  { cod: '21.7', secao: 21, grupo: 'G6', descricao: 'Rodapé em fórmica - Mat. + M.O.', zona: 'vendas', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.8', secao: 21, grupo: 'G6', descricao: 'Rodateto em fórmica - Mat. + M.O.', zona: 'vendas', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.9', secao: 21, grupo: 'G6', descricao: 'Espelho 4mm incolor Guardian class - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 480, mo: 168, vlrUnit: 648, materialCliente: false, qdeReferencia: 3, totalEsperado: 1944 },
  { cod: '21.10', secao: 21, grupo: 'G6', descricao: 'Porta completa simples Ártico TX 0.80m  - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 624.0172, mo: 229.4268, vlrUnit: 853.444, materialCliente: false, qdeReferencia: 1, totalEsperado: 853.444 },
  { cod: '21.11', secao: 21, grupo: 'G6', descricao: 'Porta completa simples  Ártico TX 1.00m - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 724.0172, mo: 229.4268, vlrUnit: 953.444, materialCliente: false, qdeReferencia: 2, totalEsperado: 1906.888 },
  { cod: '21.12', secao: 21, grupo: 'G6', descricao: 'Porta dupla 1.20m  Ártico TX - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 824.0172, mo: 229.4268, vlrUnit: 1053.444, materialCliente: false, qdeReferencia: 1, totalEsperado: 1053.444 },
  { cod: '21.13', secao: 21, grupo: 'G6', descricao: 'Porta vai vem  Ártico TX - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 2640, mo: 410, vlrUnit: 3050, materialCliente: false, qdeReferencia: 1, totalEsperado: 3050 },
  { cod: '21.14', secao: 21, grupo: 'G6', descricao: 'Caixa para hidrantes - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 1090, mo: 490, vlrUnit: 1580, materialCliente: false, qdeReferencia: 3, totalEsperado: 4740 },
  { cod: '21.15', secao: 21, grupo: 'G6', descricao: 'Vidro temperado hidrante c/ ferragens - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 660, mo: 240, vlrUnit: 900, materialCliente: false, qdeReferencia: 3, totalEsperado: 2700 },
  { cod: '21.16', secao: 21, grupo: 'G6', descricao: 'Arquibancada: TABLADO FIXO EM MDP BRANCO 18mm. Prever estrutura  metálica interna em tubo de ferro metalon para sustentação a cada 1m.', zona: 'adm', unidade: 'un', mat: 0, mo: 1228.29, vlrUnit: 1228.29, materialCliente: true, qdeReferencia: 1, totalEsperado: 1228.29 },
  { cod: '21.17', secao: 21, grupo: 'G6', descricao: 'Arremates de cantos / Cantoneira alumínio - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '21.18', secao: 21, grupo: 'G6', descricao: 'Tubo aço inox 2" para alimentação caixa - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 368, mo: 95, vlrUnit: 463, materialCliente: false, qdeReferencia: 2, totalEsperado: 926 },
  { cod: '21.19', secao: 21, grupo: 'G6', descricao: 'Estrado com laminado branco para vitrine  - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 129.4059, mo: 98.3169, vlrUnit: 227.7228, materialCliente: false, qdeReferencia: 8, totalEsperado: 1821.7824 },
  { cod: '21.20', secao: 21, grupo: 'G6', descricao: 'Estrutura metálica em tubo de ferro metalon para estrados - Mat. + M.O.', zona: 'vendas', unidade: 'm2', mat: 992.45, mo: 423.67, vlrUnit: 1416.12, materialCliente: false, qdeReferencia: 6.3, totalEsperado: 8921.556 },
  { cod: '21.21', secao: 21, grupo: 'G6', descricao: 'Fixadores de teto - Mat. + M.O.', zona: 'vendas', unidade: 'un', mat: 93.2, mo: 63.4, vlrUnit: 156.6, materialCliente: false, qdeReferencia: 6, totalEsperado: 939.6 },
];

// ─── SEÇÃO 22 — Provadores ─────────────────────────────────────── //
const secao22: XlsxItem[] = [
  { cod: '22.1', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica artico l166 tx', zona: 'provador', unidade: 'm2', mat: 378.1, mo: 247, vlrUnit: 625.1, materialCliente: false, qdeReferencia: 42, totalEsperado: 26254.2 },
  { cod: '22.2', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica gelo l106 tx', zona: 'provador', unidade: 'm2', mat: 378.1, mo: 247, vlrUnit: 625.1, materialCliente: false, qdeReferencia: 25, totalEsperado: 15627.5 },
  { cod: '22.3', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica branco l120tx', zona: 'provador', unidade: 'm2', mat: 378.1, mo: 247, vlrUnit: 625.1, materialCliente: false, qdeReferencia: 243, totalEsperado: 151899.3 },
  { cod: '22.4', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica cobalto l118 tx', zona: 'provador', unidade: 'm2', mat: 428.1, mo: 247, vlrUnit: 675.1, materialCliente: false, qdeReferencia: 9, totalEsperado: 6075.9 },
  { cod: '22.5', secao: 22, grupo: 'G5', descricao: 'revestimento em laminado formica prattan l151 tx', zona: 'provador', unidade: 'm2', mat: 498.1, mo: 247, vlrUnit: 745.1, materialCliente: false, qdeReferencia: 30, totalEsperado: 22353 },
  { cod: '22.7', secao: 22, grupo: 'G5', descricao: 'lateral de provador branca', zona: 'provador', unidade: 'un', mat: 138.65, mo: 124.2, vlrUnit: 262.85, materialCliente: false, qdeReferencia: 24, totalEsperado: 6308.4 },
  { cod: '22.8', secao: 22, grupo: 'G5', descricao: 'painel liso laminado branco', zona: 'provador', unidade: 'un', mat: 138.65, mo: 124.2, vlrUnit: 262.85, materialCliente: false, qdeReferencia: 9, totalEsperado: 2365.65 },
  { cod: '22.9', secao: 22, grupo: 'G5', descricao: 'coluna simples', zona: 'provador', unidade: 'un', mat: 1340, mo: 730, vlrUnit: 2070, materialCliente: false, qdeReferencia: 40, totalEsperado: 82800 },
  { cod: '22.10', secao: 22, grupo: 'G5', descricao: 'régua para união de painéis', zona: 'provador', unidade: 'un', mat: 132, mo: 37.8, vlrUnit: 169.8, materialCliente: false, qdeReferencia: 30, totalEsperado: 5094 },
  { cod: '22.11', secao: 22, grupo: 'G5', descricao: 'travessa', zona: 'provador', unidade: 'un', mat: 187.2, mo: 98.23, vlrUnit: 285.43, materialCliente: false, qdeReferencia: 30, totalEsperado: 8562.9 },
  { cod: '22.12', secao: 22, grupo: 'G5', descricao: 'frontal', zona: 'provador', unidade: 'un', mat: 623.13, mo: 223.13, vlrUnit: 846.26, materialCliente: false, qdeReferencia: 30, totalEsperado: 25387.8 },
  { cod: '22.13', secao: 22, grupo: 'G5', descricao: 'suporte "l" para lateral de provador', zona: 'provador', unidade: 'un', mat: 87.1, mo: 46.2, vlrUnit: 133.3, materialCliente: false, qdeReferencia: 50, totalEsperado: 6665 },
  { cod: '22.14', secao: 22, grupo: 'G5', descricao: 'rodapé em mdf branco 10mm x 5,0cm - TARKET', zona: 'provador', unidade: 'm', mat: 76.23, mo: 53.12, vlrUnit: 129.35, materialCliente: false, qdeReferencia: 99.3, totalEsperado: 12844.455 },
  { cod: '22.15', secao: 22, grupo: 'G5', descricao: 'rodapé em fórmica pratan 10cm', zona: 'provador', unidade: 'm', mat: 73.74, mo: 53.12, vlrUnit: 126.86, materialCliente: false, qdeReferencia: 43.7, totalEsperado: 5543.782 },
  { cod: '22.16', secao: 22, grupo: 'G5', descricao: 'rodapé/rodateto em mdf branco 10mm x 10,0cm', zona: 'provador', unidade: 'm', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.17', secao: 22, grupo: 'G5', descricao: 'Espelho 4mm incolor Guardian class - corredor provador', zona: 'provador', unidade: 'un', mat: 574.089, mo: 167.4, vlrUnit: 741.489, materialCliente: false, qdeReferencia: 3, totalEsperado: 2224.467 },
  { cod: '22.18', secao: 22, grupo: 'G5', descricao: 'Espelho 4mm incolor Guardian class com cava para iluminação - cabine provador', zona: 'provador', unidade: 'un', mat: 624.96, mo: 167.4, vlrUnit: 792.36, materialCliente: false, qdeReferencia: 25, totalEsperado: 19809 },
  { cod: '22.19', secao: 22, grupo: 'G5', descricao: 'Chassis para espelhos - cabine provador', zona: 'provador', unidade: 'un', mat: 519.958, mo: 265.98, vlrUnit: 785.938, materialCliente: false, qdeReferencia: 25, totalEsperado: 19648.45 },
  { cod: '22.20', secao: 22, grupo: 'G5', descricao: 'porta para provador 60,0cm x 180,0cm - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.21', secao: 22, grupo: 'G5', descricao: 'porta para provador 70,0cm x 180,0cm - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 837.6, mo: 216, vlrUnit: 1053.6, materialCliente: false, qdeReferencia: 21, totalEsperado: 22125.6 },
  { cod: '22.22', secao: 22, grupo: 'G5', descricao: 'porta para provador 80,0cm x 180,0cm - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.23', secao: 22, grupo: 'G5', descricao: 'porta para provador 90,0cm x 180,0cm - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.24', secao: 22, grupo: 'G5', descricao: 'porta provador PNE - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 900, mo: 240, vlrUnit: 1140, materialCliente: false, qdeReferencia: 1, totalEsperado: 1140 },
  { cod: '22.25', secao: 22, grupo: 'G5', descricao: 'porta provador família - com dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 900, mo: 340, vlrUnit: 1240, materialCliente: false, qdeReferencia: 2, totalEsperado: 2480 },
  { cod: '22.26', secao: 22, grupo: 'G5', descricao: 'Porta de correr provador', zona: 'provador', unidade: 'un', mat: 1680, mo: 300, vlrUnit: 1980, materialCliente: false, qdeReferencia: 1, totalEsperado: 1980 },
  { cod: '22.27', secao: 22, grupo: 'G5', descricao: 'Nichos lounge -', zona: 'provador', unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.28', secao: 22, grupo: 'G5', descricao: 'Superficie para troca de roupas', zona: 'provador', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '22.28', secao: 22, grupo: 'G5', descricao: 'Arremates de cantos / Cantoneira alumínio', zona: 'provador', unidade: 'un', mat: 89, mo: 68.3, vlrUnit: 157.3, materialCliente: false, qdeReferencia: 12, totalEsperado: 1887.6 },
  { cod: '22.29', secao: 22, grupo: 'G5', descricao: 'cabideiro cromado (especificação em anexo)', zona: 'provador', unidade: 'un', mat: 58.2, mo: 14.4, vlrUnit: 72.6, materialCliente: false, qdeReferencia: 23, totalEsperado: 1669.8 },
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
  { cod: '23.4', secao: 23, grupo: 'G6', descricao: 'Revestimento em ACM Branco Brilho', zona: 'fachada', unidade: 'm2', mat: 380, mo: 259, vlrUnit: 639, materialCliente: false, qdeReferencia: 55.68, totalEsperado: 35579.52 },
  { cod: '23.5', secao: 23, grupo: 'G6', descricao: 'Revestimento em formica', zona: 'fachada', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.6', secao: 23, grupo: 'G6', descricao: 'Revestimento para marquise', zona: 'fachada', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.7', secao: 23, grupo: 'G6', descricao: 'Porcelanato 1,20x0,60 - fornecido pela C&A', zona: 'fachada', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.8', secao: 23, grupo: 'G6', descricao: 'Argamassa, rejunte e mão de obra para aplicação de porcelanato na fachada', zona: 'fachada', unidade: 'm2', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '23.9', secao: 23, grupo: 'G6', descricao: 'Rodapé em aço inox escovado 200mm', zona: 'fachada', unidade: 'm', mat: 256, mo: 119, vlrUnit: 375, materialCliente: false, qdeReferencia: 9.36, totalEsperado: 3510 },
  { cod: '23.10', secao: 23, grupo: 'G6', descricao: 'Porta de enrolar - fornecimento C&A', zona: 'fachada', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, qdeReferencia: 1, zerado: true },
];

// ─── SEÇÃO 24 — Marcenaria e Enxoval ───────────────────────────── //
const secao24: XlsxItem[] = [
  { cod: '24.1', secao: 24, grupo: 'G6', descricao: 'Armário suspenso - refeitório', zona: 'adm', unidade: 'un', mat: 2175, mo: 460, vlrUnit: 2635, materialCliente: false, qdeReferencia: 1, totalEsperado: 2635 },
  { cod: '24.2', secao: 24, grupo: 'G6', descricao: 'Bancada/ armário da copa', zona: 'adm', unidade: 'un', mat: 2160, mo: 950, vlrUnit: 3110, materialCliente: false, qdeReferencia: 1, totalEsperado: 3110 },
  { cod: '24.3', secao: 24, grupo: 'G6', descricao: 'Armário suspenso e bancada - sala da gerência', zona: 'adm', unidade: 'un', mat: 2170, mo: 950, vlrUnit: 3120, materialCliente: false, qdeReferencia: 1, totalEsperado: 3120 },
  { cod: '24.4', secao: 24, grupo: 'G6', descricao: 'Prateleira na circulação para caixa geral', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '24.5', secao: 24, grupo: 'G6', descricao: 'Moldura para cofre - boca de lobo', zona: 'adm', unidade: 'un', mat: 925, mo: 260, vlrUnit: 1185, materialCliente: false, qdeReferencia: 1, totalEsperado: 1185 },
  { cod: '24.6', secao: 24, grupo: 'G6', descricao: 'Estante sala de rack', zona: 'adm', unidade: 'un', mat: 1320, mo: 260, vlrUnit: 1580, materialCliente: false, qdeReferencia: 1, totalEsperado: 1580 },
  { cod: '24.7', secao: 24, grupo: 'G6', descricao: 'Armário boca de lobo - sala da gerência', zona: 'adm', unidade: 'un', mat: 1315, mo: 180, vlrUnit: 1495, materialCliente: false, qdeReferencia: 1, totalEsperado: 1495 },
  { cod: '24.8', secao: 24, grupo: 'G6', descricao: 'Base de alumínio para bebedouro', zona: 'adm', unidade: 'un', mat: 1190, mo: 0, vlrUnit: 1190, materialCliente: false, qdeReferencia: 2, totalEsperado: 2380 },
  { cod: '24.9', secao: 24, grupo: 'G6', descricao: 'Filtro para bebedouro Aqualar', zona: 'adm', unidade: 'un', mat: 735, mo: 0, vlrUnit: 735, materialCliente: false, qdeReferencia: 2, totalEsperado: 1470 },
  { cod: '24.10', secao: 24, grupo: 'G6', descricao: 'Porta e Tampa de alumínio para lixeira copa', zona: 'adm', unidade: 'un', mat: 920, mo: 0, vlrUnit: 920, materialCliente: false, qdeReferencia: 2, totalEsperado: 1840 },
  { cod: '24.11', secao: 24, grupo: 'G6', descricao: 'Suporte para TV, Projetor e Microondas', zona: 'adm', unidade: 'un', mat: 545, mo: 95, vlrUnit: 640, materialCliente: false, qdeReferencia: 3, totalEsperado: 1920 },
  { cod: '24.12', secao: 24, grupo: 'G6', descricao: 'Lixeira para bancada da cantina', zona: 'adm', unidade: 'un', mat: 376.12, mo: 0, vlrUnit: 376.12, materialCliente: false, qdeReferencia: 1, totalEsperado: 376.12 },
  { cod: '24.13', secao: 24, grupo: 'G6', descricao: 'Lixeira para bancada dos sanitários', zona: 'adm', unidade: 'un', mat: 376, mo: 0, vlrUnit: 376, materialCliente: false, qdeReferencia: 2, totalEsperado: 752 },
  { cod: '24.14', secao: 24, grupo: 'G6', descricao: 'Lixeira para vasos sanitários', zona: 'adm', unidade: 'un', mat: 298.3, mo: 0, vlrUnit: 298.3, materialCliente: false, qdeReferencia: 6, totalEsperado: 1789.8 },
  { cod: '24.15', secao: 24, grupo: 'G6', descricao: 'Portinhola branca para correio pneumático', zona: 'vendas', unidade: 'un', mat: 436, mo: 83.65, vlrUnit: 519.65, materialCliente: false, qdeReferencia: 1, totalEsperado: 519.65 },
  { cod: '24.16', secao: 24, grupo: 'G6', descricao: 'Locker para vestiário', zona: 'adm', unidade: 'un', mat: 560, mo: 156, vlrUnit: 716, materialCliente: false, qdeReferencia: 3, totalEsperado: 2148 },
  { cod: '24.17', secao: 24, grupo: 'G6', descricao: 'Banco para vestiário', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
  { cod: '24.17', secao: 24, grupo: 'G6', descricao: 'Sapateira para vestiário', zona: 'adm', unidade: 'un', mat: 0, mo: 0, vlrUnit: 0, materialCliente: false, zerado: true },
];

// ─── SEÇÃO 25 — Omissos ────────────────────────────────────────── //
const secao25: XlsxItem[] = [
  { cod: '25.1', secao: 25, grupo: 'G2', descricao: 'PROTEÇÃO ELETROMAGNÉTICA EM MANTA ALUMINIZADA (RFID)', zona: '', unidade: 'm2', mat: 70, mo: 50, vlrUnit: 120, materialCliente: false, qdeReferencia: 158, totalEsperado: 18960 },
  { cod: '25.2', secao: 25, grupo: 'G2', descricao: 'Alvenaria em Bloco Celular', zona: '', unidade: 'm2', mat: 66.3, mo: 28.5, vlrUnit: 94.8, materialCliente: false, qdeReferencia: 10, totalEsperado: 948 },
  { cod: '25.3', secao: 25, grupo: 'G2', descricao: 'Revestimento da Escada (Degrau e espelho) em Granito Branco Ceará', zona: '', unidade: 'm2', mat: 900, mo: 250, vlrUnit: 1150, materialCliente: false, qdeReferencia: 10.73, totalEsperado: 12339.5 },
  { cod: '25.4', secao: 25, grupo: 'G2', descricao: 'Rodapé escada dos provadores em granito branco ceará', zona: '', unidade: 'ml', mat: 879, mo: 250, vlrUnit: 1129, materialCliente: false, qdeReferencia: 16.21, totalEsperado: 18301.09 },
  { cod: '25.5', secao: 25, grupo: 'G2', descricao: 'Rodapé MDP Branco', zona: '', unidade: 'ml', mat: 340, mo: 189, vlrUnit: 529, materialCliente: false, qdeReferencia: 5.05, totalEsperado: 2671.45 },
  { cod: '25.7', secao: 25, grupo: 'G2', descricao: 'Grama sintética - sala descompressão', zona: '', unidade: 'm2', mat: 393.3, mo: 296.8, vlrUnit: 690.1, materialCliente: false, qdeReferencia: 10, totalEsperado: 6901 },
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
  'A': 234410,
  '7': 10000,
  '8': 61738.3,
  '9': 59715.2,
  '10': 17054.6,
  '11': 0,
  '12': 255528.706,
  '13': 25435.65,
  '14': 142672.9208,
  '15': 11962.3,
  '16': 12076.75,
  '17': 3150,
  '18': 178664.513,
  '19': 11151.516,
  '20': 22640.4,
  '21': 42906.7045,
  '22': 453244.404,
  '23': 42174.12,
  '24': 26320.57,
  '25': 60121.04,
};

export const TOTAL_GERAL_XLSX = 1670967.6943;
