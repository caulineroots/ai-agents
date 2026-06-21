// ─── Checklist XLSX — 1ª Proposta CELMAR BLN ─────────────────────────────────
// Fonte: tabela-precos-unitarios-celmar-bln.md + planilha-precificacao-celmar-bln.md
// Todos os itens das seções A–25 indexados por código.
// É a fonte primária de estrutura e preços — substitui TABELA_CELMAR com keyword fuzzy.

export type GrupoEspecialista = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

export interface XlsxItem {
  cod:             string;          // ex: "14.1"
  secao:           number | 'A';    // número da seção ou 'A' para custos indiretos
  grupo:           GrupoEspecialista;
  descricao:       string;
  zona:            string;          // "vendas" | "adm" | "fachada" | "estoque" | ...
  unidade:         string;          // m2 | ml | un | vb | kg | hr | m3 | mes | dia | m
  mat:             number;          // preço unitário de material
  mo:              number;          // preço unitário de mão de obra
  vlrUnit:         number;          // mat + mo
  materialCliente: boolean;         // true = material fornecido pela C&A
  qdeReferencia?:  number;          // quantidade real do XLSX (para auditoria)
  totalEsperado?:  number;          // total esperado do XLSX (para auditoria)
  zerado?:         boolean;         // item zerado na proposta (inaplicável ou C&A)
}

// ─── SEÇÃO A — Custos Indiretos ──────────────────────────────────────────────
const secaoA: XlsxItem[] = [
  { cod: '1.1',  secao: 'A', grupo: 'G1', descricao: 'ART contemplando todos os serviços + placa de obra', zona: '', unidade: 'vb',  mat: 0,       mo: 1100,  vlrUnit: 1100,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 1100 },
  { cod: '1.2',  secao: 'A', grupo: 'G1', descricao: 'Seguro de obra com responsabilidade civil',           zona: '', unidade: 'vb',  mat: 3400,    mo: 0,     vlrUnit: 3400,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 3400 },
  { cod: '1.3',  secao: 'A', grupo: 'G1', descricao: 'Topografia (5 visitas)',                              zona: '', unidade: 'dia', mat: 350,     mo: 2070,  vlrUnit: 2420,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 2420 },
  { cod: '2.1',  secao: 'A', grupo: 'G1', descricao: 'Tapume Eucatex pontaletes 3"×3" branco',             zona: '', unidade: 'm2',  mat: 0,       mo: 0,     vlrUnit: 0,     materialCliente: false, qdeReferencia: 0,  totalEsperado: 0,   zerado: true },
  { cod: '2.2',  secao: 'A', grupo: 'G1', descricao: 'EPI + comunicação visual de obra',                    zona: '', unidade: 'vb',  mat: 3500,    mo: 0,     vlrUnit: 3500,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 3500 },
  { cod: '2.3',  secao: 'A', grupo: 'G1', descricao: 'Vigilância de obra (30 dias)',                        zona: '', unidade: 'dia', mat: 0,       mo: 150,   vlrUnit: 150,   materialCliente: false, qdeReferencia: 30, totalEsperado: 4500 },
  { cod: '2.4',  secao: 'A', grupo: 'G1', descricao: 'Escritório + refeitório + WC para obra (130 m²)',    zona: '', unidade: 'vb',  mat: 17980,   mo: 5800,  vlrUnit: 23780, materialCliente: false, qdeReferencia: 1,  totalEsperado: 23780 },
  { cod: '2.5',  secao: 'A', grupo: 'G1', descricao: 'Material de limpeza e administrativo',               zona: '', unidade: 'vb',  mat: 3500,    mo: 0,     vlrUnit: 3500,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 3500 },
  { cod: '2.6',  secao: 'A', grupo: 'G1', descricao: 'Extintores de obra + bebedouro',                     zona: '', unidade: 'vb',  mat: 1830,    mo: 0,     vlrUnit: 1830,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 1830 },
  { cod: '2.7',  secao: 'A', grupo: 'G1', descricao: 'Ligação elétrica tomadas e iluminação canteiro',     zona: '', unidade: 'vb',  mat: 3500,    mo: 0,     vlrUnit: 3500,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 3500 },
  { cod: '2.8',  secao: 'A', grupo: 'G1', descricao: 'Iluminação provisória + quadro entrada de energia',  zona: '', unidade: 'vb',  mat: 3400,    mo: 0,     vlrUnit: 3400,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 3400 },
  { cod: '2.9',  secao: 'A', grupo: 'G1', descricao: 'Eletricista durante a obra',                         zona: '', unidade: 'vb',  mat: 0,       mo: 4500,  vlrUnit: 4500,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 4500 },
  { cod: '3.1',  secao: 'A', grupo: 'G1', descricao: 'Lona proteção — piso, marcenaria, equipamentos',     zona: '', unidade: 'vb',  mat: 4580,    mo: 0,     vlrUnit: 4580,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 4580 },
  { cod: '3.2',  secao: 'A', grupo: 'G1', descricao: 'Lona transparente proteção equipamentos',            zona: '', unidade: 'vb',  mat: 4200,    mo: 0,     vlrUnit: 4200,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 4200 },
  { cod: '3.3',  secao: 'A', grupo: 'G1', descricao: 'Entulho + caçamba (3 meses)',                        zona: '', unidade: 'mes', mat: 200,     mo: 8000,  vlrUnit: 8200,  materialCliente: false, qdeReferencia: 3,  totalEsperado: 24600 },
  { cod: '3.4',  secao: 'A', grupo: 'G1', descricao: 'Locação de equipamentos manuais',                    zona: '', unidade: 'vb',  mat: 0,       mo: 6900,  vlrUnit: 6900,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 6900 },
  { cod: '3.5',  secao: 'A', grupo: 'G1', descricao: 'Transporte vertical e horizontal',                   zona: '', unidade: 'vb',  mat: 0,       mo: 9700,  vlrUnit: 9700,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 9700 },
  { cod: '4.1',  secao: 'A', grupo: 'G1', descricao: 'Engenheiro residente (full time)',                    zona: '', unidade: 'mes', mat: 0,       mo: 10500, vlrUnit: 10500, materialCliente: false, qdeReferencia: 3,  totalEsperado: 31500 },
  { cod: '4.2',  secao: 'A', grupo: 'G1', descricao: 'Técnico de segurança (full time)',                   zona: '', unidade: 'mes', mat: 0,       mo: 3500,  vlrUnit: 3500,  materialCliente: false, qdeReferencia: 3,  totalEsperado: 10500 },
  { cod: '4.3',  secao: 'A', grupo: 'G1', descricao: 'Estadias e refeições',                               zona: '', unidade: 'vb',  mat: 0,       mo: 35000, vlrUnit: 35000, materialCliente: false, qdeReferencia: 1,  totalEsperado: 35000 },
  { cod: '4.4',  secao: 'A', grupo: 'G1', descricao: 'Mobilização e desmobilização',                       zona: '', unidade: 'vb',  mat: 0,       mo: 28000, vlrUnit: 28000, materialCliente: false, qdeReferencia: 1,  totalEsperado: 28000 },
  { cod: '4.5',  secao: 'A', grupo: 'G1', descricao: 'Limpeza permanente (2 operários)',                   zona: '', unidade: 'mes', mat: 0,       mo: 5000,  vlrUnit: 5000,  materialCliente: false, qdeReferencia: 3,  totalEsperado: 15000 },
  { cod: '5.1',  secao: 'A', grupo: 'G1', descricao: 'Limpeza final de obra',                              zona: '', unidade: 'vb',  mat: 0,       mo: 9000,  vlrUnit: 9000,  materialCliente: false, qdeReferencia: 1,  totalEsperado: 9000 },
];

