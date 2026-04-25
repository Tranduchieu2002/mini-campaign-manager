export default async function findUsersResolver(fastify: FastifyRouteInstance) {
  fastify.graphql.defineResolvers({
    Query: {
      findUsers: async (_, args) => {
        return await fastify.diContainer.cradle.userService.findUsers(args ?? {});
      },
    },
  });
}
