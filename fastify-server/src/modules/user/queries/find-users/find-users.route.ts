import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { userPaginatedResponseSchema } from '#src/modules/user/dtos/user.paginated.response.dto.ts';
import { findUsersRequestDtoSchema } from './find-users.schema.ts';

export default async function findUsersRoute(fastify: FastifyRouteInstance) {
  fastify.withTypeProvider<TypeBoxTypeProvider>().route({
    method: 'GET',
    url: '/v1/users',
    schema: {
      description: 'Find users',
      querystring: findUsersRequestDtoSchema,
      response: {
        200: userPaginatedResponseSchema,
      },
      tags: ['users'],
    },
    handler: async (req, res) => {
      const result = await fastify.diContainer.cradle.userService.findUsers(req.query);
      const response = {
        ...result,
        data: result.data?.map(fastify.diContainer.cradle.userMapper.toResponse),
      };
      return res.status(200).send(response);
    },
  });
}
