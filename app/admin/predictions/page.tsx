import type { Metadata } from 'next';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { PredictionResult } from '@/components/PredictionResult';
import { requireAdmin } from '@/lib/auth/session';
import { listAllPredictions, predictionStats } from '@/lib/predictions/prediction-history';
import { listUsers } from '@/lib/users/user-service';
import { CONFIDENCE_LABELS } from '@/lib/predictions/prediction-engine';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Predictions' };

export default async function AdminPredictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const [predictions, users, stats] = await Promise.all([
    listAllPredictions(120),
    listUsers(),
    predictionStats(),
  ]);

  const filtered = params.user
    ? predictions.filter((prediction) => prediction.user_id === params.user)
    : predictions;

  const rows = filtered.map((prediction) => ({
    prediction,
    user: users.find((item) => item.id === prediction.user_id),
  }));

  return (
    <div>
      <PageHeader
        title="Predictions"
        subtitle="Every analysis request, including the ones refused for insufficient live data."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total requests" value={stats.total} />
        <StatCard label="Estimates produced" value={stats.generated} tone="success" />
        <StatCard label="Refused (no data)" value={stats.refused} tone="warning" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No predictions yet"
          message="Requests appear here as soon as users start generating analyses."
        />
      ) : (
        <>
          <div className="mb-6 table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Range</th>
                  <th className="hidden sm:table-cell">Confidence</th>
                  <th className="hidden md:table-cell">Data points</th>
                  <th className="hidden lg:table-cell">Cost</th>
                  <th>Status</th>
                  <th className="hidden lg:table-cell">Generated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ prediction, user }) => (
                  <tr key={prediction.id}>
                    <td>
                      <p className="text-xs font-medium text-white">{user?.full_name ?? 'Deleted user'}</p>
                      <p className="text-[11px] text-slate-500">{user?.email ?? '—'}</p>
                    </td>
                    <td className="font-semibold tabular text-white">
                      {prediction.estimated_min !== null && prediction.estimated_max !== null
                        ? `${prediction.estimated_min.toFixed(2)}x – ${prediction.estimated_max.toFixed(2)}x`
                        : '—'}
                    </td>
                    <td className="hidden text-xs text-slate-300 sm:table-cell">
                      {CONFIDENCE_LABELS[prediction.confidence]}
                    </td>
                    <td className="hidden tabular text-xs text-slate-300 md:table-cell">
                      {prediction.data_points}
                    </td>
                    <td className="hidden text-xs text-slate-300 lg:table-cell">
                      {prediction.cost_gems > 0 ? `${prediction.cost_gems} gems` : 'free'}
                    </td>
                    <td>
                      <span
                        className={
                          prediction.status === 'generated' ? 'badge-success' : 'badge-warning'
                        }
                      >
                        {prediction.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="hidden text-xs text-slate-400 lg:table-cell">
                      <LocalTime iso={prediction.created_at} mode="datetime" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
            Latest result detail
          </h2>
          {rows[0] ? <PredictionResult prediction={rows[0].prediction} /> : null}
        </>
      )}
    </div>
  );
}
