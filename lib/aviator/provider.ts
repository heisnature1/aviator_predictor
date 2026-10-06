import { EMPTY_SNAPSHOT, type AviatorProvider, type AviatorProviderConfig } from './types';
import type { AviatorRound, AviatorRoundStatus, AviatorSnapshot } from '@/types';

/**
 * Aviator data providers.
 * =============================================================================
 *
 * This layer is the ONLY place in the application that talks to a game data
 * source. Everything upstream (UI, prediction engine, API) consumes the
 * neutral `AviatorSnapshot` shape defined in lib/aviator/types.ts.
 *
 * ── Connecting a real provider ───────────────────────────────────────────────
 * Set AVIATOR_PROVIDER_URL (and AVIATOR_PROVIDER_KEY when required). The HTTP
 * provider below will then be used and no other code has to change.
 *
 * The endpoint must return JSON that `normalisePayload()` can understand —
 * either the canonical shape:
 *
 *   {
 *     "roundId": "9f2c...",
 *     "status": "flying" | "betting" | "waiting" | "crashed",
 *     "multiplier": 2.31,
 *     "startedAt": "2026-01-01T12:00:00.000Z",
 *     "history": [
 *       { "roundId": "...", "multiplier": 1.42, "endedAt": "..." }
 *     ]
 *   }
 *
 * or any of the common aliases handled in `pick*()` below (snake_case keys,
 * `crashPoint`, `rounds`, `recent`, …).
 *
 * ── Integrity rules ─────────────────────────────────────────────────────────
 * • No provider is configured → the snapshot reports `not_configured` with an
 *   empty history. Nothing is fabricated.
 * • The local simulator only runs when AVIATOR_ALLOW_SIMULATION=true and every
 *   snapshot it emits is flagged `is_simulated: true` so the UI can label it.
 * • Provider errors are surfaced as `connection: 'error'` — they never degrade
 *   into invented numbers.
 */

export function getAviatorConfig(): AviatorProviderConfig {
  const rawHeaders = process.env.AVIATOR_PROVIDER_HEADERS?.trim();
  let headers: Record<string, string> = {};
  if (rawHeaders) {
    try {
      const parsed = JSON.parse(rawHeaders) as Record<string, unknown>;
      headers = Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)]),
      );
    } catch {
      console.warn('[aviator] AVIATOR_PROVIDER_HEADERS is not valid JSON — ignoring.');
    }
  }

  const timeoutMs = Number(process.env.AVIATOR_PROVIDER_TIMEOUT_MS) || 4000;
  const cacheTtlMs = Number(process.env.AVIATOR_CACHE_TTL_MS) || 1000;

  return {
    url: process.env.AVIATOR_PROVIDER_URL?.trim() || null,
    key: process.env.AVIATOR_PROVIDER_KEY?.trim() || null,
    headers,
    timeoutMs,
    cacheTtlMs,
    simulationEnabled: process.env.AVIATOR_ALLOW_SIMULATION === 'true',
    predictionsAllowSimulated: process.env.AVIATOR_PREDICTIONS_ALLOW_SIMULATED === 'true',
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const ROUND_STATUSES: AviatorRoundStatus[] = ['waiting', 'betting', 'flying', 'crashed', 'unknown'];

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStatus(value: unknown): AviatorRoundStatus {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('wait')) return 'waiting';
  if (raw.includes('bet') || raw.includes('pending') || raw.includes('starting')) return 'betting';
  if (raw.includes('fly') || raw.includes('in_progress') || raw.includes('live')) return 'flying';
  if (raw.includes('crash') || raw.includes('end') || raw.includes('complete')) return 'crashed';
  return 'unknown';
}

function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function normaliseRounds(value: unknown): AviatorRound[] {
  if (!Array.isArray(value)) return [];
  const rounds: AviatorRound[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const multiplier = toNumber(pick(record, ['multiplier', 'crashPoint', 'crash_point', 'value', 'x']));
    if (multiplier === null) continue;
    rounds.push({
      round_id: String(pick(record, ['roundId', 'round_id', 'id', 'round']) ?? `r${rounds.length}`),
      multiplier: Math.max(1, Math.round(multiplier * 100) / 100),
      status: toStatus(pick(record, ['status', 'state', 'phase'])) || 'crashed',
      started_at: String(pick(record, ['startedAt', 'started_at', 'start']) ?? '') || null,
      ended_at: String(pick(record, ['endedAt', 'ended_at', 'end', 'crashedAt', 'crashed_at']) ?? '') || null,
    });
  }
  return rounds;
}

