export const dynamic = 'force-dynamic';

import { proxyPostToPython } from '../_python-service';

export async function POST(request: Request) {
  return proxyPostToPython(request, '/maps/scrape');
}
