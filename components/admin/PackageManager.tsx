'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { del, patch, post } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/format';
import type { CreditPackage, WalletCurrency } from '@/types';

const EMPTY = {
  name: '',
  currency: 'gems' as WalletCurrency,
  credits: '',
  price: '',
  currency_code: 'GHS',
  description: '',
  active: true,
  sort_order: '10',
};

/** Create / edit / enable / delete credit packages. */
export function PackageManager({ packages }: { packages: CreditPackage[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CreditPackage | null>(null);
  const [deleting, setDeleting] = useState<CreditPackage | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setForm({ ...EMPTY });
    setCreating(true);
  }

  function openEdit(pkg: CreditPackage) {
    setForm({
      name: pkg.name,
      currency: pkg.currency,
      credits: String(pkg.credits),
      price: String(pkg.price),
      currency_code: pkg.currency_code,
      description: pkg.description ?? '',
      active: pkg.active,
      sort_order: String(pkg.sort_order),
    });
    setEditing(pkg);
  }

  function close() {
    setCreating(false);
    setEditing(null);
  }

  async function save() {
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      currency: form.currency,
      credits: Number(form.credits),
      price: Number(form.price),
      currency_code: form.currency_code.trim() || 'GHS',
      description: form.description.trim(),
      active: form.active,
      sort_order: Number(form.sort_order) || 10,
    };
    try {
      if (editing) {
        await patch(`/api/admin/packages/${editing.id}`, payload);
        toast.success('Package updated', payload.name);
      } else {
        await post('/api/admin/packages', payload);
        toast.success('Package created', payload.name);
      }
      close();
      router.refresh();
    } catch (error) {
      toast.error('Save failed', (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(pkg: CreditPackage) {
    try {
      await patch(`/api/admin/packages/${pkg.id}`, { active: !pkg.active });
      toast.success(pkg.active ? 'Package disabled' : 'Package enabled', pkg.name);
      router.refresh();
    } catch (error) {
      toast.error('Update failed', (error as Error).message);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await del(`/api/admin/packages/${deleting.id}`);
      toast.success('Package deleted', deleting.name);
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error('Delete failed', (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const formBody = (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pkg-name">
            Name
          </label>
          <input
            id="pkg-name"
            className="input"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="500 Gems"
          />
        </div>
        <div>
          <label className="label" htmlFor="pkg-currency">
            Currency
          </label>
          <select
            id="pkg-currency"
            className="input"
            value={form.currency}
            onChange={(event) =>
              setForm((current) => ({ ...current, currency: event.target.value as WalletCurrency }))
            }
          >
            <option value="gems">Gems</option>
            <option value="coins">Coins</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="pkg-credits">
            Credits
          </label>
          <input
            id="pkg-credits"
            className="input"
            inputMode="numeric"
            value={form.credits}
            onChange={(event) => setForm((current) => ({ ...current, credits: event.target.value }))}
            placeholder="500"
          />
        </div>
        <div>
          <label className="label" htmlFor="pkg-price">
            Price
          </label>
          <input
            id="pkg-price"
            className="input"
            inputMode="decimal"
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            placeholder="70"
          />
        </div>
        <div>
          <label className="label" htmlFor="pkg-code">
            Currency code
          </label>
          <input
            id="pkg-code"
            className="input"
            value={form.currency_code}
            onChange={(event) =>
              setForm((current) => ({ ...current, currency_code: event.target.value }))
            }
            placeholder="GHS"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pkg-description">
            Badge / description
          </label>
          <input
            id="pkg-description"
            className="input"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Best value"
          />
        </div>
        <div>
          <label className="label" htmlFor="pkg-sort">
            Sort order
          </label>
          <input
            id="pkg-sort"
            className="input"
            inputMode="numeric"
            value={form.sort_order}
            onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 bg-transparent"
          checked={form.active}
          onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
        />
        Visible to users
      </label>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New package
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center text-sm text-slate-400">
          No packages yet. Create one to start selling credits.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Credits</th>
                <th>Price</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <p className="text-sm font-medium text-white">{pkg.name}</p>
                    {pkg.description ? (
                      <p className="text-[11px] text-slate-500">{pkg.description}</p>
                    ) : null}
                  </td>
                  <td className="tabular text-slate-300">
                    {pkg.credits.toLocaleString()} {pkg.currency}
                  </td>
                  <td className="tabular text-slate-300">
                    {formatCurrency(pkg.price, pkg.currency_code)}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleActive(pkg)}
                      className={pkg.active ? 'badge-success' : 'badge-muted'}
                      title="Toggle visibility"
                    >
                      {pkg.active ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => openEdit(pkg)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => setDeleting(pkg)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={creating || Boolean(editing)}
        onClose={close}
        title={editing ? 'Edit package' : 'Create package'}
        description="Prices and credit amounts are enforced server-side on every purchase."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create package'}
            </button>
          </>
        }
      >
        {formBody}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete package"
        description="Existing purchases keep their history. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={busy}
      >
        <p className="text-sm text-slate-300">
          Delete <strong className="text-white">{deleting?.name}</strong>?
        </p>
      </ConfirmDialog>
    </div>
  );
}
