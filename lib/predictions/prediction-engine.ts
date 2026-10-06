import type { PredictionAnalysisPoint, PredictionConfidence, PredictionStatus } from '@/types';

/**
 * Prediction engine.
 * =============================================================================
 *
 * WHAT THIS IS
 * A descriptive statistics module. It looks at the multipliers of the most
 * recent rounds supplied by the configured Aviator data provider and reports
 * where recent outcomes have clustered, expressed as an estimated reachable
 * band with an explicit probability estimate.
 *
 * WHAT THIS IS NOT
 * • It is not a forecast of the next crash point.
 * • It is not a guarantee of profit, winnings, or any particular outcome.
 * • It has no access to the server-side round seed: Aviator rounds are
 *   cryptographically committed before they start, so no model can know the
 *   next crash multiplier in advance. Any product claiming otherwise is lying.
 *
 * METHOD
 *   1. clean the sample (only finite values >= 1.00x)
 *   2. require `minDataPoints` rounds, otherwise refuse to produce an estimate
 *   3. build the empirical survival curve  S(x) = P(round >= x)
 *   4. band = [largest x with S(x) >= 0.60, largest x with S(x) >= 0.35]
 *      i.e. recent rounds reached the low end about 60% of the time and the
 *      high end about 35% of the time
 *   5. confidence describes how STABLE that estimate is (sample size and
 *      dispersion) — never "how likely you are to win"
 */

export const ENGINE_VERSION = 'statistical-v1';

export const PREDICTION_DISCLAIMER =
  'Platform analysis based on recent rounds, not an official game result and not a prediction of the next crash point. No outcome is guaranteed.';

export interface EngineInput {
  multipliers: number[];
  minDataPoints: number;
  /** Upper bound on how many recent rounds are considered. */
  window?: number;
}

export interface EngineResult {
  status: PredictionStatus;
  estimated_min: number | null;
  estimated_max: number | null;
  confidence: PredictionConfidence;
  analysis: PredictionAnalysisPoint[];
  summary: string;
  data_points: number;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }
  return sorted[middle] ?? 0;
}

function stdDev(values: number[], average = mean(values)): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const lower = sorted[base] ?? 0;
  const upper = sorted[base + 1] ?? lower;
  return lower + rest * (upper - lower);
}

/** Empirical P(round >= threshold) across the sample. */
function survival(values: number[], threshold: number): number {
  if (values.length === 0) return 0;
  return values.filter((value) => value >= threshold).length / values.length;
}

/** Largest threshold on the grid that at least `probability` of rounds reached. */
function thresholdForProbability(values: number[], probability: number, ceiling: number): number {
  let best = 1;
  for (let threshold = 1.05; threshold <= ceiling; threshold += 0.01) {
    if (survival(values, threshold) >= probability) {
      best = threshold;
    } else {
      break; // survival is monotonically decreasing
    }
  }
  return Math.round(best * 100) / 100;
}

export function analyse(input: EngineInput): EngineResult {
  const window = input.window ?? 120;
  const clean = input.multipliers
    .filter((value) => typeof value === 'number' && Number.isFinite(value) && value >= 1)
    .slice(-window);

  const dataPoints = clean.length;

  if (dataPoints < Math.max(1, input.minDataPoints)) {
    return {
      status: 'insufficient_data',
      estimated_min: null,
      estimated_max: null,
      confidence: 'insufficient',
      data_points: dataPoints,
      analysis: [
        {
          label: 'Rounds available',
          value: `${dataPoints}`,
          note: `${Math.max(1, input.minDataPoints)} are required for a meaningful read.`,
        },
      ],
      summary: `Not enough live round data yet (${dataPoints} of ${Math.max(
        1,
        input.minDataPoints,
      )} required). No estimate is produced rather than guessing.`,
    };
  }

  const sorted = [...clean].sort((a, b) => a - b);
  const average = mean(clean);
  const middle = median(clean);
  const deviation = stdDev(clean, average);
  const variation = average > 0 ? deviation / average : 1;
  const ceiling = Math.min(Math.max(5, Math.ceil(Math.max(...clean))), 50);

  const lowBand = Math.max(1.05, thresholdForProbability(clean, 0.6, ceiling));
  const highBand = Math.max(lowBand + 0.15, thresholdForProbability(clean, 0.35, ceiling));
  const estimatedMin = Math.round(lowBand * 100) / 100;
  const estimatedMax = Math.round(Math.min(highBand, Math.max(estimatedMin + 0.15, middle * 1.6)) * 100) / 100;

  // Short-term momentum: last 10 rounds versus the preceding batch.
  const recent = clean.slice(-10);
  const earlier = clean.slice(0, Math.max(0, clean.length - 10));
  const recentAverage = recent.length ? mean(recent) : average;
  const earlierAverage = earlier.length ? mean(earlier) : average;
  const drift = earlierAverage > 0 ? (recentAverage - earlierAverage) / earlierAverage : 0;

  const momentumLabel =
    drift > 0.12 ? 'Higher than the earlier sample' : drift < -0.12 ? 'Lower than the earlier sample' : 'In line with the earlier sample';

  const share = (threshold: number) =>
    `${Math.round(survival(clean, threshold) * 100)}% of the last ${dataPoints} rounds reached ${threshold.toFixed(2)}x`;

  const confidence: PredictionConfidence =
    dataPoints >= 60 && variation <= 0.9
      ? 'high'
      : dataPoints >= 30 && variation <= 1.4
        ? 'moderate'
        : 'low';

  const analysis: PredictionAnalysisPoint[] = [
    { label: 'Rounds analysed', value: `${dataPoints}` },
    { label: 'Median crash point', value: `${middle.toFixed(2)}x` },
    { label: 'Average crash point', value: `${average.toFixed(2)}x` },
    {
      label: 'Volatility',
      value: variation <= 0.7 ? 'Stable' : variation <= 1.3 ? 'Moderate' : 'High',
      note: `Standard deviation ${deviation.toFixed(2)}x`,
    },
    { label: 'Reached 2.00x', value: share(2) },
    { label: 'Reached 3.00x', value: share(3) },
    { label: 'Last 10 rounds', value: momentumLabel, note: `Average ${recentAverage.toFixed(2)}x` },
    {
      label: 'Estimated reach',
      value: `${Math.round(survival(clean, estimatedMin) * 100)}% reached ${estimatedMin.toFixed(2)}x`,
      note: `${Math.round(survival(clean, estimatedMax) * 100)}% reached ${estimatedMax.toFixed(2)}x`,
    },
  ];

  return {
    status: 'generated',
    estimated_min: estimatedMin,
    estimated_max: estimatedMax,
    confidence,
    data_points: dataPoints,
    analysis,
    summary: `Across the last ${dataPoints} rounds from the live provider feed, outcomes clustered around ${middle.toFixed(
      2,
    )}x. The estimated reachable band is ${estimatedMin.toFixed(2)}x – ${estimatedMax.toFixed(
      2,
    )}x. Confidence (${confidence}) describes how stable this sample is, not a probability of winning.`,
  };
}

export const CONFIDENCE_LABELS: Record<PredictionConfidence, string> = {
  insufficient: 'Not enough data',
  low: 'Low confidence',
  moderate: 'Moderate confidence',
  high: 'Stable sample',
};
