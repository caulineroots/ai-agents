import { proxyToPython } from '../_python-proxy';

export const maxDuration = 60;
export const dynamic     = 'force-dynamic';

export async function POST(request) {
  return proxyToPython(request, '/extrair-codigo', { timeoutMs: 60_000 });
}
