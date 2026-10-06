'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { post } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import type { PaymentSettings, SystemSettings } from '@/types';

/**
 * Administrator settings forms.
 * Saving writes to data/settings/settings.json and adds an audit entry.
 */

export function PaymentSettingsForm({ settings }: { settings: PaymentSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    activation_fee: String(settings.activation_fee),
    currency_code: settings.currency_code,
    payment_method: settings.payment_method,
    payment_number: settings.payment_number,
    account_name: settings.account_name,
    payment_instructions: settings.payment_instructions,
    support_contact: settings.support_contact,
  });
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await post('/api/admin/settings/payments', {
        activation_fee: Number(form.activation_fee),
        currency_code: form.currency_code.trim(),
        payment_method: form.payment_method.trim(),
        payment_number: form.payment_number.trim(),
        account_name: form.account_name.trim(),
        payment_instructions: form.payment_instructions,
        support_contact: form.support_contact.trim(),
      });
      toast.success('Payment settings saved', 'Users see the new instructions immediately.');
      router.refresh();
    } catch (error) {
      toast.error('Save failed', (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="activation_fee">
            Activation fee
          </label>
          <input
            id="activation_fee"
            className="input"
            inputMode="decimal"
            value={form.activation_fee}
            onChange={(event) => update('activation_fee', event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="currency_code">
            Currency code
          </label>
          <input
            id="currency_code"
            className="input"
            value={form.currency_code}
            onChange={(event) => update('currency_code', event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="payment_method">
            Payment method
          </label>
          <input
            id="payment_method"
            className="input"
            value={form.payment_method}
            onChange={(event) => update('payment_method', event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="payment_number">
            Payment number
          </label>
          <input
            id="payment_number"
            className="input"
            value={form.payment_number}
            onChange={(event) => update('payment_number', event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="account_name">
            Account name
          </label>
          <input
            id="account_name"
            className="input"
            value={form.account_name}
            onChange={(event) => update('account_name', event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="payment_instructions">
          Payment instructions
        </label>
        <textarea
          id="payment_instructions"
          className="input min-h-[100px]"
          value={form.payment_instructions}
          onChange={(event) => update('payment_instructions', event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="support_contact">
          Support contact
        </label>
        <input
          id="support_contact"
          className="input"
          value={form.support_contact}
          onChange={(event) => update('support_contact', event.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save payment settings
        </button>
      </div>
    </form>
  );
}

export function SystemSettingsForm({ settings }: { settings: SystemSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    site_name: settings.site_name,
    tagline: settings.tagline,
    prediction_cost_gems: String(settings.prediction_cost_gems),
    prediction_cost_coins: String(settings.prediction_cost_coins),
    activation_bonus_gems: String(settings.activation_bonus_gems),
    activation_bonus_coins: String(settings.activation_bonus_coins),
    min_data_points: String(settings.min_data_points),
    history_window: String(settings.history_window),
    low_balance_threshold: String(settings.low_balance_threshold),
    maintenance_mode: settings.maintenance_mode,
    registration_open: settings.registration_open,
  });
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await post('/api/admin/settings/system', {
        site_name: form.site_name.trim(),
        tagline: form.tagline.trim(),
        prediction_cost_gems: Number(form.prediction_cost_gems),
        prediction_cost_coins: Number(form.prediction_cost_coins),
        activation_bonus_gems: Number(form.activation_bonus_gems),
        activation_bonus_coins: Number(form.activation_bonus_coins),
        min_data_points: Number(form.min_data_points),
        history_window: Number(form.history_window),
        low_balance_threshold: Number(form.low_balance_threshold),
        maintenance_mode: form.maintenance_mode,
        registration_open: form.registration_open,
      });
      toast.success('System settings saved');
      router.refresh();
    } catch (error) {
      toast.error('Save failed', (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="site_name">
            Site name
          </label>
          <input
            id="site_name"
            className="input"
            value={form.site_name}
            onChange={(event) => update('site_name', event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="tagline">
            Tagline
          </label>
          <input
            id="tagline"
            className="input"
            value={form.tagline}
            onChange={(event) => update('tagline', event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="prediction_cost_gems">
            Prediction cost (gems)
          </label>
          <input
            id="prediction_cost_gems"
            className="input"
            inputMode="numeric"
            value={form.prediction_cost_gems}
            onChange={(event) => update('prediction_cost_gems', event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="prediction_cost_coins">
            Prediction cost (coins)
          </label>
          <input
            id="prediction_cost_coins"
            className="input"
            inputMode="numeric"
            value={form.prediction_cost_coins}
            onChange={(event) => update('prediction_cost_coins', event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="activation_bonus_gems">
            Activation bonus (gems)
          </label>
          <input
            id="activation_bonus_gems"
            className="input"
            inputMode="numeric"
            value={form.activation_bonus_gems}
            onChange={(event) => update('activation_bonus_gems', event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="activation_bonus_coins">
            Activation bonus (coins)
          </label>
          <input
            id="activation_bonus_coins"
            className="input"
            inputMode="numeric"
            value={form.activation_bonus_coins}
            onChange={(event) => update('activation_bonus_coins', event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="min_data_points">
            Minimum data points per analysis
          </label>
          <input
            id="min_data_points"
            className="input"
            inputMode="numeric"
            value={form.min_data_points}
            onChange={(event) => update('min_data_points', event.target.value)}
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            Below this many rounds the engine refuses to produce an estimate.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="history_window">
            History window (rounds)
          </label>
          <input
            id="history_window"
            className="input"
            inputMode="numeric"
            value={form.history_window}
            onChange={(event) => update('history_window', event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="low_balance_threshold">
            Low balance alert threshold
          </label>
          <input
            id="low_balance_threshold"
            className="input"
            inputMode="numeric"
            value={form.low_balance_threshold}
            onChange={(event) => update('low_balance_threshold', event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/20 bg-transparent"
            checked={form.maintenance_mode}
            onChange={(event) => update('maintenance_mode', event.target.checked)}
          />
          Maintenance mode (blocks predictions)
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/20 bg-transparent"
            checked={form.registration_open}
            onChange={(event) => update('registration_open', event.target.checked)}
          />
          Open new registrations
        </label>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save system settings
        </button>
      </div>
    </form>
  );
}
