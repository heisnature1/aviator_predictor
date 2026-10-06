import { ok, route } from '@/lib/http';
import { getLiveFeed } from '@/lib/aviator/live-feed';

/**
 * Current Aviator snapshot.
 *
 * Returns exactly what the configured provider returned — including an
 * explicit `not_configured` / `error` state. The route never synthesizes
 * multipliers, so the UI can never present fabricated results as real.
 */
export const GET = route(async () => {
  const snapshot = await getLiveFeed();
  const response = ok(snapshot);
  response.headers.set('cache-control', 'no-store, max-age=0');
  return response;
});
