import { getLiveFeed, recentMultipliers } from '@/lib/aviator/live-feed';
import { getAviatorConfig } from '@/lib/aviator/provider';
import { PREDICTION_DISCLAIMER, analyse, ENGINE_VERSION } from './prediction-engine';
import { predictionsCollection } from '@/lib/storage/collections';
import { Errors } from '@/lib/http';
import { getSystemSettings } from '@/lib/settings/settings-service';
import { hasSufficientBalance } from '@/lib/wallet/wallet-service';
import { debitWallet, getBalances } from '@/lib/wallet/wallet-service';
import { notify } from '@/lib/notifications/notification-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { newId, nowIso } from '@/lib/utils';
import type { Prediction, User } from '@/types';

/**
 * Prediction service — the only place a prediction may be created.
 *
 * Order of operations (all server-side):
 *   1. account must be active
 *   2. wallet must cover the configured cost
 *   3. live provider data must be available and sufficient
 *   4. the engine runs
 *   5. credits are deducted
 *   6. the prediction is stored
 *
 * If any step fails before the engine produces a usable estimate, no credits
 * are deducted.
 */

export interface RequestPredictionResult {
  prediction: Prediction;
  charged: boolean;
  gems_remaining: number;
  coins_remaining: number;
}

export async function requestPrediction(user: User): Promise<RequestPredictionResult> {
  if (user.account_status !== 'active') {
    throw Errors.forbidden(
      user.account_status === 'pending'
        ? 'Your account is pending activation. Complete the activation payment to unlock predictions.'
        : 'Your account is not active. Contact support for assistance.',
    );
  }

  const settings = await getSystemSettings();

  if (settings.maintenance_mode) {
    throw Errors.server('Predictions are temporarily disabled for maintenance. Please try again later.');
  }

  // Cost comes from server settings — never from the browser.
  const costGems = Math.max(0, Math.trunc(settings.prediction_cost_gems));
  const costCoins = Math.max(0, Math.trunc(settings.prediction_cost_coins));

  const { gems, coins } = await getBalances(user.id);
  if (gems < costGems || coins < costCoins) {
    throw Errors.invalid(
      `Insufficient credits. This analysis costs ${costGems} gems${
        costCoins > 0 ? ` and ${costCoins} coins` : ''
      }, and your balance is ${gems.toLocaleString()} gems.`,
    );
  }

  // --- Obtain data from the configured provider ---------------------------
  const snapshot = await getLiveFeed();
  const config = getAviatorConfig();

  const feedUsable =
    snapshot.connection === 'connected' &&
    snapshot.mode !== 'unavailable' &&
    snapshot.recent_multipliers.length > 0;

  const refused = (reason: string): Prediction => ({
    id: newId('prd'),
    user_id: user.id,
    status: 'unavailable',
    estimated_min: null,
    estimated_max: null,
    confidence: 'insufficient',
    analysis: [{ label: 'Live feed', value: 'Unavailable', note: reason }],
    summary: reason,
    data_points: snapshot.recent_multipliers.length,
    data_source: snapshot.is_simulated ? 'simulation' : 'live_provider',
    provider: snapshot.provider,
    snapshot_at: snapshot.updated_at,
    round_id: snapshot.current_round_id,
    cost_gems: 0,
    cost_coins: 0,
    engine_version: ENGINE_VERSION,
    disclaimer: PREDICTION_DISCLAIMER,
    created_at: nowIso(),
  });

  if (!feedUsable) {
    const prediction = refused(
      snapshot.connection === 'not_configured'
        ? 'No Aviator data provider is configured, so there is no real round data to analyse.'
        : `The live feed is currently unavailable: ${snapshot.message ?? 'no data received'}.`,
    );
    await predictionsCollection.mutate((items) => [...items, prediction]);
    return { prediction, charged: false, gems_remaining: gems, coins_remaining: coins };
  }

  // Simulated data is not real game data — by default we refuse to present an
  // analysis of it as if it were.
  if (snapshot.is_simulated && !config.predictionsAllowSimulated) {
    const prediction = refused(
      'The connected feed is a local simulator, not real game data. Enable AVIATOR_PREDICTIONS_ALLOW_SIMULATED for local testing only.',
    );
    await predictionsCollection.mutate((items) => [...items, prediction]);
    return { prediction, charged: false, gems_remaining: gems, coins_remaining: coins };
  }

  const multipliers = recentMultipliers(snapshot, settings.history_window);
  const result = analyse({
    multipliers,
    minDataPoints: settings.min_data_points,
    window: settings.history_window,
  });

  const id = newId('prd');
  let charged = false;
  let gemsRemaining = gems;
  let coinsRemaining = coins;

  // Charge only when the engine actually produced an estimate.
  if (result.status === 'generated') {
    if (costGems > 0) {
      const outcome = await debitWallet({
        user_id: user.id,
        currency: 'gems',
        amount: costGems,
        type: 'prediction_usage',
        reference: id,
        description: `Prediction analysis (${result.estimated_min?.toFixed(2)}x – ${result.estimated_max?.toFixed(2)}x)`,
      });
      gemsRemaining = outcome.balance_after;
      charged = true;
    }
    if (costCoins > 0) {
      const outcome = await debitWallet({
        user_id: user.id,
        currency: 'coins',
        amount: costCoins,
        type: 'prediction_usage',
        reference: id,
        description: 'Prediction analysis',
      });
      coinsRemaining = outcome.balance_after;
      charged = true;
    }
  }

  const prediction: Prediction = {
    id,
    user_id: user.id,
    status: result.status,
    estimated_min: result.estimated_min,
    estimated_max: result.estimated_max,
    confidence: result.confidence,
    analysis: result.analysis,
    summary: result.summary,
    data_points: result.data_points,
    data_source: snapshot.is_simulated ? 'simulation' : 'live_provider',
    provider: snapshot.provider,
    snapshot_at: snapshot.updated_at,
    round_id: snapshot.current_round_id,
    cost_gems: charged ? costGems : 0,
    cost_coins: charged ? costCoins : 0,
    engine_version: ENGINE_VERSION,
    disclaimer: PREDICTION_DISCLAIMER,
    created_at: nowIso(),
  };

  await predictionsCollection.mutate((items) => [...items, prediction]);

  await recordAudit({
    admin_id: null,
    action: 'prediction_generated',
    target_user: user.id,
    target_label: `${user.full_name} (${user.email})`,
    previous_value: null,
    new_value:
      result.status === 'generated'
        ? `${result.estimated_min?.toFixed(2)}x – ${result.estimated_max?.toFixed(2)}x (${result.confidence})`
        : result.status,
    reason: `charged:${charged}`,
  });

  if (result.status === 'generated') {
    await notify({
      user_id: user.id,
      kind: 'prediction_generated',
      title: 'Analysis ready',
      message: `Estimated range ${result.estimated_min?.toFixed(2)}x – ${result.estimated_max?.toFixed(
        2,
      )}x (${result.confidence}). ${
        charged ? `${costGems} gems were deducted.` : ''
      }`,
      link: '/predictions',
    });
  }

  if (charged && gemsRemaining < settings.low_balance_threshold && settings.low_balance_threshold > 0) {
    await notify({
      user_id: user.id,
      kind: 'low_balance',
      title: 'Wallet running low',
      message: `You have ${gemsRemaining.toLocaleString()} gems left. Top up to keep generating analyses.`,
      link: '/wallet',
    });
  }

  return { prediction, charged, gems_remaining: gemsRemaining, coins_remaining: coinsRemaining };
}

export async function canAffordPrediction(userId: string): Promise<boolean> {
  const settings = await getSystemSettings();
  const gemsOk = await hasSufficientBalance(userId, 'gems', settings.prediction_cost_gems);
  const coinsOk = await hasSufficientBalance(userId, 'coins', settings.prediction_cost_coins);
  return gemsOk && coinsOk;
}