// ─── SEÇÃO 7 — Adaptação de Shell ────────────────────────────────────────────
const secao7: XlsxItem[] = [
  { cod: '7.1',  secao: 7, grupo: 'G1', descricao: 'Demolições e retiradas (inclui bota-fora)', zona: '', unidade: 'vb', mat: 3500, mo: 6500, vlrUnit: 10000, materialCliente: false, qdeReferencia: 1, totalEsperado: 10000 },
];

// ─── SEÇÃO 8 — Serralheria ───────────────────────────────────────────────────
const secao8: XlsxItem[] = [
  { cod: '8.1',  secao: 8, grupo: 'G1', descricao: 'Mezanino metálico — contratação direta C&A',                 zona: 'estoque',       unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: true,  zerado: true },
  { cod: '8.2',  secao: 8, grupo: 'G1', descricao: 'Painel wall para mezanino — contratação direta C&A',         zona: 'estoque',       unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: true,  zerado: true },
  { cod: '8.3',  secao: 8, grupo: 'G1', descricao: 'Escada metálica — contratação direta C&A',                   zona: 'estoque',       unidade: 'vb', mat: 0, mo: 0, vlrUnit: 0, materialCliente: true,  zerado: true },
  { cod: '8.5',  secao: 8, grupo: 'G1', descricao: 'Guarda corpo de ferro c/ pintura (escada + mezanino)',       zona: 'estoque',       unidade: 'm',  mat: 280, mo: 125.70, vlrUnit: 405.70, materialCliente: false, qdeReferencia: 19, totalEsperado: 7708 },
  { cod: '8.6',  secao: 8, grupo: 'G1', descricao: 'Estrutura metálica metalon — revestimento de fachada',      zona: 'fachada',       unidade: 'vb', mat: 9190, mo: 5220, vlrUnit: 14410, materialCliente: false, qdeReferencia: 1, totalEsperado: 14410 },
  { cod: '8.8',  secao: 8, grupo: 'G1', descricao: 'Estrutura metálica septo de AC sobre o forro',              zona: 'estoque',       unidade: 'vb', mat: 5000, mo: 4980, vlrUnit: 9980,  materialCliente: false, qdeReferencia: 1, totalEsperado: 9980 },
  { cod: '8.9',  secao: 8, grupo: 'G1', descricao: 'Estrutura metálica auxiliar para porta de enrolar',         zona: 'fachada',       unidade: 'vb', mat: 5000, mo: 3980, vlrUnit: 8980,  materialCliente: false, qdeReferencia: 1, totalEsperado: 8980 },
  { cod: '8.11', secao: 8, grupo: 'G1', descricao: 'Adequação estrutural para elevador',                        zona: 'vendas',        unidade: 'vb', mat: 5000, mo: 5980, vlrUnit: 10980, materialCliente: false, qdeReferencia: 1, totalEsperado: 10980 },
  { cod: '8.14', secao: 8, grupo: 'G1', descricao: 'Porta de ferro — Casa de Máquinas',                         zona: 'área técnica',  unidade: 'un', mat: 2790, mo: 480,  vlrUnit: 3270,  materialCliente: false, qdeReferencia: 1, totalEsperado: 3270 },
  { cod: '8.15', secao: 8, grupo: 'G1', descricao: 'Porta corta-fogo — Docas',                                  zona: 'área técnica',  unidade: 'un', mat: 3760, mo: 650,  vlrUnit: 4410,  materialCliente: false, qdeReferencia: 1, totalEsperado: 4410 },
  { cod: '8.18', secao: 8, grupo: 'G1', descricao: 'Visor back office com vidro',                               zona: 'adm',           unidade: 'un', mat: 600,  mo: 400,  vlrUnit: 1000,  materialCliente: false, qdeReferencia: 1, totalEsperado: 1000 },
  { cod: '8.19', secao: 8, grupo: 'G1', descricao: 'Visor gerência com vidro',                                  zona: 'adm',           unidade: 'un', mat: 600,  mo: 400,  vlrUnit: 1000,  materialCliente: false, qdeReferencia: 1, totalEsperado: 1000 },
];

// ─── SEÇÃO 9 — Civil ─────────────────────────────────────────────────────────
const secao9: XlsxItem[] = [
  { cod: '9.1',  secao: 9, grupo: 'G2', descricao: 'Enchimento de contrapiso h=4cm',                         zona: '',              unidade: 'm2', mat: 0,    mo: 0,    vlrUnit: 0,     materialCliente: false, zerado: true },
  { cod: '9.3',  secao: 9, grupo: 'G2', descricao: 'Sóculos para bancadas',                                  zona: 'adm',           unidade: 'vb', mat: 840,  mo: 510,  vlrUnit: 1350,  materialCliente: false, qdeReferencia: 1, totalEsperado: 1350 },
  { cod: '9.4',  secao: 9, grupo: 'G2', descricao: 'Bases em concreto para equipamentos (AC, gerador, transformador)', zona: 'área técnica', unidade: 'vb', mat: 1879, mo: 970, vlrUnit: 2849, materialCliente: false, qdeReferencia: 1, totalEsperado: 2849 },
  { cod: '9.5',  secao: 9, grupo: 'G2', descricao: 'Alvenaria em tijolo/bloco de concreto',                 zona: 'adm',           unidade: 'm2', mat: 76,   mo: 34,   vlrUnit: 110,   materialCliente: false, qdeReferencia: 230, totalEsperado: 25300 },
  { cod: '9.7',  secao: 9, grupo: 'G2', descricao: 'Chapisco e emboço',                                     zona: 'adm',           unidade: 'm2', mat: 25.32, mo: 14.65, vlrUnit: 39.97, materialCliente: false, qdeReferencia: 460, totalEsperado: 18386 },
  { cod: '9.12', secao: 9, grupo: 'G2', descricao: 'Furação mecânica de lajes (esgotos + tubulações)',      zona: '',              unidade: 'vb', mat: 4150, mo: 1290, vlrUnit: 5440,  materialCliente: false, qdeReferencia: 1, totalEsperado: 5440 },
  { cod: '9.13', secao: 9, grupo: 'G2', descricao: 'Arremates gerais',                                      zona: '',              unidade: 'vb', mat: 4130, mo: 2260, vlrUnit: 6390,  materialCliente: false, qdeReferencia: 1, totalEsperado: 6390 },
];

