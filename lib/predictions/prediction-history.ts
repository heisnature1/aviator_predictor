import { predictionsCollection } from '@/lib/storage/collections';
import type { Prediction } from '@/types';

/** Prediction history & reporting helpers. */

export async function listUserPredictions(userId: string, limit = 50): Promise<Prediction[]> {
  const predictions = await predictionsCollection.read();
  return predictions
    .filter((prediction) => prediction.user_id === userId)
    .slice(-limit)
    .reverse();
}

export async function listAllPredictions(limit = 200): Promise<Prediction[]> {
  const predictions = await predictionsCollection.read();
  return predictions.slice(-limit).reverse();
}

export async function getPrediction(id: string): Promise<Prediction | null> {
  const predictions = await predictionsCollection.read();
  return predictions.find((prediction) => prediction.id === id) ?? null;
}

export async function predictionStats(): Promise<{
  total: number;
  generated: number;
  refused: number;
  last24h: number;
}> {
  const predictions = await predictionsCollection.read();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return {
    total: predictions.length,
    generated: predictions.filter((prediction) => prediction.status === 'generated').length,
    refused: predictions.filter((prediction) => prediction.status !== 'generated').length,
    last24h: predictions.filter(
      (prediction) => new Date(prediction.created_at).getTime() >= cutoff,
    ).length,
  };
}
