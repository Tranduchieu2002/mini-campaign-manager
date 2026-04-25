import { randomUUID } from 'node:crypto';
import type { CreateUserProps, UserEntity } from '#src/modules/user/domain/user.types.ts';

export default function userDomain() {
  return {
    createUser: (create: CreateUserProps): UserEntity => {
      const now = new Date();

      return {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...create,
      };
    },
  };
}
