import type { FastifyInstance } from 'fastify';
import createUserResolver from '#src/modules/user/commands/create-user/create-user.resolver.ts';
import createUserRoute from '#src/modules/user/commands/create-user/create-user.route.ts';
import deleteUserRoute from '#src/modules/user/commands/delete-user/delete-user.route.ts';
import findUsersResolver from '#src/modules/user/queries/find-users/find-users.resolver.ts';
import findUsersRoute from '#src/modules/user/queries/find-users/find-users.route.ts';

export default async function appModule(fastify: FastifyInstance) {
  await fastify.register(createUserRoute);
  await fastify.register(deleteUserRoute);
  await fastify.register(findUsersRoute);

  await createUserResolver(fastify as FastifyRouteInstance);
  await findUsersResolver(fastify as FastifyRouteInstance);
}
