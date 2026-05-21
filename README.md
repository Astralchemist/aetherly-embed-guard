# aetherly-embed-guard

[![CI](https://github.com/Astralchemist/aetherly-embed-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/Astralchemist/aetherly-embed-guard/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/aetherly-embed-guard.svg)](https://www.npmjs.com/package/aetherly-embed-guard)
[![npm downloads](https://img.shields.io/npm/dm/aetherly-embed-guard.svg)](https://www.npmjs.com/package/aetherly-embed-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/aetherly-embed-guard)](https://bundlephobia.com/package/aetherly-embed-guard)

Reverse-proxy + in-iframe guard script for safely embedding third-party video providers (`vidsrc.*`, `2embed.*`, `vidfast.pro`, `vidlink.pro`, etc.) without their popunder, tab-hijack, and top-window-redirect ads escaping the iframe.

Zero dependencies, Web Fetch API native — works in Next.js App Router, Cloudflare Workers, Bun, Deno.

## What problem this solves

Most "free embed" providers monetise with aggressive ads that try to:

1. Open a popunder via `window.open(...)`.
2. Navigate the **parent** window via `<a target="_top">`, `location.assign`, or a form submission with `target="_blank"`.
3. Submit form-based clickjacks to attribution networks.
4. Run script-injected `<a>` clicks programmatically.

Browser `<iframe sandbox>` mitigates *some* of this, but a few providers (notably `vidfast.pro`, `vidlink.pro`, `embed.su`) detect `window.frameElement.sandbox` and refuse to play if any flags are set. So you can't just sandbox everything.

This package's two-layer fix:

- **Server-side reverse proxy** (`createEmbedGuardHandler`) — fetches the upstream provider HTML, rewrites relative URLs to absolute (against the original origin), and injects a guard `<script>` at the very top of `<head>`.
- **Client-side guard script** — replaces `window.open` with a fake-window stub, intercepts and cancels any cross-origin anchor click / form submit, wraps `location.assign` and `location.replace`, and re-routes `fetch` / `XMLHttpRequest` calls that target the upstream origin back through the proxy (so the player's own runtime API calls keep working).

A separate host list (`DEFAULT_TRUSTED_DIRECT_HOSTS`) flags the sandbox-sensitive providers so callers can render those direct.

## Install

```bash
npm install aetherly-embed-guard
```

## Use with Next.js App Router

```ts
// app/api/player-proxy/route.ts
import { createEmbedGuardHandler } from 'aetherly-embed-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET } = createEmbedGuardHandler({
  proxyPath: '/api/player-proxy',
});
```

Then point your iframe at `/api/player-proxy?url=<encoded upstream>`. The proxy will fetch, inject the guard, and return HTML that loads cleanly in a sandboxed iframe.

## The trusted-direct exception

`vidfast.pro`, `vidlink.pro`, and `embed.su` will black-screen if rendered in a sandboxed iframe. The recommended client-side flow:

```ts
import { isTrustedDirect } from 'aetherly-embed-guard';

function attachIframe(iframe: HTMLIFrameElement, providerUrl: string) {
  if (isTrustedDirect(providerUrl)) {
    // No proxy, no sandbox. Rely on the browser's popup blocker.
    iframe.removeAttribute('sandbox');
    iframe.src = providerUrl;
    return;
  }
  // Sandboxed + proxied (guard script handles the rest).
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-orientation-lock allow-modals',
  );
  iframe.src = `/api/player-proxy?url=${encodeURIComponent(providerUrl)}`;
}
```

## Use with Cloudflare Workers

```ts
import { createEmbedGuardHandler } from 'aetherly-embed-guard';

const proxy = createEmbedGuardHandler({ proxyPath: '/api/player-proxy' });

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/player-proxy') return proxy.GET(request);
    return new Response('Not found', { status: 404 });
  },
};
```

## Options

```ts
createEmbedGuardHandler({
  proxyPath: '/api/player-proxy',
  providerHosts: DEFAULT_PROVIDER_HOST_RULES, // pass your own for a stricter allowlist
  requestTimeoutMs: 12_000,
  retries: 1,
  defaultUserAgent: 'Mozilla/5.0 ...',
  fetchImpl: fetch,
});
```

## Security notes

- The host allowlist (`providerHosts`) is **load-bearing**. Without it, this becomes an open HTTP proxy.
- The guard script runs *inside* the proxied document. It cannot prevent every escape (a deeply-nested iframe loading its own document is out of scope), but it stops every common ad-injection pattern those providers have shipped over the last 2+ years.
- This does not bypass DRM, CDN signing, or geo-restrictions — it's purely a UX hardening layer on top of *publicly accessible* embed pages.

## Disclaimer

This library is provided as infrastructure for safely embedding third-party iframe content. Users are responsible for ensuring they have the right to embed and proxy the content they target. The authors do not endorse any specific use case and make no representation about the legality of upstream sources.

## License

MIT
