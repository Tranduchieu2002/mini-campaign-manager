# Project Roadmap — Campaign Management System

> TDD-first delivery plan: every module has a dedicated RED phase (tests written first)
> followed by a GREEN phase (implementation to make tests pass).  
> Modules are developed independently — one module pair at a time.

---

## Quick Concept Reference

Before diving into phases, remember these three distinct entities:

- **User** = system account that signs up and creates campaigns; authenticates via JWT
- **Campaign** = email communication owned by a User; targets Recipients  
- **Recipient** = campaign contact (email address); **NOT a system User**

No FK exists between Users and Recipients — they're independent.

---

## Phase Status Summary

| Phase | Name | TDD Role | Status | Depends on |
|---|---|---|---|---|
| 1 | Database Schema & Integrity | Schema | **COMPLETE** | — |
| 2 | Recipient Module — Tests | RED | **COMPLETE** | Phase 1 |
| 3 | Recipient Module — Implementation | GREEN | **NEXT** | Phase 2 |
| 4 | Campaign Module — Tests | RED | PLANNED | Phase 3 |
| 5 | Campaign Module — Implementation | GREEN | PLANNED | Phase 4 |
| 6 | API Contracts, Auth & Stats | RED → GREEN | PLANNED | Phase 5 |
| 7 | End-to-End Integration Tests | Full cycle | PLANNED | Phase 6 |

---

## How TDD cycles work in this project

```
RED   → Write unit tests (*.spec.ts) for domain functions and service behaviour.
        All tests must FAIL at this point — that is the goal of the RED phase.
        No implementation code is written.

GREEN → Write the minimum implementation to make all RED-phase tests pass.
        No new features, no speculation — only what the failing tests require.

The cycle repeats for each module.
```

Test runner: `node:test` with `describe` / `it` / `assert` in every `*.spec.ts`
file co-located next to its source. Run with `pnpm test:unit`.

---

## Phase 1 — Database Schema & Integrity

**Goal:** Establish a correct, constraint-enforced database layer before writing
any application code.

**TDD role:** Schema  
**Status:** COMPLETE

### Deliverables

| Artifact | Location |
|---|---|
| Schema design document | [`docs/database-schema.md`](database-schema.md) |
| DBMate migration | `fastify-server/db/migrations/20260423_create_campaign_management_tables.sql` |

### What was built

- DDL for `campaigns`, `recipients`, and `campaign_recipients` tables
- `CHECK` constraints for all status columns (campaigns: 6 values, campaign_recipients: 6 values)
- `FOREIGN KEY` with `ON DELETE RESTRICT` (campaigns → users) and `ON DELETE CASCADE` (junction → campaigns/recipients)
- `BEFORE INSERT` trigger `check_campaign_scheduled_at_future` — rejects past-dated `scheduled_at`
- `BEFORE UPDATE` trigger `set_campaign_updated_at` — auto-maintains `updated_at` timestamp
- 4 indexes with trade-off analysis: `idx_campaigns_status`, `idx_campaigns_scheduled_active` (partial), `idx_cr_recipient_id`, `idx_cr_campaign_status`
- 6-test TDD SQL verification script embedded in `docs/database-schema.md`

### Acceptance criteria (met)

- [x] Invalid campaign status rejected with `SQLSTATE 23514`
- [x] Orphaned `campaign_recipient` (non-existent FK) rejected with `SQLSTATE 23503`
- [x] Past-dated `scheduled_at` on INSERT rejected by trigger
- [x] `opened_at` without `sent_at` rejected with `SQLSTATE 23514`
- [x] `updated_at` advances on every campaign `UPDATE`

---

## Phase 2 — Recipient Domain Tests (RED)

**Goal:** Write unit tests for the Recipient domain's core business rules before
any implementation exists. Tests encode pure function contracts and must FAIL —
no `recipient.domain.ts` implementation is written in this phase.

> Service-level unit tests (`*.service.spec.ts`) are written in Phase 3
> alongside the implementation so tests and code stay in sync.

**TDD role:** RED  
**Status:** COMPLETE

### Deliverables

| Artifact | Location |
|---|---|
| Domain unit tests | `src/modules/recipient/domain/recipient.domain.spec.ts` |

### Domain unit test cases — `recipient.domain.spec.ts`

