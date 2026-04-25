import { RecipientAlreadyExistsError } from '#src/modules/recipient/domain/recipient.errors.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';
import type { Paginated, PaginatedQueryParams } from '#src/shared/db/repository.port.ts';
import { paginatedQueryBase } from '#src/shared/ddd/query.base.ts';
import { ConflictException, NotFoundException } from '#src/shared/exceptions/index.ts';
import type { CreateRecipientRequestDto } from './commands/create-recipient/create-recipient.schema.ts';

export type FindRecipientsParams = Partial<PaginatedQueryParams>;

export default function recipientService({ recipientRepository, recipientDomain }: Dependencies) {
  return {
    async createRecipient(dto: CreateRecipientRequestDto): Promise<string> {
      const entity = recipientDomain.createRecipient(dto);
      try {
        await recipientRepository.insert(entity);
        return entity.id;
      } catch (error: unknown) {
        if (error instanceof ConflictException) {
          throw new RecipientAlreadyExistsError(dto.email);
        }
        throw error;
      }
    },

    async deleteRecipient(id: string): Promise<boolean> {
      const deleted = await recipientRepository.delete(id);
      if (!deleted) {
        throw new NotFoundException(`Recipient with id "${id}" not found`);
      }
      return deleted;
    },

    async findRecipients(params: FindRecipientsParams): Promise<Paginated<RecipientEntity>> {
      const query = paginatedQueryBase(params);
      return recipientRepository.findAllPaginated(query);
    },
  };
}
