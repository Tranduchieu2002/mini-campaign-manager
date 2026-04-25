import { type Static, Type } from 'typebox';
import type { RecipientRepository } from '#src/modules/recipient/database/recipient.repository.port.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';

export const recipientSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  metadata: Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()]),
  unsubscribed_at: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
  updated_at: Type.String(),
});

export type RecipientModel = Static<typeof recipientSchema>;

export default function recipientRepository({
  db,
  recipientMapper,
  repositoryBase,
}: Dependencies): RecipientRepository {
  const tableName = 'recipients';
  return {
    ...repositoryBase<RecipientEntity, RecipientModel>({ tableName, mapper: recipientMapper }),

    async findOneByEmail(email: string): Promise<RecipientEntity | undefined> {
      const [row]: [RecipientModel?] =
        await db`SELECT * FROM ${db(tableName)} WHERE email = ${email} LIMIT 1`;
      return row ? recipientMapper.toDomain(row) : undefined;
    },
  };
}
