import type {
  AviatorConnectionStatus,
  AviatorFeedMode,
  AviatorRound,
  AviatorRoundStatus,
  AviatorSnapshot,
} from '@/types';

export type {
  AviatorConnectionStatus,
  AviatorFeedMode,
  AviatorRound,
  AviatorRoundStatus,
  AviatorSnapshot,
};

export interface AviatorProvider {
  /** Stable identifier shown in the UI diagnostics panel. */
  readonly name: string;
  /** True when real credentials/endpoint are configured. */
  isConfigured(): boolean;
  /** Fetches the current state from the data source. */
  getSnapshot(): Promise<AviatorSnapshot>;
}

export interface AviatorProviderConfig {
  url: string | null;
  key: string | null;
  headers: Record<string, string>;
  timeoutMs: number;
  cacheTtlMs: number;
  simulationEnabled: boolean;
  predictionsAllowSimulated: boolean;
}

export const EMPTY_SNAPSHOT: AviatorSnapshot = {
  provider: 'unconfigured',
  mode: 'unavailable',
  is_simulated: false,
  connection: 'not_configured',
  current_round_id: null,
  current_multiplier: null,
  current_status: 'unknown',
  round_started_at: null,
  history: [],
  updated_at: new Date().toISOString(),
  fetched_at: new Date().toISOString(),
  recent_multipliers: [],
  message:
    'No Aviator data provider is configured, so no live game data is available. This platform never invents game results.',
};
