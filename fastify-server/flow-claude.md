```md
/docs Here is a structured sequence of prompts to guided you to create project-roadmap and document for separate module and project stuctue overview.

Phase 1: Database Schema & Integrity (TDD for Data)
The goal here is to ensure the database layer is "correct" before writing any application code.

Prompt:

"I am building a Campaign Management system. Act as a Lead Database Engineer. Design the PostgreSQL Schema for the following entities: User, Campaign, Recipient, and CampaignRecipient.

Requirements:

Use Raw SQL (DDL) for table creation.

Implement Constraints to enforce business rules at the DB level (e.g., status must be one of the specified enums, scheduled_at must be future-dated on insert).

Indexing Strategy: Create indexes for optimized lookups on campaign_id in CampaignRecipient and status in Campaign. Explain the trade-offs for each index.

TDD Verification: Provide a SQL script that attempts to insert 'bad' data (e.g., an invalid status or an orphaned recipient) and show how the schema prevents it.

Use updated_at triggers for the Campaign table."

Phase 2: Core Logic & Status Transitions (The Business Rules)
Since you are avoiding heavy ORMs, Claude needs to focus on the raw SQL logic for status changes.

Prompt:

"Now, let’s implement the Campaign Business Logic in Node.js using [Fastify or Express] and [Knex or 'postgres' library].

The Task: Create a service or controller for Campaign status transitions.
Logic to Enforce:

PATCH or DELETE only works if status = 'draft'.

/schedule must update scheduled_at and set status to scheduled.

/send must perform a Transaction: Mark all associated recipients as sent, record sent_at, and update the Campaign status to sent.

Technical Constraint: Use Explicit Database Transactions to ensure atomicity. If one recipient fails to update, the entire 'send' operation must roll back. Provide the code for the /send logic first, focusing on race condition prevention."

Phase 3: API Contracts & Input Validation (Zod)
This prompt ensures the API is secure and the inputs are strictly typed.

Prompt:

"Define the API Contract for this system.

Create Zod Schemas for every endpoint (Registration, Login, Campaign Creation, Scheduling). Ensure the email validation is strict.

Implement a JWT Middleware that attaches the user_id to the request object.

Document the GET /campaigns/:id/stats endpoint.

Complex Query: Write a single, optimized Raw SQL query for the /stats endpoint that calculates total, sent, failed, opened, open_rate, and send_rate in one go using COUNT and CASE statements. Ensure it handles division-by-zero gracefully."

Phase 4: Verification (The Tests)
This completes the TDD loop by asking for the actual test suites.

Prompt:

"Write 3 critical Integration Tests using [Vitest or Jest] and supertest.

Test 1: Verify that a user cannot update a campaign once its status is 'sent' (Expect 400/403).

Test 2: Verify the /send transaction: Mock a database failure halfway through and assert that the Campaign status remains 'scheduled' (Rollback check).

Test 3: Verify that the /stats endpoint returns correct percentages (e.g., if 10 sent and 2 opened, open_rate should be 20%).

Provide the setup and teardown logic for a test database to ensure each test runs in isolation."
```

```
/cook I am building a Campaign Management system. Act as a Lead Database Engineer. Design the PostgreSQL Schema docs and system architucture for the following entities: User, Campaign, Recipient, and CampaignRecipient.

Requirements:

Use Raw SQL (DDL) for table creation.

Implement Constraints to enforce business rules at the DB level (e.g., status must be one of the specified enums, scheduled_at must be future-dated on insert).

Indexing Strategy: Create indexes for optimized lookups on campaign_id in CampaignRecipient and status in Campaign. Explain the trade-offs for each index.

TDD Verification: Provide a SQL script that attempts to insert 'bad' data (e.g., an invalid status or an orphaned recipient) and show how the schema prevents it.

Use updated_at triggers for the Campaign table."
```

I have to adjust plan is implement TDD pattern to write and review test carefully

```
/docs adjust plan implementation we separate module and write test for core module before write core and in the plan you can adjust case can happended
```

after that i will create plan and detail implement for each module by each period
