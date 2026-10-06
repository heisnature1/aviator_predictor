'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Enables sorting and provides the value to sort on. */
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  /** Hide on small screens to keep tables readable on mobile. */
  hideOnMobile?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder = 'Search…',
  searchable = true,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  initialSort,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchable?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  initialSort?: { key: string; direction: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort ?? null);

  const visibleRows = useMemo(() => {
    let next = rows;
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      next = next.filter((row) =>
        columns.some((column) => {
          const value = column.sortValue?.(row);
          return value !== undefined && String(value).toLowerCase().includes(needle);
        }),
      );
    }
    if (sort) {
      const column = columns.find((item) => item.key === sort.key);
      if (column?.sortValue) {
        const direction = sort.direction === 'asc' ? 1 : -1;
        next = [...next].sort((a, b) => {
          const left = column.sortValue!(a);
          const right = column.sortValue!(b);
          if (left === right) return 0;
          return left > right ? direction : -direction;
        });
      }
    }
    return next;
  }, [rows, query, sort, columns]);

  function toggleSort(column: Column<T>) {
    if (!column.sortValue) return;
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, direction: 'desc' };
      return { key: column.key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
    });
  }

  return (
    <div className="space-y-3">
      {searchable ? (
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}

      {visibleRows.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`${column.headerClassName ?? ''} ${
                      column.hideOnMobile ? 'hidden md:table-cell' : ''
                    }`}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="flex items-center gap-1.5 uppercase tracking-[0.14em] transition hover:text-white"
                      >
                        {column.header}
                        {sort?.key === column.key ? (
                          sort.direction === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUp className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`${column.className ?? ''} ${
                        column.hideOnMobile ? 'hidden md:table-cell' : ''
                      }`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visibleRows.length > 0 ? (
        <p className="text-[11px] text-slate-500">
          Showing {visibleRows.length} of {rows.length} record{rows.length === 1 ? '' : 's'}
        </p>
      ) : null}
    </div>
  );
}
