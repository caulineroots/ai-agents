export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobs, JOB_STATUS, type JobStatus } from '@/db/schema';

// GET — detalhe do job (inclui o result completo).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return Response.json({ error: 'Job não encontrado' }, { status: 404 });
  return Response.json(job);
}

// PATCH — usado pelo worker para atualizar status/progresso/result/erro.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!JOB_STATUS.includes(body.status as JobStatus)) {
      return Response.json({ error: `status inválido: ${body.status}` }, { status: 400 });
    }
    patch.status = body.status;
    if (body.status === 'in_progress') patch.startedAt = new Date();
    if (body.status === 'completed' || body.status === 'failed') patch.finishedAt = new Date();
  }
  if (body.progress !== undefined) patch.progress = body.progress;
  if (body.result !== undefined) patch.result = body.result;
  if (body.error !== undefined) patch.error = body.error;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'nada para atualizar' }, { status: 400 });
  }

  const [job] = await db.update(jobs).set(patch).where(eq(jobs.id, id)).returning();
  if (!job) return Response.json({ error: 'Job não encontrado' }, { status: 404 });
  return Response.json(job);
}
