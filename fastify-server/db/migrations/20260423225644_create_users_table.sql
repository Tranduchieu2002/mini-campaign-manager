-- migrate:up
CREATE TABLE "users" (
  "id" VARCHAR(36) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints for Data Integrity
  CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email")
);

-- migrate:down
DROP TABLE "users";