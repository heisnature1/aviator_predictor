import { createAviatorProvider, getAviatorConfig } from './provider';
import { EMPTY_SNAPSHOT, type AviatorProvider } from './types';
import type { AviatorSnapshot } from '@/types';

/**
 * Live feed facade.
 * ---------------------------------------------------------------------------
 * The single entry point used by pages, API routes and the prediction engine.
 *
 * Responsibilities:
 *   • pick the configured provider (HTTP → simulation → unconfigured)
 *   • short-TTL caching so every page render does not hammer the provider
 *   • convert provider failures into an explicit error state
 *
 * It never throws and never substitutes invented numbers for missing data.
 */

let providerInstance: AviatorProvider | null = null;
let cache: { snapshot: AviatorSnapshot; at: number } | null = null;

export interface FeedDiagnostics {
  provider: string;
  configured: boolean;
  mode: AviatorSnapshot['mode'];
  simulation_enabled: boolean;
  predictions_allow_simulated: boolean;
  cache_ttl_ms: number;
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  last_history_size: number;
}

const diagnostics: FeedDiagnostics = {
  provider: 'unconfigured',
  configured: false,
  mode: 'unavailable',
  simulation_enabled: false,
  predictions_allow_simulated: false,
  cache_ttl_ms: 1000,
  last_success_at: null,
  last_error: null,
  last_error_at: null,
  last_history_size: 0,
};

export function getProvider(): AviatorProvider {
  if (!providerInstance) {
    const config = getAviatorConfig();
    providerInstance = createAviatorProvider(config);
    diagnostics.provider = providerInstance.name;
    diagnostics.configured = providerInstance.isConfigured();
    diagnostics.simulation_enabled = config.simulationEnabled;
    diagnostics.predictions_allow_simulated = config.predictionsAllowSimulated;
    diagnostics.cache_ttl_ms = config.cacheTtlMs;
  }
  return providerInstance;
}

/** Test hook: drops the cached snapshot and provider instance. */
export function resetFeedCache(): void {
  cache = null;
  providerInstance = null;
}

export function isSimulatedFeed(): boolean {
  return getProvider().name === 'local-simulation';
}

export async function getLiveFeed(options: { force?: boolean } = {}): Promise<AviatorSnapshot> {
  const config = getAviatorConfig();
  const provider = getProvider();
  const ttl = Math.max(0, config.cacheTtlMs);

  if (!options.force && cache && Date.now() - cache.at < ttl) {
    return cache.snapshot;
  }

  try {
    const snapshot = await provider.getSnapshot();
    cache = { snapshot, at: Date.now() };
    diagnostics.last_success_at = snapshot.fetched_at;
    diagnostics.last_error = null;
    diagnostics.last_error_at = null;
    diagnostics.mode = snapshot.mode;
    diagnostics.last_history_size = snapshot.history.length;
    return snapshot;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'The Aviator data provider did not respond in time.'
          : error.message
        : 'The Aviator data provider could not be reached.';

    diagnostics.last_error = message;
    diagnostics.last_error_at = new Date().toISOString();

    const previous = cache?.snapshot;
    return {
      ...EMPTY_SNAPSHOT,
      provider: provider.name,
      connection: previous && previous.connection === 'connected' ? 'disconnected' : 'error',
      mode: 'unavailable',
      is_simulated: false,
      current_multiplier: null,
      current_status: 'unknown',
      history: [],
      recent_multipliers: [],
      fetched_at: new Date().toISOString(),
      message: `Live feed unavailable: ${message}`,
    };
  }
}

export function getFeedDiagnostics(): FeedDiagnostics {
  getProvider();
  return { ...diagnostics };
}

/** Multipliers from the newest completed rounds, oldest → newest. */
export function recentMultipliers(snapshot: AviatorSnapshot, limit = 120): number[] {
  const values = snapshot.history
    .map((round) => round.multiplier)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 1);
  return values.slice(0, limit).reverse();
}
