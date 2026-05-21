import { createEmbedGuardHandler } from 'aetherly-embed-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const { GET } = createEmbedGuardHandler({
  proxyPath: '/api/player-proxy',
});
