import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RecipientRepository } from '#src/modules/recipient/database/recipient.repository.port.ts';
import recipientDomain from '#src/modules/recipient/domain/recipient.domain.ts';
import { RecipientAlreadyExistsError } from '#src/modules/recipient/domain/recipient.errors.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';
import recipientService from '#src/modules/recipient/recipient.service.ts';
import type { Paginated, PaginatedQueryParams } from '#src/shared/db/repository.port.ts';
import { ConflictException, NotFoundException } from '#src/shared/exceptions/index.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntity(overrides: Partial<RecipientEntity> = {}): RecipientEntity {
  return {
    id: 'test-id',
    email: 'alice@example.com',
    name: 'Alice',
    metadata: null,
    unsubscribedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<RecipientRepository> = {}): RecipientRepository {
  return {
    insert: async () => {
      /* no-op mock */
    },
    delete: async () => true,
    findOneById: async () => undefined,
    findOneByEmail: async () => undefined,
    findAll: async () => [],
    findAllPaginated: async (
      _params: PaginatedQueryParams,
    ): Promise<Paginated<RecipientEntity>> => ({
      data: [],
      count: 0,
      limit: _params.limit,
      page: _params.page,
    }),
    update: async (e) => e,
    ...overrides,
  };
}

function makeService(repoOverrides: Partial<RecipientRepository> = {}) {
  return recipientService({
    recipientRepository: makeRepo(repoOverrides),
    recipientDomain: recipientDomain(),
  } as unknown as Dependencies);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recipientService()', () => {
  describe('createRecipient()', () => {
    it('returns the generated id on success', async () => {
      let inserted: RecipientEntity | undefined;
      const service = makeService({
        insert: async (entity) => {
          inserted = entity as RecipientEntity;
        },
      });

      const id = await service.createRecipient({ email: 'alice@example.com', name: 'Alice' });

      assert.ok(typeof id === 'string' && id.length > 0);
      assert.strictEqual(inserted?.email, 'alice@example.com');
    });

    it('throws RecipientAlreadyExistsError when repository signals a conflict', async () => {
      const service = makeService({
        insert: async () => {
          throw new ConflictException('duplicate');
        },
      });

      await assert.rejects(
        () => service.createRecipient({ email: 'alice@example.com', name: 'Alice' }),
        (err) => err instanceof RecipientAlreadyExistsError,
      );
    });

    it('re-throws non-conflict errors from the repository', async () => {
      const boom = new Error('unexpected db failure');
      const service = makeService({
        insert: async () => {
          throw boom;
        },
      });

      await assert.rejects(
        () => service.createRecipient({ email: 'alice@example.com', name: 'Alice' }),
        (err) => err === boom,
      );
    });
  });

  describe('deleteRecipient()', () => {
    it('returns true when recipient exists', async () => {
      const service = makeService({ delete: async () => true });
      const result = await service.deleteRecipient('some-id');
      assert.strictEqual(result, true);
    });

    it('throws NotFoundException when recipient does not exist', async () => {
      const service = makeService({ delete: async () => false });

      await assert.rejects(
        () => service.deleteRecipient('missing-id'),
        (err) => err instanceof NotFoundException,
      );
    });
  });

  describe('findRecipients()', () => {
    it('returns a paginated result', async () => {
      const entity = makeEntity();
      const service = makeService({
        findAllPaginated: async (params) => ({
          data: [entity],
          count: 1,
          limit: params.limit,
          page: params.page,
        }),
      });

      const result = await service.findRecipients({ limit: 10, page: 0 });

      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.data[0]?.email, 'alice@example.com');
    });

    it('applies default pagination when no params provided', async () => {
      let captured: PaginatedQueryParams | undefined;
      const service = makeService({
        findAllPaginated: async (params) => {
          captured = params;
          return { data: [], count: 0, limit: params.limit, page: params.page };
        },
      });

      await service.findRecipients({});

      assert.strictEqual(captured?.limit, 20, 'default limit should be 20');
      assert.strictEqual(captured?.page, 0, 'default page should be 0');
    });
  });
});