// ─── SEÇÃO 10 — Impermeabilização ────────────────────────────────────────────
const secao10: XlsxItem[] = [
  { cod: '10.1', secao: 10, grupo: 'G2', descricao: 'Impermeabilização manta butílica/asfáltica — casa de máquinas + área técnica', zona: 'adm', unidade: 'm2', mat: 177.36, mo: 120.68, vlrUnit: 298.04, materialCliente: false, qdeReferencia: 43.7, totalEsperado: 13024 },
  { cod: '10.2', secao: 10, grupo: 'G2', descricao: 'Impermeabilização manta líquida — sanitários',         zona: 'adm',           unidade: 'm2', mat: 87.20,  mo: 52.40,  vlrUnit: 139.60, materialCliente: false, qdeReferencia: 28.87, totalEsperado: 4030 },
  { cod: '11.1', secao: 11, grupo: 'G2', descricao: 'Enchimento de juntas de dilatação com Vedaflex',       zona: '',              unidade: 'ml', mat: 0,      mo: 0,      vlrUnit: 0,      materialCliente: false, zerado: true },
];

// ─── SEÇÃO 12 — Paredes e Forros em Gesso ────────────────────────────────────
const secao12: XlsxItem[] = [
  { cod: '12.1', secao: 12, grupo: 'G3', descricao: 'Gesso Standard (STD) 1 face — salão de vendas',        zona: 'vendas',        unidade: 'm2', mat: 75.80, mo: 45.70, vlrUnit: 121.50, materialCliente: false, qdeReferencia: 672,  totalEsperado: 81648 },
  { cod: '12.2', secao: 12, grupo: 'G3', descricao: 'Gesso Standard (STD) 2 faces — salão de vendas',       zona: 'vendas',        unidade: 'm2', mat: 75.80, mo: 56.70, vlrUnit: 132.50, materialCliente: false, qdeReferencia: 274,  totalEsperado: 36305 },
  { cod: '12.3', secao: 12, grupo: 'G3', descricao: 'Gesso Resistente à Umidade (RU) 1 face — ADM',        zona: 'adm',           unidade: 'm2', mat: 90.20, mo: 58.45, vlrUnit: 148.65, materialCliente: false, qdeReferencia: 40.84, totalEsperado: 6071 },
  { cod: '12.4', secao: 12, grupo: 'G3', descricao: 'Gesso Resistente à Umidade (RU) 2 faces — ADM',       zona: 'adm',           unidade: 'm2', mat: 90.20, mo: 58.45, vlrUnit: 148.65, materialCliente: false, qdeReferencia: 98,   totalEsperado: 14568 },
  { cod: '12.5', secao: 12, grupo: 'G3', descricao: 'Gesso Resistente ao Fogo (RF) 1 face — área técnica', zona: 'área técnica',  unidade: 'm2', mat: 90.20, mo: 58.45, vlrUnit: 148.65, materialCliente: false, qdeReferencia: 3,    totalEsperado: 446 },
  { cod: '12.6', secao: 12, grupo: 'G3', descricao: 'Gesso Resistente ao Fogo (RF) 2 faces — área técnica', zona: 'área técnica', unidade: 'm2', mat: 104.20, mo: 58.45, vlrUnit: 162.65, materialCliente: false, qdeReferencia: 15,   totalEsperado: 2440 },
  { cod: '12.7', secao: 12, grupo: 'G3', descricao: 'Reforço em cedrinho para paredes',                     zona: '',              unidade: 'vb', mat: 5770,  mo: 2530,  vlrUnit: 8300,   materialCliente: false, qdeReferencia: 1,    totalEsperado: 8300 },
  { cod: '12.9', secao: 12, grupo: 'G3', descricao: 'Forro Gypsum liso tabicado estruturado e rejuntado',   zona: '',              unidade: 'm2', mat: 25.50, mo: 38.00, vlrUnit: 63.50,  materialCliente: false, qdeReferencia: 1457.44, totalEsperado: 92547 },
  { cod: '12.11', secao: 12, grupo: 'G3', descricao: 'Alçapão (acesso à plenum)',                           zona: '',              unidade: 'un', mat: 153,   mo: 64,    vlrUnit: 217,    materialCliente: false, qdeReferencia: 15,   totalEsperado: 3255 },
  { cod: '12.12', secao: 12, grupo: 'G3', descricao: 'Abertura forro para luminárias/spots/wall washer',   zona: '',              unidade: 'un', mat: 0,     mo: 35,    vlrUnit: 35,     materialCliente: false, qdeReferencia: 176,  totalEsperado: 6160 },
  { cod: '12.13', secao: 12, grupo: 'G3', descricao: 'Reforço para placas aéreas CV + trilho vitrine',      zona: '',              unidade: 'vb', mat: 2489,  mo: 1300,  vlrUnit: 3789,   materialCliente: false, qdeReferencia: 1,    totalEsperado: 3789 },
];

// ─── SEÇÃO 13 — Divisórias ───────────────────────────────────────────────────
const secao13: XlsxItem[] = [
  { cod: '13.1', secao: 13, grupo: 'G2', descricao: 'Fechamento compartimentos — Divilux 35 / Formidur BP Plus / Eucatex', zona: 'adm', unidade: 'm2', mat: 118.20, mo: 87.00, vlrUnit: 205.20, materialCliente: false, qdeReferencia: 30, totalEsperado: 6156 },
  { cod: '13.2', secao: 13, grupo: 'G2', descricao: 'Porta cela sanitária Eucatex 0,60×1,65m',              zona: 'adm',           unidade: 'un', mat: 1068.40, mo: 144.30, vlrUnit: 1212.70, materialCliente: false, qdeReferencia: 10, totalEsperado: 12127 },
  { cod: '13.3', secao: 13, grupo: 'G2', descricao: 'Porta Eucatex maçaneta alavanca — abrir 1F',           zona: 'adm',           unidade: 'un', mat: 1382.30, mo: 232.45, vlrUnit: 1614.75, materialCliente: false, qdeReferencia: 3,  totalEsperado: 4844 },
  { cod: '13.5', secao: 13, grupo: 'G2', descricao: 'Porta e ferragens vidro/alumínio — box chuveiro',      zona: 'adm',           unidade: 'un', mat: 989.20,  mo: 165.00, vlrUnit: 1154.20, materialCliente: false, qdeReferencia: 2,  totalEsperado: 2308 },
];

