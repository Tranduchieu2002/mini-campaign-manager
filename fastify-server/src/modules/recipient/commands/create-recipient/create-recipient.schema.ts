import { type Static, Type } from 'typebox';

export const MAX_LENGTH_EMAIL = 255;
export const MIN_LENGTH_EMAIL = 5;
export const MAX_LENGTH_NAME = 100;
export const MIN_LENGTH_NAME = 1;

export const createRecipientRequestDtoSchema = Type.Object({
  email: Type.String({
    example: 'alice@example.com',
    description: "Recipient's email address",
    maxLength: MAX_LENGTH_EMAIL,
    minLength: MIN_LENGTH_EMAIL,
    format: 'email',
  }),
  name: Type.String({
    example: 'Alice Smith',
    description: "Recipient's display name",
    maxLength: MAX_LENGTH_NAME,
    minLength: MIN_LENGTH_NAME,
  }),
});

export type CreateRecipientRequestDto = Static<typeof createRecipientRequestDtoSchema>;
