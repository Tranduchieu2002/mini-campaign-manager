import { type Static, Type } from 'typebox';
import { baseResponseDtoSchema } from '#src/shared/api/response.base.ts';

export const userResponseDtoSchema = Type.Intersect([
  baseResponseDtoSchema,
  Type.Object({
    email: Type.String({
      example: 'test@mail.com',
      format: 'email',
      description: "User's email address",
    }),
    name: Type.String({
      example: 'John Doe',
      description: "User's name",
    }),
  }),
]);

export type UserResponseDto = Static<typeof userResponseDtoSchema>;
