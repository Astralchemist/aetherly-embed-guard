export interface ProviderHostRule {
  /** Human-friendly identifier returned to the caller (e.g. for logging). */
  provider: string;
  /** Regex tested against the upstream hostname (lowercased). */
  hostRegex: RegExp;
}

/**
 * Default allowlist for common TMDB-keyed video embed providers and their
 * known CDNs. Pass your own list to `createEmbedGuardHandler({ providerHosts })`
 * if you want to lock the proxy down further or extend it.
 */
export const DEFAULT_PROVIDER_HOST_RULES: ProviderHostRule[] = [
  { provider: 'vidsrc', hostRegex: /(^|\.)vidsrc\.xyz$/i },
  { provider: 'vidsrc', hostRegex: /(^|\.)vidsrc\.to$/i },
  { provider: 'vidsrc', hostRegex: /(^|\.)vidsrc\.cc$/i },
  { provider: 'vidsrc', hostRegex: /(^|\.)vidsrc\.me$/i },
  { provider: 'vidsrc', hostRegex: /(^|\.)vidsrc\.in$/i },
  { provider: 'vidsrc', hostRegex: /(^|\.)vidsrc\.pm$/i },
  { provider: 'vidsrc', hostRegex: /(^|\.)vidsrc\.net$/i },
  { provider: 'vidsrc-cdn', hostRegex: /(^|\.)cloudnestra\.com$/i },
  { provider: 'vidsrc-cdn', hostRegex: /(^|\.)streame\.net$/i },
  { provider: 'vidsrc-cdn', hostRegex: /(^|\.)rcp\.cloudnestra\.com$/i },
  { provider: 'vidsrc-cdn', hostRegex: /(^|\.)prorcp\.cloudnestra\.com$/i },
  { provider: 'vidfast', hostRegex: /(^|\.)vidfast\.pro$/i },
  { provider: 'vidlink', hostRegex: /(^|\.)vidlink\.pro$/i },
  { provider: 'embedsu', hostRegex: /(^|\.)embed\.su$/i },
  { provider: '2embed', hostRegex: /(^|\.)2embed\.cc$/i },
  { provider: '2embed', hostRegex: /(^|\.)2embed\.to$/i },
  { provider: '2embed', hostRegex: /(^|\.)2embed\.org$/i },
  { provider: '2embed', hostRegex: /(^|\.)2embed\.skin$/i },
  { provider: 'youtube', hostRegex: /(^|\.)youtube\.com$/i },
  { provider: 'youtube', hostRegex: /(^|\.)youtube-nocookie\.com$/i },
  { provider: 'youtube', hostRegex: /(^|\.)youtu\.be$/i },
  { provider: 'vimeo', hostRegex: /(^|\.)vimeo\.com$/i },
  { provider: 'archive', hostRegex: /(^|\.)archive\.org$/i },
  { provider: 'twitch', hostRegex: /(^|\.)twitch\.tv$/i },
  { provider: 'peertube', hostRegex: /(^|\.)peertube\./i },
];

/**
 * Providers that detect `window.frameElement.sandbox` and refuse to play if
 * any sandbox flags are set ("please disable sandbox" black screen). The
 * recommended workflow is to load these *direct* (no proxy, no sandbox) and
 * rely on the browser's built-in popup/tab blocker for mitigation.
 */
export const DEFAULT_TRUSTED_DIRECT_HOSTS = ['vidfast.pro', 'vidlink.pro', 'embed.su'] as const;

/**
 * Providers that don't always respond well to the reverse proxy (e.g. they
 * 403 server-to-server requests but work fine when the user's browser loads
 * them direct in a sandboxed iframe). When the proxy probe fails, the
 * client-side helper falls back to a direct sandboxed iframe load instead of
 * skipping the source entirely.
 */
export const DEFAULT_DIRECT_FALLBACK_HOSTS = [
  'vidsrc.xyz',
  'vidsrc.to',
  'vidsrc.cc',
  '2embed.cc',
] as const;

export function findProvider(
  hostname: string,
  rules: ProviderHostRule[] = DEFAULT_PROVIDER_HOST_RULES,
): string | null {
  const normalized = hostname.toLowerCase();
  const match = rules.find(({ hostRegex }) => hostRegex.test(normalized));
  return match?.provider ?? null;
}

export function matchesHostList(url: string, list: readonly string[]): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return list.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function isTrustedDirect(
  url: string,
  list: readonly string[] = DEFAULT_TRUSTED_DIRECT_HOSTS,
): boolean {
  return matchesHostList(url, list);
}

export function shouldUseDirectFallback(
  url: string,
  list: readonly string[] = DEFAULT_DIRECT_FALLBACK_HOSTS,
): boolean {
  return matchesHostList(url, list);
}
