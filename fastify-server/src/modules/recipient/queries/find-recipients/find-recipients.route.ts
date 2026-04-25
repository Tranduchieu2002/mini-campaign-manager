import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { recipientPaginatedResponseSchema } from '#src/modules/recipient/dtos/recipient.paginated.response.dto.ts';
import { findRecipientsRequestDtoSchema } from './find-recipients.schema.ts';

export default async function findRecipientsRoute(fastify: FastifyRouteInstance) {
  fastify.withTypeProvider<TypeBoxTypeProvider>().route({
    method: 'GET',
    url: '/v1/recipients',
    schema: {
      description: 'Find recipients',
      querystring: findRecipientsRequestDtoSchema,
      response: {
        200: recipientPaginatedResponseSchema,
      },
      tags: ['recipients'],
    },
    handler: async (req, res) => {
      const result = await fastify.diContainer.cradle.recipientService.findRecipients(req.query);
      const response = {
        ...result,
        data: result.data?.map(fastify.diContainer.cradle.recipientMapper.toResponse),
      };
      return res.status(200).send(response);
    },
  });
}