| Test | Input | Expected |
|---|---|---|
| `createRecipient` with valid props | `{ email, name }` | Returns `RecipientEntity` with generated `id` |
| `createRecipient` — empty name | `{ email, name: "" }` | Throws `ArgumentInvalidException` |
| `createRecipient` — invalid email | `{ email: "bad", name: "Alice" }` | Throws `ArgumentInvalidException` |
| `createRecipient` — whitespace-only name | `{ email, name: "   " }` | Throws `ArgumentInvalidException` |
| `isUnsubscribed` — `unsubscribed_at` is null | entity | Returns `false` |
| `isUnsubscribed` — `unsubscribed_at` is a past date | entity | Returns `true` |

### Acceptance criteria

- [x] Domain spec file written at `src/modules/recipient/domain/recipient.domain.spec.ts`
- [x] All 6 domain cases written with real assertions; stub throws so all FAIL (RED state confirmed)
- [x] `pnpm check` passes (Biome + TypeScript clean)

---

## Phase 3 — Recipient Module Implementation (GREEN)

**Goal:** Write the minimum implementation to make every Phase 2 domain test pass,
then add service-level unit tests to cover HTTP behaviour via `fastify.inject()`.

**TDD role:** GREEN  
**Status:** **COMPLETE**

### Module structure to create

```
src/modules/recipient/
├── commands/
│   ├── create-recipient/
│   │   ├── create-recipient.route.ts
│   │   └── create-recipient.schema.ts
│   └── delete-recipient/
│       └── delete-recipient.route.ts
├── queries/
│   └── find-recipients/
│       ├── find-recipients.route.ts
│       └── find-recipients.schema.ts
├── database/
│   ├── recipient.repository.port.ts
│   └── recipient.repository.ts
├── domain/
│   ├── recipient.domain.ts
│   ├── recipient.domain.spec.ts   ← written in Phase 2
│   ├── recipient.types.ts
│   └── recipient.errors.ts
├── dtos/
│   ├── recipient.response.dto.ts
│   └── recipient.paginated.response.dto.ts
├── recipient.mapper.ts
├── recipient.service.ts
└── index.ts
```

Register routes in `src/modules/app-module.ts`.

### Service-level unit test cases — `recipient.service.spec.ts`

| Test | Expected |
|---|---|
| `createRecipient` with valid data | Returns `id` string |
| `createRecipient` with duplicate email | Throws `RecipientAlreadyExistsError` |
| `deleteRecipient` with existing id | Returns `true`; row removed from DB |
| `deleteRecipient` with non-existent id | Throws `NotFoundException` |
| `findRecipients` with 5 rows, limit 3 | Returns `{ data: 3 items, count: 5 }` |
| `findRecipients` on empty table | Returns `{ data: [], count: 0 }` |

### Acceptance criteria

- [ ] `pnpm test:unit` — all `recipient.domain.spec.ts` cases pass
- [ ] `pnpm test:unit` — all `recipient.service.spec.ts` cases pass
- [ ] `pnpm check` passes (Biome + TypeScript)
- [ ] No SQL in `recipient.service.ts`
- [ ] No business logic in route files

---

## Phase 4 — Campaign Domain Tests (RED)

**Goal:** Write unit tests for the Campaign domain's core business rules before
any implementation. Every test must fail.

**TDD role:** RED  
**Status:** PLANNED (depends on Phase 3)

### Deliverables

| Artifact | Location |
|---|---|
| Domain unit tests | `src/modules/campaign/domain/campaign.domain.spec.ts` |

### Domain unit test cases — `campaign.domain.spec.ts`

| Test | Input | Expected |
|---|---|---|
| `createCampaign` with valid props | `{ name, subject, body, createdBy }` | Returns `CampaignEntity`, `status = 'draft'` |
| `createCampaign` — empty name | `{ name: "" }` | Throws `ArgumentInvalidException` |
| `validateTransition('draft', 'scheduled')` | — | Valid (no throw) |
| `validateTransition('draft', 'active')` | — | Throws `InvalidStatusTransitionError` |
| `validateTransition('scheduled', 'active')` | — | Valid (no throw) |
| `validateTransition('active', 'paused')` | — | Valid (no throw) |
| `validateTransition('active', 'draft')` | — | Throws `InvalidStatusTransitionError` |
| `validateTransition('completed', 'draft')` | — | Throws `InvalidStatusTransitionError` |
| `validateTransition('cancelled', 'active')` | — | Throws `InvalidStatusTransitionError` |
| `validateScheduledAt(futureDate)` | `now + 1h` | Valid (no throw) |
| `validateScheduledAt(pastDate)` | `now - 1d` | Throws `ArgumentInvalidException` |
| `validateScheduledAt(null)` | `null` | Throws `ArgumentInvalidException` |
| `canEdit(draft)` | entity | Returns `true` |
| `canEdit(scheduled)` | entity | Returns `false` |
| `canEdit(active)` | entity | Returns `false` |

