import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { idDtoSchema } from '#src/shared/api/id.response.dto.ts';
import { createRecipientRequestDtoSchema } from './create-recipient.schema.ts';

export default async function createRecipientRoute(fastify: FastifyRouteInstance) {
  fastify.withTypeProvider<TypeBoxTypeProvider>().route({
    method: 'POST',
    url: '/v1/recipients',
    schema: {
      description: 'Create a recipient',
      body: createRecipientRequestDtoSchema,
      response: {
        201: idDtoSchema,
      },
      tags: ['recipients'],
    },
    handler: async (req, res) => {
      const id = await fastify.diContainer.cradle.recipientService.createRecipient(req.body);
      return res.status(201).send({ id });
    },
  });
}
