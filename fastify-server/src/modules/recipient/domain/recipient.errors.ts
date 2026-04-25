import { ConflictException } from '#src/shared/exceptions/exceptions.ts';

export class RecipientAlreadyExistsError extends ConflictException {
  constructor(email: string) {
    super(`Recipient with email "${email}" already exists`);
  }
}
