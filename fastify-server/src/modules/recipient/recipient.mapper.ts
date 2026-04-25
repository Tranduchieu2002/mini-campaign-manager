import {
  type RecipientModel,
  recipientSchema,
} from '#src/modules/recipient/database/recipient.repository.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';
import type { RecipientResponseDto } from '#src/modules/recipient/dtos/recipient.response.dto.ts';
import type { Mapper } from '#src/shared/ddd/mapper.interface.ts';
import { ArgumentInvalidException } from '#src/shared/exceptions/index.ts';
import { ajv } from '#src/shared/utils/validator.util.ts';

export default function recipientMapper(): Mapper<
  RecipientEntity,
  RecipientModel,
  RecipientResponseDto
> {
  const persistenceValidator = ajv.compile(recipientSchema);
  return {
    toDomain(record: RecipientModel): RecipientEntity {
      return {
        id: record.id,
        email: record.email,
        name: record.name,
        metadata: record.metadata,
        unsubscribedAt: record.unsubscribed_at ? new Date(record.unsubscribed_at) : null,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
      };
    },

    toResponse(entity: RecipientEntity): RecipientResponseDto {
      return {
        id: entity.id,
        email: entity.email,
        name: entity.name,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
      };
    },

    toPersistence(entity: RecipientEntity): RecipientModel {
      const record: RecipientModel = {
        id: entity.id,
        email: entity.email,
        name: entity.name,
        metadata: entity.metadata,
        unsubscribed_at: entity.unsubscribedAt ? entity.unsubscribedAt.toISOString() : null,
        created_at: entity.createdAt.toISOString(),
        updated_at: entity.updatedAt.toISOString(),
      };
      const valid = persistenceValidator(record);
      if (!valid) {
        throw new ArgumentInvalidException(
          JSON.stringify(persistenceValidator.errors),
          new Error('Mapper validation error'),
          record,
        );
      }
      return record;
    },
  };
}
