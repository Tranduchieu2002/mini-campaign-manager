# Recipient Module — Implementation Guide

> Phase 2 (RED) + Phase 3 (GREEN) of the TDD roadmap.  
> Reference module: `src/modules/user/` — every pattern here mirrors it exactly.

---

## Table of Contents

1. [Module Overview](#module-overview)
2. [File Map](#file-map)
3. [Phase 2 — RED: Write Tests First](#phase-2--red-write-tests-first)
   - [Domain Unit Tests](#domain-unit-tests)
   - [E2E Feature Files](#e2e-feature-files)
   - [Step Definitions](#step-definitions)
4. [Phase 3 — GREEN: Implementation](#phase-3--green-implementation)
   - [Domain Types](#domain-types)
   - [Domain Errors](#domain-errors)
   - [Domain Logic](#domain-logic)
   - [Repository Port](#repository-port)
   - [Repository Adapter](#repository-adapter)
   - [Mapper](#mapper)
   - [DTOs](#dtos)
   - [Service](#service)
   - [Schemas](#schemas)
   - [Routes](#routes)
   - [DI Index](#di-index)
   - [Register in app-module](#register-in-app-module)
5. [Verification Checklist](#verification-checklist)

---

## Module Overview

The `recipient` module manages the subscriber registry. A recipient is
identified by a globally unique email address and exists independently of any
campaign. Campaigns reference recipients through the `campaign_recipients`
junction table.

**Dependency rule:** `Route → Service → RepositoryPort → RepositoryAdapter → DB`  
**SQL location:** `recipient.repository.ts` only. Never in `recipient.service.ts`.

---

## File Map

```
fastify-server/
├── src/modules/recipient/
│   ├── commands/
│   │   ├── create-recipient/
│   │   │   ├── create-recipient.route.ts
│   │   │   └── create-recipient.schema.ts
│   │   └── delete-recipient/
│   │       └── delete-recipient.route.ts
│   ├── queries/
│   │   └── find-recipients/
│   │       ├── find-recipients.route.ts
│   │       └── find-recipients.schema.ts
│   ├── database/
│   │   ├── recipient.repository.port.ts
│   │   └── recipient.repository.ts
│   ├── domain/
│   │   ├── recipient.domain.ts
│   │   ├── recipient.domain.spec.ts      ← written in Phase 2
│   │   ├── recipient.types.ts
│   │   └── recipient.errors.ts
│   ├── dtos/
│   │   ├── recipient.response.dto.ts
│   │   └── recipient.paginated.response.dto.ts
│   ├── recipient.mapper.ts
│   ├── recipient.service.ts
│   └── index.ts
└── tests/recipient/
    ├── create-recipient.feature          ← written in Phase 2
    ├── delete-recipient.feature          ← written in Phase 2
    ├── find-recipients.feature           ← written in Phase 2
    └── recipient.steps.ts                ← written in Phase 2
```

---

## Phase 2 — RED: Write Tests First

> Goal: write every test file. Run `pnpm test:e2e --tags @recipient` and
> `pnpm test:unit` — all must **FAIL**. A passing test at this stage is a bug.

---

### Domain Unit Tests

**`src/modules/recipient/domain/recipient.domain.spec.ts`**

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ArgumentInvalidException } from '#src/shared/exceptions/index.ts';
import recipientDomain from './recipient.domain.ts';

describe('recipientDomain()', () => {
  const domain = recipientDomain();

  describe('createRecipient()', () => {
    it('returns a RecipientEntity with a generated id', () => {
      const recipient = domain.createRecipient({
        email: 'alice@example.com',
        name: 'Alice',
      });

      assert.equal(typeof recipient.id, 'string');
      assert.equal(recipient.email, 'alice@example.com');
      assert.equal(recipient.name, 'Alice');
      assert.equal(recipient.unsubscribedAt, null);
      assert.ok(recipient.createdAt instanceof Date);
      assert.ok(recipient.updatedAt instanceof Date);
    });

    it('throws ArgumentInvalidException when email is empty', () => {
      assert.throws(
        () => domain.createRecipient({ email: '', name: 'Alice' }),
        ArgumentInvalidException,
      );
    });

    it('throws ArgumentInvalidException when email format is invalid', () => {
      assert.throws(
        () => domain.createRecipient({ email: 'not-an-email', name: 'Alice' }),
        ArgumentInvalidException,
      );
    });

    it('throws ArgumentInvalidException when name is empty', () => {
      assert.throws(
        () => domain.createRecipient({ email: 'alice@example.com', name: '' }),
        ArgumentInvalidException,
      );
    });

    it('throws ArgumentInvalidException when name is only whitespace', () => {
      assert.throws(
        () => domain.createRecipient({ email: 'alice@example.com', name: '   ' }),
        ArgumentInvalidException,
      );
    });
  });

  describe('isUnsubscribed()', () => {
    it('returns false when unsubscribedAt is null', () => {
      const recipient = domain.createRecipient({
        email: 'alice@example.com',
        name: 'Alice',
      });
      assert.equal(domain.isUnsubscribed(recipient), false);
    });

    it('returns true when unsubscribedAt is a past date', () => {
      const recipient = domain.createRecipient({
        email: 'alice@example.com',
        name: 'Alice',
      });
      const unsubscribed = { ...recipient, unsubscribedAt: new Date('2020-01-01') };
      assert.equal(domain.isUnsubscribed(unsubscribed), true);
    });
  });
});
```

---

### E2E Feature Files

**`tests/recipient/create-recipient.feature`**

```gherkin
Feature: Create a recipient

  @recipient
  Scenario: Create recipient with valid data
    Given recipient data
      | email                | name  |
      | alice@example.com    | Alice |
    When I send a request to create a recipient
    Then I receive a recipient ID
    And I can see the recipient in the list

  @recipient
  Scenario Outline: Create recipient with invalid data
    Given recipient data
      | email   | name   |
      | <Email> | <Name> |
    When I send a request to create a recipient
    Then I receive an error "Bad Request" with status code 400

    Examples:
      | Email              | Name  | Reason           |
      | not-an-email       | Alice | malformed email  |
      | alice@example.com  |       | empty name       |

  @recipient
  Scenario: Create recipient with missing email field
    Given recipient data with missing email
    When I send a request to create a recipient
    Then I receive an error "Bad Request" with status code 400

  @recipient
  Scenario: Create recipient with missing name field
    Given recipient data with missing name
    When I send a request to create a recipient
    Then I receive an error "Bad Request" with status code 400

  @recipient
  Scenario: Duplicate email is rejected
    Given a recipient with email "duplicate@example.com" already exists
    When I send a request to create a recipient with email "duplicate@example.com"
    Then I receive an error "Conflict" with status code 409
```

**`tests/recipient/delete-recipient.feature`**

```gherkin
Feature: Delete a recipient

  @recipient
  Scenario: Delete an existing recipient
    Given a recipient with email "todelete@example.com" exists
    When I send a request to delete that recipient
    Then the response status is 204

  @recipient
  Scenario: Delete a non-existent recipient
    When I send a delete request for recipient id "non-existent-id"
    Then I receive an error "Not Found" with status code 404

  @recipient
  Scenario: Deleting a recipient removes their campaign_recipients rows
    Given a recipient with email "enrolled@example.com" exists
    And that recipient is enrolled in a campaign
    When I send a request to delete that recipient
    Then the response status is 204
    And no campaign_recipients rows exist for that recipient
```

**`tests/recipient/find-recipients.feature`**

```gherkin
Feature: Find recipients

  @recipient
  Scenario: List recipients returns paginated results
    Given 5 recipients exist
    When I request recipients with limit 3 and offset 0
    Then the response status is 200
    And the response contains 3 recipients
    And the total count is 5

  @recipient
  Scenario: List recipients with offset beyond total
    Given 2 recipients exist
    When I request recipients with limit 10 and offset 5
    Then the response status is 200
    And the response contains 0 recipients
    And the total count is 2

  @recipient
  Scenario: Empty recipient table returns empty list
    Given no recipients exist
    When I request recipients with limit 10 and offset 0
    Then the response status is 200
    And the response contains 0 recipients
    And the total count is 0
```

---

### Step Definitions

**`tests/recipient/recipient.steps.ts`**

```typescript
import assert from 'node:assert';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import type { ICustomWorld } from '../support/custom-world.ts';

// Truncate the recipients table before each @recipient scenario
Before({ tags: '@recipient' }, async function (this: ICustomWorld) {
  await this.db`TRUNCATE recipients CASCADE`;
});

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given('recipient data', function (this: ICustomWorld, table) {
  this.context.createRecipientDto = table.hashes()[0];
});

Given('recipient data with missing email', function (this: ICustomWorld) {
  this.context.createRecipientDto = { name: 'Alice' };
});

Given('recipient data with missing name', function (this: ICustomWorld) {
  this.context.createRecipientDto = { email: 'alice@example.com' };
});

Given(
  'a recipient with email {string} already exists',
  async function (this: ICustomWorld, email: string) {
    const response = await this.server.inject({
      method: 'POST',
      url: '/api/v1/recipients',
      body: { email, name: 'Existing' },
    });
    assert.strictEqual(response.statusCode, 201);
  },
);

Given(
  'a recipient with email {string} exists',
  async function (this: ICustomWorld, email: string) {
    const response = await this.server.inject({
      method: 'POST',
      url: '/api/v1/recipients',
      body: { email, name: 'Test Recipient' },
    });
    assert.strictEqual(response.statusCode, 201);
    this.context.createdRecipientId = response.json<{ id: string }>().id;
  },
);

Given(
  'that recipient is enrolled in a campaign',
  async function (this: ICustomWorld) {
    // Insert a campaign directly via DB for this scenario
    await this.db`
      INSERT INTO campaigns (id, name, status, subject, body, created_by)
      SELECT 'camp-enroll-test', 'Test', 'draft', 'Sub', 'Body', id
      FROM users LIMIT 1
    `;
    await this.db`
      INSERT INTO campaign_recipients (campaign_id, recipient_id, status)
      VALUES ('camp-enroll-test', ${this.context.createdRecipientId}, 'pending')
    `;
  },
);

Given(
  '{int} recipients exist',
  async function (this: ICustomWorld, count: number) {
    for (let i = 0; i < count; i++) {
      await this.server.inject({
        method: 'POST',
        url: '/api/v1/recipients',
        body: { email: `recipient${i}@example.com`, name: `Recipient ${i}` },
      });
    }
  },
);

Given('no recipients exist', async function (this: ICustomWorld) {
  await this.db`TRUNCATE recipients CASCADE`;
});

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When(
  'I send a request to create a recipient',
  async function (this: ICustomWorld) {
    this.context.latestResponse = await this.server.inject({
      method: 'POST',
      url: '/api/v1/recipients',
      body: this.context.createRecipientDto,
    });
  },
);

When(
  'I send a request to create a recipient with email {string}',
  async function (this: ICustomWorld, email: string) {
    this.context.latestResponse = await this.server.inject({
      method: 'POST',
      url: '/api/v1/recipients',
      body: { email, name: 'Duplicate Test' },
    });
  },
);

When(
  'I send a request to delete that recipient',
  async function (this: ICustomWorld) {
    this.context.latestResponse = await this.server.inject({
      method: 'DELETE',
      url: `/api/v1/recipients/${this.context.createdRecipientId}`,
    });
  },
);

When(
  'I send a delete request for recipient id {string}',
  async function (this: ICustomWorld, id: string) {
    this.context.latestResponse = await this.server.inject({
      method: 'DELETE',
      url: `/api/v1/recipients/${id}`,
    });
  },
);

When(
  'I request recipients with limit {int} and offset {int}',
  async function (this: ICustomWorld, limit: number, offset: number) {
    this.context.latestResponse = await this.server.inject({
      method: 'GET',
      url: `/api/v1/recipients?limit=${limit}&offset=${offset}`,
    });
  },
);

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then('I receive a recipient ID', function (this: ICustomWorld) {
  assert.strictEqual(this.context.latestResponse!.statusCode, 201);
  assert.strictEqual(
    typeof this.context.latestResponse!.json<{ id: string }>().id,
    'string',
  );
});

Then('I can see the recipient in the list', async function (this: ICustomWorld) {
  const list = await this.server.inject({
    method: 'GET',
    url: '/api/v1/recipients',
  });
  const { data } = list.json<{ data: { id: string }[] }>();
  assert.ok(
    data.some((r) => r.id === this.context.latestResponse!.json<{ id: string }>().id),
  );
});

Then(
  'the response status is {int}',
  function (this: ICustomWorld, statusCode: number) {
    assert.strictEqual(this.context.latestResponse!.statusCode, statusCode);
  },
);

Then(
  'the response contains {int} recipients',
  function (this: ICustomWorld, count: number) {
    const { data } = this.context.latestResponse!.json<{ data: unknown[] }>();
    assert.strictEqual(data.length, count);
  },
);

Then(
  'the total count is {int}',
  function (this: ICustomWorld, total: number) {
    const { count } = this.context.latestResponse!.json<{ count: number }>();
    assert.strictEqual(count, total);
  },
);

Then(
  'no campaign_recipients rows exist for that recipient',
  async function (this: ICustomWorld) {
    const rows = await this.db`
      SELECT * FROM campaign_recipients
      WHERE recipient_id = ${this.context.createdRecipientId}
    `;
    assert.strictEqual(rows.length, 0);
  },
);
```

---

## Phase 3 — GREEN: Implementation

> Goal: write the minimum code to make every Phase 2 test pass.  
> Run `pnpm test:unit` and `pnpm test:e2e --tags @recipient` — all must pass.  
> Run `pnpm check` — must pass before committing.

---

### Domain Types

**`src/modules/recipient/domain/recipient.types.ts`**

```typescript
export interface CreateRecipientProps {
  email: string;
  name: string;
}

export interface RecipientEntity {
  id: string;
  email: string;
  name: string;
  metadata: Record<string, unknown> | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### Domain Errors

**`src/modules/recipient/domain/recipient.errors.ts`**

```typescript
import { ConflictException } from '#src/shared/exceptions/index.ts';

export class RecipientAlreadyExistsError extends ConflictException {
  static readonly message = 'Recipient with this email already exists';

  constructor(cause?: Error, metadata?: unknown) {
    super(RecipientAlreadyExistsError.message, cause, metadata);
  }
}
```

---

### Domain Logic

**`src/modules/recipient/domain/recipient.domain.ts`**

```typescript
import { randomUUID } from 'node:crypto';
import { ArgumentInvalidException } from '#src/shared/exceptions/index.ts';
import type { CreateRecipientProps, RecipientEntity } from './recipient.types.ts';

// Minimal RFC 5322 email check — TypeBox handles full validation at the API layer.
// This guard exists so pure domain functions stay self-validating.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function recipientDomain() {
  return {
    createRecipient(props: CreateRecipientProps): RecipientEntity {
      if (!props.email || !EMAIL_REGEX.test(props.email)) {
        throw new ArgumentInvalidException(
          `Invalid email address: "${props.email}"`,
        );
      }

      if (!props.name || props.name.trim().length === 0) {
        throw new ArgumentInvalidException('Recipient name cannot be empty');
      }

      const now = new Date();
      return {
        id: randomUUID(),
        email: props.email,
        name: props.name.trim(),
        metadata: null,
        unsubscribedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    isUnsubscribed(recipient: RecipientEntity): boolean {
      return recipient.unsubscribedAt !== null;
    },
  };
}
```

---

### Repository Port

**`src/modules/recipient/database/recipient.repository.port.ts`**

```typescript
import type { RepositoryPort } from '#src/shared/db/repository.port.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';

export interface RecipientRepository extends RepositoryPort<RecipientEntity> {
  findOneByEmail(email: string): Promise<RecipientEntity | undefined>;
}
```

---

### Repository Adapter

**`src/modules/recipient/database/recipient.repository.ts`**

```typescript
import { type Static, Type } from 'typebox';
import type { RecipientRepository } from '#src/modules/recipient/database/recipient.repository.port.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';

// TypeBox schema mirrors the recipients table exactly.
// Used by the mapper's persistence validator.
export const recipientSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  name: Type.String({ minLength: 1 }),
  metadata: Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()]),
  unsubscribed_at: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  created_at: Type.String({ format: 'date-time' }),
  updated_at: Type.String({ format: 'date-time' }),
});
export type RecipientModel = Static<typeof recipientSchema>;

export default function recipientRepository({
  db,
  recipientMapper,
  repositoryBase,
}: Dependencies): RecipientRepository {
  const tableName = 'recipients';
  return {
    ...repositoryBase({ tableName, mapper: recipientMapper }),

    async findOneByEmail(email: string): Promise<RecipientEntity | undefined> {
      const [row]: [RecipientModel?] =
        await db`SELECT * FROM ${db(tableName)} WHERE email = ${email} LIMIT 1`;
      return row ? recipientMapper.toDomain(row) : undefined;
    },
  };
}
```

---

### Mapper

**`src/modules/recipient/recipient.mapper.ts`**

```typescript
import {
  type RecipientModel,
  recipientSchema,
} from '#src/modules/recipient/database/recipient.repository.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';
import type { RecipientResponseDto } from '#src/modules/recipient/dtos/recipient.response.dto.ts';
import type { Mapper } from '#src/shared/ddd/mapper.interface.ts';
import { ArgumentInvalidException } from '#src/shared/exceptions/index.ts';
import { ajv } from '#src/shared/utils/validator.util.ts';

export default function recipientMapper(): Mapper<
  RecipientEntity,
  RecipientModel,
  RecipientResponseDto
> {
  const persistenceValidator = ajv.compile(recipientSchema);

  return {
    toDomain(record: RecipientModel): RecipientEntity {
      return {
        id: record.id,
        email: record.email,
        name: record.name,
        metadata: record.metadata ?? null,
        unsubscribedAt: record.unsubscribed_at
          ? new Date(record.unsubscribed_at)
          : null,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
      };
    },

    toResponse(entity: RecipientEntity): RecipientResponseDto {
      return {
        id: entity.id,
        email: entity.email,
        name: entity.name,
        metadata: entity.metadata,
        unsubscribedAt: entity.unsubscribedAt?.toISOString() ?? null,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
      };
    },

    toPersistence(entity: RecipientEntity): RecipientModel {
      const record: RecipientModel = {
        id: entity.id,
        email: entity.email,
        name: entity.name,
        metadata: entity.metadata,
        unsubscribed_at: entity.unsubscribedAt?.toISOString() ?? null,
        created_at: entity.createdAt.toISOString(),
        updated_at: entity.updatedAt.toISOString(),
      };

      const isValid = persistenceValidator(record);
      if (!isValid) {
        throw new ArgumentInvalidException(
          JSON.stringify(persistenceValidator.errors),
          new Error('RecipientMapper persistence validation error'),
          record,
        );
      }

      return record;
    },
  };
}
```

---

### DTOs

**`src/modules/recipient/dtos/recipient.response.dto.ts`**

```typescript
import { type Static, Type } from 'typebox';

export const recipientResponseDtoSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  name: Type.String(),
  metadata: Type.Union([
    Type.Record(Type.String(), Type.Unknown()),
    Type.Null(),
  ]),
  unsubscribedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export type RecipientResponseDto = Static<typeof recipientResponseDtoSchema>;
```

**`src/modules/recipient/dtos/recipient.paginated.response.dto.ts`**

```typescript
import { type Static, Type } from 'typebox';
import { recipientResponseDtoSchema } from './recipient.response.dto.ts';

export const recipientPaginatedResponseDtoSchema = Type.Object({
  data: Type.Array(recipientResponseDtoSchema),
  count: Type.Number(),
  limit: Type.Number(),
  page: Type.Number(),
});

export type RecipientPaginatedResponseDto = Static<
  typeof recipientPaginatedResponseDtoSchema
>;
```

---

### Service

**`src/modules/recipient/recipient.service.ts`**

```typescript
import { RecipientAlreadyExistsError } from '#src/modules/recipient/domain/recipient.errors.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';
import type { Paginated, PaginatedQueryParams } from '#src/shared/db/repository.port.ts';
import { paginatedQueryBase } from '#src/shared/ddd/query.base.ts';
import { ConflictException, NotFoundException } from '#src/shared/exceptions/index.ts';

export type CreateRecipientDto = {
  email: string;
  name: string;
};

export type FindRecipientsParams = Partial<PaginatedQueryParams>;

export default function recipientService({
  recipientRepository,
  recipientDomain,
}: Dependencies) {
  return {
    async createRecipient(dto: CreateRecipientDto): Promise<string> {
      const recipient = recipientDomain.createRecipient(dto);
      try {
        await recipientRepository.insert(recipient);
        return recipient.id;
      } catch (error: unknown) {
        if (error instanceof ConflictException) {
          throw new RecipientAlreadyExistsError(error);
        }
        throw error;
      }
    },

    async deleteRecipient(id: string): Promise<boolean> {
      const deleted = await recipientRepository.delete(id);
      if (!deleted) {
        throw new NotFoundException(`Recipient with id ${id} not found`);
      }
      return deleted;
    },

    async findRecipients(
      params: FindRecipientsParams,
    ): Promise<Paginated<RecipientEntity>> {
      const query = paginatedQueryBase(params);
      return recipientRepository.findAllPaginated(query);
    },
  };
}
```

---

### Schemas

**`src/modules/recipient/commands/create-recipient/create-recipient.schema.ts`**

```typescript
import { type Static, Type } from 'typebox';

export const MAX_EMAIL_LENGTH = 320;
export const MIN_EMAIL_LENGTH = 5;
export const MAX_NAME_LENGTH = 255;
export const MIN_NAME_LENGTH = 1;

export const createRecipientRequestSchema = Type.Object({
  email: Type.String({
    format: 'email',
    minLength: MIN_EMAIL_LENGTH,
    maxLength: MAX_EMAIL_LENGTH,
    description: 'Subscriber email address',
    example: 'alice@example.com',
  }),
  name: Type.String({
    minLength: MIN_NAME_LENGTH,
    maxLength: MAX_NAME_LENGTH,
    description: 'Subscriber display name',
    example: 'Alice',
  }),
});

export type CreateRecipientRequestDto = Static<typeof createRecipientRequestSchema>;
```

**`src/modules/recipient/queries/find-recipients/find-recipients.schema.ts`**

```typescript
import { type Static, Type } from 'typebox';

export const findRecipientsQuerySchema = Type.Object({
  limit: Type.Optional(
    Type.Number({ minimum: 1, maximum: 100, default: 20 }),
  ),
  offset: Type.Optional(
    Type.Number({ minimum: 0, default: 0 }),
  ),
  page: Type.Optional(
    Type.Number({ minimum: 1, default: 1 }),
  ),
});

export type FindRecipientsQuery = Static<typeof findRecipientsQuerySchema>;
```

---

### Routes

**`src/modules/recipient/commands/create-recipient/create-recipient.route.ts`**

```typescript
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { idDtoSchema } from '#src/shared/api/id.response.dto.ts';
import { createRecipientRequestSchema } from './create-recipient.schema.ts';

export default async function createRecipientRoute(
  fastify: FastifyRouteInstance,
) {
  fastify.withTypeProvider<TypeBoxTypeProvider>().route({
    method: 'POST',
    url: '/v1/recipients',
    schema: {
      description: 'Create a new recipient (subscriber)',
      body: createRecipientRequestSchema,
      response: {
        201: idDtoSchema,
      },
      tags: ['recipients'],
    },
    handler: async (req, res) => {
      const id =
        await fastify.diContainer.cradle.recipientService.createRecipient(
          req.body,
        );
      return res.status(201).send({ id });
    },
  });
}
```

**`src/modules/recipient/commands/delete-recipient/delete-recipient.route.ts`**

```typescript
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from 'typebox';

export default async function deleteRecipientRoute(
  fastify: FastifyRouteInstance,
) {
  fastify.withTypeProvider<TypeBoxTypeProvider>().route({
    method: 'DELETE',
    url: '/v1/recipients/:id',
    schema: {
      description: 'Delete a recipient by ID',
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        204: Type.Null(),
      },
      tags: ['recipients'],
    },
    handler: async (req, res) => {
      await fastify.diContainer.cradle.recipientService.deleteRecipient(
        req.params.id,
      );
      return res.status(204).send();
    },
  });
}
```

**`src/modules/recipient/queries/find-recipients/find-recipients.route.ts`**

```typescript
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { recipientPaginatedResponseDtoSchema } from '#src/modules/recipient/dtos/recipient.paginated.response.dto.ts';
import { findRecipientsQuerySchema } from './find-recipients.schema.ts';

export default async function findRecipientsRoute(
  fastify: FastifyRouteInstance,
) {
  fastify.withTypeProvider<TypeBoxTypeProvider>().route({
    method: 'GET',
    url: '/v1/recipients',
    schema: {
      description: 'Find recipients (paginated)',
      querystring: findRecipientsQuerySchema,
      response: {
        200: recipientPaginatedResponseDtoSchema,
      },
      tags: ['recipients'],
    },
    handler: async (req, res) => {
      const result =
        await fastify.diContainer.cradle.recipientService.findRecipients(
          req.query,
        );
      return res.status(200).send(result);
    },
  });
}
```

---

### DI Index

**`src/modules/recipient/index.ts`**

```typescript
import type recipientDomain from '#src/modules/recipient/domain/recipient.domain.ts';
import type { RecipientRepository } from '#src/modules/recipient/database/recipient.repository.port.ts';
import type { RecipientModel } from '#src/modules/recipient/database/recipient.repository.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';
import type { RecipientResponseDto } from '#src/modules/recipient/dtos/recipient.response.dto.ts';
import type makeRecipientService from '#src/modules/recipient/recipient.service.ts';
import type { Mapper } from '#src/shared/ddd/mapper.interface.ts';

declare global {
  export interface Dependencies {
    recipientMapper: Mapper<RecipientEntity, RecipientModel, RecipientResponseDto>;
    recipientRepository: RecipientRepository;
    recipientDomain: ReturnType<typeof recipientDomain>;
    recipientService: ReturnType<typeof makeRecipientService>;
  }
}
```

---

### Register in app-module

Add the recipient routes to **`src/modules/app-module.ts`**:

```typescript
// Add these imports alongside the existing user imports
import createRecipientRoute from '#src/modules/recipient/commands/create-recipient/create-recipient.route.ts';
import deleteRecipientRoute from '#src/modules/recipient/commands/delete-recipient/delete-recipient.route.ts';
import findRecipientsRoute from '#src/modules/recipient/queries/find-recipients/find-recipients.route.ts';

export default async function appModule(fastify: FastifyInstance) {
  // ... existing user routes ...

  // Recipient routes
  await fastify.register(createRecipientRoute);
  await fastify.register(deleteRecipientRoute);
  await fastify.register(findRecipientsRoute);
}
```

---

## Verification Checklist

Run these commands in order after completing Phase 3:

```bash
# 1. Domain unit tests — all recipient.domain.spec.ts cases green
pnpm test:unit

# 2. E2E tests — all @recipient scenarios green
pnpm test:e2e --tags @recipient

# 3. TypeScript + Biome — must pass before any commit
pnpm check

# 4. If Biome reports formatting issues
pnpm format && pnpm check
```

### Phase 2 (RED) checklist

- [ ] `recipient.domain.spec.ts` written — 7 test cases
- [ ] `create-recipient.feature` written — 5 scenarios
- [ ] `delete-recipient.feature` written — 3 scenarios
- [ ] `find-recipients.feature` written — 3 scenarios
- [ ] `recipient.steps.ts` written with step stubs
- [ ] `pnpm test:unit` on spec file — all cases **FAILING**
- [ ] `pnpm test:e2e --tags @recipient` — all scenarios **PENDING/FAILING**

### Phase 3 (GREEN) checklist

- [ ] `recipient.types.ts` — `RecipientEntity`, `CreateRecipientProps`
- [ ] `recipient.errors.ts` — `RecipientAlreadyExistsError`
- [ ] `recipient.domain.ts` — `createRecipient`, `isUnsubscribed`
- [ ] `recipient.repository.port.ts` — `RecipientRepository` interface
- [ ] `recipient.repository.ts` — `recipientSchema`, adapter with `findOneByEmail`
- [ ] `recipient.mapper.ts` — `toDomain`, `toResponse`, `toPersistence`
- [ ] `recipient.response.dto.ts` + `recipient.paginated.response.dto.ts`
- [ ] `recipient.service.ts` — `createRecipient`, `deleteRecipient`, `findRecipients`
- [ ] `create-recipient.schema.ts` + route
- [ ] `delete-recipient` route
- [ ] `find-recipients.schema.ts` + route
- [ ] `index.ts` — DI type declarations
- [ ] Routes registered in `app-module.ts`
- [ ] `pnpm test:unit` — all **PASSING**
- [ ] `pnpm test:e2e --tags @recipient` — all **PASSING**
- [ ] `pnpm check` — **PASSING**

### Common mistakes to avoid

| Mistake | Correct approach |
|---|---|
| SQL in `recipient.service.ts` | SQL belongs only in `recipient.repository.ts` |
| Business logic in route handler | Routes call service methods only |
| Direct import of repository adapter in service | Service imports repository port (interface) only |
| `console.log` for debugging | Use injected `logger` from DI container |
| Missing `.ts` extension on imports | Always include `.ts` (ESM requirement) |
| `npm install` or `yarn add` | Always use `pnpm add` |
| Forgetting to register routes in `app-module.ts` | Registration is required for routes to be active |
