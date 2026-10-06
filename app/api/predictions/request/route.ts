import type { NextRequest } from 'next/server';
import { ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireUser } from '@/lib/auth/session';
import { requestPrediction } from '@/lib/predictions/prediction-service';
import { LIMITS } from '@/lib/auth/rate-limit';

export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request, LIMITS.prediction);

  const { user } = await requireUser();
  const result = await requestPrediction(user);

  return ok({
    prediction: result.prediction,
    charged: result.charged,
    gems_remaining: result.gems_remaining,
    coins_remaining: result.coins_remaining,
  });
});

export const GET = route(async () => {
  const { user } = await requireUser();
  void user;
  return ok({ message: 'Use POST to request an analysis. History is served by the page.' });
});
