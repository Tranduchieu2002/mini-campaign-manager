import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { idDtoSchema } from '#src/shared/api/id.response.dto.ts';
import { createUserRequestDtoSchema } from './create-user.schema.ts';

export default async function createUserRoute(fastify: FastifyRouteInstance) {
  fastify.withTypeProvider<TypeBoxTypeProvider>().route({
    method: 'POST',
    url: '/v1/users',
    schema: {
      description: 'Create user',
      body: createUserRequestDtoSchema,
      response: {
        201: idDtoSchema,
      },
      tags: ['users'],
    },
    handler: async (req, res) => {
      const id = await fastify.diContainer.cradle.userService.createUser(req.body);
      return res.status(201).send({ id });
    },
  });
}