/**
 * Maps an arbitrary provider payload onto the internal snapshot shape.
 * Exported so a bespoke provider can be unit tested without HTTP.
 */
export function normalisePayload(
  payload: unknown,
  meta: { provider: string; fetchedAt: string },
): AviatorSnapshot {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Provider returned an empty response.');
  }
  const record = payload as Record<string, unknown>;
  const container = (pick(record, ['data', 'result', 'game', 'round']) ?? record) as Record<
    string,
    unknown
  >;

  const status = toStatus(pick(container, ['status', 'state', 'phase']));
  const multiplier = toNumber(
    pick(container, ['multiplier', 'crashPoint', 'crash_point', 'currentMultiplier', 'value']),
  );
  const history = normaliseRounds(
    pick(container, ['history', 'rounds', 'recent', 'recentRounds', 'results']),
  );

  const snapshot: AviatorSnapshot = {
    provider: meta.provider,
    mode: 'live',
    is_simulated: false,
    connection: 'connected',
    current_round_id:
      String(pick(container, ['roundId', 'round_id', 'id']) ?? '') || null,
    current_multiplier:
      multiplier === null ? null : Math.max(1, Math.round(multiplier * 100) / 100),
    current_status: status === 'unknown' ? 'flying' : status,
    round_started_at:
      String(pick(container, ['startedAt', 'started_at', 'start']) ?? '') || null,
    history,
    updated_at:
      String(pick(container, ['updatedAt', 'updated_at', 'timestamp', 'serverTime']) ?? '') ||
      meta.fetchedAt,
    fetched_at: meta.fetchedAt,
    recent_multipliers: history.map((round) => round.multiplier ?? 0).filter((value) => value > 0),
    message: null,
  };

  return snapshot;
}

// ---------------------------------------------------------------------------
// HTTP provider — real, authorised data source
// ---------------------------------------------------------------------------

