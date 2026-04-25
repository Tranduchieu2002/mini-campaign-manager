import type { RecipientEntity } from '#src/modules/recipient/domain/recipient.types.ts';
import type { RepositoryPort } from '#src/shared/db/repository.port.ts';

export interface RecipientRepository extends RepositoryPort<RecipientEntity> {
  findOneByEmail(email: string): Promise<RecipientEntity | undefined>;
}
