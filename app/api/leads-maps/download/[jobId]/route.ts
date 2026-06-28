export const dynamic = 'force-dynamic';

import { proxyGetToPython } from '../../../_python-service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  return proxyGetToPython(`/maps/jobs/${jobId}/csv`);
}
