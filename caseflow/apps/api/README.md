# @caseflow/api

NestJS REST API for CaseFlow. See the [root README](../../README.md) for setup.

## Layout

```
src/
├── common/          Prisma, guards, decorators, pipes, filters, utilities
├── config/          Zod-validated environment schema
└── modules/
    ├── auth/            magic links, sessions
    ├── organizations/   settings, branding, team
    ├── clients/
    ├── workflows/       reusable templates
    ├── cases/           the case workspace: cases, documents, requests,
    │                    tasks, messages — one module, one authorisation
    │                    choke point (CaseAccessService)
    ├── dashboard/
    ├── portal/          client-facing read models
    ├── documents/       upload, review, signed downloads
    ├── events/          append-only activity log
    ├── notifications/   service, channel drivers, mail transports
    ├── queue/           BullMQ with an in-process fallback
    ├── storage/         S3 and local drivers
    ├── integrations/    CRM provider interface, Bitrix24, webhooks
    └── maintenance/     deadline scanning
```

## Conventions

- **Authorisation is server-side and default-deny.** `SessionGuard` and
  `RolesGuard` are global: a route is private and staff-only unless it declares
  `@Public()` or `@Roles(...)`. Adding an endpoint cannot leak data by omission.
- **The organization comes from the session.** Services take an `AuthContext`
  and scope every query with it. No service accepts an organization id argument.
- **Validation is Zod at the boundary.** `zodPipe(schema)` on the controller
  parameter; the inferred type is what the service receives.
- **Events are append-only.** `EventsService` exposes `record`/`recordAs` and
  read methods, and nothing else.
- **Side effects go through the queue.** Business code calls
  `NotificationService`; delivery happens in a job.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/magic-link` | Public, rate limited, does not disclose whether an account exists |
| `POST` | `/auth/verify` | Public; issues the session cookie |
| `GET` | `/auth/me` · `POST /auth/logout` | Any signed-in principal |
| `GET` | `/dashboard` | Staff |
| `GET/POST/PATCH` | `/clients`, `/clients/:id` | Staff; create/update is MANAGER+ |
| `GET/POST/PATCH` | `/cases`, `/cases/:id` | Staff, scoped by role |
| `POST` | `/cases/:id/stage` | Move stage |
| `POST` | `/cases/:id/document-requests` | Requirement + client request + notification |
| `POST` | `/cases/:id/documents` | Multipart upload |
| `POST` | `/cases/:id/requests` · `/tasks` · `/messages` | |
| `GET` | `/documents/review-queue` | |
| `POST` | `/documents/:id/review` | Rejection requires a reason |
| `GET` | `/documents/:id/download-url` | Short-lived signed URL |
| `GET/PUT` | `/organization`, `/organization/users` | Branding and team; writes are ADMIN+ |
| `GET/POST/PATCH/DELETE` | `/workflow-templates` | Writes are ADMIN+ |
| `GET/POST` | `/portal/*` | CLIENT only, bound to their own client id |
| `GET/PUT/POST` | `/integrations/crm/*` | ADMIN+ |
| `POST` | `/integrations/bitrix24/webhook` | Public; authenticated by application token |
| `GET` | `/health` | Public |

## Storage drivers

`STORAGE_DRIVER=local` writes under `STORAGE_LOCAL_PATH` and serves downloads
through `GET /api/files/download` with an HMAC signature and expiry — the same
access model as S3 presigned URLs, so nothing behaves differently in production.

`STORAGE_DRIVER=s3` works with AWS S3, MinIO, R2 or any compatible endpoint.
Keep the bucket private; CaseFlow never sets a public ACL.
