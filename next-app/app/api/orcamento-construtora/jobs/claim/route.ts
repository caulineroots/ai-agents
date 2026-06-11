export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from 'drizzle-orm';
import { db } from '@/db';

// POST — o worker reivindica o próximo job pendente de forma atômica.
// FOR UPDATE SKIP LOCKED garante que dois workers nunca pegam o mesmo job.
// Retorna o job (id, input_dir, filename, use_llm) ou null se não há pendentes.
export async function POST() {
  const rows = await db.execute(sql`
    UPDATE jobs
       SET status = 'in_progress', started_at = now()
     WHERE id = (
       SELECT id FROM jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
    RETURNING id, filename, input_dir, n_desenhos, use_llm, status
  `);
  const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? [];
  const job = list[0] ?? null;
  return Response.json(job);
}
