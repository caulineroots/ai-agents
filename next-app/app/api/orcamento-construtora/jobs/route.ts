export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { jobs } from '@/db/schema';

const STORAGE = path.join(process.cwd(), 'storage', 'jobs');
const safe = (name: string) => path.basename(name).replace(/[^\w.\- ()]/g, '_');

// POST — cria um job: salva planilha + desenhos em storage/jobs/<id>/ e insere pending.
export async function POST(req: Request) {
  const form = await req.formData();
  const planilha = form.get('planilha');
  if (!(planilha instanceof File) || !planilha.name) {
    return Response.json({ error: 'Envie a planilha (.xlsx) no campo "planilha"' }, { status: 400 });
  }
  const desenhos = form.getAll('desenhos').filter((d): d is File => d instanceof File && !!d.name);
  const useLlm = ['true', '1', 'sim', 'on'].includes(String(form.get('use_llm')).toLowerCase());

  const id = randomUUID();
  const dir = path.join(STORAGE, id);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, safe(planilha.name)), Buffer.from(await planilha.arrayBuffer()));
  for (const d of desenhos) {
    await fs.writeFile(path.join(dir, safe(d.name)), Buffer.from(await d.arrayBuffer()));
  }

  const [job] = await db.insert(jobs).values({
    id, filename: safe(planilha.name), inputDir: dir,
    nDesenhos: desenhos.length, useLlm,
  }).returning({ id: jobs.id, status: jobs.status });

  return Response.json(job, { status: 201 });
}

// GET — lista os jobs (sem o result pesado), mais recentes primeiro.
export async function GET() {
  const rows = await db.select({
    id: jobs.id, status: jobs.status, filename: jobs.filename,
    nDesenhos: jobs.nDesenhos, useLlm: jobs.useLlm, progress: jobs.progress,
    error: jobs.error, createdAt: jobs.createdAt, startedAt: jobs.startedAt,
    finishedAt: jobs.finishedAt,
  }).from(jobs).orderBy(desc(jobs.createdAt)).limit(100);
  return Response.json(rows);
}
