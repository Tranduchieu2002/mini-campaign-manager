import { type Static, Type } from 'typebox';
import { baseResponseDtoSchema } from '#src/shared/api/response.base.ts';

export const recipientResponseDtoSchema = Type.Intersect([
  baseResponseDtoSchema,
  Type.Object({
    email: Type.String({ format: 'email', description: "Recipient's email address" }),
    name: Type.String({ description: "Recipient's name" }),
  }),
]);

export type RecipientResponseDto = Static<typeof recipientResponseDtoSchema>;
