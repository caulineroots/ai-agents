import { proxyToPython } from '../_python-proxy';

export const maxDuration = 120;
export const dynamic     = 'force-dynamic';

export async function POST(request) {
  return proxyToPython(request, '/orquestrar', { timeoutMs: 120_000 });
}
