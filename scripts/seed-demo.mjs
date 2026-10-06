#!/usr/bin/env node
/**
 * Seeds realistic demo data for local development:
 *
 *   npm run seed:demo
 *
 * Creates an administrator, active/pending/suspended users, wallet balances,
 * a pending activation payment with a generated PDF receipt, a pending credit
 * purchase, prediction history, transactions, notifications and audit entries.
 *
 * Demo credentials (development only):
 *   admin@aviatorinsights.test  / Admin#12345
 *   john@example.com            / User#12345
 *   mary@example.com            / User#12345   (pending activation)
 *   sam@example.com             / User#12345   (zero balance)
 */

import {
  buildReceiptPdf,
  hashPassword,
  initialiseStore,
  newId,
  nowIso,
  readJson,
  writeReceipt,
  writeJson,
} from './lib/seed-utils.mjs';

const DEMO_USERS = [
  {
    key: 'admin',
    full_name: 'Ada Administrator',
    username: 'admin',
    email: 'admin@aviatorinsights.test',
    phone: '+233 20 000 0001',
    password: 'Admin#12345',
    role: 'admin',
    account_status: 'active',
    gems: 0,
    coins: 0,
  },
  {
    key: 'john',
    full_name: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
    phone: '+233 24 111 2222',
    password: 'User#12345',
    role: 'user',
    account_status: 'active',
    gems: 250,
    coins: 100,
  },
  {
    key: 'mary',
    full_name: 'Mary Mensah',
    username: 'marym',
    email: 'mary@example.com',
    phone: '+233 55 333 4444',
    password: 'User#12345',
    role: 'user',
    account_status: 'pending',
    gems: 0,
    coins: 0,
  },
  {
    key: 'sam',
    full_name: 'Samuel Owusu',
    username: 'samowusu',
    email: 'sam@example.com',
    phone: '+233 27 555 6666',
    password: 'User#12345',
    role: 'user',
    account_status: 'active',
    gems: 0,
    coins: 10,
  },
  {
    key: 'alice',
    full_name: 'Alice Boateng',
    username: 'aliceb',
    email: 'alice@example.com',
    phone: '+233 26 777 8888',
    password: 'User#12345',
    role: 'user',
    account_status: 'suspended',
    gems: 40,
    coins: 0,
  },
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

async function main() {
  await initialiseStore();

  const users = (await readJson('users')) ?? [];
  const existing = new Set(users.map((user) => user.email.toLowerCase()));

  const byKey = {};
  const timestamp = nowIso();

  for (const spec of DEMO_USERS) {
    if (existing.has(spec.email.toLowerCase())) {
      byKey[spec.key] = users.find((user) => user.email.toLowerCase() === spec.email.toLowerCase());
      continue;
    }
    const user = {
      id: newId('usr'),
      full_name: spec.full_name,
      username: spec.username,
      email: spec.email.toLowerCase(),
      phone: spec.phone,
      password_hash: await hashPassword(spec.password),
      role: spec.role,
      account_status: spec.account_status,
      created_at: nowIso(-3 * DAY),
      updated_at: timestamp,
      last_login: spec.key === 'admin' ? nowIso(-2 * HOUR) : nowIso(-1 * DAY),
      activated_by_payment_id: null,
      status_note:
        spec.account_status === 'suspended' ? 'Chargeback investigation' : null,
      failed_login_attempts: 0,
      locked_until: null,
    };
    users.push(user);
    byKey[spec.key] = user;
  }
  await writeJson('users', users);

  // --- Wallets -------------------------------------------------------------
  const wallets = (await readJson('wallets')) ?? [];
  for (const spec of DEMO_USERS) {
    const user = byKey[spec.key];
    const existingWallet = wallets.find((wallet) => wallet.user_id === user.id);
    if (existingWallet) continue;
    wallets.push({
      user_id: user.id,
      gems: spec.gems,
      coins: spec.coins,
      created_at: nowIso(-3 * DAY),
      updated_at: timestamp,
    });
  }
  await writeJson('wallets', wallets);

  // --- Activation payment for Mary (pending, with receipt) ------------------
  const payments = (await readJson('payments')) ?? [];
  const transactions = (await readJson('transactions')) ?? [];
  const notifications = (await readJson('notifications')) ?? [];
  const purchases = (await readJson('purchases')) ?? [];
  const predictions = (await readJson('predictions')) ?? [];
  const audit = (await readJson('audit')) ?? [];

  const john = byKey.john;
  const mary = byKey.mary;

  if (mary && !payments.some((payment) => payment.user_id === mary.id)) {
    const paymentId = newId('pay');
    const receiptPath = await writeReceipt(
      mary.id,
      `${Date.now().toString(36)}-activation.pdf`,
      buildReceiptPdf([
        'MTN MOBILE MONEY — PAYMENT CONFIRMATION',
        '',
        'Amount:      GHS 50.00',
        'To:          024 000 0000 (Aviator Insights Ltd)',
        'Reference:   MM77XK2210',
        'Date:        ' + new Date().toISOString().slice(0, 16).replace('T', ' '),
        '',
        'Status:      COMPLETED',
        'Fee:         GHS 0.00',
        '',
        'Thank you for using MTN Mobile Money.',
      ]),
    );

    payments.push({
      id: paymentId,
      user_id: mary.id,
      type: 'account_activation',
      amount: 50,
      currency_code: 'GHS',
      payment_method: 'MTN Mobile Money',
      reference: 'MM77XK2210',
      receipt_file: receiptPath,
      receipt_name: 'momo-confirmation.pdf',
      status: 'pending',
      admin_note: null,
      created_at: nowIso(-5 * HOUR),
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
    });

    notifications.push({
      id: newId('ntf'),
      user_id: mary.id,
      kind: 'payment_submitted',
      title: 'Activation payment received',
      message:
        'Your payment of GHS 50 is waiting for verification. We will notify you once an administrator reviews it.',
      read: false,
      link: '/payments',
      created_at: nowIso(-5 * HOUR),
    });
  }

  // --- John: approved activation + approved purchase + pending purchase ----
  if (john) {
    if (!payments.some((payment) => payment.user_id === john.id)) {
      const activationId = newId('pay');
      payments.push({
        id: activationId,
        user_id: john.id,
        type: 'account_activation',
        amount: 50,
        currency_code: 'GHS',
        payment_method: 'MTN Mobile Money',
        reference: 'MM19QZ4417',
        receipt_file: null,
        receipt_name: null,
        status: 'approved',
        admin_note: null,
        created_at: nowIso(-3 * DAY),
        reviewed_at: nowIso(-3 * DAY + 2 * HOUR),
        reviewed_by: byKey.admin?.id ?? null,
        rejection_reason: null,
      });

      transactions.push(
        {
          id: newId('txn'),
          user_id: john.id,
          type: 'account_activation',
          currency: 'gems',
          amount: 50,
          balance_before: 0,
          balance_after: 50,
          reference: activationId,
          description: 'Activation bonus — 50 gems',
          created_at: nowIso(-3 * DAY + 2 * HOUR),
          actor_id: byKey.admin?.id ?? null,
        },
        {
          id: newId('txn'),
          user_id: john.id,
          type: 'account_activation',
          currency: 'coins',
          amount: 25,
          balance_before: 0,
          balance_after: 25,
          reference: activationId,
          description: 'Activation bonus — 25 coins',
          created_at: nowIso(-3 * DAY + 2 * HOUR),
          actor_id: byKey.admin?.id ?? null,
        },
      );

      const purchaseId = newId('pur');
      purchases.push({
        id: purchaseId,
        user_id: john.id,
        package_id: 'pkg_gems_500',
        package_name: '500 Gems',
        currency: 'gems',
        credits: 500,
        amount: 70,
        currency_code: 'GHS',
        payment_method: 'MTN Mobile Money',
        reference: 'MM44PL9001',
        receipt_file: null,
        receipt_name: null,
        status: 'approved',
        admin_note: null,
        created_at: nowIso(-2 * DAY),
        reviewed_at: nowIso(-2 * DAY + 45 * MINUTE),
        reviewed_by: byKey.admin?.id ?? null,
        rejection_reason: null,
      });

      transactions.push({
        id: newId('txn'),
        user_id: john.id,
        type: 'gem_purchase',
        currency: 'gems',
        amount: 500,
        balance_before: 50,
        balance_after: 550,
        reference: purchaseId,
        description: '500 Gems — approved by Ada Administrator',
        created_at: nowIso(-2 * DAY + 45 * MINUTE),
        actor_id: byKey.admin?.id ?? null,
      });

      notifications.push(
        {
          id: newId('ntf'),
          user_id: john.id,
          kind: 'account_approved',
          title: 'Account activated',
          message: 'Your activation payment was approved. Your account is now active and 50 gems have been added to your wallet.',
          read: true,
          link: '/dashboard',
          created_at: nowIso(-3 * DAY + 2 * HOUR),
        },
        {
          id: newId('ntf'),
          user_id: john.id,
          kind: 'purchase_approved',
          title: 'Credits added',
          message: '500 gems from your 500 Gems purchase have been added to your wallet.',
          read: true,
          link: '/wallet',
          created_at: nowIso(-2 * DAY + 45 * MINUTE),
        },
      );

      audit.push(
        {
          id: newId('log'),
          admin_id: byKey.admin?.id ?? null,
          action: 'admin_approved_payment',
          target_user: john.id,
          target_label: `${john.full_name} (${john.email})`,
          previous_value: 'payment:pending account:pending',
          new_value: 'payment:approved account:active',
          reason: null,
          timestamp: nowIso(-3 * DAY + 2 * HOUR),
          ip_address: '127.0.0.1',
        },
        {
          id: newId('log'),
          admin_id: byKey.admin?.id ?? null,
          action: 'admin_approved_purchase',
          target_user: john.id,
          target_label: '500 Gems',
          previous_value: 'purchase:pending',
          new_value: 'purchase:approved +500 gems',
          reason: null,
          timestamp: nowIso(-2 * DAY + 45 * MINUTE),
          ip_address: '127.0.0.1',
        },
      );
    }

    // Pending credit purchase awaiting review
    if (!purchases.some((purchase) => purchase.user_id === john.id && purchase.status === 'pending')) {
      const pendingId = newId('pur');
      const receiptPath = await writeReceipt(
        john.id,
        `${Date.now().toString(36)}-purchase.pdf`,
        buildReceiptPdf([
          'MTN MOBILE MONEY — PAYMENT CONFIRMATION',
          '',
          'Amount:      GHS 40.00',
          'To:          024 000 0000 (Aviator Insights Ltd)',
          'Reference:   MM88TR3321',
          'Date:        ' + new Date().toISOString().slice(0, 16).replace('T', ' '),
          '',
          'Status:      COMPLETED',
          '',
          'Thank you for using MTN Mobile Money.',
        ]),
      );

      purchases.push({
        id: pendingId,
        user_id: john.id,
        package_id: 'pkg_gems_250',
        package_name: '250 Gems',
        currency: 'gems',
        credits: 250,
        amount: 40,
        currency_code: 'GHS',
        payment_method: 'MTN Mobile Money',
        reference: 'MM88TR3321',
        receipt_file: receiptPath,
        receipt_name: 'momo-250-gems.pdf',
        status: 'pending',
        admin_note: null,
        created_at: nowIso(-40 * MINUTE),
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
      });

      notifications.push({
        id: newId('ntf'),
        user_id: john.id,
        kind: 'purchase_submitted',
        title: 'Credit purchase received',
        message: 'Your 250 Gems purchase (GHS 40) is waiting for verification.',
        read: false,
        link: '/wallet',
        created_at: nowIso(-40 * MINUTE),
      });
    }

    // Prediction history (three charged analyses + one refused)
    if (!predictions.some((prediction) => prediction.user_id === john.id)) {
      const samples = [
        { min: 2.1, max: 2.8, confidence: 'moderate', points: 96, offset: -6 * HOUR, cost: 10 },
        { min: 1.4, max: 1.9, confidence: 'low', points: 34, offset: -4 * HOUR, cost: 10 },
        { min: 3.2, max: 5.4, confidence: 'high', points: 120, offset: -90 * MINUTE, cost: 10 },
      ];

      let balance = 550;
      for (const sample of samples) {
        const id = newId('prd');
        predictions.push({
          id,
          user_id: john.id,
          status: 'generated',
          estimated_min: sample.min,
          estimated_max: sample.max,
          confidence: sample.confidence,
          analysis: [
            { label: 'Rounds analysed', value: `${sample.points}` },
            { label: 'Median crash point', value: `${(sample.min * 0.9).toFixed(2)}x` },
            { label: 'Volatility', value: sample.confidence === 'low' ? 'High' : 'Moderate' },
            { label: 'Reached 2.00x', value: `61% of the last ${sample.points} rounds reached 2.00x` },
          ],
          summary: `Across the last ${sample.points} rounds from the live provider feed, outcomes clustered around ${(
            (sample.min + sample.max) /
            2
          ).toFixed(2)}x. The estimated reachable band is ${sample.min.toFixed(2)}x – ${sample.max.toFixed(
            2,
          )}x. Confidence (${sample.confidence}) describes how stable this sample is, not a probability of winning.`,
          data_points: sample.points,
          data_source: 'live_provider',
          provider: 'provider-demo',
          snapshot_at: nowIso(sample.offset),
          round_id: null,
          cost_gems: sample.cost,
          cost_coins: 0,
          engine_version: 'statistical-v1',
          disclaimer:
            'Platform analysis based on recent rounds, not an official game result and not a prediction of the next crash point. No outcome is guaranteed.',
          created_at: nowIso(sample.offset),
        });

        transactions.push({
          id: newId('txn'),
          user_id: john.id,
          type: 'prediction_usage',
          currency: 'gems',
          amount: -sample.cost,
          balance_before: balance,
          balance_after: balance - sample.cost,
          reference: id,
          description: `Prediction analysis (${sample.min.toFixed(2)}x – ${sample.max.toFixed(2)}x)`,
          created_at: nowIso(sample.offset),
          actor_id: null,
        });
        balance -= sample.cost;

        audit.push({
          id: newId('log'),
          admin_id: null,
          action: 'prediction_generated',
          target_user: john.id,
          target_label: `${john.full_name} (${john.email})`,
          previous_value: null,
          new_value: `${sample.min.toFixed(2)}x – ${sample.max.toFixed(2)}x (${sample.confidence})`,
          reason: 'charged:true',
          timestamp: nowIso(sample.offset),
          ip_address: null,
        });
      }

      predictions.push({
        id: newId('prd'),
        user_id: john.id,
        status: 'insufficient_data',
        estimated_min: null,
        estimated_max: null,
        confidence: 'insufficient',
        analysis: [{ label: 'Rounds available', value: '11', note: '20 are required for a meaningful read.' }],
        summary: 'Not enough live round data yet (11 of 20 required). No estimate is produced rather than guessing.',
        data_points: 11,
        data_source: 'live_provider',
        provider: 'provider-demo',
        snapshot_at: nowIso(-30 * MINUTE),
        round_id: null,
        cost_gems: 0,
        cost_coins: 0,
        engine_version: 'statistical-v1',
        disclaimer:
          'Platform analysis based on recent rounds, not an official game result and not a prediction of the next crash point. No outcome is guaranteed.',
        created_at: nowIso(-30 * MINUTE),
      });

      notifications.push({
        id: newId('ntf'),
        user_id: john.id,
        kind: 'prediction_generated',
        title: 'Analysis ready',
        message: 'Estimated range 3.20x – 5.40x (Stable sample). 10 gems were deducted.',
        read: false,
        link: '/predictions',
        created_at: nowIso(-90 * MINUTE),
      });
    }
  }

  await writeJson('payments', payments);
  await writeJson('purchases', purchases);
  await writeJson('transactions', transactions);
  await writeJson('predictions', predictions);
  await writeJson('notifications', notifications);
  await writeJson('audit', audit);

  console.log('[seed:demo] demo data ready');
  console.log('  admin  admin@aviatorinsights.test / Admin#12345');
  console.log('  user   john@example.com           / User#12345  (active, 250 gems)');
  console.log('  user   mary@example.com           / User#12345  (pending activation)');
  console.log('  user   sam@example.com            / User#12345  (active, 0 gems)');
  console.log('  user   alice@example.com          / User#12345  (suspended)');
}

main().catch((error) => {
  console.error('[seed:demo] failed:', error.message);
  process.exit(1);
});
