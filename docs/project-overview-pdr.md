# Product Development Requirements — Campaign Management System

> PDR v1.1 · April 2026  
> Owner: Engineering Team  
> Status: Active Development  
> Delivery plan: [`docs/project-roadmap.md`](project-roadmap.md) — 7-phase TDD cycle

---

## Table of Contents

1. [Domain Concepts](#domain-concepts--core-definitions)
2. [Problem Statement](#problem-statement)
3. [Stakeholders & User Roles](#stakeholders--user-roles)
4. [Functional Requirements](#functional-requirements)
5. [Non-Functional Requirements](#non-functional-requirements)
6. [Out of Scope](#out-of-scope)
7. [Technical Stack](#technical-stack)
8. [Constraints & Assumptions](#constraints--assumptions)
9. [Glossary](#glossary)

---

## Domain Concepts — Core Definitions

Before proceeding, understand these three distinct entities:

| Concept | Definition | Example |
|---------|-----------|---------|
| **User** | System account that signs up to access the platform. Users authenticate via JWT and own campaigns. | "alice@company.com" signs up, can create and send campaigns |
| **Campaign** | Email communication created and owned by a User. Targets a list of Recipients and tracks delivery status. | A marketing email campaign scheduled for delivery tomorrow |
| **Recipient** | A contact (email address) that receives campaign emails. **NOT a User.** Recipients have no login credentials and exist independently in a global registry. | "customer@gmail.com" receives campaign emails but is not a system user |

**Key relationship:** A User creates Campaigns. Campaigns target Recipients via the `campaign_recipients` junction table. Users ≠ Recipients. No FK exists between `users` and `recipients`.

---

## Problem Statement

Marketing and operations teams need to send targeted email campaigns to lists of
recipients. The system must track the full lifecycle of a campaign — from draft
creation through scheduling, active delivery, and completion — while maintaining
accurate per-recipient delivery status and providing analytics on send and open
rates.

The core requirements are:

1. **Data integrity at the database level** — invalid status values, orphaned
   records, and past-dated schedules must be rejected by the schema itself, not
   only by application code.
2. **Atomic delivery** — marking recipients as sent must be a single
   all-or-nothing transaction; a partial send must roll back completely.
3. **Accurate analytics** — the stats endpoint must calculate open and send
   rates from a single, efficient SQL aggregation that handles edge cases such
   as zero sends without returning errors.
4. **Secure API** — all campaign operations require JWT authentication; only
   the campaign owner (or admin) may modify or send a campaign.

---

## Stakeholders & User Roles

> **Note:** The auth role `recipient` (below) is **not** related to the `Recipient` domain entity. Auth roles control API permissions; Recipients are campaign contacts, not system accounts.

|| Role | Description | Permissions |
||---|---|---|
|| `admin` | Platform administrator | Full CRUD on all entities; can force-cancel any campaign |
|| `sender` | Campaign author (a User) | Create, schedule, and send own campaigns; read own stats |
|| `recipient` | End subscriber (auth role only) | No API access; never authenticates |

### Role enforcement

- Roles are stored in `users.role` (existing `users` table)
- JWT payload carries `{ sub: userId, role: userRole }` — only Users get JWT tokens
- Route-level guards check `req.user.role` before delegating to the service

---

## Functional Requirements

> Requirements are grouped by the 7-phase TDD roadmap. RED phases contain only
> test-writing requirements; GREEN phases contain only implementation requirements.
> See [`docs/project-roadmap.md`](project-roadmap.md) for full scenario details.

### Phase 1 — Database Schema & Integrity

|| ID | Requirement | Priority |
||---|---|---|
|| DB-01 | `campaigns` table stores name, status, subject, body, scheduled_at, sent_at, created_by | Must have |
|| DB-02 | `recipients` table stores email (unique), name, metadata (JSONB), unsubscribed_at | Must have |
|| DB-03 | `campaign_recipients` junction table tracks per-recipient delivery status | Must have |
|| DB-04 | Campaign status constrained to: `draft`, `scheduled`, `active`, `paused`, `completed`, `cancelled` | Must have |
|| DB-05 | Delivery status constrained to: `pending`, `sent`, `failed`, `bounced`, `opened`, `clicked` | Must have |
|| DB-06 | `scheduled_at` must be a future timestamp on INSERT (trigger-enforced) | Must have |
|| DB-07 | `updated_at` on `campaigns` auto-maintained by BEFORE UPDATE trigger | Must have |
|| DB-08 | Deleting a campaign cascades to `campaign_recipients`; deleting a user is RESTRICTED if campaigns exist | Must have |
|| DB-09 | Indexes on `campaigns.status`, `campaigns.scheduled_at WHERE status = 'scheduled'`, `campaign_recipients.recipient_id`, `campaign_recipients(campaign_id, status)` | Should have |

### Phase 2 — Recipient Domain Tests (RED)

Write core business domain unit tests only. Tests must fail (no implementation exists).

|| ID | Requirement | Priority |
||---|---|---|
|| RC-T01 | Domain spec: `createRecipient` with valid `{ email, name }` returns `RecipientEntity` with generated `id` | Must have |
|| RC-T02 | Domain spec: `createRecipient` with invalid email throws `ArgumentInvalidException` | Must have |
|| RC-T03 | Domain spec: `createRecipient` with empty name throws `ArgumentInvalidException` | Must have |
|| RC-T04 | Domain spec: `createRecipient` with whitespace-only name throws `ArgumentInvalidException` | Must have |
|| RC-T05 | Domain spec: `isUnsubscribed` returns `false` when `unsubscribed_at` is null | Must have |
|| RC-T06 | Domain spec: `isUnsubscribed` returns `true` when `unsubscribed_at` is a past date | Must have |

### Phase 3 — Recipient Module Implementation (GREEN)

Implement until all Phase 2 tests and service-level unit tests pass.

|| ID | Requirement | Priority |
||---|---|---|
|| RC-I01 | `recipient.domain.ts` — pure functions: `createRecipient`, `isUnsubscribed` | Must have |
|| RC-I02 | `POST /api/v1/recipients` creates a subscriber with email uniqueness enforced | Must have |
|| RC-I03 | `DELETE /api/v1/recipients/:id` removes subscriber; `campaign_recipients` rows cascade | Must have |
|| RC-I04 | `GET /api/v1/recipients` returns paginated list | Must have |
|| RC-I05 | Service throws typed domain errors for all error paths | Must have |
|| RC-I06 | `pnpm test:unit` — all `recipient.domain.spec.ts` cases pass | Must have |
|| RC-I07 | `pnpm test:unit` — all `recipient.service.spec.ts` cases pass | Must have |

### Phase 4 — Campaign Domain Tests (RED)

Write core business domain unit tests only. Tests must fail (no implementation exists).

|| ID | Requirement | Priority |
||---|---|---|
|| CM-T01 | Domain spec: `createCampaign` with valid props returns `CampaignEntity` with `status = draft` | Must have |
|| CM-T02 | Domain spec: `createCampaign` with empty name throws `ArgumentInvalidException` | Must have |
|| CM-T03 | Domain spec: `validateTransition('draft', 'scheduled')` — valid (no throw) | Must have |
|| CM-T04 | Domain spec: `validateTransition('draft', 'active')` — throws `InvalidStatusTransitionError` | Must have |
|| CM-T05 | Domain spec: `validateTransition('scheduled', 'active')` — valid | Must have |
|| CM-T06 | Domain spec: `validateTransition('active', 'paused')` — valid | Must have |
|| CM-T07 | Domain spec: `validateTransition('completed', 'draft')` — throws `InvalidStatusTransitionError` | Must have |
|| CM-T08 | Domain spec: `validateScheduledAt(futureDate)` — valid (no throw) | Must have |
|| CM-T09 | Domain spec: `validateScheduledAt(pastDate)` — throws `ArgumentInvalidException` | Must have |
|| CM-T10 | Domain spec: `validateScheduledAt(null)` — throws `ArgumentInvalidException` | Must have |
|| CM-T11 | Domain spec: `canEdit(draft)` — returns `true` | Must have |
|| CM-T12 | Domain spec: `canEdit(scheduled)` — returns `false` | Must have |

### Phase 5 — Campaign Module Implementation (GREEN)

Implement until all Phase 4 domain tests and service-level unit tests pass.

|| ID | Requirement | Priority |
||---|---|---|
|| CM-I01 | `campaign.domain.ts` — pure functions: `createCampaign`, `validateTransition`, `validateScheduledAt`, `canEdit` | Must have |
|| CM-I02 | `POST /api/v1/campaigns` creates a campaign with status `draft` | Must have |
|| CM-I03 | `PATCH /api/v1/campaigns/:id` updates editable fields only when `status = 'draft'`; returns 409 otherwise | Must have |
|| CM-I04 | `DELETE /api/v1/campaigns/:id` removes campaign when `status = 'draft'`; returns 409 otherwise | Must have |
|| CM-I05 | `POST /api/v1/campaigns/:id/schedule` sets future `scheduled_at`; transitions to `scheduled` | Must have |
|| CM-I06 | `POST /api/v1/campaigns/:id/send` runs inside `withTransaction()` — atomic batch update | Must have |
|| CM-I07 | Partial send failure rolls back entirely; status remains `scheduled` (re-read from DB) | Must have |
|| CM-I08 | Send with zero enrolled recipients returns 422 without touching DB | Must have |
|| CM-I09 | `pnpm test:unit` — all `campaign.domain.spec.ts` cases pass | Must have |
|| CM-I10 | `pnpm test:unit` — all `campaign.service.spec.ts` cases pass | Must have |

### Phase 6 — API Contracts, Auth & Stats

|| ID | Requirement | Priority |
||---|---|---|
|| API-01 | `POST /api/v1/auth/register` creates a user with hashed password; returns JWT | Must have |
|| API-02 | `POST /api/v1/auth/login` validates credentials; returns JWT with `{ sub, role }` | Must have |
|| API-03 | All non-auth routes require a valid JWT in `Authorization: Bearer` header | Must have |
|| API-04 | All request bodies validated by TypeBox schemas; invalid input → 400 with field-level errors | Must have |
|| API-05 | `GET /api/v1/campaigns/:id/stats` returns `{ total, sent, failed, opened, open_rate, send_rate }` from a single SQL aggregation | Must have |
|| API-06 | Stats endpoint: `open_rate = 0` (not an error) when `sent = 0` | Must have |
|| API-07 | Email fields validated with `format: "email"` in TypeBox schema | Must have |
|| API-08 | OpenAPI/Swagger docs auto-generated from TypeBox schemas; served at `/documentation` | Should have |

### Phase 7 — Full Test Suite & CI Green

|| ID | Requirement | Priority |
||---|---|---|
|| TST-01 | All `*.domain.spec.ts` files pass: user, recipient, campaign | Must have |
|| TST-02 | All `*.service.spec.ts` files pass: recipient, campaign, auth | Must have |
|| TST-03 | `stats.spec.ts`: open_rate and send_rate correct; zero-send returns 0 not error | Must have |
|| TST-04 | `campaign.service.spec.ts` rollback test: re-reads status from DB after failure | Must have |
|| TST-05 | `pnpm test:unit` 0 failures across all spec files | Must have |
|| TST-06 | `pnpm check` (Biome + TypeScript) clean | Must have |

---

## Non-Functional Requirements

### Performance

|| NFR | Requirement |
||---|---|
|| NFR-P1 | Stats query executes in a single SQL pass using `FILTER` aggregates; no N+1 queries |
|| NFR-P2 | `campaign_recipients` bulk inserts use batch SQL, not row-by-row loops |
|| NFR-P3 | Index coverage ensures all common filter queries (`status`, `scheduled_at`, `recipient_id`) use index scans |

### Reliability & Atomicity

|| NFR | Requirement |
||---|---|
|| NFR-R1 | The `/send` operation is fully atomic: either all recipients are marked sent, or none are (database transaction) |
|| NFR-R2 | Idempotency: a duplicate `/send` call on an already-active campaign returns a 409 without side effects |
|| NFR-R3 | DB connection errors are surfaced as `DatabaseErrorException` (502 or 500 depending on context); not swallowed silently |

### Security

|| NFR | Requirement |
||---|---|
|| NFR-S1 | Passwords stored as bcrypt hashes (cost factor ≥ 12); plaintext never logged or persisted |
|| NFR-S2 | JWT secret loaded from environment variable `JWT_SECRET`; never hard-coded |
|| NFR-S3 | All SQL uses parameterized queries (postgres.js tagged templates); no string concatenation in SQL |
|| NFR-S4 | Sensitive fields (password, token) excluded from all response DTOs |

### Observability

|| NFR | Requirement |
||---|---|
|| NFR-O1 | All server activity logged via injected Pino logger; no `console.*` calls |
|| NFR-O2 | OpenTelemetry traces exported for all incoming requests (`src/instrumentation.ts`) |
|| NFR-O3 | Each request carries a `requestId` stored in `AsyncLocalStorage` (request-context plugin) |

### Code Quality

|| NFR | Requirement |
||---|---|
|| NFR-Q1 | `pnpm check` (Biome + `tsc --noEmit`) passes after every change |
|| NFR-Q2 | No file exceeds 200 lines of code without modularisation |
|| NFR-Q3 | TypeScript `strict: true`; no `any`, no `enum` |
|| NFR-Q4 | All imports include `.ts` extension (ESM strict mode) |

---

## Out of Scope

The following are explicitly excluded from this system:

|| Item | Rationale |
||---|---|
|| Email provider integration (SendGrid, SES, Postmark) | The system models delivery status but does not send emails. Provider integration is a separate service concern. |
|| Front-end / Admin UI | API-only system; UI layer is out of scope for this PDR. |
|| Real-time push notifications | Delivery status updates are pull-based (polling `/stats`). WebSocket or SSE support is a future enhancement. |
|| Multi-tenancy / workspace isolation | All data is scoped by `created_by` user; full tenant isolation is a future enhancement. |
|| Unsubscribe webhook processing | The `unsubscribed_at` column exists; webhook ingestion from providers is out of scope. |
|| Rate limiting | Assumed to be handled at the infrastructure layer (API gateway / reverse proxy). |
|| GDPR / data deletion workflows | `DELETE /recipients/:id` exists; automated right-to-be-forgotten workflows are out of scope. |

---

## Technical Stack

|| Concern | Technology | Version |
||---|---|---|
|| Runtime | Node.js | >= 24 (native TS execution, no build step) |
|| Web framework | Fastify | 5.x |
|| Language | TypeScript | strict mode, ESM-only |
|| Database | PostgreSQL | 15+ |
|| DB client | postgres.js | tagged template literals |
|| Migrations | DBMate | SQL files in `db/migrations/` |
|| DI container | Awilix + @fastify/awilix | singleton scope |
|| Authentication | fastify-jwt | RS256 or HS256 JWT |
|| Validation | TypeBox | compile-time + runtime schemas |
|| GraphQL | Mercurius | co-located with REST routes |
|| Linter + formatter | Biome | `pnpm check` / `pnpm format` |
|| Unit tests | node:test | `*.spec.ts` next to source (`pnpm test:unit`) |


|| Observability | Pino + OpenTelemetry | structured JSON logs |

---

## Constraints & Assumptions

1. **No ORM.** All SQL is written explicitly. TypeBox validates inputs; postgres.js
   handles all query parameterization.
2. **Factory functions, not classes.** Services, repositories, and domain modules
   export factory functions that receive a single destructured `Dependencies` object.
3. **Modules are independent.** Cross-module communication goes through the DI
   container, never through direct imports between module directories.
4. **Status transitions are irreversible in most paths.** A `completed` or
   `cancelled` campaign cannot be re-opened. This is enforced in the service layer
   and documented in the status machine diagram in `docs/system-architecture.md`.
5. **Recipient deduplication is email-based.** The `UNIQUE` constraint on
   `recipients.email` is the sole deduplication mechanism.
6. **The users table pre-exists.** The auth module will add password hashing and
   JWT issuance on top of the existing `users` schema without altering the table
   structure.
7. **TDD-first development.** Every module is developed in a RED → GREEN cycle:
   tests are written first (RED phase, all tests must fail), implementation
   follows (GREEN phase, minimum code to pass tests). Modules are developed
   independently; one module pair is completed before the next begins.
8. **Unit-test-only approach.** All tests use `node:test` (`*.spec.ts` files).
   Service-level tests may use real DB connections; each test cleans up its own
   data via `beforeEach`/`afterEach` helpers.

---

## Glossary

|| Term | Definition |
||---|---|
|| **User** | System account that signs up to access the platform; can create and own campaigns; authenticates via JWT. **Never to be confused with Recipient.** |
|| **Campaign** | Email communication owned by a User, targeting Recipients, tracking lifecycle and per-recipient delivery status. |
|| **Recipient** | A contact (unique email address) that receives campaign emails. **Not a system User; no login credentials.** Exists independently in the global `recipients` table. |
|| **CampaignRecipient** | Row in the `campaign_recipients` junction table linking one Campaign to one Recipient; tracks delivery status (`pending`, `sent`, `failed`, `bounced`, `opened`, `clicked`). |
|| **Status (campaign)** | One of `draft`, `scheduled`, `active`, `paused`, `completed`, `cancelled`. Enforced by a `CHECK` constraint on the `campaigns` table. |
|| **Status (delivery)** | One of `pending`, `sent`, `failed`, `bounced`, `opened`, `clicked`. Enforced by a `CHECK` constraint on `campaign_recipients`. |
|| **Send transaction** | The atomic database operation that transitions all `campaign_recipients` from `pending` to `sent` and the campaign from `scheduled` to `active`. Rolls back entirely if any part fails. |
|| **open_rate** | `opened / sent * 100`, rounded to 2 decimal places. Returns `0` (not an error) when `sent = 0`. |
|| **send_rate** | `sent / total * 100`, rounded to 2 decimal places. Returns `0` (not an error) when `total = 0`. |
|| **Repository Port** | A TypeScript interface that defines the data access contract for a module. The service depends on the interface; the repository adapter implements it. |
|| **Repository Adapter** | The concrete SQL implementation of a repository port. All SQL lives here; the service never imports it directly. |
|| **Domain Function** | A pure function (no I/O, no side effects) that encodes a business rule, e.g. `validateStatusTransition(from, to)`. |
|| **DI Container** | The Awilix container that wires all dependencies together at startup and provides them to routes via `fastify.diContainer.cradle`. |
|| **Vertical Slice** | A self-contained feature folder (`commands/`, `queries/`, `database/`, `domain/`, `dtos/`, `*.service.ts`) that owns everything needed to deliver one feature. |
|| **withTransaction** | A helper from `src/shared/db/postgres.ts` that wraps an async callback in a PostgreSQL transaction, committing on success and rolling back on any error. |
|| **TypeBox** | A JSON Schema builder that produces schemas usable at both compile time (TypeScript types) and runtime (Fastify validation). |
|| **DBMate** | A schema migration tool that applies raw SQL files from `db/migrations/` in order; supports `migrate:up` and `migrate:down` sections. |
