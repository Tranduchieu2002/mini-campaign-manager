import { Type } from 'typebox';
import { recipientResponseDtoSchema } from '#src/modules/recipient/dtos/recipient.response.dto.ts';
import { paginatedResponseBaseSchema } from '#src/shared/api/paginated.response.base.ts';

export const recipientPaginatedResponseSchema = Type.Intersect([
  paginatedResponseBaseSchema,
  Type.Object({
    data: Type.Array(Type.Optional(recipientResponseDtoSchema)),
  }),
]);
