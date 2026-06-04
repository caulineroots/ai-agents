import { NextResponse } from 'next/server';
import { calcularOrcamento } from '@/lib/construtora/calcular-orcamento';

/**
 * POST /api/orcamento-construtora/calcular
 *
 * Body JSON:
 * {
 *   itens:         object[]   itens do quantitativo (output do agente Stage 3)
 *   duracaoMeses?: number     duração da obra em meses (default: 3)
 *   nomeObra?:     string     nome da obra para o cabeçalho do orçamento
 * }
 *
 * Response JSON: orçamento completo com categorias, subtotais e total geral
 */
export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { erro: 'Body inválido — envie JSON válido.' },
      { status: 400 }
    );
  }

  const { itens, duracaoMeses, nomeObra } = body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json(
      { erro: 'Campo "itens" é obrigatório e deve ser um array não vazio.' },
      { status: 400 }
    );
  }

  // Validação mínima dos itens
  const invalidos = itens
    .map((item, i) => ({ i, item }))
    .filter(({ item }) => !item.cod || !item.unid);

  if (invalidos.length > 0) {
    return NextResponse.json(
      {
        erro: `${invalidos.length} item(ns) sem "cod" ou "unid". Indices: ${invalidos.map((x) => x.i).join(', ')}`,
      },
      { status: 400 }
    );
  }

  try {
    const orcamento = calcularOrcamento(itens, {
      duracaoMeses: duracaoMeses ?? 3,
      nomeObra:     nomeObra    ?? 'Obra não identificada',
    });

    return NextResponse.json(orcamento);
  } catch (err) {
    console.error('[calcular-orcamento-construtora]', err);
    return NextResponse.json(
      { erro: 'Erro interno ao calcular orçamento.', detalhe: err.message },
      { status: 500 }
    );
  }
}
