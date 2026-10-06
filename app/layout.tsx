import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { getCurrentUser } from '@/lib/auth/session';
import { unreadCount } from '@/lib/notifications/notification-service';
import { bootstrapPlatform } from '@/lib/bootstrap';
import { getSystemSettings } from '@/lib/settings/settings-service';

export const metadata: Metadata = {
  title: {
    default: 'Aviator Insights — Live round analytics & prediction platform',
    template: '%s · Aviator Insights',
  },
  description:
    'A professional Aviator insights platform: live round feed integration, statistical round analysis, wallet, credits and a full administrative review workflow.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#05070d',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Creates data/ + storage/ and the bootstrap admin on first boot.
  await bootstrapPlatform();

  const [context, settings] = await Promise.all([getCurrentUser(), getSystemSettings()]);
  const user = context?.publicUser ?? null;
  const unread = user ? await unreadCount(user.id) : 0;

  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 font-sans text-slate-200">
        <ToastProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar user={user} unread={unread} siteName={settings.site_name} />
            <main className="flex-1">{children}</main>
            <SiteFooter siteName={settings.site_name} tagline={settings.tagline} />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
