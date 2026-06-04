export const dynamic     = 'force-dynamic';
export const maxDuration = 120;

import { proxyToPython } from '../_python-service';

export async function POST(request: Request) {
  return proxyToPython(request, '/orquestrar');
}
