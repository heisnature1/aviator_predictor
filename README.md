# Aviator Insights — prediction & analytics platform (MVP)

A production-structured Aviator insights platform: real user accounts, secure
cookie sessions, wallet & credits, receipt-based payment verification, a
statistical prediction service and a full administrator dashboard. It uses
local JSON files for self-hosting and an optional Neon Postgres backend on Vercel.

> **Integrity first.** This project never fabricates official Aviator results,
> never presents simulated numbers as real game data, and never claims that a
> prediction can guarantee a win. See
> [Live data & prediction integrity](#live-data--prediction-integrity).

---

## Table of contents

1. [Quick start](#quick-start)
2. [Demo accounts](#demo-accounts)
3. [Feature overview](#feature-overview)
4. [Tech stack](#tech-stack)
5. [Project structure](#project-structure)
6. [Data & storage architecture](#data--storage-architecture)
7. [Aviator provider integration](#aviator-provider-integration)
8. [Live data & prediction integrity](#live-data--prediction-integrity)
9. [Security model](#security-model)
10. [Admin workflows](#admin-workflows)
11. [API reference](#api-reference)
12. [Environment variables](#environment-variables)
13. [Scripts](#scripts)
14. [Testing](#testing)
15. [Deployment](#deployment)
16. [Known limitations](#known-limitations)

---

## Quick start

```bash
git clone <your-fork-url> aviator_predictor
cd aviator_predictor

npm install
cp .env.example .env.local      # then edit it (AUTH_SECRET is required)
npm run seed                    # creates data/, storage/ and the admin account
npm run seed:demo               # optional: demo users, payments & history

npm run dev                     # http://localhost:3000
```

In the default local mode, `data/` and `storage/` are created automatically
on first boot if missing. On Vercel, connect Neon and select the `postgres`
storage mode instead of relying on local files.

Other commands:

```bash
npm run build        # production build
npm start            # run the production build
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run reset:data   # clear every collection + uploaded receipt (destructive)
```

---

## Demo accounts

`npm run seed:demo` creates these accounts (development only):

| Email                        | Password      | Role  | Status            |
| ---------------------------- | ------------- | ----- | ----------------- |
| `admin@aviatorinsights.test` | `Admin#12345` | admin | active            |
| `john@example.com`           | `User#12345`  | user  | active, 250 gems  |
| `mary@example.com`           | `User#12345`  | user  | pending activation |
| `sam@example.com`            | `User#12345`  | user  | active, 0 gems    |
| `alice@example.com`          | `User#12345`  | user  | suspended         |

The demo data includes a pending activation payment with a generated PDF
receipt, a pending credit purchase, prediction history, wallet transactions,
notifications and audit entries so every admin screen has something to review.

---

## Feature overview

**Public site**

- Landing page with the live game panel, prediction panel, credit packages and
  an honest "what this platform does not do" section.
- `/live` — full-screen live feed, round history and feed diagnostics.
- `/how-it-works` — onboarding, data provenance and disclaimers.

**Accounts**

- Registration (name, username, email, phone, password + confirm) creates a
  **pending** account — never auto-activated.
- Login with email or username, session expiry, logout everywhere, rate limits
  and per-account lockout after repeated failures.

**Money**

- Wallet with **gems** and **coins**; every movement writes a ledger row with
  balance before/after.
- Configurable credit packages (gems/coins, price, order, enabled).
- Activation payment and credit purchase both require a receipt upload
  (JPG/PNG/WEBP/PDF, ≤ 5 MB) and stay `pending` until an **administrator**
  approves them. Uploading a receipt never grants credits or activates an
  account.

**Predictions**

- Server-side generation: auth → active account → credits → live provider data →
  engine → charge → store → result.
- Refuses to guess when the feed is missing or there are too few rounds, and
  **does not charge** in that case.
- Full history with the data points used, the estimated band and the disclaimer.

**Administration** (`/admin`)

Dashboard, users, pending accounts, payments, credit purchases, predictions,
wallets, packages, payment settings, system settings, admin users, credit
overview and an immutable activity log.

---

## Tech stack

| Layer      | Choice                                                  |
| ---------- | ------------------------------------------------------- |
| Framework  | Next.js 15 (App Router) + React 19                      |
| Language   | TypeScript (strict)                                     |
| Styling    | Tailwind CSS 3.4 (dark glass/gaming aesthetic)           |
| Backend    | Node.js route handlers + server components               |
| Storage    | Local JSON files, or Neon Postgres documents/receipts on Vercel |
| Auth       | HTTP-only cookies + scrypt password hashing + CSRF       |
| Validation | Zod on every API boundary                                |

The default `local` mode has no external database dependency. The optional
`postgres` mode uses Neon Postgres for Vercel/serverless deployments. The app
does not use Supabase, Firebase, MongoDB or Prisma.

---

## Project structure

```text
middleware.ts                    first-line route guard (edge: cookie presence only)
components/ProtectedArea.tsx     server-side auth guard for signed-in areas
app/error.tsx                    friendly error boundary (no stack traces in the UI)
app/
├── page.tsx                     landing page (live game + prediction)
├── live/  predictions/  how-it-works/
├── login/  register/
├── dashboard/  wallet/  payments/  notifications/
├── admin/
│   ├── page.tsx                 dashboard
│   ├── users/  pending-accounts/  payments/  purchases/
│   ├── predictions/  wallets/  packages/  gems/
│   ├── settings/  settings/payments/  admins/  audit/
└── api/
    ├── auth/{register,login,logout,session,csrf}
    ├── aviator/snapshot
    ├── predictions/request
    ├── payments/activation      purchases
    ├── receipts/[type]/[id]     notifications
    └── admin/{payments,purchases,users,packages,settings}/…

components/
├── Navbar.tsx  SiteFooter.tsx  PredictionPanel.tsx  PredictionResult.tsx
├── WalletCard.tsx  PaymentForm.tsx  ReceiptUpload.tsx  DataTable.tsx
├── AdminSidebar.tsx
├── aviator/{LiveGame,MultiplierDisplay,RoundHistory,GameStatus,ConnectionStatus}
├── admin/{ReviewTable,UserManager,PackageManager,SettingsForms,AuditTable}
└── ui/{Toast,Modal,primitives,LocalTime}

lib/
├── storage/       database (atomic JSON) · drivers · collections · files · lock
├── auth/          password (scrypt) · session · csrf · rate-limit · service
├── users/  wallet/  payments/  predictions/  notifications/
├── settings/  packages/  audit/  admin/
├── aviator/       types · provider · live-feed
├── http/  format.ts  utils.ts  bootstrap.ts  client/api.ts

data/…            JSON collections (see below)
storage/receipts/ uploaded payment receipts (never publicly served)
scripts/          seed-data · seed-demo · reset-data
types/            shared domain types
```

---

## Data & storage architecture

```text
data/
├── users/users.json              data/payments/payments.json
├── wallets/wallets.json          data/purchases/purchases.json
├── transactions/transactions.json
├── predictions/predictions.json
├── notifications/notifications.json
├── settings/settings.json
├── packages/packages.json
├── audit/activity.json
└── sessions/sessions.json

storage/receipts/<user-id>/<id>.<ext>
```

The tree above shows the local driver. With `STORAGE_MODE=postgres`, these
collections and receipt paths are records in `aviator_storage_documents`.

### Storage abstraction

Nothing outside `lib/storage` touches the filesystem. Business logic uses typed
collections:

```ts
await usersCollection.mutate((users) => [...users, newUser]);
```

`lib/storage/drivers.ts` defines the `StorageDriver` interface (read / write /
remove / list / ensureDir, with optional atomic update/transaction support). The
bundled `local` driver stores JSON in `data/`.
The bundled `postgres` driver stores collection documents and private receipt
files in a Neon Postgres table, so it works across Vercel serverless instances.
Additional drivers can still be registered without changing business logic.

### Write safety

The local driver writes a temporary file, `fsync`s it, then atomically renames
it over the target. The Postgres driver validates collection JSON and performs
writes in Neon with per-document advisory locks; it never writes into Vercel's
read-only deployment directory.

Additional protections:

- **Per-collection serialisation** — concurrent read-modify-write cycles use a
  process lock locally and a Postgres advisory transaction lock on Vercel.
- **Ledger atomicity** — wallet balance + transaction row are written in one
  storage transaction on Postgres (and one exclusive lock on a single local
  process).
- **Corruption recovery** — invalid JSON is logged and reset to the collection
  seed; local files are quarantined under `data/_corrupt/`.
- **Path traversal guard** — local paths are confined to their data directory;
  remote document keys reject absolute paths and `..` segments.

### `STORAGE_MODE` and deployments

- `STORAGE_MODE=local` uses JSON files and is intended for development or one
  self-hosted Node.js instance with a persistent mounted disk.
- `STORAGE_MODE=postgres` uses the built-in Neon driver for serverless and
  multi-instance deployments. Set `DATABASE_URL` to the pooled Neon connection
  string. Vercel defaults to `postgres` when `STORAGE_MODE` is omitted; setting
  `local` on Vercel production fails fast with a configuration error.
- An unregistered mode fails with `StorageConfigurationError` rather than
  silently accepting writes that would be lost.

On Vercel, the Postgres driver stores collection JSON and base64-encoded receipt
files in the managed database. Receipt bytes are never served from a public
storage URL; downloads still pass through the owner/admin authorization route.

---

## Aviator provider integration

All game data flows through one layer:

```text
lib/aviator/types.ts      neutral snapshot/round types + provider interface
lib/aviator/provider.ts   provider selection + HTTP provider + local simulator
lib/aviator/live-feed.ts  caching, error handling, diagnostics
```

### Connecting a real provider

```bash
AVIATOR_PROVIDER_URL=https://your-authorised-source.example/aviator/current
AVIATOR_PROVIDER_KEY=your-api-key          # sent as `Authorization: Bearer …`
AVIATOR_PROVIDER_HEADERS='{"X-Tenant":"acme"}'   # optional JSON object
AVIATOR_PROVIDER_TIMEOUT_MS=4000
AVIATOR_CACHE_TTL_MS=1000
```

The endpoint should return JSON in this shape (alias-tolerant — see
`normalisePayload`):

```json
{
  "roundId": "9f2c…",
  "status": "flying",
  "multiplier": 2.31,
  "startedAt": "2026-10-06T12:00:00.000Z",
  "history": [{ "roundId": "9f2b…", "multiplier": 1.42, "endedAt": "…" }]
}
```

Accepted aliases include `round_id`, `crashPoint`, `currentMultiplier`,
`rounds`, `recent`, `results`, `started_at`, `ended_at`, `crashedAt`, and the
payload may be nested under `data` / `result` / `game` / `round`.

Once configured, the live panel, `/live` diagnostics and the prediction engine
all use it — no other code changes. A worked example (mock provider on
`127.0.0.1:3300`) was verified end-to-end during development: the feed reported
`mode: "live"`, `is_simulated: false`, 50 rounds of history, and predictions
were generated and charged from that data.

### States the UI can show

| `connection`      | Cause                                | What the UI shows                                                    |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `connected`       | provider reachable                    | multiplier, round id, status, history, last update                    |
| `not_configured`  | `AVIATOR_PROVIDER_URL` empty          | "No Aviator data provider configured", empty history, no numbers      |
| `error`           | provider request failed / timed out   | "Live feed unavailable: …" plus a retry action                        |
| `disconnected`    | previously connected, now failing     | error state, stale values are not presented as live                   |

---

## Live data & prediction integrity

These rules are enforced in code, not just in copy:

1. **No invented results.** With no provider configured the snapshot reports
   `not_configured` with an empty history. The frontend has no code path that
   generates a multiplier — `components/aviator/*` only renders what
   `/api/aviator/snapshot` returns.
2. **Simulation is explicit and opt-in.** `AVIATOR_ALLOW_SIMULATION=true`
   (default **false**) enables a local simulator for offline development. Every
   snapshot it emits carries `is_simulated: true` / `mode: "simulation"`, and
   the UI renders an unmissable amber "Simulated development feed" banner on
   every screen that shows it.
3. **Predictions refuse simulated data** unless
   `AVIATOR_PREDICTIONS_ALLOW_SIMULATED=true` (default **false**, local testing
   only). With a real provider connected this is irrelevant.
4. **No guarantees, anywhere.** The engine reports an estimated *reachable band*
   with a confidence level that describes **sample stability** — never "chance
   of winning". Every result card carries the disclaimer: *"Platform analysis
   based on recent rounds, not an official game result and not a prediction of
   the next crash point. No outcome is guaranteed."* There is no 90%/99%
   accuracy claim anywhere in the codebase.
5. **Refuse rather than guess.** Fewer rounds than `min_data_points` (default
   20), a missing feed, or simulated data all produce an explicit refusal —
   and **no credits are deducted**.
6. **Live result ≠ platform analysis.** The live panel and the prediction card
   are visually and semantically separated; the copy states the difference.

### Prediction method (`lib/predictions/prediction-engine.ts`)

1. Clean the sample (finite multipliers ≥ 1.00x) inside the configured window.
2. Require `min_data_points` rounds; otherwise return `insufficient_data`.
3. Build the empirical survival curve `S(x) = P(round ≥ x)`.
4. Band = `[max x where S(x) ≥ 0.60, max x where S(x) ≥ 0.35]` — i.e. recent
   rounds reached the low end ~60% of the time and the high end ~35%.
5. Confidence (`low` / `moderate` / `high`) is derived from sample size and
   dispersion (coefficient of variation).

Aviator rounds are committed cryptographically before they start, so no model
can know the next crash point. This engine is descriptive statistics, and the
product says so.

---

## Security model

| Concern                | Implementation                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Password storage       | scrypt (N=16384, r=8, p=1) + per-password salt, `scrypt$N$r$p$salt$hash`; constant-time compare.  |
| Secrets never returned | `toPublicUser()` strips `password_hash`; API responses never include hashes, keys or paths.       |
| Route protection       | `middleware.ts` (cookie presence, edge-safe) + per-area server layouts + `requireUser()` on every page. |
| Sessions               | Opaque 32-byte token in an HTTP-only, SameSite=Lax, Secure (prod) cookie; only `sha256(secret+token)` is stored. |
| Session expiry         | `SESSION_TTL_HOURS` (default 168h); expired/revoked sessions are rejected server-side.            |
| CSRF                   | Double-submit cookie (`av_csrf`) + `x-csrf-token` header + same-origin check on every mutation.   |
| Rate limiting          | Per-IP and per-account limits on login/register/upload/prediction/admin actions (tunable).        |
| Login protection       | 8 failures → 15-minute account lockout; generic error text prevents account enumeration.          |
| Admin authorization    | `requireAdmin()` on **every** `/api/admin/*` route plus a server-side redirect in `app/admin/layout.tsx`. Hiding buttons is cosmetic only. |
| Input validation       | Zod schemas on every request; amounts, prices and credit amounts are re-read server-side.         |
| Upload validation      | Extension + declared MIME + **magic-byte sniffing**, size cap, random filename, stored outside the public tree. |
| Receipt privacy        | `storage/receipts` is never public — `/api/receipts/[type]/[id]` authorises (owner or admin) and streams with `Content-Disposition: attachment`. Non-owners get 404. |
| Error handling         | `route()` maps every failure to a short, user-safe message; `app/error.tsx` renders a friendly page. Stack traces and paths are logged server-side only. |
| Wallet integrity       | Balances change only through `applyWalletChange()`, which always writes a transaction row; overdrafts are rejected. |
| Audit trail            | Every admin action is append-only with actor, target, previous/new values, reason and IP.         |

**Never trusted from the client:** user id, wallet balance, payment status,
admin status, prediction cost, credit amount, package price.

---

## Admin workflows

```text
/admin                     dashboard: users, pending queue, revenue, credits, feed status
/admin/pending-accounts    pending registrations and their payments
/admin/payments            approve (activate + bonus) or reject (with reason) activation payments
/admin/purchases           approve (credits + ledger row) or reject credit purchases
/admin/users               search, filter, activate/suspend/reject, wallet adjust, promote/demote
/admin/predictions         every request, including refusals, with the data used
/admin/wallets             balances + full transaction ledger
/admin/packages            create / edit / enable / delete credit packages
/admin/settings/payments   activation fee, method, number, account name, instructions, support
/admin/settings            prediction cost, bonuses, thresholds, maintenance & registration switches
/admin/admins              grant or revoke administrator access (cannot demote yourself)
/admin/gems                credit overview: circulation, top holders, movement by type
/admin/audit               immutable activity log with actor, change and reason
```

Approving an activation payment activates the account, credits the configured
bonus, writes a transaction, notifies the user and records the audit entry.
Rejecting stores your reason, notifies the user and — for activation payments —
sets the account to `rejected`. **A rejected purchase never grants credits.**

---

## API reference

All responses use `{ ok: true, data }` or `{ ok: false, error, code, fields }`.
Mutations require the CSRF header.

| Method | Endpoint                                    | Auth   | Purpose                                  |
| ------ | ------------------------------------------- | ------ | ---------------------------------------- |
| GET    | `/api/auth/csrf`                            | –      | issue a CSRF cookie                       |
| POST   | `/api/auth/register`                        | –      | create a pending account                  |
| POST   | `/api/auth/login`                           | –      | sign in (rate limited)                    |
| POST   | `/api/auth/logout`                          | user   | revoke the current session                |
| GET    | `/api/auth/session`                         | –      | current user, unread count, balance       |
| GET    | `/api/aviator/snapshot`                     | –      | current provider snapshot                 |
| POST   | `/api/predictions/request`                  | user   | generate an analysis (charges on success) |
| POST   | `/api/payments/activation`                  | user   | submit activation payment + receipt       |
| GET    | `/api/payments/activation`                  | user   | own activation payments                   |
| POST   | `/api/purchases`                            | user   | submit a credit purchase + receipt        |
| GET    | `/api/purchases`                            | user   | own purchases                             |
| GET    | `/api/receipts/[payment\|purchase]/[id]`    | owner/admin | private receipt download             |
| GET    | `/api/notifications`                        | user   | notifications + unread count              |
| PATCH  | `/api/notifications`                        | user   | mark one (`{id}`) or all read             |
| POST   | `/api/admin/payments/[id]/approve`          | admin  | activate account + bonus                  |
| POST   | `/api/admin/payments/[id]/reject`           | admin  | reject with reason                        |
| POST   | `/api/admin/purchases/[id]/approve`         | admin  | grant credits                             |
| POST   | `/api/admin/purchases/[id]/reject`          | admin  | reject with reason                        |
| POST   | `/api/admin/users/[id]/status`              | admin  | activate / suspend / reject / reset       |
| POST   | `/api/admin/users/[id]/wallet`              | admin  | manual credit adjustment (reason required)|
| POST   | `/api/admin/users/[id]/role`                | admin  | grant/revoke admin                        |
| POST   | `/api/admin/packages`                       | admin  | create package                            |
| PATCH  | `/api/admin/packages/[id]`                  | admin  | edit package                              |
| DELETE | `/api/admin/packages/[id]`                  | admin  | delete package                            |
| POST   | `/api/admin/settings/payments`              | admin  | update payment settings                   |
| POST   | `/api/admin/settings/system`                | admin  | update system settings                    |

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | – | **Required in production.** Signs session/CSRF material. Must be ≥ 16 chars and not the `.env.example` placeholder. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `SESSION_TTL_HOURS` | `168` | Session lifetime |
| `LOGIN_RATE_LIMIT` / `REGISTER_RATE_LIMIT` | `8` / `5` | Rate-limit ceilings per 15 min / hour |
| `STORAGE_MODE` | `local` (`postgres` on Vercel if omitted) | `local` JSON files or `postgres` Neon storage |
| `DATABASE_URL` / `POSTGRES_URL` | – | Pooled Neon Postgres connection string (Vercel Neon integration provides `DATABASE_URL`) |
| `DATA_DIR` / `STORAGE_DIR` | `data` / `storage` | Local-driver storage roots only |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_FULL_NAME` / `ADMIN_USERNAME` | – | Bootstrap administrator (quote values containing `#`) |
| `AVIATOR_PROVIDER_URL` | – | Authorised live data endpoint |
| `AVIATOR_PROVIDER_KEY` | – | Bearer token for the provider |
| `AVIATOR_PROVIDER_HEADERS` | – | Extra headers as a JSON object |
| `AVIATOR_PROVIDER_TIMEOUT_MS` | `4000` | Provider timeout |
| `AVIATOR_CACHE_TTL_MS` | `1000` | Snapshot cache TTL |
| `AVIATOR_ALLOW_SIMULATION` | `false` | Enable the labelled local simulator |
| `AVIATOR_PREDICTIONS_ALLOW_SIMULATED` | `false` | Allow analyses of simulated data (local only) |

`.env.local` is git-ignored and must never be committed.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run seed` | Create data files and the bootstrap administrator |
| `npm run seed:demo` | Seed demo users, payments, purchases, predictions, audit entries |
| `npm run reset:data` | Clear all collections and receipts, then recreate empty seeds |

---

## Testing

The suite below was executed against the running app with `curl` (**91
assertions, all passing**):

- registration (success, duplicate email, duplicate username, weak password,
  password mismatch)
- login (success, wrong password, non-enumerating errors, CSRF missing,
  rate limiting, session cookie issued)
- session endpoint (returns user, never returns `password_hash`)
- prediction flow (generated, charged, correct balance delta, disclaimer
  present, **no guarantee language**, pending account blocked)
- activation payment (accepted, stays pending, account stays pending, wrong
  amount rejected by server-side price, invalid file contents rejected)
- credit purchase (server-side package price/credits, wallet **not** credited by
  upload, underpay rejected, unknown package rejected)
- admin authorization: a normal user gets 403 on every admin API and is
  redirected from `/admin`
- all 12 admin pages load for an admin and 403/redirect for a user
- approvals (account activated, bonus credited, transaction row written,
  credits granted), rejections (reason required, recorded, notified)
- manual wallet adjustment (balance updated, transaction + audit written,
  overdraft prevented, reason required)
- package CRUD and settings updates persist to disk
- receipt privacy (admin 200, owner 200, other user 404, anonymous 401)
- malformed requests (bad JSON → 400, wrong types → 400, unknown keys → 400,
  path traversal blocked)
- logout invalidates the session; protected endpoints then return 401
- route protection (anonymous requests to `/dashboard`, `/wallet`,
  `/predictions`, `/payments`, `/notifications` and `/admin` redirect to
  `/login?next=…`; signed-in users are bounced off `/login`; a normal user is
  redirected away from `/admin`)
- live-feed integrity (provider name exposed, simulation always flagged)

Feed states were verified with three server configurations:

| Configuration | Result |
| --- | --- |
| No provider URL | `connection: "not_configured"`, empty history, UI explains it, prediction refused and **not charged** |
| Mock provider on `127.0.0.1:3300` | `mode: "live"`, `is_simulated: false`, 50 rounds, prediction generated and charged |
| Unreachable provider | `connection: "error"`, `"Live feed unavailable: …"`, retry action, no invented values |

---

## Deployment

The app is a standard Next.js 15 application and builds cleanly
(`npm run build`). Before handling real money:

### Persistent-disk deployment with Docker

The built-in JSON driver is intended for **one Node.js instance with a
persistent writable disk**. This repository includes a `Dockerfile` and
`.dockerignore` for that setup. The host must retain both mounted directories
across container restarts and redeploys; do not scale this service to multiple
instances while using local JSON storage.

Build the image and prepare persistent host directories:

```bash
docker build -t aviator-predictor:latest .
sudo install -d -m 700 /srv/aviator-predictor/data /srv/aviator-predictor/storage
```

Generate an auth secret with `openssl rand -hex 48`, then create a secrets
file **outside the repository** at `/srv/aviator-predictor/app.env`. Paste the
generated value into `AUTH_SECRET` and set a strong, unique admin password:

```bash
openssl rand -hex 48
```

```dotenv
AUTH_SECRET=
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=
ADMIN_FULL_NAME=Platform Administrator
ADMIN_USERNAME=admin
```

Restrict access to it, then start the container with both persistent mounts:

```bash
sudo chmod 600 /srv/aviator-predictor/app.env
docker run -d --name aviator-predictor --restart unless-stopped \
  --env-file /srv/aviator-predictor/app.env \
  -e STORAGE_MODE=local \
  -e DATA_DIR=/app/data \
  -e STORAGE_DIR=/app/storage \
  -p 3000:3000 \
  -v /srv/aviator-predictor/data:/app/data \
  -v /srv/aviator-predictor/storage:/app/storage \
  aviator-predictor:latest
```

Put the service behind an HTTPS reverse proxy. Keep exactly one application
instance when using the local driver; it coordinates writes only inside that
process. The data and receipt folders must be backed up as sensitive data.

### Vercel deployment with Neon Postgres

Vercel does not provide a persistent writable app directory, so use the
Postgres driver instead of the local JSON backend:

1. In Vercel, add the **Neon** integration from the Marketplace and connect it
   to this project for Production (and Preview if you use preview deployments).
   The integration supplies a pooled `DATABASE_URL` environment variable.
2. In **Project Settings → Environment Variables**, set `STORAGE_MODE` to
   `postgres` for Production and Preview. Do not set it to `local`.
3. Set the project Node.js runtime to **22.x** or newer. The Neon serverless
   driver uses WebSockets for transactions.
4. Set a strong `AUTH_SECRET` and strong `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   values in Vercel. Never use the example credentials.
5. Redeploy. On first request, the app creates its `aviator_storage_documents`
   table, seeds default settings/packages, and creates the configured admin if
   one does not exist.

For local testing with Neon, add `DATABASE_URL` to your untracked `.env.local`
and set `STORAGE_MODE=postgres`. Back up the Neon database: it contains all
account, session, payment, wallet, audit and private receipt data. Existing
JSON files on a previous Vercel function instance are not durable and cannot be
assumed to be recoverable or migrated.

Before handling real money:

1. Set a strong `AUTH_SECRET` and configure unique `ADMIN_*` credentials.
2. Point `AVIATOR_PROVIDER_URL` at a data source you are licensed to use.
3. Use Neon/Postgres on Vercel or persistent mounted disks on one self-hosted
   Node.js instance. Never point local JSON storage at `/tmp`.
4. Keep `AVIATOR_ALLOW_SIMULATION` and `AVIATOR_PREDICTIONS_ALLOW_SIMULATED`
   set to `false`.
5. Serve over HTTPS (session cookies are marked `Secure` in production).

### Troubleshooting

**The page shows "Unexpected error" after a successful build.**
That is the root error boundary; its `Reference` number is a Next.js digest,
not the original exception. Check the runtime/function logs for the request.
On Vercel, confirm the Neon integration is connected, `DATABASE_URL` is
available to the deployment, `STORAGE_MODE=postgres` (or unset so Vercel's
Postgres default is used), and the Node.js runtime is 22.x or newer. The local
JSON driver writes under `process.cwd()` and is not supported on Vercel; do not
point it at `/tmp` for account, payment, receipt or wallet data.

A missing or placeholder `AUTH_SECRET` is a separate issue: the server logs a
`CONFIGURATION ERROR`, treats visitors as signed out and returns `503` for
account actions; it should not by itself crash the root layout. Generate a
strong secret and set it in the production environment:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Changing `AUTH_SECRET` invalidates existing sessions and CSRF tokens by design,
so users simply sign in again.

---

## Known limitations

- The rate limiter keeps counters in process memory; on multi-instance
  deployments, replace `consume()` in `lib/auth/rate-limit.ts` with a shared
  backend (Redis/KV). Call sites do not change.
- The session store prunes old rows opportunistically; a dedicated cron is not
  included.
- Notifications are in-app only — no email/SMS transport is wired up.
- Email is stored but not verified (no outbound mail service configured).
- The prediction engine is descriptive, not a forecasting model, by design.
