# CaseFlow

**Client operations platform for service companies that run long, document-heavy
customer processes.**

CaseFlow is the external, client-facing operational layer a company puts in
front of its clients: the case, its stages, the documents required, what has
been approved or rejected, what is still outstanding, and the deadlines
attached to all of it. It is deliberately *not* a CRM — companies keep Bitrix24
or whatever they already use for their internal pipeline, and CaseFlow syncs the
few fields that matter.

The first vertical is immigration and residency consulting. Nothing in the data
model is specific to it: a case is a workflow instance with stages, document
requirements, requests and an activity log, which is equally the shape of a
legal matter, an audit engagement or a certification process.

---

## What is in the box

| Area | What it does |
| --- | --- |
| **Multi-tenancy** | Every business row carries an `organizationId`. Scoping is enforced in the data layer through one authorisation choke point, never in the UI. |
| **Auth** | Passwordless magic links. Sessions are a signed JWT plus an opaque secret checked against a stored hash, in an httpOnly cookie. |
| **RBAC** | `OWNER`, `ADMIN`, `MANAGER`, `SPECIALIST`, `CLIENT`. Routes are private and staff-only unless they opt in. Specialists see only their own cases. |
| **Workflows** | Reusable templates with stages and document requirements. Opening a case *copies* the template — editing a template never mutates a live case. |
| **Documents** | Requirement-centric, versioned. Rejection requires a reason the client reads; the replacement is a new version, nothing is overwritten. |
| **Client portal** | Separate mobile-first surface: progress, stage timeline, documents by status, open requests, deadlines, messages. |
| **Notifications** | Queued, channel-driven (email + in-app today), with a transport-level mail interface. Telegram/WhatsApp/SMS are new drivers, not new business code. |
| **CRM** | `CrmProvider` interface with a Bitrix24 adapter and an idempotent inbound webhook pipeline. |
| **Audit** | Append-only `Event` log with no update or delete path in the service layer. |

## Stack

- **Frontend** — Next.js 15 (App Router, server components and server actions),
  TypeScript, Tailwind CSS v4, shadcn/ui-style components on Radix primitives.
- **Backend** — NestJS 11, TypeScript, REST, Zod validation.
- **Data** — PostgreSQL 16 via Prisma.
- **Queue** — Redis + BullMQ (with an in-process fallback driver).
- **Storage** — any S3-compatible bucket, or the local driver for development.
  Both hand out short-lived signed URLs; buckets are never public.

```
caseflow/
├── apps/
│   ├── api/            NestJS API, Prisma schema, migrations, seed
│   └── web/            Next.js employee app + client portal
└── docker-compose.yml  Postgres, Redis, MinIO for local development
```

---

## Running it

### 1. Infrastructure

```bash
docker compose up -d postgres redis
```

Or point `DATABASE_URL` / `REDIS_URL` at anything you already run.

### 2. Configure

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Set `SESSION_SECRET` in `apps/api/.env` to at least 32 random characters
(`openssl rand -base64 48`). The API refuses to boot on an invalid
configuration rather than failing later at request time.

### 3. Install, migrate, seed

```bash
npm install
npm run db:deploy      # apply migrations
npm run db:seed        # demo organization and case
```

### 4. Run

```bash
npm run dev            # API on :4000, web on :3000
```

Open <http://localhost:3000>, enter one of the seeded addresses, and follow the
magic link. With `MAIL_DRIVER=console` the link is printed in the API log and is
also returned to the login screen outside production.

| Address | Role | Lands on |
| --- | --- | --- |
| `elena@globalmigration.example` | OWNER | employee app, full access |
| `marc@globalmigration.example` | MANAGER | employee app, clients and cases |
| `amelie@globalmigration.example` | SPECIALIST | only cases assigned to them |
| `ivan.petrov@example.com` | CLIENT | client portal |

### Demo state

**Global Migration**, running a nine-stage *France Residence Permit* workflow.
Ivan Petrov's case sits in **Legal review** (stage 4 of 9) with 16 document
requirements: 12 approved, 1 under review, 1 rejected with a reason, 2
outstanding — 13 of 16 received. There is an open document request with a
deadline inside 48 hours, an internal task, a four-message conversation and a
full activity trail including a stage change that arrived from Bitrix24.

