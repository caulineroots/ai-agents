// ─── Cálculo — Orçamento de Construtora ──────────────────────────────────────
// A multiplicação é feita por item: quantidade × vlrUnit = vlrTotal.
// Preços reais da 1ª Proposta CELMAR BLN (MAT + M.OBRA).
// Lookup: exact → keyword → partial → fallback por categoria.

import type {
  FolhaOrcamento,
  ItemOrcamento,
  ItemOrcado,
  Categoria,
  ResultadoOrcamento,
} from './types';

// ─── Tabela de preços CELMAR BLN — 1ª Proposta (MAT + M.OBRA) ─────────────────
// Fonte: AI-Agents/lib/construtora/tabela-precos.js
// Chave: descrição do serviço (case-insensitive). Valor: MAT + M.OBRA em R$.
// Itens com materialCliente=true: cobrar apenas M.OBRA.
// ORDEM IMPORTA: entradas mais específicas devem vir antes das genéricas.
const TABELA_CELMAR: Array<{ descricao: string; vlr: number; categoria?: Categoria; keywords?: string[] }> = [
  // ── Custos indiretos / mobilização ───────────────────────────────────────────
  { descricao: 'ART contemplando todos os serviços + placa de obra', categoria: 'outro', vlr: 1100, keywords: ['ART', 'placa de obra'] },
  { descricao: 'Seguro de obra com responsabilidade civil', categoria: 'outro', vlr: 3400, keywords: ['seguro de obra'] },
  { descricao: 'Topografia', categoria: 'outro', vlr: 2420, keywords: ['topografia'] },
  { descricao: 'Tapume em placas de divisória', categoria: 'outro', vlr: 0, keywords: ['tapume'] },
  { descricao: 'EPI e comunicação visual', categoria: 'outro', vlr: 3500, keywords: ['EPI', 'comunicação visual'] },
  { descricao: 'Vigilância noturna', categoria: 'outro', vlr: 150, keywords: ['vigilância'] },
  { descricao: 'Dependências para administração da obra', categoria: 'outro', vlr: 23780, keywords: ['canteiro', 'dependências admin'] },
  { descricao: 'Material de limpeza e administrativo', categoria: 'outro', vlr: 3500, keywords: ['material de limpeza'] },
  { descricao: 'Extintores para a obra + bebedouro', categoria: 'outro', vlr: 1830, keywords: ['extintor'] },
  { descricao: 'Ligação elétrica canteiro', categoria: 'outro', vlr: 3500, keywords: ['ligação elétrica canteiro'] },
  { descricao: 'Iluminação provisória', categoria: 'outro', vlr: 3400, keywords: ['iluminação provisória'] },
  { descricao: 'Eletricista durante a obra', categoria: 'outro', vlr: 4500, keywords: ['eletricista obra'] },
  { descricao: 'Lona proteção piso e marcenaria', categoria: 'outro', vlr: 4580, keywords: ['lona proteção'] },
  { descricao: 'Retirada de entulhos e caçamba', categoria: 'outro', vlr: 8200, keywords: ['entulho', 'caçamba', 'bota-fora'] },
  { descricao: 'Locação de equipamentos manuais', categoria: 'outro', vlr: 6900, keywords: ['locação equipamentos'] },
  { descricao: 'Transporte vertical e horizontal', categoria: 'outro', vlr: 9700, keywords: ['transporte vertical', 'transporte horizontal'] },
  { descricao: 'Engenheiro residente', categoria: 'outro', vlr: 10500, keywords: ['engenheiro residente'] },
  { descricao: 'Técnico de segurança', categoria: 'outro', vlr: 3500, keywords: ['técnico de segurança', 'CIPA'] },
  { descricao: 'Estadias e refeições', categoria: 'outro', vlr: 35000, keywords: ['estadia', 'refeição', 'hospedagem'] },
  { descricao: 'Mobilização e desmobilização', categoria: 'outro', vlr: 28000, keywords: ['mobilização', 'desmobilização'] },
  { descricao: 'Limpeza permanente da obra', categoria: 'outro', vlr: 5000, keywords: ['limpeza permanente'] },
  { descricao: 'Limpeza final de obra', categoria: 'outro', vlr: 9000, keywords: ['limpeza final'] },

  // ── Demolição / adaptação de shell ────────────────────────────────────────────
  { descricao: 'Demolições e retiradas', categoria: 'civil', vlr: 10000, keywords: ['demolição', 'demolir', 'retirada'] },

  // ── Serralheria ───────────────────────────────────────────────────────────────
  { descricao: 'Guarda corpo de ferro com pintura', categoria: 'civil', vlr: 405.7, keywords: ['guarda corpo ferro'] },
  { descricao: 'Estrutura metálica fachada', categoria: 'fachada', vlr: 14410, keywords: ['estrutura metálica fachada', 'metalon fachada'] },
  { descricao: 'Estrutura metálica septo AC', categoria: 'climatizacao', vlr: 9980, keywords: ['septo AC', 'septo ar condicionado'] },
  { descricao: 'Estrutura metálica porta de enrolar', categoria: 'civil', vlr: 8980, keywords: ['estrutura porta enrolar'] },
  { descricao: 'Adequação estrutural para elevador', categoria: 'civil', vlr: 10980, keywords: ['estrutura elevador'] },
  { descricao: 'Porta de ferro circulação', categoria: 'civil', vlr: 4400, keywords: ['porta ferro circulação', 'porta metálica circulação'] },
  { descricao: 'Porta de ferro gerador', categoria: 'civil', vlr: 0, keywords: ['porta ferro gerador', 'porta gerador'] },
  { descricao: 'Porta de ferro casa de máquinas', categoria: 'civil', vlr: 3270, keywords: ['porta casa de máquinas'] },
  { descricao: 'Porta corta-fogo docas', categoria: 'civil', vlr: 4410, keywords: ['porta corta-fogo', 'porta docas'] },
  { descricao: 'Visor back office com vidro', categoria: 'vidros', vlr: 1000, keywords: ['visor back office'] },
  { descricao: 'Visor gerência com vidro', categoria: 'vidros', vlr: 1000, keywords: ['visor gerência'] },

  // ── Civil ─────────────────────────────────────────────────────────────────────
  { descricao: 'Enchimento de contrapiso', categoria: 'civil', vlr: 0, keywords: ['contrapiso', 'enchimento piso'] },
  { descricao: 'Piso cimentado áreas técnicas', categoria: 'civil', vlr: 0, keywords: ['piso cimentado', 'área técnica'] },
  { descricao: 'Sóculos em concreto para bancadas', categoria: 'civil', vlr: 1350, keywords: ['sóculo', 'sóculos concreto'] },
  { descricao: 'Bases em concreto para equipamentos', categoria: 'civil', vlr: 2849, keywords: ['base concreto equipamento', 'base AC', 'base gerador'] },
  // Alvenaria bloco de concreto — mais específico antes de "alvenaria bloco"
  { descricao: 'Alvenaria em bloco de concreto 14cm', categoria: 'civil', vlr: 132.5, keywords: ['bloco de concreto 14cm', 'alvenaria bloco de concreto', 'alvenaria em bloco de concreto'] },
  { descricao: 'Alvenaria em tijolo/bloco de concreto', categoria: 'civil', vlr: 110, keywords: ['alvenaria tijolo', 'alvenaria bloco', 'alvenaria concreto'] },
  { descricao: 'Alvenaria em bloco sical', categoria: 'civil', vlr: 0, keywords: ['bloco sical', 'alvenaria sical'] },
  { descricao: 'Alvenaria em bloco celular', categoria: 'civil', vlr: 94.8, keywords: ['bloco celular', 'alvenaria celular'] },
  { descricao: 'Chapisco e emboço', categoria: 'civil', vlr: 39.97, keywords: ['chapisco', 'emboço', 'reboco'] },
  { descricao: 'Furação mecânica de lajes', categoria: 'civil', vlr: 5440, keywords: ['furação laje', 'furo laje', 'tubulações laje'] },
  { descricao: 'Arremates gerais', categoria: 'civil', vlr: 6390, keywords: ['arremate geral'] },
  { descricao: 'Painel OSB', categoria: 'civil', vlr: 85, keywords: ['madeirite osb', 'painel osb', 'OSB'] },

  // ── Impermeabilização ─────────────────────────────────────────────────────────
  // Manta líquida primeiro para ter prioridade sobre a butílica
  { descricao: 'Impermeabilização manta líquida', categoria: 'civil', vlr: 139.6, keywords: ['manta líquida', 'impermeabilização líquida', 'impermeabilização sanitário', 'impermeabilização box', 'impermeabilização banheiro', 'impermeabilização copa', 'manta liquida'] },
  { descricao: 'Impermeabilização manta butílica/asfáltica', categoria: 'civil', vlr: 298.04, keywords: ['impermeabilização manta', 'manta butílica', 'manta asfáltica', 'impermeabilização manta asfáltica', 'impermeabilização'] },

  // ── Gesso / Drywall ───────────────────────────────────────────────────────────
  // Tipos específicos primeiro, genérico por último
  { descricao: 'Forro de gesso liso tabicado', categoria: 'civil', vlr: 63.5, keywords: ['forro gesso', 'forro gypsum', 'forro tabicado', 'forro drywall', 'teto gesso', 'forro em gesso', 'forro liso gesso', 'execução de forro de gesso', 'execução forro gesso'] },
  { descricao: 'Parede gesso RF 2 faces', categoria: 'civil', vlr: 162.65, keywords: ['gesso rf rf', 'drywall rf rf', 'rf/rf', 'drywall rf/rf'] },
  { descricao: 'Parede gesso RF', categoria: 'civil', vlr: 148.65, keywords: ['gesso RF', 'drywall RF', 'resistente fogo', 'corta fogo gesso'] },
  { descricao: 'Parede gesso RU 2 faces', categoria: 'civil', vlr: 148.65, keywords: ['gesso ru ru', 'drywall ru ru', 'ru/ru', 'drywall ru/ru'] },
  { descricao: 'Parede gesso RU', categoria: 'civil', vlr: 148.65, keywords: ['gesso RU', 'drywall RU', 'resistente umidade', 'placa verde', 'gypsum RU'] },
  { descricao: 'Parede gesso STD 2 faces', categoria: 'civil', vlr: 132.5, keywords: ['gesso st st', 'drywall st st', 'gesso st/st', 'drywall st/st', 'placas de gesso std 2 faces', 'duas faces gesso'] },
  // "drywall" genérico — DEVE vir depois dos tipos específicos acima
  { descricao: 'Parede gesso drywall simples', categoria: 'civil', vlr: 121.5, keywords: ['parede gesso', 'drywall', 'divisória gesso', 'vedação gesso', 'parede drywall', 'parede gesso simples', 'execução drywall', 'instalação drywall', 'placas de gesso'] },
  { descricao: 'Reforço em cedrinho para paredes de gesso', categoria: 'civil', vlr: 8300, keywords: ['reforço cedrinho'] },
  { descricao: 'Alçapão no forro de gesso', categoria: 'civil', vlr: 217, keywords: ['alçapão'] },
  { descricao: 'Abertura forro gesso para luminária', categoria: 'civil', vlr: 35, keywords: ['abertura forro', 'furo forro', 'spot forro'] },
  { descricao: 'Reforço forro para placas', categoria: 'civil', vlr: 3789, keywords: ['reforço forro'] },

  // ── Divisórias ────────────────────────────────────────────────────────────────
  { descricao: 'Divisória Divilux', categoria: 'civil', vlr: 205.2, keywords: ['divilux', 'divisória eucatex', 'divisória formidur'] },
  { descricao: 'Porta sanitário 0.60m', categoria: 'marcenaria', vlr: 1212.7, keywords: ['porta sanitário', 'porta WC', 'porta banheiro'] },
  { descricao: 'Porta eucatex com maçaneta', categoria: 'marcenaria', vlr: 1614.75, keywords: ['porta eucatex'] },
  { descricao: 'Porta vidro alumínio para chuveiro', categoria: 'vidros', vlr: 1154.2, keywords: ['porta box', 'box chuveiro'] },

  // ── Revestimento de piso ──────────────────────────────────────────────────────
  // Piso tátil primeiro (mais específico)
  { descricao: 'Piso tátil escada', categoria: 'revestimento', vlr: 370, keywords: ['piso tátil', 'tátil', 'antiderrapante'] },
  { descricao: 'Assentamento piso vinílico salão de vendas', categoria: 'revestimento', vlr: 40.15, keywords: ['piso vinílico', 'piso vinyl', 'vinil', 'piso laminado vinílico', 'piso lvt', 'laminado vinílico', 'tarket'] },
  { descricao: 'Autonivelante', categoria: 'civil', vlr: 14.2, keywords: ['autonivelante', 'auto nivelante', 'regularização piso'] },
  { descricao: 'Argamassa e rejunte para piso cerâmico', categoria: 'revestimento', vlr: 0, keywords: ['rejunte piso', 'argamassa piso'] },
  { descricao: 'Aplicação de piso cerâmico ADM', categoria: 'revestimento', vlr: 68, keywords: ['piso cerâmico ADM', 'piso ADM', 'piso cerâmico copa', 'piso cerâmico copa/sanitários', 'piso cerâmico sanitário', 'piso cerâmico banheiro', 'piso cerâmico', 'cerâmico piso', 'cerâmica piso', 'revestimento piso cerâmico', 'piso cerâmico área', 'cerâmica 20x20 piso'] },
  { descricao: 'Sóculo granito frente vitrine', categoria: 'revestimento', vlr: 324.2, keywords: ['sóculo granito vitrine'] },
  { descricao: 'Soleira em granito Branco Ceará', categoria: 'revestimento', vlr: 1010, keywords: ['soleira granito', 'soleira entrada'] },
  { descricao: 'Soleira granito Cinza Andorinha', categoria: 'revestimento', vlr: 968.8, keywords: ['soleira cinza andorinha'] },
  { descricao: 'Revestimento escada ardósia', categoria: 'revestimento', vlr: 16210.56, keywords: ['ardósia escada', 'revestimento ardósia'] },
  { descricao: 'Revestimento escada granito Branco Ceará', categoria: 'revestimento', vlr: 1150, keywords: ['granito branco ceará escada', 'revestimento escada granito'] },
  { descricao: 'Rodapé escada granito Branco Ceará', categoria: 'revestimento', vlr: 1129, keywords: ['rodapé escada granito'] },
  // Rodapé MDF branco para provadores — específico, vem antes dos genéricos
  { descricao: 'Rodapé MDF branco provador', categoria: 'marcenaria', vlr: 129.35, keywords: ['rodapé provador', 'rodapé mdf branco provador', 'rodapé em mdf branco 10mm tarket'] },
  { descricao: 'Rodapé Primer Tarket', categoria: 'revestimento', vlr: 53.2, keywords: ['rodapé tarket', 'rodapé vinyl', 'rodapé vinílico'] },
  { descricao: 'Rodapé de madeira 20cm', categoria: 'revestimento', vlr: 61.12, keywords: ['rodapé madeira 20'] },
  { descricao: 'Rodapé de madeira 7cm', categoria: 'revestimento', vlr: 53.33, keywords: ['rodapé madeira', 'rodapé MDF'] },
  { descricao: 'Rodapé MDP Branco', categoria: 'revestimento', vlr: 529, keywords: ['rodapé MDP', 'rodapé branco'] },
  // Tablado / plataforma piso
  { descricao: 'Tablado fixo MDP branco piso vendas', categoria: 'civil', vlr: 185, keywords: ['tablado fixo', 'tablado mdp', 'tablado mdf', 'tablado em mdp', 'tablado em mdf'] },

  // ── Revestimento de parede ─────────────────────────────────────────────────────
  { descricao: 'Azulejo branco junta a prumo', categoria: 'revestimento', vlr: 126.5, keywords: ['azulejo branco', 'cerâmica branca', 'azulejo sanitário', 'cerâmica 20x20', 'cerâmica eliane', 'cerâmica parede', 'revestimento cerâmico parede', 'cerâmica parede copa', 'cerâmica parede sanitário', 'revestimento parede cerâmica', 'cerâmica parede banheiro', 'revestimento parede banheiro', 'azulejo copa', 'azulejo banheiro', 'revestimento cerâmico de parede'] },
  { descricao: 'Perfil alumínio branco meia altura', categoria: 'revestimento', vlr: 48.2, keywords: ['perfil alumínio meia altura'] },
  { descricao: 'Cantoneira alumínio quinas', categoria: 'revestimento', vlr: 50.6, keywords: ['cantoneira alumínio quina'] },

  // ── Mármores e granitos ───────────────────────────────────────────────────────
  { descricao: 'Bancada em granito cantina/balcão', categoria: 'revestimento', vlr: 3015, keywords: ['bancada granito cantina', 'bancada granito balcão', 'bancada granito copa', 'tampo granito', 'tampo de granito', 'bancada granito', 'granito copa', 'granito bancada'] },
  { descricao: 'Bancada em granito vestiários', categoria: 'revestimento', vlr: 3015, keywords: ['bancada granito vestiário', 'bancada vestiário'] },
  { descricao: 'Aparadores para bancada vestiários', categoria: 'revestimento', vlr: 268, keywords: ['aparador bancada', 'suporte bancada'] },
  { descricao: 'Nicho em granito box chuveiro', categoria: 'revestimento', vlr: 268, keywords: ['nicho granito', 'nicho chuveiro'] },

  // ── Louças e metais ───────────────────────────────────────────────────────────
  { descricao: 'Cuba de inox copa', categoria: 'hidraulica', vlr: 1150, keywords: ['cuba inox', 'cuba de inox'] },
  { descricao: 'Cuba de embutir louça oval sanitários', categoria: 'hidraulica', vlr: 500, keywords: ['cuba louça', 'cuba oval', 'cuba embutir', 'pia sanitário'] },

  // ── Pintura ───────────────────────────────────────────────────────────────────
  { descricao: 'Epóxi sobre cimentado áreas técnicas', categoria: 'pintura', vlr: 105.4, keywords: ['epóxi', 'piso epóxi', 'epoxy', 'cimento epoxi', 'cimento epóxi'] },
  { descricao: 'Pintura esmalte amarela', categoria: 'pintura', vlr: 2000, keywords: ['esmalte amarelo', 'pintura amarela base'] },
  { descricao: 'Emassamento e pintura látex forro', categoria: 'pintura', vlr: 45.58, keywords: ['pintura forro', 'pintura gesso', 'látex forro', 'pintura teto', 'pintura laje', 'teto pintado', 'forro pintado', 'latex pva branco neve fosco para forro', 'latex branco neve fosco forro'] },
  { descricao: 'Emassamento e pintura Diário de Menina', categoria: 'pintura', vlr: 39.77, keywords: ['diário de menina', 'pintura ADM'] },
  { descricao: 'Emassamento e pintura branco neve', categoria: 'pintura', vlr: 53.58, keywords: ['branco neve', 'pintura branco neve'] },
  // Pintura acrílica genérica — abrange a maioria das paredes
  { descricao: 'Emassamento e pintura acrílica branco gelo', categoria: 'pintura', vlr: 53.58, keywords: ['pintura acrílica', 'pintura branco gelo', 'tinta acrílica parede', 'branco gelo', 'pintura fosca', 'acrílica fosca', 'pintura acrilica', 'tinta acrilica', 'pintura parede acrílica', 'emassamento pintura', 'massa corrida', 'pintura látex', 'pintura latéx', 'pintura semi-brilho', 'pintura semi brilho', 'gesso acartonado', 'sobre drywall', 'sobre gesso', 'em gesso', 'latex acrilico semi-brilho', 'latex acrílico semi-brilho', 'pintura latex', 'suvinil'] },
  { descricao: 'Pintura epóxi corrimão', categoria: 'pintura', vlr: 60.59, keywords: ['pintura corrimão', 'epóxi corrimão'] },

  // ── Vidros e espelhos ─────────────────────────────────────────────────────────
  { descricao: 'Vidro temperado vitrine', categoria: 'vidros', vlr: 601.6, keywords: ['vidro vitrine', 'vidro temperado vitrine', 'vidro temperado incolor'] },
  { descricao: 'Espelho corredor provador', categoria: 'marcenaria', vlr: 741.49, keywords: ['espelho corredor provador'] },
  { descricao: 'Espelho cava iluminação provador', categoria: 'marcenaria', vlr: 792.36, keywords: ['espelho cava provador', 'espelho iluminação provador'] },
  { descricao: 'Espelho área vendas', categoria: 'vidros', vlr: 648, keywords: ['espelho vendas', 'espelho salão'] },
  { descricao: 'Espelho cristal 4mm com moldura', categoria: 'vidros', vlr: 694.49, keywords: ['espelho cristal', 'espelho cuba', 'espelho lavatório'] },
  { descricao: 'Espelho cristal vertical vestiários', categoria: 'vidros', vlr: 694.49, keywords: ['espelho vestiário'] },

  // ── Portas em madeira ──────────────────────────────────────────────────────────
  { descricao: 'Porta de madeira 0.72m', categoria: 'marcenaria', vlr: 1861, keywords: ['porta madeira 0.72', 'porta 0.72'] },
  { descricao: 'Porta de madeira 0.82m', categoria: 'marcenaria', vlr: 2061, keywords: ['porta madeira 0.82', 'porta 0.82'] },
  { descricao: 'Porta de madeira 0.92m cantina', categoria: 'marcenaria', vlr: 2161, keywords: ['porta madeira 0.92', 'porta cantina', 'porta 0.92'] },
  { descricao: 'Mola para porta', categoria: 'marcenaria', vlr: 421, keywords: ['mola porta'] },
  { descricao: 'Tetra-chave', categoria: 'marcenaria', vlr: 434.4, keywords: ['tetra-chave', 'fechadura tetra'] },
  { descricao: 'Prendedor de porta', categoria: 'marcenaria', vlr: 180, keywords: ['prendedor porta'] },
  { descricao: 'Porta vai-vem', categoria: 'marcenaria', vlr: 3050, keywords: ['porta vai-vem'] },
  // Acessórios de provador — devem vir ANTES de entradas genéricas de "porta"
  { descricao: 'Puxador alumínio anodizado provador', categoria: 'marcenaria', vlr: 65, keywords: ['puxador provador', 'puxador porta provador', 'puxador de porta', 'puxador alumínio', 'puxador aluminio'] },
  { descricao: 'Tranca / tranqueta bico de papagaio', categoria: 'marcenaria', vlr: 35, keywords: ['tranca provador', 'tranqueta', 'bico de papagaio'] },
  { descricao: 'Mão-amiga / cabide de parede provador', categoria: 'marcenaria', vlr: 45, keywords: ['mão-amiga', 'mao-amiga', 'mão amiga'] },
  { descricao: 'Banco de apoio MDF provador', categoria: 'marcenaria', vlr: 220, keywords: ['banco apoio provador', 'banco de apoio provador', 'banco rebatível', 'banco rebativel'] },

  // ── Marcenaria área de vendas ─────────────────────────────────────────────────
  // Laminados de provadores — específicos ANTES de genéricos de laminado
  { descricao: 'Revestimento laminado formica prattan (provadores)', categoria: 'marcenaria', vlr: 745.1, keywords: ['laminado prattan', 'fórmica prattan', 'formica prattan', 'prattan'] },
  { descricao: 'Revestimento laminado formica ártico/gelo/branco (provadores)', categoria: 'marcenaria', vlr: 625.1, keywords: [
      'laminado provador', 'laminado artico', 'formica artico', 'formica ártico',
      'laminado gelo', 'formica gelo',
      'formica branco', 'formica branco l120', 'formica l120', 'formica l166', 'formica l106',
      'laminado formica', 'divisória laminado', 'divisoria laminado',
      'painel fórmica', 'painel formica',
      'revestimento formica', 'revestimento fórmica',
      'essencial wood', 'itapua', 'itapuã', 'duratex provadores',
      'painel em mdf formica', 'painel mdf formica', 'mdf formica',
      'parede mdf laminado', 'parede em mdf laminado',
      'divisoria laminado branco formica', 'divisória em itapuã',
    ] },
  { descricao: 'Lateral de provador', categoria: 'marcenaria', vlr: 262.85, keywords: ['lateral provador'] },
  { descricao: 'Coluna simples provador', categoria: 'marcenaria', vlr: 2070, keywords: ['coluna provador'] },
  { descricao: 'Régua para união de painéis provador', categoria: 'marcenaria', vlr: 169.8, keywords: ['régua provador'] },
  { descricao: 'Travessa provador', categoria: 'marcenaria', vlr: 285.43, keywords: ['travessa provador'] },
  { descricao: 'Frontal provador', categoria: 'marcenaria', vlr: 846.26, keywords: ['frontal provador'] },
  { descricao: 'Suporte L lateral provador', categoria: 'marcenaria', vlr: 133.3, keywords: ['suporte lateral provador'] },
  { descricao: 'Porta provador 0.70m', categoria: 'marcenaria', vlr: 1053.6, keywords: ['porta provador 0.70'] },
  { descricao: 'Porta provador PNE', categoria: 'marcenaria', vlr: 1140, keywords: ['porta provador PNE', 'porta deficiente', 'PNE'] },
  { descricao: 'Porta provador família', categoria: 'marcenaria', vlr: 1240, keywords: ['porta provador família'] },
  { descricao: 'Porta de correr provador', categoria: 'marcenaria', vlr: 1980, keywords: ['porta correr provador'] },
  { descricao: 'Cabideiro cromado', categoria: 'marcenaria', vlr: 72.6, keywords: ['cabideiro'] },
  { descricao: 'Barra inox 160cm provador deficiente', categoria: 'marcenaria', vlr: 1127.6, keywords: ['barra inox 160', 'barra PNE'] },
  { descricao: 'Barra inox 80cm provador deficiente', categoria: 'marcenaria', vlr: 685, keywords: ['barra inox 80'] },
  { descricao: 'Réguas para união de painéis', categoria: 'marcenaria', vlr: 47.37, keywords: ['régua painel', 'régua união'] },
  { descricao: 'Revestimento de colunas área vendas', categoria: 'marcenaria', vlr: 4116, keywords: ['revestimento coluna', 'coluna vendas'] },
  { descricao: 'Porta simples Ártico TX 0.80m', categoria: 'marcenaria', vlr: 853.45, keywords: ['porta marcenaria 0.80', 'porta ártico 0.80'] },
  { descricao: 'Porta simples Ártico TX 1.00m', categoria: 'marcenaria', vlr: 953.45, keywords: ['porta marcenaria 1.00', 'porta ártico 1.00'] },
  { descricao: 'Porta dupla 1.20m', categoria: 'marcenaria', vlr: 1053.45, keywords: ['porta dupla 1.20'] },
  { descricao: 'Caixa para hidrante', categoria: 'hidraulica', vlr: 1580, keywords: ['caixa hidrante', 'hidrante'] },
  { descricao: 'Arquibancada em MDP branco', categoria: 'marcenaria', vlr: 1228.29, keywords: ['arquibancada'] },
  { descricao: 'Estrado com laminado branco para vitrine', categoria: 'marcenaria', vlr: 227.73, keywords: ['estrado vitrine', 'tablado vitrine'] },
  { descricao: 'Estrutura metálica para estrados', categoria: 'marcenaria', vlr: 1416.12, keywords: ['estrutura estrado'] },
  // Laminado genérico (sem categorização clara) — DEPOIS dos específicos
  { descricao: 'Revestimento em laminado', categoria: 'marcenaria', vlr: 0, keywords: ['revestimento laminado'] },

  // ── Fachadas ──────────────────────────────────────────────────────────────────
  { descricao: 'Vitrine tablado fixo', categoria: 'fachada', vlr: 2770, keywords: ['tablado vitrine fixo', 'vitrine MDP'] },
  { descricao: 'Revestimento em ACM Branco Brilho', categoria: 'fachada', vlr: 639, keywords: ['ACM', 'revestimento ACM', 'painel ACM'] },
  { descricao: 'Porcelanato fachada', categoria: 'fachada', vlr: 0, keywords: ['porcelanato fachada'] },
  { descricao: 'Rodapé inox fachada', categoria: 'fachada', vlr: 375, keywords: ['rodapé inox fachada'] },

  // ── Marcenaria e enxoval ──────────────────────────────────────────────────────
  { descricao: 'Armário suspenso refeitório', categoria: 'marcenaria', vlr: 2635, keywords: ['armário refeitório', 'armário suspenso', 'armário parede'] },
  { descricao: 'Bancada armário copa', categoria: 'marcenaria', vlr: 3110, keywords: ['bancada copa', 'armário copa', 'bancada cozinha', 'armário cozinha', 'marcenaria copa', 'conjunto marcenaria copa'] },
  { descricao: 'Armário bancada gerência', categoria: 'marcenaria', vlr: 3120, keywords: ['armário gerência', 'bancada gerência'] },
  { descricao: 'Moldura para cofre', categoria: 'marcenaria', vlr: 1185, keywords: ['cofre', 'moldura cofre'] },
  { descricao: 'Estante sala de rack', categoria: 'marcenaria', vlr: 1580, keywords: ['rack', 'estante rack'] },
  { descricao: 'Armário boca de lobo', categoria: 'marcenaria', vlr: 1495, keywords: ['boca de lobo', 'armário boca'] },
  { descricao: 'Base de alumínio para bebedouro', categoria: 'outro', vlr: 1190, keywords: ['bebedouro', 'base bebedouro', 'ponto bebedouro'] },
  { descricao: 'Locker vestiário', categoria: 'marcenaria', vlr: 716, keywords: ['locker', 'vestiário roupeiro', 'armário vestiário'] },

  // ── Omissos / outros ──────────────────────────────────────────────────────────
  { descricao: 'Proteção eletromagnética RFID', categoria: 'eletrica', vlr: 120, keywords: ['RFID', 'proteção eletromagnética'] },
  { descricao: 'Grama sintética sala descompressão', categoria: 'revestimento', vlr: 690.1, keywords: ['grama sintética', 'grama artificial', 'descompressão'] },
  { descricao: 'Cortina de enrolar / persiana rolo', categoria: 'marcenaria', vlr: 350, keywords: ['cortina de enrolar', 'cortina enrolar', 'persiana enrolar', 'persiana rolo', 'fechamento cortina'] },

  // ── Itens de enxoval / acessórios (gabarito CELMAR BLN) ──────────────────────
  { descricao: 'Chassis para espelhos cabine provador', categoria: 'marcenaria', vlr: 785.94, keywords: ['chassis espelho', 'chassis para espelho', 'chassis provador'] },
  { descricao: 'Rodapé em fórmica prattan 10cm', categoria: 'marcenaria', vlr: 126.86, keywords: ['rodapé formica prattan', 'rodapé fórmica prattan', 'formica pratan', 'fórmica pratan'] },
  { descricao: 'Arremates de cantos / cantoneira alumínio provadores', categoria: 'revestimento', vlr: 157.30, keywords: ['arremate de canto', 'arremates de cantos', 'cantoneira aluminio provador'] },
  { descricao: 'Fixadores de teto para painéis', categoria: 'civil', vlr: 156.60, keywords: ['fixador de teto', 'fixadores de teto'] },
  { descricao: 'Filtro para bebedouro', categoria: 'outro', vlr: 735, keywords: ['filtro bebedouro', 'filtro aqualar'] },
  { descricao: 'Porta e tampa alumínio para lixeira copa', categoria: 'marcenaria', vlr: 920, keywords: ['tampa lixeira', 'porta lixeira copa'] },
  { descricao: 'Lixeira para bancada sanitários', categoria: 'outro', vlr: 376, keywords: ['lixeira bancada', 'lixeira sanitário', 'lixeira banheiro'] },
  { descricao: 'Lixeira para vasos sanitários', categoria: 'outro', vlr: 298.30, keywords: ['lixeira vaso', 'lixeira wc'] },
  { descricao: 'Portinhola correio pneumático', categoria: 'outro', vlr: 519.65, keywords: ['portinhola', 'correio pneumático portinhola'] },
  { descricao: 'Suporte para TV / projetor / microondas', categoria: 'marcenaria', vlr: 640, keywords: ['suporte tv', 'suporte projetor', 'suporte microondas'] },
  { descricao: 'Tubo aço inox alimentação caixa', categoria: 'hidraulica', vlr: 463, keywords: ['tubo inox alimentação', 'tubo aço inox 2'] },
  { descricao: 'Lona transparente proteção equipamentos', categoria: 'outro', vlr: 4200, keywords: ['lona transparente'] },
  { descricao: 'Painel liso laminado branco (provadores)', categoria: 'marcenaria', vlr: 262.85, keywords: ['painel liso laminado', 'painel liso branco'] },
  { descricao: 'Porta de madeira 0.92m curupixá', categoria: 'marcenaria', vlr: 2395, keywords: ['porta madeira curupixá', 'porta 0.92 curupixa', 'porta 0.92m curupixá'] },
  { descricao: 'Autonivelante salão de vendas', categoria: 'revestimento', vlr: 14.2, keywords: ['autonivelante'] },
];