### Acceptance criteria

- [ ] Domain spec file written at `src/modules/campaign/domain/campaign.domain.spec.ts`
- [ ] `pnpm test:unit` — all domain cases **FAILING** (correct RED state)
- [ ] No `campaign.domain.ts` implementation file exists

---

## Phase 5 — Campaign Module Implementation (GREEN)

**Goal:** Write the minimum implementation to make every Phase 4 test pass.
The `send` operation must use `withTransaction()` to guarantee atomicity.

**TDD role:** GREEN  
**Status:** PLANNED (depends on Phase 4)

### Module structure to create

```
src/modules/campaign/
├── commands/
│   ├── create-campaign/
│   │   ├── create-campaign.route.ts
│   │   └── create-campaign.schema.ts
│   ├── patch-campaign/
│   │   ├── patch-campaign.route.ts
│   │   └── patch-campaign.schema.ts
│   ├── delete-campaign/
│   │   └── delete-campaign.route.ts
│   ├── schedule-campaign/
│   │   ├── schedule-campaign.route.ts
│   │   └── schedule-campaign.schema.ts
│   └── send-campaign/
│       └── send-campaign.route.ts
├── queries/
│   └── find-campaigns/
│       ├── find-campaigns.route.ts
│       └── find-campaigns.schema.ts
├── database/
│   ├── campaign.repository.port.ts
│   └── campaign.repository.ts
├── domain/
│   ├── campaign.domain.ts
│   ├── campaign.domain.spec.ts    ← written in Phase 4
│   ├── campaign.types.ts
│   └── campaign.errors.ts
├── dtos/
│   ├── campaign.response.dto.ts
│   └── campaign.paginated.response.dto.ts
├── campaign.mapper.ts
├── campaign.service.ts
└── index.ts
```

### Send transaction pattern

```typescript
// campaign.service.ts
async sendCampaign(campaignId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const campaign = await campaignRepository.findOneById(campaignId, tx);

    campaignDomain.validateTransition(campaign.status, 'active');

    const recipientCount = await campaignRepository.countEnrolledRecipients(campaignId, tx);
    if (recipientCount === 0) {
      throw new ArgumentInvalidException('Campaign has no enrolled recipients');
    }

    await campaignRepository.markAllRecipientsSent(campaignId, tx);
    await campaignRepository.updateStatus(campaignId, 'active', tx);
    // Any error above rolls back the entire transaction
  });
}
```

### Service-level unit test cases — `campaign.service.spec.ts`

| Test | Expected |
|---|---|
| `createCampaign` with valid data | Returns `id`; status is `draft` |
| `createCampaign` with missing fields | Throws `ArgumentInvalidException` |
| `patchCampaign` on draft | Updates field; returns updated entity |
| `patchCampaign` on non-draft status | Throws `InvalidStatusTransitionError` |
| `deleteCampaign` on draft | Returns `true` |
| `deleteCampaign` on non-draft status | Throws `InvalidStatusTransitionError` |
| `scheduleCampaign` with future date | Status becomes `scheduled` |
| `scheduleCampaign` with past date | Throws `ArgumentInvalidException` |
| `sendCampaign` with 3 pending recipients | All `campaign_recipients` → `sent`; campaign → `active` |
| `sendCampaign` with 0 recipients | Throws `ArgumentInvalidException` (422) |
| `sendCampaign` on non-scheduled status | Throws `InvalidStatusTransitionError` |
| `sendCampaign` — DB failure mid-send | Transaction rolled back; status remains `scheduled` |
| `findCampaigns` paginated | Returns `{ data, count }` |
| `findCampaigns` filtered by status | Returns only matching campaigns |

### Acceptance criteria

- [ ] `pnpm test:unit` — all `campaign.domain.spec.ts` cases pass
- [ ] `pnpm test:unit` — all `campaign.service.spec.ts` cases pass
- [ ] `pnpm check` passes (Biome + TypeScript)
- [ ] No SQL in `campaign.service.ts`
- [ ] No business logic in route files

---

## Phase 6 — API Contracts, Auth & Stats

**Goal:** Lock down every API surface with TypeBox schemas, add JWT
authentication, and implement the stats aggregation endpoint.
Follow the same RED → GREEN cycle within this phase.

**TDD role:** RED → GREEN (within one phase)  
**Status:** PLANNED (depends on Phase 5)

### Auth endpoints

| Method | Path | Auth | TypeBox schema |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | No | `RegisterBodySchema` |
| `POST` | `/api/v1/auth/login` | No | `LoginBodySchema` |

### Protected endpoints (all require `Authorization: Bearer <token>`)

