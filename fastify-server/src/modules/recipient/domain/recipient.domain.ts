import { randomUUID } from 'node:crypto';
import { ArgumentInvalidException } from '#src/shared/exceptions/exceptions.ts';
import type { CreateRecipientProps, RecipientEntity } from './recipient.types.ts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function recipientDomain() {
  return {
    createRecipient(props: CreateRecipientProps): RecipientEntity {
      if (!EMAIL_REGEX.test(props.email)) {
        throw new ArgumentInvalidException(`Invalid email format: "${props.email}"`);
      }
      if (!props.name || props.name.trim().length === 0) {
        throw new ArgumentInvalidException('Recipient name cannot be empty or whitespace');
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

    isUnsubscribed(entity: RecipientEntity): boolean {
      return entity.unsubscribedAt !== null;
    },
  };
}
