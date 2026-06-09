import { calcularOrcamento } from '@/lib/orcamento/calcular';
import type { FolhaMedicao } from '@/lib/orcamento/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { folha: FolhaMedicao };

    if (!body.folha || !body.folha.itens) {
      return Response.json({ error: 'folha inválida' }, { status: 400 });
    }

    const resultado = calcularOrcamento(body.folha);
    return Response.json(resultado);
  } catch (error) {
    console.error('Calcular error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
