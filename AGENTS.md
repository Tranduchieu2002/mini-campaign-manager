# AGENTS.md

> Instructions for AI coding assistants (Cursor, Claude Code, GitHub Copilot, etc.)

## Project overview

A production-ready Fastify 5 server using Clean Architecture, DDD, and functional programming.
TypeScript strict mode, ESM-only, Node >= 24 (native TS execution, no build step).

## Quick reference

| What                     | Where                                             |
| ------------------------ | ------------------------------------------------- |
| Package manager          | `pnpm` (never npm or yarn)                        |
| Linter + formatter       | Biome (never ESLint or Prettier)                  |
| Validation after changes | `pnpm check` (runs `biome check && tsc --noEmit`) |
| Auto-fix formatting      | `pnpm format`                                     |
| Unit tests               | `pnpm test:unit` (node:test)                      |
| E2E tests                | `pnpm test:e2e` (Cucumber + Gherkin)              |
| Architecture validation  | `pnpm deps:validate` (dependency-cruiser)         |
| DB migrations            | `pnpm db:migrate` (DBMate)                        |

Always run `pnpm check` after making changes. If formatting fails, run `pnpm format` first, then `pnpm check`.

## Architecture

### Layer boundaries (CRITICAL)

The dependency flow is strictly **inward**: `Route → Service → Repository`.

```
src/
├── instrumentation.ts    ← OpenTelemetry setup (loaded via --import before the app)
├── modules/              ← Feature code (vertical slices)
│   ├── app-module.ts     ← Registers all routes/resolvers into Fastify (imported by server)
│   └── <feature>/
│       ├── commands/     ← Route + schema for state-changing operations
│       ├── queries/      ← Route + schema for data-retrieval operations
│       ├── database/     ← Repository port (interface) + adapter (implementation)
│       ├── domain/       ← Business logic, types, errors
│       ├── dtos/         ← Shared response schemas
│       ├── <feature>.service.ts  ← All business logic for the feature
│       └── index.ts      ← declare global Dependencies for this module
├── server/               ← Fastify setup, plugins, DI wiring
└── shared/               ← Cross-cutting: DB, exceptions, utils
```

**Never** import from `src/shared/db/` or `database/` inside service files.
Services interact with data exclusively through repository ports (interfaces).
SQL belongs in repository files only.

### Module independence

Modules should avoid importing directly from other modules. If cross-module
communication is needed, call the other module's service through the DI container.

## Service pattern

Each feature module has a single `<feature>.service.ts` that contains all business logic.

### Service structure

```typescript
// user.service.ts
export default function userService({
  userRepository,
  userDomain,
}: Dependencies) {
  return {
    async createUser(dto: CreateUserRequestDto): Promise<string> {
      // business logic here
    },
    async deleteUser(id: string): Promise<boolean> {
      // business logic here
    },
    async findUsers(params: FindUsersParams): Promise<Paginated<UserEntity>> {
      // business logic here
    },
  };
}
```

Key rules:

- Service receives dependencies via a single destructured `Dependencies` object
- Service methods are plain `async` functions — no bus, no action creators
- Throw domain errors (`UserAlreadyExistsError`, `NotFoundException`, etc.) directly
- Never put business logic in route files — routes are HTTP adapters only

### Calling from routes

```typescript
// Route handler — calls service directly via DI container
handler: async (req, res) => {
  const id = await fastify.diContainer.cradle.userService.createUser(req.body);
  return res.status(201).send({ id });
},
```

### Calling from GraphQL resolvers

```typescript
export default async function createUserResolver(
  fastify: FastifyRouteInstance,
) {
  fastify.graphql.defineResolvers({
    Mutation: {
      putUser: async (_, args) => {
        return await fastify.diContainer.cradle.userService.createUser(
          args.input ?? {},
        );
      },
    },
  });
}
```

## Dependency injection

