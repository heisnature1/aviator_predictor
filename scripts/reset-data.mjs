#!/usr/bin/env node
/**
 * Clears every collection and uploaded receipt, then rebuilds empty seed files.
 *
 *   npm run reset:data
 *
 * WARNING: destructive. It never touches your .env files or source code.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { COLLECTIONS, DATA_ROOT, RECEIPTS_ROOT, initialiseStore } from './lib/seed-utils.mjs';

async function removeContents(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    await fs.rm(path.join(directory, entry.name), { recursive: true, force: true });
  }
}

async function main() {
  console.log(`[reset] clearing ${DATA_ROOT}`);
  await removeContents(DATA_ROOT);
  console.log(`[reset] clearing ${RECEIPTS_ROOT}`);
  await removeContents(RECEIPTS_ROOT);

  const created = await initialiseStore({ force: true });
  console.log(`[reset] recreated ${created.length} collection files`);
  for (const name of Object.keys(COLLECTIONS)) {
    console.log(`  data/${COLLECTIONS[name]}`);
  }
}

main().catch((error) => {
  console.error('[reset] failed:', error.message);
  process.exit(1);
});
