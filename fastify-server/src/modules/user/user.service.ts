import { UserAlreadyExistsError } from '#src/modules/user/domain/user.errors.ts';
import type { UserEntity } from '#src/modules/user/domain/user.types.ts';
import type { Paginated, PaginatedQueryParams } from '#src/shared/db/repository.port.ts';
import { paginatedQueryBase } from '#src/shared/ddd/query.base.ts';
import { ConflictException, NotFoundException } from '#src/shared/exceptions/index.ts';
import type { CreateUserRequestDto } from './commands/create-user/create-user.schema.ts';

export type FindUsersParams = Partial<PaginatedQueryParams> & {
  name?: string;
};

export default function userService({ userRepository, userDomain }: Dependencies) {
  return {
    async createUser(dto: CreateUserRequestDto): Promise<string> {
      const user = userDomain.createUser(dto);
      try {
        await userRepository.insert(user);
        return user.id;
      } catch (error: unknown) {
        if (error instanceof ConflictException) {
          throw new UserAlreadyExistsError(error);
        }
        throw error;
      }
    },

    async deleteUser(id: string): Promise<boolean> {
      const deleted = await userRepository.delete(id);
      if (!deleted) {
        throw new NotFoundException(`User with id ${id} not found`);
      }
      return deleted;
    },

    async findUsers(params: FindUsersParams): Promise<Paginated<UserEntity>> {
      const query = paginatedQueryBase(params);
      return userRepository.findAllPaginatedFiltered(query, {
        name: params.name,
      });
    },
  };
}
