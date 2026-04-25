import createRecipientRoute from '#src/modules/recipient/commands/create-recipient/create-recipient.route.ts';
import deleteRecipientRoute from '#src/modules/recipient/commands/delete-recipient/delete-recipient.route.ts';
import findRecipientsRoute from '#src/modules/recipient/queries/find-recipients/find-recipients.route.ts';
import createUserResolver from '#src/modules/user/commands/create-user/create-user.resolver.ts';
import createUserRoute from '#src/modules/user/commands/create-user/create-user.route.ts';
import deleteUserRoute from '#src/modules/user/commands/delete-user/delete-user.route.ts';
import findUsersResolver from '#src/modules/user/queries/find-users/find-users.resolver.ts';
import findUsersRoute from '#src/modules/user/queries/find-users/find-users.route.ts';

export default async function appModule(fastify: FastifyRouteInstance) {
  // user routes
  await fastify.register(createUserRoute);
  await fastify.register(deleteUserRoute);
  await fastify.register(findUsersRoute);

  await createUserResolver(fastify);
  await findUsersResolver(fastify);

  // recipient routes
  await fastify.register(createRecipientRoute);
  await fastify.register(deleteRecipientRoute);
  await fastify.register(findRecipientsRoute);
}
