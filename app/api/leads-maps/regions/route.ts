export const dynamic = 'force-dynamic';

import { loadRegionsFromJson } from '@/lib/leads-maps/regions-server';
import { proxyGetToPython } from '../_python-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') ?? 'marcenaria';

  const res = await proxyGetToPython(
    `/maps/regions?keyword=${encodeURIComponent(keyword)}`,
  );

  if (res.ok) {
    return res;
  }

  // Fallback when Python is stale/offline — still show all states/cities from JSON
  if (res.status === 404 || res.status === 502 || res.status === 503) {
    try {
      return Response.json(loadRegionsFromJson(keyword));
    } catch {
      /* fall through */
    }
  }

  return res;
}
