import ProtectedArea from '@/components/ProtectedArea';

/**
 * Signed-in area: authentication is resolved on the server before the page and
 * its data loaders run.
 */
export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedArea next="/notifications">{children}</ProtectedArea>;
}