// ─── Fallback por categoria — derivado dos preços reais CELMAR BLN ────────────
const FALLBACK_CATEGORIA: Record<Categoria, number> = {
  civil: 110,       // ~alvenaria/chapisco
  eletrica: 300,    // ponto elétrico estimado
  hidraulica: 280,  // ponto hidráulico estimado
  marcenaria: 625,  // ~revestimento laminado provador
  vidros: 650,      // ~vidro temperado vitrine/m2
  revestimento: 85, // ~azulejo ou piso vinílico
  pintura: 54,      // ~emassamento + acrílica
  fachada: 640,     // ~ACM
  climatizacao: 600,
  outro: 100,
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolvePreco(item: ItemOrcamento): { vlr: number; fallback: boolean; categoria?: Categoria } {
  const desc = normalize(item.descricao);

  // 1. Exact match (normalized)
  for (const entry of TABELA_CELMAR) {
    if (normalize(entry.descricao) === desc) return { vlr: entry.vlr, fallback: false, categoria: entry.categoria };
  }

  // 2. Keyword match — keyword de 1 palavra: match de palavra completa; múltiplas palavras: frase exata
  const descWordsArr = desc.split(' ');
  function kwMatches(kw: string): boolean {
    const kwNorm = normalize(kw);
    const kwWords = kwNorm.split(' ').filter(Boolean);
    if (kwWords.length === 0) return false;
    if (kwWords.length === 1) return descWordsArr.some((w) => w === kwWords[0]);
    return desc.includes(kwNorm);
  }
  for (const entry of TABELA_CELMAR) {
    const keywords = entry.keywords ?? [];
    if (keywords.some(kwMatches)) {
      return { vlr: entry.vlr, fallback: false, categoria: entry.categoria };
    }
  }

  // 3. Partial match — descrição contém entry ou vice-versa
  for (const entry of TABELA_CELMAR) {
    const entryNorm = normalize(entry.descricao);
    if (desc.includes(entryNorm) || entryNorm.includes(desc)) {
      return { vlr: entry.vlr, fallback: false, categoria: entry.categoria };
    }
  }

  // 4. Word-overlap scoring: score = palavras significativas em comum / total entry words
  // Requer mínimo 2 palavras correspondentes para evitar falsos positivos de 1 palavra (ex: "porta")
  const descWords = new Set(desc.split(' ').filter((w) => w.length > 3));
  let bestScore = 0;
  let bestMatched = 0;
  let bestVlr = 0;
  let bestCat: Categoria | undefined;
  for (const entry of TABELA_CELMAR) {
    const entryWords = normalize(entry.descricao).split(' ').filter((w) => w.length > 3);
    if (entryWords.length === 0) continue;
    const matched = entryWords.filter((w) => descWords.has(w)).length;
    const score = matched / entryWords.length;
    if (score > bestScore || (score === bestScore && matched > bestMatched)) {
      bestScore = score;
      bestMatched = matched;
      bestVlr = entry.vlr;
      bestCat = entry.categoria;
    }
  }
  // Exige pelo menos 2 palavras coincidentes para evitar match por palavra única genérica
  if (bestScore >= 0.4 && bestMatched >= 2) return { vlr: bestVlr, fallback: false, categoria: bestCat };

  // 5. Fallback by category
  return { vlr: FALLBACK_CATEGORIA[item.categoria] ?? 0, fallback: true };
}

function calcularItem(item: ItemOrcamento): ItemOrcado {
  const erros: string[] = [];
  const { vlr, fallback, categoria } = resolvePreco(item);
  if (fallback) {
    erros.push(`Preço de "${item.descricao}" não encontrado — usando fallback de categoria "${item.categoria}"`);
  }
  // Sobrescreve "outro" se a tabela de preços identificou uma categoria real
  const categoriaFinal: Categoria = (item.categoria === 'outro' && categoria && categoria !== 'outro')
    ? categoria
    : item.categoria;
  return {
    ...item,
    categoria: categoriaFinal,
    vlrUnit: vlr,
    vlrTotal: parseFloat((vlr * item.quantidade).toFixed(2)),
    erros,
  };
}

/**
 * Itens que NÃO devem ser precificados:
 * - ABL/SV/AVL/ADM: áreas de referência espacial (Área Bruta Locável, Salão de Vendas, etc.)
 * - LAJE APARENTE: teto sem forro instalado — custo zero por definição
 * - PÉ-DIREITO: anotação de altura, não é material
 * - ILUMINÂNCIA: dado de simulação luminotécnica
 * - QUADRO DE ACABAMENTOS: tabela de especificação, não item de compra
 */
const NON_BILLABLE = /^(ABL\s|SV\s|AVL\s|ADM\s+[A-ZÁÉÍÓÚÀÃÕ]|CIRC[\.\s]|LAJE\s+APARENTE|PÉ-DIREITO|PÉ\s+DIREITO|ILUMINÂNCIA|QUADRO\s+DE\s+ACABAMENTOS\s+[–—-])/i;

function isNonBillable(item: ItemOrcamento): boolean {
  return NON_BILLABLE.test(item.descricao ?? '');
}

export function calcularOrcamento(folha: FolhaOrcamento): ResultadoOrcamento {
  const itens = folha.itens.filter((it) => !isNonBillable(it)).map(calcularItem);

  const confirmados = itens.filter((i) => i.status !== 'aguardando');

  const totalGeral = confirmados.reduce((s, i) => s + i.vlrTotal, 0);

  const porCategoria: Record<string, number> = {};
  for (const item of confirmados) {
    porCategoria[item.categoria] = (porCategoria[item.categoria] ?? 0) + item.vlrTotal;
  }

  const porAmbiente: Record<string, number> = {};
  for (const item of confirmados) {
    const amb = item.ambiente ?? '?';
    porAmbiente[amb] = (porAmbiente[amb] ?? 0) + item.vlrTotal;
  }

  return { itens, totalGeral, porCategoria, porAmbiente };
}
