'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: { title: string; message?: string; variant?: ToastVariant }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: TriangleAlert,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'border-success-500/30 bg-success-500/10 text-success-400',
  error: 'border-danger-500/30 bg-danger-500/10 text-danger-400',
  info: 'border-accent-400/30 bg-accent-500/10 text-accent-300',
  warning: 'border-coin-400/30 bg-coin-400/10 text-coin-300',
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: { title: string; message?: string; variant?: ToastVariant }) => {
      counter += 1;
      const id = counter;
      setToasts((current) => [
        ...current.slice(-3),
        { id, title: input.title, message: input.message, variant: input.variant ?? 'info' },
      ]);
      setTimeout(() => dismiss(id), input.variant === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, message) => toast({ title, message, variant: 'success' }),
      error: (title, message) => toast({ title, message, variant: 'error' }),
      info: (title, message) => toast({ title, message, variant: 'info' }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:top-6">
        {toasts.map((item) => {
          const Icon = ICONS[item.variant];
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex w-full max-w-md animate-slide-in items-start gap-3 rounded-xl border px-4 py-3 shadow-card backdrop-blur-xl ${STYLES[item.variant]}`}
              role="status"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                {item.message ? (
                  <p className="mt-0.5 break-words text-xs text-slate-300">{item.message}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return context;
}
