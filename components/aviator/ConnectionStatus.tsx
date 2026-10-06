'use client';

import { AlertTriangle, Loader2, Radio, WifiOff } from 'lucide-react';
import type { AviatorConnectionStatus } from '@/types';

const CONFIG: Record<
  AviatorConnectionStatus,
  { label: string; className: string; icon: typeof Radio }
> = {
  connected: { label: 'Live feed connected', className: 'text-success-400', icon: Radio },
  connecting: { label: 'Connecting…', className: 'text-coin-300', icon: Loader2 },
  disconnected: { label: 'Disconnected', className: 'text-danger-400', icon: WifiOff },
  not_configured: { label: 'No provider configured', className: 'text-coin-300', icon: AlertTriangle },
  error: { label: 'Feed error', className: 'text-danger-400', icon: AlertTriangle },
};

export function ConnectionStatus({
  status,
  provider,
  message,
  compact = false,
}: {
  status: AviatorConnectionStatus;
  provider: string;
  message?: string | null;
  compact?: boolean;
}) {
  const config = CONFIG[status] ?? CONFIG.error;
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-2 text-xs font-semibold ${config.className}`}>
        <span className="relative flex h-2 w-2">
          {status === 'connected' ? (
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success-400" />
          ) : null}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              status === 'connected'
                ? 'bg-success-400'
                : status === 'connecting'
                  ? 'bg-coin-400'
                  : 'bg-danger-400'
            }`}
          />
        </span>
        <Icon className={`h-3.5 w-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />
        {config.label}
        {!compact ? <span className="text-slate-500">· {provider}</span> : null}
      </div>
      {message && !compact ? <p className="text-[11px] leading-relaxed text-slate-400">{message}</p> : null}
    </div>
  );
}
