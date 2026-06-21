export const dynamic    = 'force-dynamic';
export const maxDuration = 180;

import { proxyToPython } from '../_python-service';

export async function POST(request: Request) {
  return proxyToPython(request, '/especialista');
}