DI uses [Awilix](https://github.com/jeffijoe/awilix) with `@fastify/awilix`.

- Global dependencies (`db`, `logger`, `repositoryBase`) are registered in `src/server/di/index.ts` via `makeDependencies({ logger: fastify.log })`
- Module-specific dependencies are declared via `declare global { export interface Dependencies { ... } }` in the module's `index.ts`
- Repositories, mappers, domain services, and **feature services** are auto-loaded as singletons from `src/modules/**/*.{repository,mapper,service,domain}.ts`
- All factory functions receive dependencies as a single destructured object: `function makeX({ dep1, dep2 }: Dependencies)`
- DI naming convention: kebab-case filenames are converted to camelCase identifiers (e.g. `user.service.ts` → `userService` in the container)

### Declaring a service type in the module index

```typescript
// src/modules/user/index.ts
import type makeUserService from "#src/modules/user/user.service.ts";

declare global {
  export interface Dependencies {
    userService: ReturnType<typeof makeUserService>;
    // ... other module deps
  }
}
```

## App module

`src/modules/app-module.ts` is the single entry point that manually registers all
routes and resolvers. Import it in `src/server/index.ts` with a prefix:

```typescript
await fastify.register(appModule, { prefix: "/api" });
```

To add a new feature's routes, import and register them in `app-module.ts`:

```typescript
import myFeatureRoute from "#src/modules/my-feature/queries/find-items/find-items.route.ts";

export default async function appModule(fastify: FastifyInstance) {
  await fastify.register(myFeatureRoute);
  // ...
}
```

## Database

- Client: `postgres` (postgres.js) — uses tagged template literals for parameterized queries
- Connection: lazy singleton via `getDb()` in `src/shared/db/postgres.ts`; close with `closeDbConnection()`
- Migrations/seeds: DBMate (SQL files in `db/migrations/` and `db/seeds/`)
- Transaction support: `withTransaction(async (tx) => { ... })`
- Repository base: `SqlRepositoryBase` (in `src/shared/db/sql-repository.base.ts`) provides generic CRUD (insert, findOneById, findAll, findAllPaginated, update, delete)
- Repository ports extend `RepositoryPort<Entity>` (in `src/shared/db/repository.port.ts`)
- Mapper interface: `Mapper<DomainEntity, DbRecord, Response>` with `toPersistence`, `toDomain`, `toResponse` (in `src/shared/ddd/mapper.interface.ts`)

SQL parameterization rules:

- Always use tagged templates: `` db`SELECT * FROM ${db(tableName)} WHERE id = ${id}` ``
- Table names use `db(tableName)` (identifier interpolation)
- Values use `${value}` (parameterized automatically)
- Condition composition uses `joinConditions()` from `src/shared/db/postgres.ts`

## Coding conventions

### Style

- Biome enforces: single quotes, 2-space indent, trailing commas, semicolons, LF line endings
- Max line width: 100 characters
- File naming: `kebab-case` only (enforced by Biome)
- No enums — use `const` objects with derived types (e.g. `UserRoles`)
- No classes for business logic — prefer factory functions and composition
- No `any` — Biome's `noExplicitAny` is an error (relaxed only in test files)
- No `console` — use the injected `logger` (Pino)

### TypeScript

- `strict: true` with `noImplicitAny: true`
- Path aliases: `#src/*` maps to `./src/*`, `#tests/*` maps to `./tests/*` (defined as Node [subpath imports](https://nodejs.org/api/packages.html#subpath-imports) in `package.json`, not in `tsconfig.json`)
- Always include `.ts` extension in imports (ESM requirement)
- Prefer `type` imports: `import type { Foo } from './bar.ts'`

### API

- All REST routes are prefixed with `/api` (configured via `app-module.ts` prefix)
- Schemas use TypeBox (`Type.Object`, `Type.String`, etc.)
- Routes handle HTTP concerns only — no business logic in routes
- GraphQL resolvers co-locate with their REST route counterparts

### Testing

- Unit/integration tests: `*.spec.ts` files next to source, using `node:test` with `describe`/`it`/`assert`
- E2E tests: Cucumber features in `tests/`, step definitions in `tests/<feature>/`
- Load tests: k6 scripts in `tests/<feature>/`
- Test server: use `buildApp()` from `tests/support/server.ts` — creates a Fastify instance without listening

### Exceptions

- Domain errors extend `ExceptionBase` (in `src/shared/exceptions/`)
- Built-in exceptions: `NotFoundException`, `ConflictException`, `DatabaseErrorException`, `ArgumentInvalidException`, `InternalServerErrorException`, `ProviderErrorException`
- Always include a descriptive message: `throw new NotFoundException('User with id X not found')`

## Adding a new module

1. Create `src/modules/<name>/` with the vertical slice structure
2. Create `src/modules/<name>/index.ts` with `declare global { interface Dependencies { ... } }` for this module's types
3. Create domain types in `domain/<name>.types.ts`
4. Create repository port in `database/<name>.repository.port.ts` (interface extending `RepositoryPort<Entity>`)
5. Create repository adapter in `database/<name>.repository.ts` (implements the port)
6. Create mapper in `<name>.mapper.ts` (implements `Mapper<Entity, DbModel, ResponseDto>`)
7. Create `<name>.service.ts` with all business logic methods
8. Create routes (`*.route.ts`) and/or resolvers (`*.resolver.ts`) — call `fastify.diContainer.cradle.<name>Service.method()`
9. Register routes/resolvers in `src/modules/app-module.ts`
10. Create a DB migration: `pnpm db:create-migration <name>`
11. Run `pnpm check` to validate

## Common mistakes to avoid

- Importing DB/infrastructure code in service files (violates architecture boundaries)
- Putting business logic in route or resolver files — services own all logic
- Forgetting to register new routes in `app-module.ts`
- Forgetting `.ts` extensions in imports
- Using `npm` or `yarn` instead of `pnpm`
- Using `console.log` instead of the injected Pino `logger`
- Adding `enum` types (use const objects + derived types)
- Directly importing from one module into another — go through the DI container

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization

- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Workflows

- Primary workflow: `./.cursor/rules/primary-workflow.md`
- Development rules: `./.cursor/rules/development-rules.md`
- Orchestration protocols: `./.cursor/rules/orchestration-protocol.md`
- Documentation management: `./.cursor/rules/documentation-management.md`
- And other workflows: `./.cursor/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.agent/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

**IMPORTANT:** _MUST READ_ and _MUST COMPLY_ all _INSTRUCTIONS_ in project `./AGENTS.md`, especially _WORKFLOWS_ section is _CRITICALLY IMPORTANT_, this rule is _MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!_
