export { createEmbedGuardHandler } from './handler.js';
export type { EmbedGuardHandler, EmbedGuardOptions } from './handler.js';
export {
  DEFAULT_PROVIDER_HOST_RULES,
  DEFAULT_TRUSTED_DIRECT_HOSTS,
  DEFAULT_DIRECT_FALLBACK_HOSTS,
  findProvider,
  matchesHostList,
  isTrustedDirect,
  shouldUseDirectFallback,
} from './hosts.js';
export type { ProviderHostRule } from './hosts.js';
export { buildGuardScript, looksLikeBotChallenge } from './guard-script.js';
