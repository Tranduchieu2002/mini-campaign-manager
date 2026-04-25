import path from 'node:path';
import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import { asFunction, Lifetime } from 'awilix';
import type { FastifyInstance } from 'fastify';
import { makeDependencies } from '#src/modules/index.ts';
import { formatName } from '#src/server/di/util.ts';

export async function di(fastify: FastifyInstance) {
  // Register global infrastructure values (logger, db, repositoryBase)
  diContainer.register(makeDependencies({ logger: fastify.log }));

  // Auto-load module-specific dependencies (mapper, domain, repository, service)
  await diContainer.loadModules(
    [
      path.join(
        import.meta.dirname,
        '../../modules/**/*.{repository,mapper,service,domain}.{js,ts}',
      ),
    ],
    {
      formatName,
      esModules: true,
      resolverOptions: {
        register: asFunction,
        lifetime: Lifetime.SINGLETON,
      },
    },
  );

  // Register the dependency injection container
  await fastify.register(fastifyAwilixPlugin, {
    container: diContainer,
    asyncInit: true,
  });
}
