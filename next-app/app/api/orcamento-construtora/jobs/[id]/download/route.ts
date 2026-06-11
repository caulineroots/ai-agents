export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { promises as fs } from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { jobs } from '@/db/schema';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// GET — baixa a planilha preenchida (escrita pelo worker em input_dir/preenchida.xlsx).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return Response.json({ error: 'Job não encontrado' }, { status: 404 });

  const file = path.join(job.inputDir, 'preenchida.xlsx');
  const buf = await fs.readFile(file).catch(() => null);
  if (!buf) return Response.json({ error: 'Planilha preenchida ainda não disponível' }, { status: 404 });

  const nome = job.filename.replace(/\.xlsx$/i, '') + ' - preenchida.xlsx';
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  });
}
