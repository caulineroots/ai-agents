ï»¿/**
 * Motor determinÃ­stico de cÃ¡lculo de orÃ§amento â fit-out comercial
 *
 * Recebe um array de itens extraÃ­dos pelo agente de IA (stages 1-5) e
 * devolve o orÃ§amento completo agrupado por categoria, sem nenhuma IA.
 *
 * Schema de cada item de entrada:
 * {
 *   cod           {string}   cÃ³digo do item, ex: "16.1", "9.5"
 *   descricao     {string}   descriÃ§Ã£o livre (sobrescreve a padrÃ£o da tabela)
 *   ambiente      {string}   ambiente de origem, ex: "copa", "sanitarios"
 *   unid          {string}   unidade: "m2"|"ml"|"m"|"unid"|"vb"|"dia"|"mes"|"cj"|"pe"
 *   L             {number}   comprimento (usado para m2: qty = L Ã C; para ml: qty = L)
 *   C             {number}   largura (usado para m2: qty = L Ã C)
 *   qty           {number}   quantidade direta (para unid, vb, dia, mes, cj â ou quando nÃ£o hÃ¡ L/C)
 *   mat           {number}   preÃ§o de material unitÃ¡rio (sobrescreve tabela se informado)
 *   mObra         {number}   preÃ§o de MO unitÃ¡rio (sobrescreve tabela se informado)
 *   materialCliente {boolean} true = material por conta do contratante (MAT = 0)
 *   observacao    {string}   nota livre
 *   status        {string}   "confirmado" | "calculado" | "estimativa" | "pendencia"
 * }
 */

import { TABELA, CATEGORIAS, catFromCod } from './tabela-precos.js';

const UNIDADES_AREA   = new Set(['m2', 'm²']);
const UNIDADES_LINEAR = new Set(['ml', 'm']);

/**
 * Calcula a quantidade a partir das dimensÃµes informadas.
 * Hierarquia: qty explÃ­cita > L Ã C (Ã¡rea) > L (linear)
 */
function resolverQtd(item) {
  const unid = (item.unid ?? '').trim().toLowerCase();

  if (item.qty != null && item.qty !== 0) return item.qty;

  if (UNIDADES_AREA.has(unid)) {
    const L = item.L ?? 0;
    const C = item.C ?? 0;
    return +(L * C).toFixed(4);
  }

  if (UNIDADES_LINEAR.has(unid)) {
    return item.L ?? 0;
  }

  return item.qty ?? 0;
}

/**
 * Calcula um item individual.
 * Retorna o item enriquecido com qtd, matUnit, mObraUnit e total.
 */
function calcularItem(item) {
  const tabela = TABELA[item.cod] ?? {};

  const qtd = resolverQtd(item);

  // PreÃ§os: item sobrescreve tabela quando explÃ­cito
  const matUnit   = item.mat   != null ? item.mat   : (tabela.mat   ?? 0);
  const mObraUnit = item.mObra != null ? item.mObra : (tabela.mObra ?? 0);

  const materialCliente = item.materialCliente ?? tabela.materialCliente ?? false;

  // Material do cliente: MAT = 0, cobra sÃ³ M.OBRA
  const matEfetivo = materialCliente ? 0 : matUnit;

  const unidResolvida = item.unid ?? tabela.unidPadrao ?? 'â';
  const descricao     = item.descricao || tabela.descricao || item.cod;

  const totalMat   = +(qtd * matEfetivo).toFixed(2);
  const totalMObra = +(qtd * mObraUnit).toFixed(2);
  const total      = +(totalMat + totalMObra).toFixed(2);

  const semPreco = (matEfetivo === 0 && mObraUnit === 0 && !materialCliente);

  return {
    cod:              item.cod,
    descricao,
    ambiente:         item.ambiente ?? null,
    unid:             unidResolvida,
    L:                item.L ?? null,
    C:                item.C ?? null,
    qtd,
    matUnit:          materialCliente ? null : matUnit,
    mObraUnit,
    totalMat:         materialCliente ? null : totalMat,
    totalMObra,
    total,
    materialCliente,
    status:           item.status ?? 'confirmado',
    semPreco,
    observacao:       item.observacao ?? null,
    alertas:          semPreco && qtd > 0
                        ? ['Sem preÃ§o na tabela â cotaÃ§Ã£o necessÃ¡ria']
                        : [],
  };
}

/**
 * FunÃ§Ã£o principal.
 *
 * @param {object[]} itens   Array de itens extraÃ­dos pelo agente
 * @param {object}   opcoes  { duracaoMeses: number, nomeObra: string }
 * @returns {object}         OrÃ§amento completo com categorias e totais
 */
export function calcularOrcamento(itens, opcoes = {}) {
  const { duracaoMeses = 3, nomeObra = 'Obra nÃ£o identificada' } = opcoes;

  const calculados = itens.map((item) => {
    const c = calcularItem(item);

    // Itens por mÃªs (3.3, 4.1, 4.2, 4.5) usam duraÃ§Ã£o quando qty nÃ£o foi explicitada
    if (['mes', 'mês'].includes((c.unid ?? '').toLowerCase()) && !item.qty) {
      const c2 = calcularItem({ ...item, qty: duracaoMeses });
      return c2;
    }
    // VigilÃ¢ncia (2.3) por dia usa duraÃ§Ã£o Ã 30
    if (item.cod === '2.3' && !item.qty) {
      return calcularItem({ ...item, qty: duracaoMeses * 30 });
    }

    return c;
  });

  // Agrupar por categoria
  const grupos = {};
  for (const item of calculados) {
    const cat = catFromCod(item.cod);
    if (!grupos[cat]) {
      grupos[cat] = {
        cat,
        nome:      CATEGORIAS[cat] ?? `Categoria ${cat}`,
        itens:     [],
        subtotal:  0,
      };
    }
    grupos[cat].itens.push(item);
    grupos[cat].subtotal = +(grupos[cat].subtotal + item.total).toFixed(2);
  }

  const categorias = Object.values(grupos).sort((a, b) => a.cat - b.cat);

  const totalGeral      = +categorias.reduce((s, g) => s + g.subtotal, 0).toFixed(2);
  const itensSemPreco   = calculados.filter((i) => i.semPreco && i.qtd > 0);
  const itensEstimativa = calculados.filter((i) => i.status === 'estimativa');
  const itensPendencia  = calculados.filter((i) => i.status === 'pendencia');

  return {
    meta: {
      nomeObra,
      duracaoMeses,
      dataCalculo:   new Date().toISOString(),
      totalItens:    calculados.length,
      totalGeral,
    },
    resumo: categorias.map((g) => ({
      cat:      g.cat,
      nome:     g.nome,
      subtotal: g.subtotal,
    })),
    categorias,
    alertas: {
      semPreco:   itensSemPreco.map((i) => ({ cod: i.cod, descricao: i.descricao, qtd: i.qtd })),
      estimativa: itensEstimativa.map((i) => ({ cod: i.cod, descricao: i.descricao })),
      pendencia:  itensPendencia.map((i) => ({ cod: i.cod, descricao: i.descricao })),
    },
  };
}