// ─── SEÇÃO 14 — Revestimento de Piso ─────────────────────────────────────────
const secao14: XlsxItem[] = [
  { cod: '14.1',  secao: 14, grupo: 'G4', descricao: 'Piso vinílico vendas/provadores (MO — mat. C&A)',     zona: 'vendas',  unidade: 'm2', mat: 0,      mo: 40.15, vlrUnit: 40.15,  materialCliente: true,  qdeReferencia: 1024.98, totalEsperado: 41153 },
  { cod: '14.2',  secao: 14, grupo: 'G4', descricao: 'Autonivelante vendas/provadores (MO — mat. C&A)',     zona: 'vendas',  unidade: 'm2', mat: 0,      mo: 14.20, vlrUnit: 14.20,  materialCliente: true,  qdeReferencia: 1024.98, totalEsperado: 14555 },
  { cod: '14.5',  secao: 14, grupo: 'G4', descricao: 'Rodapé Primer Tarket 10cm — SV',                      zona: 'vendas',  unidade: 'ml', mat: 20.00,  mo: 33.20, vlrUnit: 53.20,  materialCliente: false, qdeReferencia: 130.84, totalEsperado: 6961 },
  { cod: '14.6',  secao: 14, grupo: 'G4', descricao: 'Piso tátil (escada rolante + escada fixa)',            zona: 'vendas',  unidade: 'vb', mat: 220,    mo: 150,   vlrUnit: 370,    materialCliente: false, qdeReferencia: 16,     totalEsperado: 5920 },
  { cod: '14.7',  secao: 14, grupo: 'G4', descricao: 'Sóculos granito frente vitrine (largura 10cm)',        zona: 'fachada', unidade: 'ml', mat: 237.20, mo: 87.00, vlrUnit: 324.20, materialCliente: false, qdeReferencia: 7.12,   totalEsperado: 2308 },
  { cod: '14.8',  secao: 14, grupo: 'G4', descricao: 'Soleira granito Branco Cearense',                      zona: 'vendas',  unidade: 'ml', mat: 650,    mo: 360,   vlrUnit: 1010,   materialCliente: false, qdeReferencia: 11.4,   totalEsperado: 11514 },
  { cod: '14.11', secao: 14, grupo: 'G4', descricao: 'Cerâmica até 45×45cm Cargo Plus White Eliane (MO — mat. C&A)', zona: 'adm', unidade: 'm2', mat: 0, mo: 68.00, vlrUnit: 68.00, materialCliente: true, qdeReferencia: 361, totalEsperado: 24548 },
  { cod: '14.13', secao: 14, grupo: 'G4', descricao: 'Rodapé de madeira h=7cm',                              zona: 'adm',     unidade: 'ml', mat: 35.90,  mo: 17.43, vlrUnit: 53.33,  materialCliente: false, qdeReferencia: 42.5,   totalEsperado: 2267 },
  { cod: '14.14', secao: 14, grupo: 'G4', descricao: 'Rodapé de madeira h=20cm',                             zona: 'adm',     unidade: 'ml', mat: 43.67,  mo: 17.45, vlrUnit: 61.12,  materialCliente: false, qdeReferencia: 140.39, totalEsperado: 8581 },
  { cod: '14.16', secao: 14, grupo: 'G4', descricao: 'Revestimento escada (degrau + espelho) em Ardósia',   zona: 'adm',     unidade: 'vb', mat: 16210.56, mo: 0,   vlrUnit: 16210.56, materialCliente: false, qdeReferencia: 1,    totalEsperado: 16211 },
  { cod: '14.17', secao: 14, grupo: 'G4', descricao: 'Escada: piso tátil + fita antiderrapante',            zona: 'adm',     unidade: 'cj', mat: 1990,   mo: 970,   vlrUnit: 2960,   materialCliente: false, qdeReferencia: 1,     totalEsperado: 2960 },
  { cod: '14.19', secao: 14, grupo: 'G4', descricao: 'Soleira granito Cinza Andorinha',                      zona: 'adm',     unidade: 'ml', mat: 635.60, mo: 333.20, vlrUnit: 968.80, materialCliente: false, qdeReferencia: 5.88,  totalEsperado: 5697 },
];

// ─── SEÇÃO 15 — Revestimento de Parede ───────────────────────────────────────
const secao15: XlsxItem[] = [
  { cod: '15.1', secao: 15, grupo: 'G4', descricao: 'Azulejo branco junta a prumo',                         zona: 'adm',     unidade: 'm2', mat: 89.75, mo: 36.75, vlrUnit: 126.50, materialCliente: false, qdeReferencia: 81,   totalEsperado: 10247 },
  { cod: '15.2', secao: 15, grupo: 'G4', descricao: 'Perfil alumínio branco 1/2" meia altura',              zona: 'adm',     unidade: 'm',  mat: 32.20, mo: 16.00, vlrUnit: 48.20,  materialCliente: false, qdeReferencia: 23,   totalEsperado: 1109 },
  { cod: '15.3', secao: 15, grupo: 'G4', descricao: 'Arremate cantoneira alumínio quinas h=1,70m',          zona: 'adm',     unidade: 'm',  mat: 32.20, mo: 18.40, vlrUnit: 50.60,  materialCliente: false, qdeReferencia: 12,   totalEsperado: 607 },
];

// ─── SEÇÃO 16 — Mármores e Granitos ──────────────────────────────────────────
const secao16: XlsxItem[] = [
  { cod: '16.1', secao: 16, grupo: 'G4', descricao: 'Bancada granito cantina (balcão + área térmico)',      zona: 'adm',     unidade: 'm2', mat: 1785, mo: 1230, vlrUnit: 3015, materialCliente: false, qdeReferencia: 1.47, totalEsperado: 4432 },
  { cod: '16.2', secao: 16, grupo: 'G4', descricao: 'Bancada granito vestiários',                           zona: 'adm',     unidade: 'm2', mat: 1785, mo: 1230, vlrUnit: 3015, materialCliente: false, qdeReferencia: 2.18, totalEsperado: 6573 },
  { cod: '16.3', secao: 16, grupo: 'G4', descricao: 'Aparadores para bancada de vestiários',               zona: 'adm',     unidade: 'un', mat: 190,  mo: 78,   vlrUnit: 268,  materialCliente: false, qdeReferencia: 2,    totalEsperado: 536 },
  { cod: '16.4', secao: 16, grupo: 'G4', descricao: 'Nicho em granito nos box de chuveiro',                 zona: 'adm',     unidade: 'un', mat: 190,  mo: 78,   vlrUnit: 268,  materialCliente: false, qdeReferencia: 2,    totalEsperado: 536 },
];

// ─── SEÇÃO 17 — Louças e Metais ───────────────────────────────────────────────
const secao17: XlsxItem[] = [
  { cod: '17.1', secao: 17, grupo: 'G6', descricao: 'Cuba de inox — copa',                                  zona: 'adm',     unidade: 'un', mat: 900,  mo: 250, vlrUnit: 1150, materialCliente: false, qdeReferencia: 1, totalEsperado: 1150 },
  { cod: '17.2', secao: 17, grupo: 'G6', descricao: 'Cuba de embutir de louça oval (sanitários)',           zona: 'adm',     unidade: 'un', mat: 350,  mo: 150, vlrUnit: 500,  materialCliente: false, qdeReferencia: 4, totalEsperado: 2000 },
];

