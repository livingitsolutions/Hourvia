import type { Config } from '@netlify/functions';

export default async function health(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  return new Response(request.method === 'HEAD' ? null : JSON.stringify({
    service: 'hourvia',
    stage: 'sprint-0',
    authentication: 'disabled',
    persistence: 'not-connected',
  }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export const config: Config = { path: '/api/health' };
