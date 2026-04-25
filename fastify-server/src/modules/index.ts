import { asValue } from 'awilix';
import type { FastifyBaseLogger } from 'fastify';
import type postgres from 'postgres';
import { getDb } from '#src/shared/db/postgres.ts';
import type { RepositoryPort } from '#src/shared/db/repository.port.ts';
import {
  SqlRepositoryBase,
  type SqlRepositoryBaseProps,
} from '#src/shared/db/sql-repository.base.ts';

type SqlBaseProps<E = { id: string }, D = Record<string, unknown>> = Omit<
  SqlRepositoryBaseProps<E, D>,
  'logger' | 'db'
>;

declare global {
  export interface Dependencies {
    logger: FastifyBaseLogger;
    db: ReturnType<typeof postgres>;
    repositoryBase: <E extends { id: string }, D extends Record<string, unknown>>(
      props: SqlBaseProps<E, D>,
    ) => RepositoryPort<E>;
  }
}

export function makeDependencies({ logger }: { logger: FastifyBaseLogger }) {
  const db = getDb();
  const repositoryBaseFn = <E extends { id: string }, D extends Record<string, unknown>>({
    tableName,
    mapper,
  }: SqlBaseProps<E, D>) =>
    SqlRepositoryBase<E, D>({
      logger,
      db,
      tableName,
      mapper,
    });
  return {
    logger: asValue(logger),
    db: asValue(db),
    repositoryBase: asValue(repositoryBaseFn),
  };
}