// ─── SEÇÃO 18 — Pintura ───────────────────────────────────────────────────────
const secao18: XlsxItem[] = [
  { cod: '18.1',  secao: 18, grupo: 'G3', descricao: 'Epóxi sobre cimentado — áreas técnicas',             zona: 'área técnica', unidade: 'm2', mat: 67.20, mo: 38.20, vlrUnit: 105.40, materialCliente: false, qdeReferencia: 39.61, totalEsperado: 4175 },
  { cod: '18.2',  secao: 18, grupo: 'G3', descricao: 'Pintura esmalte cor amarela — bases casa de máquinas', zona: 'área técnica', unidade: 'vb', mat: 1250, mo: 750, vlrUnit: 2000, materialCliente: false, qdeReferencia: 1, totalEsperado: 2000 },
  { cod: '18.3',  secao: 18, grupo: 'G3', descricao: 'Emassamento + pintura acrílica Branco Gelo — vendas', zona: 'vendas',       unidade: 'm2', mat: 30.68, mo: 22.90, vlrUnit: 53.58, materialCliente: false, qdeReferencia: 1153, totalEsperado: 61778 },
  { cod: '18.4',  secao: 18, grupo: 'G3', descricao: 'Emassamento + pintura acrílica Branco Neve — vendas', zona: 'vendas',       unidade: 'm2', mat: 30.68, mo: 22.90, vlrUnit: 53.58, materialCliente: false, qdeReferencia: 60,   totalEsperado: 3215 },
  { cod: '18.5',  secao: 18, grupo: 'G3', descricao: 'Emassamento + pintura acrílica Branco Gelo — ADM',   zona: 'adm',          unidade: 'm2', mat: 30.68, mo: 22.90, vlrUnit: 53.58, materialCliente: false, qdeReferencia: 708,  totalEsperado: 37935 },
  { cod: '18.8',  secao: 18, grupo: 'G3', descricao: 'Emassamento + pintura látex PVA Diário de Menina — ADM', zona: 'adm',      unidade: 'm2', mat: 23.88, mo: 15.89, vlrUnit: 39.77, materialCliente: false, qdeReferencia: 15,   totalEsperado: 597 },
  { cod: '18.10', secao: 18, grupo: 'G3', descricao: 'Emassamento + pintura Branco Neve — forro gesso vendas', zona: 'vendas',   unidade: 'm2', mat: 26.68, mo: 18.90, vlrUnit: 45.58, materialCliente: false, qdeReferencia: 1044, totalEsperado: 47586 },
  { cod: '18.11', secao: 18, grupo: 'G3', descricao: 'Emassamento + pintura Branco Neve — laje ADM/reservas', zona: 'adm',       unidade: 'm2', mat: 26.68, mo: 18.90, vlrUnit: 45.58, materialCliente: false, qdeReferencia: 408,  totalEsperado: 18597 },
  { cod: '18.12', secao: 18, grupo: 'G3', descricao: 'Emassamento + pintura Diário de Menina — forro ADM', zona: 'adm',          unidade: 'm2', mat: 23.68, mo: 18.90, vlrUnit: 42.58, materialCliente: false, qdeReferencia: 8.6,  totalEsperado: 366 },
  { cod: '18.18', secao: 18, grupo: 'G3', descricao: 'Pintura epóxi amarelo — corrimão metálico',          zona: 'adm',          unidade: 'ml', mat: 44.70, mo: 15.89, vlrUnit: 60.59, materialCliente: false, qdeReferencia: 39.9, totalEsperado: 2418 },
];

// ─── SEÇÃO 19 — Vidros e Espelhos ────────────────────────────────────────────
const secao19: XlsxItem[] = [
  { cod: '19.1', secao: 19, grupo: 'G4', descricao: 'Espelho Cristal 4mm c/ moldura alumínio — sobre bancada sanitário', zona: 'adm', unidade: 'un', mat: 498.30, mo: 196.19, vlrUnit: 694.49, materialCliente: false, qdeReferencia: 4,    totalEsperado: 2778 },
  { cod: '19.2', secao: 19, grupo: 'G4', descricao: 'Espelho Cristal 4mm vertical c/ moldura — vestiários 1,40×0,50m', zona: 'adm', unidade: 'un', mat: 498.30, mo: 196.19, vlrUnit: 694.49, materialCliente: false, qdeReferencia: 2,    totalEsperado: 1389 },
  { cod: '19.4', secao: 19, grupo: 'G4', descricao: 'Vidro temperado incolor 10mm — vitrine',                zona: 'fachada', unidade: 'm2', mat: 432.70, mo: 168.90, vlrUnit: 601.60, materialCliente: false, qdeReferencia: 11.61, totalEsperado: 6985 },
];

// ─── SEÇÃO 20 — Portas em Madeira ────────────────────────────────────────────
const secao20: XlsxItem[] = [
  { cod: '20.2', secao: 20, grupo: 'G6', descricao: 'Porta madeira folhada 0,72×2,10m',                     zona: 'adm', unidade: 'un', mat: 1576,  mo: 285, vlrUnit: 1861,  materialCliente: false, qdeReferencia: 2, totalEsperado: 3722 },
  { cod: '20.3', secao: 20, grupo: 'G6', descricao: 'Porta madeira folhada 0,82×2,10m',                     zona: 'adm', unidade: 'un', mat: 1776,  mo: 285, vlrUnit: 2061,  materialCliente: false, qdeReferencia: 6, totalEsperado: 12366 },
  { cod: '20.4', secao: 20, grupo: 'G6', descricao: 'Porta madeira c/ visor 0,92×2,10m — Cantina',          zona: 'adm', unidade: 'un', mat: 1876,  mo: 285, vlrUnit: 2161,  materialCliente: false, qdeReferencia: 1, totalEsperado: 2161 },
  { cod: '20.5', secao: 20, grupo: 'G6', descricao: 'Porta madeira c/ visor 0,92×2,10m — Sala CFTV',        zona: 'adm', unidade: 'un', mat: 2110,  mo: 285, vlrUnit: 2395,  materialCliente: false, qdeReferencia: 1, totalEsperado: 2395 },
  { cod: '20.6', secao: 20, grupo: 'G6', descricao: 'Mola para porta',                                       zona: 'adm', unidade: 'un', mat: 325.60, mo: 95.40, vlrUnit: 421, materialCliente: false, qdeReferencia: 2, totalEsperado: 842 },
  { cod: '20.7', secao: 20, grupo: 'G6', descricao: 'Tetra-chave',                                           zona: 'adm', unidade: 'un', mat: 289.40, mo: 145, vlrUnit: 434.40, materialCliente: false, qdeReferencia: 1, totalEsperado: 434 },
  { cod: '20.8', secao: 20, grupo: 'G6', descricao: 'Prendedor de porta',                                    zona: 'adm', unidade: 'un', mat: 100,  mo: 80,    vlrUnit: 180,   materialCliente: false, qdeReferencia: 4, totalEsperado: 720 },
];

