import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import userDomain from './user.domain.ts';

describe('userDomain()', () => {
  it('should return a new user entity', () => {
    const user = userDomain().createUser({
      email: 'test@test.it',
      name: 'Test User',
    });
    assert.equal(user.email, 'test@test.it');
    assert.equal(user.name, 'Test User');
  });
});
