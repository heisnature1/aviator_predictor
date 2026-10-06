#!/usr/bin/env node
/**
 * Initialises the file backend and creates the bootstrap administrator.
 *
 *   npm run seed
 *
 * Environment (see .env.example):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, ADMIN_USERNAME
 */

import { initialiseStore, readJson, writeJson, hashPassword, newId, nowIso } from './lib/seed-utils.mjs';

const MIN_PASSWORD_LENGTH = 8;

function assess(password) {
  const errors = [];
  if (password.length < MIN_PASSWORD_LENGTH) errors.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
  if (!/[a-z]/.test(password)) errors.push('a lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('an uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('a number');
  return errors;
}

async function main() {
  const created = await initialiseStore();
  if (created.length) {
    console.log('[seed] created:');
    for (const file of created) console.log(`  data/${file}`);
  } else {
    console.log('[seed] data files already present');
  }

  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping administrator creation.');
    console.log('       Copy .env.example to .env.local first, or create the admin later with:');
    console.log('       ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=Secret123 npm run seed');
    return;
  }

  const errors = assess(password);
  if (errors.length) {
    console.error(`[seed] ADMIN_PASSWORD is too weak — it needs ${errors.join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  const users = (await readJson('users')) ?? [];
  if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    console.log(`[seed] administrator ${email} already exists`);
    return;
  }

  const timestamp = nowIso();
  const username = (
    process.env.ADMIN_USERNAME?.trim() ||
    email.split('@')[0] ||
    'admin'
  )
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24) || 'admin';

  users.push({
    id: newId('usr'),
    full_name: process.env.ADMIN_FULL_NAME?.trim() || 'Platform Administrator',
    username,
    email: email.toLowerCase(),
    phone: process.env.ADMIN_PHONE?.trim() || '—',
    password_hash: await hashPassword(password),
    role: 'admin',
    account_status: 'active',
    created_at: timestamp,
    updated_at: timestamp,
    last_login: null,
    activated_by_payment_id: null,
    status_note: 'Seeded administrator',
    failed_login_attempts: 0,
    locked_until: null,
  });
  await writeJson('users', users);
  console.log(`[seed] administrator created: ${email}`);
}

main().catch((error) => {
  console.error('[seed] failed:', error.message);
  process.exit(1);
});