// ─── SEÇÃO 21 — Marcenaria Área de Vendas ────────────────────────────────────
const secao21: XlsxItem[] = [
  { cod: '21.4',  secao: 21, grupo: 'G6', descricao: 'Réguas para união de painéis',                         zona: 'vendas', unidade: 'm',  mat: 28.50,  mo: 18.87,  vlrUnit: 47.37,  materialCliente: false, qdeReferencia: 10, totalEsperado: 474 },
  { cod: '21.6',  secao: 21, grupo: 'G6', descricao: 'Revestimento de colunas — padrão Ártico TX',           zona: 'vendas', unidade: 'un', mat: 2376,   mo: 1740,   vlrUnit: 4116,   materialCliente: false, qdeReferencia: 3,  totalEsperado: 12348 },
  { cod: '21.9',  secao: 21, grupo: 'G6', descricao: 'Espelho 4mm incolor Guardian class',                   zona: 'vendas', unidade: 'm2', mat: 480,    mo: 168,    vlrUnit: 648,    materialCliente: false, qdeReferencia: 3,  totalEsperado: 1944 },
  { cod: '21.10', secao: 21, grupo: 'G6', descricao: 'Porta simples Ártico TX 0,80m',                        zona: 'vendas', unidade: 'un', mat: 624.02, mo: 229.43, vlrUnit: 853.44, materialCliente: false, qdeReferencia: 1,  totalEsperado: 853 },
  { cod: '21.11', secao: 21, grupo: 'G6', descricao: 'Porta simples Ártico TX 1,00m',                        zona: 'vendas', unidade: 'un', mat: 724.02, mo: 229.43, vlrUnit: 953.44, materialCliente: false, qdeReferencia: 2,  totalEsperado: 1907 },
  { cod: '21.12', secao: 21, grupo: 'G6', descricao: 'Porta dupla 1,20m Ártico TX',                          zona: 'vendas', unidade: 'un', mat: 824.02, mo: 229.43, vlrUnit: 1053.44, materialCliente: false, qdeReferencia: 1, totalEsperado: 1053 },
  { cod: '21.13', secao: 21, grupo: 'G6', descricao: 'Porta vai-vem Ártico TX',                               zona: 'vendas', unidade: 'un', mat: 2640,   mo: 410,    vlrUnit: 3050,   materialCliente: false, qdeReferencia: 1,  totalEsperado: 3050 },
  { cod: '21.14', secao: 21, grupo: 'G6', descricao: 'Caixa para hidrantes',                                  zona: 'vendas', unidade: 'un', mat: 1090,   mo: 490,    vlrUnit: 1580,   materialCliente: false, qdeReferencia: 3,  totalEsperado: 4740 },
  { cod: '21.15', secao: 21, grupo: 'G6', descricao: 'Vidro temperado hidrante c/ ferragens',                 zona: 'vendas', unidade: 'un', mat: 660,    mo: 240,    vlrUnit: 900,    materialCliente: false, qdeReferencia: 3,  totalEsperado: 2700 },
  { cod: '21.16', secao: 21, grupo: 'G6', descricao: 'Arquibancada: tablado MDP Branco 18mm + metalon',      zona: 'vendas', unidade: 'un', mat: 0,      mo: 1228.29, vlrUnit: 1228.29, materialCliente: false, qdeReferencia: 1, totalEsperado: 1228 },
  { cod: '21.18', secao: 21, grupo: 'G6', descricao: 'Tubo aço inox 2" — alimentação caixa geral',          zona: 'vendas', unidade: 'un', mat: 368,    mo: 95,     vlrUnit: 463,    materialCliente: false, qdeReferencia: 2,  totalEsperado: 926 },
  { cod: '21.19', secao: 21, grupo: 'G6', descricao: 'Estrado c/ laminado branco para vitrine',              zona: 'vendas', unidade: 'm2', mat: 129.41, mo: 98.32,  vlrUnit: 227.72, materialCliente: false, qdeReferencia: 8,  totalEsperado: 1822 },
  { cod: '21.20', secao: 21, grupo: 'G6', descricao: 'Estrutura metálica metalon para estrados',             zona: 'vendas', unidade: 'm2', mat: 992.45, mo: 423.67, vlrUnit: 1416.12, materialCliente: false, qdeReferencia: 6.3, totalEsperado: 8922 },
  { cod: '21.21', secao: 21, grupo: 'G6', descricao: 'Fixadores de teto',                                    zona: 'vendas', unidade: 'un', mat: 93.20,  mo: 63.40,  vlrUnit: 156.60, materialCliente: false, qdeReferencia: 6,  totalEsperado: 940 },
];

