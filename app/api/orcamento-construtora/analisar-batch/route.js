import { proxyToPython } from '../_python-proxy';

export const maxDuration = 180;
export const dynamic     = 'force-dynamic';

export async function POST(request) {
  return proxyToPython(request, '/analisar-batch', { timeoutMs: 180_000 });
}
