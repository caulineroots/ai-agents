import { calcularOrcamento } from '@/lib/orcamento/calcular';
import type { FolhaMedicao } from '@/lib/orcamento/types';
import { marmorariaError, marmorariaLog } from '@/lib/orcamento/debug';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { folha: FolhaMedicao };

    if (!body.folha || !body.folha.itens) {
      marmorariaError('api/calcular', 'folha inválida');
      return Response.json({ error: 'folha inválida' }, { status: 400 });
    }

    marmorariaLog('api/calcular', 'recalculating', { itens: body.folha.itens.length });
    const resultado = calcularOrcamento(body.folha);
    marmorariaLog('api/calcular', 'done', { totalGeral: resultado.totalGeral });
    return Response.json(resultado);
  } catch (error) {
    marmorariaError('api/calcular', 'failed', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
