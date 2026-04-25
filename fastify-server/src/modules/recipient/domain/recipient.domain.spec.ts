import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ArgumentInvalidException } from '#src/shared/exceptions/exceptions.ts';
import recipientDomain from './recipient.domain.ts';

const domain = recipientDomain();

describe('recipientDomain()', () => {
  describe('createRecipient()', () => {
    it('returns a RecipientEntity with a generated id', () => {
      const entity = domain.createRecipient({ email: 'alice@example.com', name: 'Alice' });
      assert.ok(typeof entity.id === 'string' && entity.id.length > 0);
      assert.strictEqual(entity.email, 'alice@example.com');
      assert.strictEqual(entity.name, 'Alice');
      assert.strictEqual(entity.unsubscribedAt, null);
    });

    it('throws ArgumentInvalidException when email format is invalid', () => {
      assert.throws(
        () => domain.createRecipient({ email: 'not-an-email', name: 'Alice' }),
        (err) => err instanceof ArgumentInvalidException,
      );
    });

    it('throws ArgumentInvalidException when name is empty', () => {
      assert.throws(
        () => domain.createRecipient({ email: 'alice@example.com', name: '' }),
        (err) => err instanceof ArgumentInvalidException,
      );
    });

    it('throws ArgumentInvalidException when name is whitespace only', () => {
      assert.throws(
        () => domain.createRecipient({ email: 'alice@example.com', name: '   ' }),
        (err) => err instanceof ArgumentInvalidException,
      );
    });
  });

  describe('isUnsubscribed()', () => {
    const baseEntity = {
      id: 'test-id',
      email: 'alice@example.com',
      name: 'Alice',
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('returns false when unsubscribedAt is null', () => {
      assert.strictEqual(domain.isUnsubscribed({ ...baseEntity, unsubscribedAt: null }), false);
    });

    it('returns true when unsubscribedAt is a past date', () => {
      assert.strictEqual(
        domain.isUnsubscribed({ ...baseEntity, unsubscribedAt: new Date('2020-01-01') }),
        true,
      );
    });
  });
});