Progress reads **~63%**. It is computed, never stored by hand — see below.

---

## How progress is calculated

`apps/api/src/modules/cases/case-progress.ts`

```
progress = 0.4 × stage score + 0.6 × document score
```

- A completed stage counts fully; the stage in progress counts by how much of
  its own paperwork is in (half, if it has none).
- A document under review counts as half — the work is done, the review is not.
  Rejected counts as zero. Optional requirements are excluded.
- Paperwork carries the larger weight because the later stages of a typical
  process are external waiting periods the company does not control, while the
  document set is what the client can act on today.

Progress is recomputed on every event that can move it and stored on the case,
so reads stay cheap.

---

## Security model

- **Tenant isolation** — `organizationId` always comes from the session. Nothing
  in a request body, query string or header can influence it. Every case-level
  read and write passes through `CaseAccessService`, which composes the tenant
  filter with the role filter. A cross-tenant id returns `404`, not `403`, so the
  API cannot be used to probe for the existence of another tenant's records.
- **Sessions** — the cookie carries a JWT *and* an opaque secret; only the hash
  of the secret is stored, so a leaked signing key alone cannot mint sessions.
  Sessions are revocable and expire server-side.
- **Files** — private buckets only. Downloads are short-lived signed URLs (S3
  presigned, or HMAC-signed for the local driver, verified for both signature
  and expiry). Object keys are `org/<uuid>/cases/<uuid>/<uuid>.<ext>` — namespaced
  per tenant and never sequential. Uploads are validated for size, MIME type and
  extension.
- **Rate limiting** — keyed by session rather than by IP, because all traffic from
  the web app shares one source address. Anonymous endpoints (sign-in, webhooks)
  fall back to the client IP with tighter limits.
- **Webhooks** — the tenant is identified by the application token the caller
  presents, checked with a constant-time comparison. Each delivery is claimed in
  an idempotency ledger before any work happens, so a retry is recorded once and
  produces no duplicate events or notifications.
- **Audit** — the event log is append-only by construction.

---

## Bitrix24 integration

CaseFlow is the source of truth for the portal, documents, requirements,
requests, client-facing tasks and history. From the CRM it reads only the deal
id, contact, responsible employee, pipeline, stage and the custom fields you
list — it does not mirror the CRM.

1. **Settings → Integrations** — paste an inbound webhook URL from Bitrix24
   (*Developer resources → Other → Inbound webhook*, `crm` scope).
2. Create an outbound webhook in Bitrix24 for `ONCRMDEALUPDATE` pointing at
   `POST /api/integrations/bitrix24/webhook`, using the application token shown
   on the settings page.
3. Map each Bitrix pipeline stage to a CaseFlow workflow stage — for example
   `DOCS_RECEIVED → Legal review`.

A delivery is validated, matched to an organization by its token, deduplicated,
applied to the case whose `externalCrmEntityId` matches, written to the activity
log, and — when the stage actually moved — notified to the client.

Adding amoCRM means implementing `CrmProvider` and registering it; the webhook
pipeline and the mapping UI are provider-agnostic.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API and web in watch mode |
| `npm run build` | Build both apps |
| `npm run lint` | ESLint across both workspaces |
| `npm run typecheck` | `tsc --noEmit` across both workspaces |
| `npm test` | Unit tests |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations (deployments) |
| `npm run db:seed` | Reset and reseed the demo organization |
| `npm run db:reset` | Drop, re-migrate and reseed |

Tests cover the progress model, tenant and role scoping, the RBAC guard, upload
validation, notification rendering and escaping, and webhook idempotency.

---

## Deliberately not built

No AI, OCR, WhatsApp, Telegram bot, mobile apps, video calls, e-signatures,
billing, accounting, telephony, marketplace, 1C or advanced analytics. Where a
future feature has an obvious seam, the seam exists and is documented — the
notification channel interface, the CRM provider interface, the storage driver
interface, and the `customDomain` field reserved for per-tenant domains.