| Method | Path | TypeBox schema |
|---|---|---|
| `GET` | `/api/v1/campaigns` | `FindCampaignsQuerySchema` |
| `POST` | `/api/v1/campaigns` | `CreateCampaignBodySchema` |
| `PATCH` | `/api/v1/campaigns/:id` | `PatchCampaignBodySchema` |
| `DELETE` | `/api/v1/campaigns/:id` | — |
| `POST` | `/api/v1/campaigns/:id/schedule` | `ScheduleCampaignBodySchema` |
| `POST` | `/api/v1/campaigns/:id/send` | — |
| `GET` | `/api/v1/campaigns/:id/stats` | — |
| `GET` | `/api/v1/recipients` | `FindRecipientsQuerySchema` |
| `POST` | `/api/v1/recipients` | `CreateRecipientBodySchema` |
| `DELETE` | `/api/v1/recipients/:id` | — |

### Stats endpoint SQL (single-pass, division-by-zero safe)

```sql
SELECT
  COUNT(*)                                          AS total,
  COUNT(*) FILTER (WHERE status = 'sent')           AS sent,
  COUNT(*) FILTER (WHERE status = 'failed')         AS failed,
  COUNT(*) FILTER (WHERE status = 'opened')         AS opened,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'opened')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE status = 'sent'), 0) * 100, 2
  )                                                 AS open_rate,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'sent')::numeric
    / NULLIF(COUNT(*), 0) * 100, 2
  )                                                 AS send_rate
FROM campaign_recipients
WHERE campaign_id = $1;
```

`NULLIF(expr, 0)` returns `NULL` when denominator is zero. Response DTO maps
`NULL → 0.00` so clients always receive a numeric value.

### Acceptance criteria

- [ ] Unauthenticated requests to protected routes → `401 Unauthorized`
- [ ] Malformed request bodies → `400 Bad Request` with field-level errors
- [ ] `GET /api/v1/campaigns/:id/stats` returns `{ total, sent, failed, opened, open_rate, send_rate }`
- [ ] Stats with zero sends → `open_rate: 0` (not an error)
- [ ] `pnpm check` passes

---

## Phase 7 — Full Test Suite & CI Green

**Goal:** Ensure every `*.spec.ts` file across all modules passes, `pnpm check`
is clean, and the full test suite is CI-ready.

**TDD role:** Full cycle validation  
**Status:** PLANNED (depends on Phase 6)

### Final test coverage checklist

| Spec file | Tests |
|---|---|
| `user.domain.spec.ts` | createUser, validation |
| `recipient.domain.spec.ts` | createRecipient, isUnsubscribed |
| `recipient.service.spec.ts` | create, delete, find |
| `campaign.domain.spec.ts` | createCampaign, validateTransition, validateScheduledAt, canEdit |
| `campaign.service.spec.ts` | create, patch, delete, schedule, send (incl. rollback), find |
| `auth.service.spec.ts` | register, login, JWT issuance |
| `stats.spec.ts` | open_rate, send_rate, zero-send edge case |

### Acceptance criteria

- [ ] `pnpm test:unit` — all spec files pass, 0 failures
- [ ] `pnpm check` — Biome + TypeScript clean
- [ ] Each spec file tests at least: happy path, validation errors, not-found errors
- [ ] Rollback test in `campaign.service.spec.ts` re-reads status from DB after failure

---

## Milestone Timeline

```
Week 1   Phase 1  [COMPLETE]  DB schema, constraints, triggers, TDD SQL verification
Week 2   Phase 2  [NEXT]      Recipient domain unit tests (RED) — all failing
Week 2   Phase 3              Recipient implementation (GREEN) — all unit tests passing
Week 3   Phase 4              Campaign domain unit tests (RED) — all failing
Week 3   Phase 5              Campaign implementation (GREEN) — all unit tests passing
Week 4   Phase 6              API contracts, JWT auth, stats endpoint
Week 4   Phase 7              Full unit test suite green in CI
```

---

## Cross-cutting standards (all phases)

- Package manager: `pnpm` (never npm or yarn)
- Linter + formatter: Biome (`pnpm format && pnpm check`)
- Test runner: `node:test` — all tests in `*.spec.ts` files, run with `pnpm test:unit`
- No `console.*` — use injected Pino `logger`
- No `enum` — use `const` objects with derived types
- All imports include `.ts` extension (ESM requirement)
- SQL lives exclusively in `*.repository.ts` files
- Services interact with data only through repository port interfaces
- Unit test files live next to their source: `*.domain.spec.ts`, `*.service.spec.ts`
