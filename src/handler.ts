import { buildGuardScript, looksLikeBotChallenge } from './guard-script.js';
import { DEFAULT_PROVIDER_HOST_RULES, findProvider, type ProviderHostRule } from './hosts.js';

export interface EmbedGuardOptions {
  /**
   * Where this proxy is mounted. The injected guard script will rewrite same-
   * origin upstream requests back through `${proxyPath}?url=...`.
   *
   * @default "/api/player-proxy"
   */
  proxyPath?: string;

  /**
   * Override the host allowlist. Requests targeting hosts not matched by any
   * rule are rejected with HTTP 403.
   */
  providerHosts?: ProviderHostRule[];

  /**
   * Per-attempt request timeout in ms.
   *
   * @default 12000
   */
  requestTimeoutMs?: number;

  /**
   * Number of retries on transient upstream failures (408, 425, 429, 5xx).
   *
   * @default 1
   */
  retries?: number;

  /**
   * Fallback User-Agent if the incoming request did not carry one.
   */
  defaultUserAgent?: string;

  /**
   * Override the global `fetch`.
   */
  fetchImpl?: typeof fetch;
}

export interface EmbedGuardHandler {
  GET: (request: Request) => Promise<Response>;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
}

/**
 * Build a Web-Fetch-compatible reverse-proxy handler that loads an upstream
 * provider iframe URL, injects the guard script, and rewrites relative links
 * to absolute. Drop into a Next.js App Router `route.ts`, a Cloudflare Worker,
 * or any Web-Fetch host.
 */
export function createEmbedGuardHandler(options: EmbedGuardOptions = {}): EmbedGuardHandler {
  const proxyPath = options.proxyPath ?? '/api/player-proxy';
  const providerHosts = options.providerHosts ?? DEFAULT_PROVIDER_HOST_RULES;
  const requestTimeoutMs = options.requestTimeoutMs ?? 12_000;
  const retries = options.retries ?? 1;
  const defaultUserAgent = options.defaultUserAgent ?? 'AetherlyEmbedGuard/1.0';
  const fetchImpl = options.fetchImpl ?? fetch;

  async function fetchWithRetry(target: URL, forwardedUserAgent: string): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        const response = await fetchImpl(target, {
          signal: controller.signal,
          headers: {
            'User-Agent': forwardedUserAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: target.origin,
            Origin: target.origin,
          },
        });

        if (!response.ok && isRetryableStatus(response.status) && attempt < retries) {
          continue;
        }
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    }
    throw new Error('Unreachable retry branch');
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing URL parameter', { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return jsonError(400, { code: 'INVALID_URL', message: 'The provided URL is invalid.' });
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return jsonError(400, {
        code: 'UNSUPPORTED_PROTOCOL',
        message: 'Only HTTP(S) URLs are supported.',
      });
    }

    const provider = findProvider(parsed.hostname, providerHosts);
    if (!provider) {
      return jsonError(403, {
        code: 'PROVIDER_NOT_ALLOWED',
        targetHost: parsed.hostname,
        message: 'This source host is not permitted by the proxy allowlist.',
      });
    }

    let upstream: Response;
    try {
      upstream = await fetchWithRetry(parsed, request.headers.get('user-agent') || defaultUserAgent);
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return jsonError(503, {
        code: aborted ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED',
        provider,
        targetHost: parsed.hostname,
        message: aborted ? 'Upstream request timed out.' : 'Failed to fetch source.',
      });
    }

    if (!upstream.ok) {
      return jsonError(503, {
        code: 'UPSTREAM_HTTP_ERROR',
        provider,
        targetHost: parsed.hostname,
        upstreamStatus: upstream.status,
        message: `Upstream responded with HTTP ${upstream.status}`,
      });
    }

    const upstreamContentType = upstream.headers.get('content-type') || '';
    const isHtml =
      upstreamContentType.includes('text/html') ||
      upstreamContentType.includes('application/xhtml');

    if (!isHtml) {
      // Non-HTML (JSON API calls, JS chunks fetched by the player at runtime,
      // etc.): pass through verbatim so the player's own XHR/fetch (which the
      // guard script has re-routed through this proxy) keeps working.
      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstreamContentType || 'application/octet-stream',
          'Cache-Control': 'no-store',
        },
      });
    }

    let html = await upstream.text();

    if (looksLikeBotChallenge(html)) {
      return jsonError(503, {
        code: 'SOURCE_CHALLENGE',
        provider,
        targetHost: parsed.hostname,
        message: 'Upstream source requires bot/security verification',
      });
    }

    const origin = parsed.origin;
    html = html.replace(/(src|href|action)=["']\/(?!\/)/g, `$1="${origin}/`);

    const baseTag = `<base href="${origin}/">`;
    const guardScript = buildGuardScript(origin, `${proxyPath}?url=`);

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${baseTag}${guardScript}`);
    } else {
      html = baseTag + guardScript + html;
    }

    return new Response(html, {
      headers: {
        'Content-Type': upstreamContentType || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return { GET: handle };
}

function jsonError(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