export function createHttpProvider(config: AviatorProviderConfig): AviatorProvider {
  return {
    name: config.url ? new URL(config.url).host : 'http-provider',

    isConfigured() {
      return Boolean(config.url);
    },

    async getSnapshot() {
      if (!config.url) {
        return { ...EMPTY_SNAPSHOT, provider: this.name };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const response = await fetch(config.url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
            ...(config.key ? { authorization: `Bearer ${config.key}` } : {}),
            ...config.headers,
          },
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Provider responded with status ${response.status}.`);
        }

        const payload = (await response.json()) as unknown;
        const snapshot = normalisePayload(payload, {
          provider: this.name,
          fetchedAt: new Date().toISOString(),
        });

        if (snapshot.current_multiplier === null && snapshot.history.length === 0) {
          return {
            ...snapshot,
            connection: 'connected' as const,
            message:
              'The provider is connected but returned no round data yet. Waiting for the next round.',
          };
        }
        return snapshot;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Local simulator — DEVELOPMENT ONLY, always flagged as simulated
// ---------------------------------------------------------------------------

/**
 * A self-contained crash-game simulator used to exercise the UI when no
 * authorised provider exists (offline development, demos, tests).
 *
 * Every snapshot it returns carries `is_simulated: true` / `mode: 'simulation'`
 * and the UI renders an unmistakable badge. It is disabled by default and must
 * never be enabled in production.
 */
export function createSimulationProvider(options: { historySize?: number } = {}): AviatorProvider {
  const historySize = options.historySize ?? 40;
  const BETTING_MS = 6000;
  const GAP_MS = 1800;
  const GROWTH_RATE = 0.22; // multiplier grows as e^(rate * seconds)

  interface SimState {
    index: number;
    phaseStart: number;
    crashPoint: number;
    history: AviatorRound[];
  }

  const epoch = Date.now();
  let state: SimState | null = null;

  /**
   * Back-fills deterministic "past" rounds so the UI has a history to render
   * straight away. Purely cosmetic — every snapshot is still flagged as
   * simulated.
   */
  function prefillHistory(rounds: number): AviatorRound[] {
    const history: AviatorRound[] = [];
    for (let index = -rounds; index < 0; index += 1) {
      const crashPoint = crashPointFor(index);
      const flight = flightMs(crashPoint);
      const endedAt = epoch - Math.abs(index) * (BETTING_MS + 4000 + GAP_MS);
      history.push({
        round_id: `sim-h${index}`,
        multiplier: crashPoint,
        status: 'crashed',
        started_at: new Date(endedAt - flight).toISOString(),
        ended_at: new Date(endedAt).toISOString(),
      });
    }
    return history;
  }

  /** Deterministic PRNG so a round's crash point is stable while it runs. */
  function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function crashPointFor(index: number): number {
    const random = mulberry32(index * 2654435761);
    const roll = random();
    if (roll < 0.033) return 1; // instant crash
    const value = 0.99 / (1 - roll * 0.9995);
    return Math.max(1, Math.min(Math.round(value * 100) / 100, 500));
  }

  function flightMs(crashPoint: number): number {
    return Math.max(600, (Math.log(Math.max(crashPoint, 1.01)) / GROWTH_RATE) * 1000);
  }

  function advance(now: number): SimState {
    if (!state) {
      state = {
        index: 0,
        phaseStart: epoch,
        crashPoint: crashPointFor(0),
        history: prefillHistory(Math.min(historySize, 48)),
      };
    }

    let guard = 0;
    while (guard < 5000) {
      guard += 1;
      const flight = flightMs(state.crashPoint);
      const roundEnd = state.phaseStart + BETTING_MS + flight + GAP_MS;
      if (now < roundEnd) break;

      state.history.push({
        round_id: `sim-${state.index}`,
        multiplier: state.crashPoint,
        status: 'crashed',
        started_at: new Date(state.phaseStart + BETTING_MS).toISOString(),
        ended_at: new Date(state.phaseStart + BETTING_MS + flight).toISOString(),
      });
      if (state.history.length > historySize) state.history.shift();

      state.index += 1;
      state.phaseStart = roundEnd;
      state.crashPoint = crashPointFor(state.index);
    }

    return state;
  }

  return {
    name: 'local-simulation',

    isConfigured() {
      return true;
    },

    async getSnapshot() {
      const now = Date.now();
      const current = advance(now);
      const flight = flightMs(current.crashPoint);
      const bettingEnd = current.phaseStart + BETTING_MS;
      const flightEnd = bettingEnd + flight;

      let status: AviatorRoundStatus;
      let multiplier: number | null = null;

      if (now < current.phaseStart) {
        status = 'waiting';
      } else if (now < bettingEnd) {
        status = 'betting';
        multiplier = 1;
      } else if (now < flightEnd) {
        status = 'flying';
        const elapsed = (now - bettingEnd) / 1000;
        multiplier = Math.max(1, Math.round(Math.exp(GROWTH_RATE * elapsed) * 100) / 100);
      } else {
        status = 'crashed';
        multiplier = current.crashPoint;
      }

      const history = [...current.history].reverse();
      const snapshot: AviatorSnapshot = {
        provider: this.name,
        mode: 'simulation',
        is_simulated: true,
        connection: 'connected',
        current_round_id: `sim-${current.index}`,
        current_multiplier: multiplier,
        current_status: status,
        round_started_at: new Date(bettingEnd).toISOString(),
        history,
        updated_at: new Date(now).toISOString(),
        fetched_at: new Date(now).toISOString(),
        recent_multipliers: history
          .map((round) => round.multiplier ?? 0)
          .filter((value) => value > 0),
        message:
          'Simulated local feed for development only — this is not official Aviator game data.',
      };
      return snapshot;
    },
  };
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

export function createAviatorProvider(config: AviatorProviderConfig = getAviatorConfig()): AviatorProvider {
  if (config.url) return createHttpProvider(config);
  if (config.simulationEnabled) return createSimulationProvider();
  return {
    name: 'unconfigured',
    isConfigured: () => false,
    async getSnapshot() {
      return { ...EMPTY_SNAPSHOT, fetched_at: new Date().toISOString() };
    },
  };
}

export { ROUND_STATUSES };
