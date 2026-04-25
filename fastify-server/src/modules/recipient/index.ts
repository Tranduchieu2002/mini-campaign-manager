import type { RecipientRepository } from '#src/modules/recipient/database/recipient.repository.port.ts';
import type { RecipientModel } from '#src/modules/recipient/database/recipient.repository.ts';
import type recipientDomain from '#src/modules/recipient/domain/recipient.domain.ts';
import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';
import type { RecipientResponseDto } from '#src/modules/recipient/dtos/recipient.response.dto.ts';
import type makeRecipientService from '#src/modules/recipient/recipient.service.ts';
import type { Mapper } from '#src/shared/ddd/mapper.interface.ts';

declare global {
  export interface Dependencies {
    recipientMapper: Mapper<RecipientEntity, RecipientModel, RecipientResponseDto>;
    recipientRepository: RecipientRepository;
    recipientDomain: ReturnType<typeof recipientDomain>;
    recipientService: ReturnType<typeof makeRecipientService>;
  }
}
