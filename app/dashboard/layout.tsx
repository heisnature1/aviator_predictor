import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * Server-side protection for the user area.
 * Rendering is blocked before any data is loaded — hiding links is not enough.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentUser();
  if (!context) redirect('/login?next=/dashboard');
  return <>{children}</>;
}
