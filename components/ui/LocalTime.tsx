'use client';

import { useEffect, useState } from 'react';

/**
 * Renders a timestamp in the visitor's locale/timezone.
 * The server renders the UTC value; after hydration it switches to local time
 * (suppressHydrationWarning avoids a false mismatch warning).
 */
export function LocalTime({
  iso,
  mode = 'datetime',
  className,
}: {
  iso: string | null | undefined;
  mode?: 'datetime' | 'date' | 'time' | 'relative';
  className?: string;
}) {
  const [formatted, setFormatted] = useState<string>('—');

  useEffect(() => {
    if (!iso) {
      setFormatted('—');
      return;
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      setFormatted('—');
      return;
    }

    if (mode === 'relative') {
      const update = () => {
        const diff = Date.now() - date.getTime();
        const minutes = Math.round(diff / 60_000);
        if (minutes < 1) setFormatted('just now');
        else if (minutes < 60) setFormatted(`${minutes}m ago`);
        else if (minutes < 60 * 24) setFormatted(`${Math.round(minutes / 60)}h ago`);
        else setFormatted(`${Math.round(minutes / (60 * 24))}d ago`);
      };
      update();
      const timer = setInterval(update, 30_000);
      return () => clearInterval(timer);
    }

    const options: Intl.DateTimeFormatOptions =
      mode === 'date'
        ? { day: '2-digit', month: 'short', year: 'numeric' }
        : mode === 'time'
          ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
          : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };

    setFormatted(new Intl.DateTimeFormat(undefined, options).format(date));
  }, [iso, mode]);

  return (
    <time dateTime={iso ?? undefined} className={className} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
