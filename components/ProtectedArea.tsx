import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * Server-side guard for a signed-in area.
 *
 * Runs before the page body, so no personal data is read for an anonymous
 * visitor and an expired session produces a redirect instead of an error.
 * Hiding links in the navigation is cosmetic — this is the real check.
 */
export default async function ProtectedArea({
  children,
  next,
}: {
  children: React.ReactNode;
  /** Path to return to after signing in. */
  next: string;
}) {
  const context = await getCurrentUser();
  if (!context) redirect(`/login?next=${encodeURIComponent(next)}`);
  return <>{children}</>;
}