// ─── SEÇÃO 22 — Provadores ───────────────────────────────────────────────────
const secao22: XlsxItem[] = [
  { cod: '22.1',  secao: 22, grupo: 'G5', descricao: 'Laminado Fórmica Ártico L166 TX — cabines provador',  zona: 'provador', unidade: 'm2', mat: 378.10, mo: 247, vlrUnit: 625.10, materialCliente: false, qdeReferencia: 42,  totalEsperado: 26254 },
  { cod: '22.2',  secao: 22, grupo: 'G5', descricao: 'Laminado Fórmica Gelo L106 TX — cabines provador',    zona: 'provador', unidade: 'm2', mat: 378.10, mo: 247, vlrUnit: 625.10, materialCliente: false, qdeReferencia: 25,  totalEsperado: 15628 },
  { cod: '22.3',  secao: 22, grupo: 'G5', descricao: 'Laminado Fórmica Branco L120TX — cabines provador',   zona: 'provador', unidade: 'm2', mat: 378.10, mo: 247, vlrUnit: 625.10, materialCliente: false, qdeReferencia: 243, totalEsperado: 151899 },
  { cod: '22.4',  secao: 22, grupo: 'G5', descricao: 'Laminado Fórmica Cobalto L118 TX — cabines provador', zona: 'provador', unidade: 'm2', mat: 428.10, mo: 247, vlrUnit: 675.10, materialCliente: false, qdeReferencia: 9,   totalEsperado: 6076 },
  { cod: '22.5',  secao: 22, grupo: 'G5', descricao: 'Laminado Fórmica Prattan L151 TX — cabines provador', zona: 'provador', unidade: 'm2', mat: 498.10, mo: 247, vlrUnit: 745.10, materialCliente: false, qdeReferencia: 30,  totalEsperado: 22353 },
  { cod: '22.7',  secao: 22, grupo: 'G5', descricao: 'Lateral de provador branca',                          zona: 'provador', unidade: 'un', mat: 138.65, mo: 124.20, vlrUnit: 262.85, materialCliente: false, qdeReferencia: 24, totalEsperado: 6308 },
  { cod: '22.8',  secao: 22, grupo: 'G5', descricao: 'Painel liso laminado branco',                         zona: 'provador', unidade: 'un', mat: 138.65, mo: 124.20, vlrUnit: 262.85, materialCliente: false, qdeReferencia: 9,  totalEsperado: 2366 },
  { cod: '22.9',  secao: 22, grupo: 'G5', descricao: 'Coluna simples (upright)',                             zona: 'provador', unidade: 'un', mat: 1340,   mo: 730,    vlrUnit: 2070,   materialCliente: false, qdeReferencia: 40, totalEsperado: 82800 },
  { cod: '22.10', secao: 22, grupo: 'G5', descricao: 'Régua para união de painéis — provador',              zona: 'provador', unidade: 'un', mat: 132,    mo: 37.80,  vlrUnit: 169.80, materialCliente: false, qdeReferencia: 30, totalEsperado: 5094 },
  { cod: '22.11', secao: 22, grupo: 'G5', descricao: 'Travessa — provador',                                  zona: 'provador', unidade: 'un', mat: 187.20, mo: 98.23,  vlrUnit: 285.43, materialCliente: false, qdeReferencia: 30, totalEsperado: 8563 },
  { cod: '22.12', secao: 22, grupo: 'G5', descricao: 'Frontal (frame de porta) — provador',                  zona: 'provador', unidade: 'un', mat: 623.13, mo: 223.13, vlrUnit: 846.26, materialCliente: false, qdeReferencia: 30, totalEsperado: 25388 },
  { cod: '22.13', secao: 22, grupo: 'G5', descricao: 'Suporte L para lateral — provador',                   zona: 'provador', unidade: 'un', mat: 87.10,  mo: 46.20,  vlrUnit: 133.30, materialCliente: false, qdeReferencia: 50, totalEsperado: 6665 },
  { cod: '22.14', secao: 22, grupo: 'G5', descricao: 'Rodapé MDF branco 10mm × 5,0cm (Tarket) — provador',  zona: 'provador', unidade: 'm',  mat: 76.23,  mo: 53.12,  vlrUnit: 129.35, materialCliente: false, qdeReferencia: 99.3, totalEsperado: 12844 },
  { cod: '22.15', secao: 22, grupo: 'G5', descricao: 'Rodapé fórmica Prattan 10cm — provador',              zona: 'provador', unidade: 'm',  mat: 73.74,  mo: 53.12,  vlrUnit: 126.86, materialCliente: false, qdeReferencia: 43.7, totalEsperado: 5544 },
  { cod: '22.17', secao: 22, grupo: 'G5', descricao: 'Espelho 4mm Guardian class — corredor provador',      zona: 'provador', unidade: 'un', mat: 574.09, mo: 167.40, vlrUnit: 741.49, materialCliente: false, qdeReferencia: 3,  totalEsperado: 2224 },
  { cod: '22.18', secao: 22, grupo: 'G5', descricao: 'Espelho 4mm Guardian class c/ cava iluminação LED — cabine provador', zona: 'provador', unidade: 'un', mat: 624.96, mo: 167.40, vlrUnit: 792.36, materialCliente: false, qdeReferencia: 25, totalEsperado: 19809 },
  { cod: '22.19', secao: 22, grupo: 'G5', descricao: 'Chassis para espelhos — cabine provador',             zona: 'provador', unidade: 'un', mat: 519.96, mo: 265.98, vlrUnit: 785.94, materialCliente: false, qdeReferencia: 25, totalEsperado: 19648 },
  { cod: '22.21', secao: 22, grupo: 'G5', descricao: 'Porta provador 70×180cm c/ dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 837.60, mo: 216, vlrUnit: 1053.60, materialCliente: false, qdeReferencia: 21, totalEsperado: 22126 },
  { cod: '22.24', secao: 22, grupo: 'G5', descricao: 'Porta provador PNE c/ dobradiça, trinco e puxador',   zona: 'provador', unidade: 'un', mat: 900,    mo: 240,    vlrUnit: 1140,   materialCliente: false, qdeReferencia: 1,  totalEsperado: 1140 },
  { cod: '22.25', secao: 22, grupo: 'G5', descricao: 'Porta provador família c/ dobradiça, trinco e puxador', zona: 'provador', unidade: 'un', mat: 900,  mo: 340,    vlrUnit: 1240,   materialCliente: false, qdeReferencia: 2,  totalEsperado: 2480 },
  { cod: '22.26', secao: 22, grupo: 'G5', descricao: 'Porta de correr provador',                             zona: 'provador', unidade: 'un', mat: 1680,   mo: 300,    vlrUnit: 1980,   materialCliente: false, qdeReferencia: 1,  totalEsperado: 1980 },
  { cod: '22.28', secao: 22, grupo: 'G5', descricao: 'Arremates de cantos / Cantoneira alumínio — provador', zona: 'provador', unidade: 'un', mat: 89, mo: 68.30, vlrUnit: 157.30, materialCliente: false, qdeReferencia: 12, totalEsperado: 1888 },
  { cod: '22.29', secao: 22, grupo: 'G5', descricao: 'Cabideiro cromado — provador',                         zona: 'provador', unidade: 'un', mat: 58.20,  mo: 14.40,  vlrUnit: 72.60,  materialCliente: false, qdeReferencia: 23, totalEsperado: 1670 },
  { cod: '22.30', secao: 22, grupo: 'G5', descricao: 'Tubo aço inox PNE 160cm',                              zona: 'provador', unidade: 'un', mat: 1032.60, mo: 95,   vlrUnit: 1127.60, materialCliente: false, qdeReferencia: 1, totalEsperado: 1128 },
  { cod: '22.31', secao: 22, grupo: 'G5', descricao: 'Tubo aço inox PNE 80cm',                               zona: 'provador', unidade: 'un', mat: 590,    mo: 95,     vlrUnit: 685,    materialCliente: false, qdeReferencia: 2,  totalEsperado: 1370 },
];

// ─── SEÇÃO 23 — Fachadas ─────────────────────────────────────────────────────
const secao23: XlsxItem[] = [
  { cod: '23.1', secao: 23, grupo: 'G6', descricao: 'Arremates de cantos / Cantoneira alumínio — fachada',  zona: 'fachada', unidade: 'un', mat: 89,    mo: 68.30, vlrUnit: 157.30, materialCliente: false, qdeReferencia: 2,    totalEsperado: 315 },
  { cod: '23.2', secao: 23, grupo: 'G6', descricao: 'Vitrines: tablado MDP Branco + estrutura metalon interna', zona: 'fachada', unidade: 'un', mat: 1440, mo: 1330, vlrUnit: 2770, materialCliente: false, qdeReferencia: 1, totalEsperado: 2770 },
  { cod: '23.4', secao: 23, grupo: 'G6', descricao: 'Revestimento ACM Branco Brilho',                        zona: 'fachada', unidade: 'm2', mat: 380,   mo: 259,   vlrUnit: 639,    materialCliente: false, qdeReferencia: 55.68, totalEsperado: 35580 },
  { cod: '23.9', secao: 23, grupo: 'G6', descricao: 'Rodapé aço inox escovado 200mm',                        zona: 'fachada', unidade: 'm',  mat: 256,   mo: 119,   vlrUnit: 375,    materialCliente: false, qdeReferencia: 9.36,  totalEsperado: 3510 },
];

// ─── SEÇÃO 24 — Marcenaria e Enxoval — Estoque e ADM ─────────────────────────
const secao24: XlsxItem[] = [
  { cod: '24.1',  secao: 24, grupo: 'G6', descricao: 'Armário suspenso — refeitório',                       zona: 'adm', unidade: 'un', mat: 2175, mo: 460,  vlrUnit: 2635,  materialCliente: false, qdeReferencia: 1, totalEsperado: 2635 },
  { cod: '24.2',  secao: 24, grupo: 'G6', descricao: 'Bancada / armário da copa',                            zona: 'adm', unidade: 'un', mat: 2160, mo: 950,  vlrUnit: 3110,  materialCliente: false, qdeReferencia: 1, totalEsperado: 3110 },
  { cod: '24.3',  secao: 24, grupo: 'G6', descricao: 'Armário suspenso + bancada — sala da gerência',       zona: 'adm', unidade: 'un', mat: 2170, mo: 950,  vlrUnit: 3120,  materialCliente: false, qdeReferencia: 1, totalEsperado: 3120 },
  { cod: '24.5',  secao: 24, grupo: 'G6', descricao: 'Moldura para cofre — boca de lobo',                   zona: 'adm', unidade: 'un', mat: 925,  mo: 260,  vlrUnit: 1185,  materialCliente: false, qdeReferencia: 1, totalEsperado: 1185 },
  { cod: '24.6',  secao: 24, grupo: 'G6', descricao: 'Estante sala de rack',                                 zona: 'adm', unidade: 'un', mat: 1320, mo: 260,  vlrUnit: 1580,  materialCliente: false, qdeReferencia: 1, totalEsperado: 1580 },
  { cod: '24.7',  secao: 24, grupo: 'G6', descricao: 'Armário boca de lobo — sala da gerência',             zona: 'adm', unidade: 'un', mat: 1315, mo: 180,  vlrUnit: 1495,  materialCliente: false, qdeReferencia: 1, totalEsperado: 1495 },
  { cod: '24.8',  secao: 24, grupo: 'G6', descricao: 'Base de alumínio para bebedouro',                     zona: 'adm', unidade: 'un', mat: 1190, mo: 0,    vlrUnit: 1190,  materialCliente: false, qdeReferencia: 2, totalEsperado: 2380 },
  { cod: '24.9',  secao: 24, grupo: 'G6', descricao: 'Filtro para bebedouro Aqualar',                        zona: 'adm', unidade: 'un', mat: 735,  mo: 0,    vlrUnit: 735,   materialCliente: false, qdeReferencia: 2, totalEsperado: 1470 },
  { cod: '24.10', secao: 24, grupo: 'G6', descricao: 'Porta e tampa de alumínio para lixeira copa',         zona: 'adm', unidade: 'un', mat: 920,  mo: 0,    vlrUnit: 920,   materialCliente: false, qdeReferencia: 2, totalEsperado: 1840 },
  { cod: '24.11', secao: 24, grupo: 'G6', descricao: 'Suporte para TV, Projetor e Microondas',              zona: 'adm', unidade: 'un', mat: 545,  mo: 95,   vlrUnit: 640,   materialCliente: false, qdeReferencia: 3, totalEsperado: 1920 },
  { cod: '24.12', secao: 24, grupo: 'G6', descricao: 'Lixeira para bancada da cantina',                     zona: 'adm', unidade: 'un', mat: 376.12, mo: 0,  vlrUnit: 376.12, materialCliente: false, qdeReferencia: 1, totalEsperado: 376 },
  { cod: '24.13', secao: 24, grupo: 'G6', descricao: 'Lixeira para bancada dos sanitários',                 zona: 'adm', unidade: 'un', mat: 376,  mo: 0,    vlrUnit: 376,   materialCliente: false, qdeReferencia: 2, totalEsperado: 752 },
  { cod: '24.14', secao: 24, grupo: 'G6', descricao: 'Lixeira para vasos sanitários',                       zona: 'adm', unidade: 'un', mat: 298.30, mo: 0,  vlrUnit: 298.30, materialCliente: false, qdeReferencia: 6, totalEsperado: 1790 },
  { cod: '24.15', secao: 24, grupo: 'G6', descricao: 'Portinhola branca para correio pneumático',           zona: 'vendas', unidade: 'un', mat: 436, mo: 83.65, vlrUnit: 519.65, materialCliente: false, qdeReferencia: 1, totalEsperado: 520 },
  { cod: '24.16', secao: 24, grupo: 'G6', descricao: 'Locker para vestiário',                               zona: 'adm', unidade: 'un', mat: 560,  mo: 156,  vlrUnit: 716,   materialCliente: false, qdeReferencia: 3, totalEsperado: 2148 },
];

// ─── SEÇÃO 25 — Omissos ───────────────────────────────────────────────────────
const secao25: XlsxItem[] = [
  { cod: '25.1', secao: 25, grupo: 'G2', descricao: 'Proteção eletromagnética manta aluminizada (RFID)',   zona: '',  unidade: 'm2', mat: 70,   mo: 50,  vlrUnit: 120,     materialCliente: false, qdeReferencia: 158,   totalEsperado: 18960 },
  { cod: '25.2', secao: 25, grupo: 'G2', descricao: 'Alvenaria em bloco celular',                          zona: '',  unidade: 'm2', mat: 66.30, mo: 28.50, vlrUnit: 94.80,  materialCliente: false, qdeReferencia: 10,    totalEsperado: 948 },
  { cod: '25.3', secao: 25, grupo: 'G4', descricao: 'Revestimento escada — degrau + espelho Granito Branco Cearense', zona: '', unidade: 'm2', mat: 900, mo: 250, vlrUnit: 1150, materialCliente: false, qdeReferencia: 10.73, totalEsperado: 12340 },
  { cod: '25.4', secao: 25, grupo: 'G4', descricao: 'Rodapé escada provadores — Granito Branco Cearense',  zona: '',  unidade: 'ml', mat: 879,  mo: 250, vlrUnit: 1129,    materialCliente: false, qdeReferencia: 16.21, totalEsperado: 18301 },
  { cod: '25.5', secao: 25, grupo: 'G4', descricao: 'Rodapé MDP Branco',                                   zona: '',  unidade: 'ml', mat: 340,  mo: 189, vlrUnit: 529,     materialCliente: false, qdeReferencia: 5.05,  totalEsperado: 2671 },
  { cod: '25.7', secao: 25, grupo: 'G4', descricao: 'Grama sintética — sala descompressão',                zona: '',  unidade: 'm2', mat: 393.30, mo: 296.80, vlrUnit: 690.10, materialCliente: false, qdeReferencia: 10, totalEsperado: 6901 },
];

// ─── Tabela completa indexada por código ──────────────────────────────────────
export const XLSX_ITENS: XlsxItem[] = [
  ...secaoA, ...secao7, ...secao8,
  ...secao9, ...secao10,
  ...secao12, ...secao13,
  ...secao14, ...secao15, ...secao16,
  ...secao17,
  ...secao18,
  ...secao19,
  ...secao20, ...secao21,
  ...secao22,
  ...secao23, ...secao24, ...secao25,
];

// Lookup por código: O(1)
export const XLSX_POR_COD: Record<string, XlsxItem> = Object.fromEntries(
  XLSX_ITENS.map((it) => [it.cod, it])
);

// Lookup por grupo: todos os itens de um grupo especialista
export function checklistDoGrupo(grupo: GrupoEspecialista): XlsxItem[] {
  return XLSX_ITENS.filter((it) => it.grupo === grupo);
}

// Totais esperados por seção (para auditoria)
export const TOTAIS_XLSX_POR_SECAO: Record<string, number> = {
  'A':  234410,
  '7':  10000,
  '8':  61738,
  '9':  59715,
  '10': 17055,
  '11': 0,
  '12': 255529,
  '13': 25436,
  '14': 142673,
  '15': 11962,
  '16': 12077,
  '17': 3150,
  '18': 178665,
  '19': 11152,
  '20': 22640,
  '21': 41678,
  '22': 453244,
  '23': 42174,
  '24': 26321,
  '25': 60121,
};

export const TOTAL_GERAL_XLSX = 1670968;
