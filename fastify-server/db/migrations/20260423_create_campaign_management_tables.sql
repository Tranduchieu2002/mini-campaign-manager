-- migrate:up

-- ---------------------------------------------------------------------------
-- Shared trigger function: maintains updated_at on any table that uses it.
-- Attach via: CREATE TRIGGER ... BEFORE UPDATE ON <table> FOR EACH ROW
--             EXECUTE FUNCTION fn_set_updated_at();
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger function: rejects INSERT rows where scheduled_at is in the past.
-- A CHECK constraint cannot reliably enforce this because CHECK evaluates
-- now() at plan time, not row-evaluation time. A BEFORE INSERT trigger is
-- the correct mechanism for temporal insert guards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_scheduled_at_future()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at <= now() THEN
    RAISE EXCEPTION
      'scheduled_at must be a future timestamp, got: %', NEW.scheduled_at
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- campaigns
--
-- Lifecycle states:  draft → scheduled → active → completed
--                                      ↘ paused  ↗
--                                        cancelled (terminal)
-- ---------------------------------------------------------------------------
CREATE TABLE campaigns (
  id           VARCHAR(36)   NOT NULL,
  name         VARCHAR(255)  NOT NULL,
  status       VARCHAR(20)   NOT NULL DEFAULT 'draft',
  subject      VARCHAR(500)  NOT NULL,
  body         TEXT          NOT NULL,
  scheduled_at TIMESTAMPTZ   NULL,
  sent_at      TIMESTAMPTZ   NULL,
  created_by   VARCHAR(36)   NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT pk_campaigns_id
    PRIMARY KEY (id),

  -- Cascade RESTRICT: prevents deleting a user who owns campaigns.
  -- Change to SET NULL + make created_by nullable if soft-delete users is required.
  CONSTRAINT fk_campaigns_created_by
    FOREIGN KEY (created_by)
    REFERENCES users (id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_campaigns_status
    CHECK (status IN (
      'draft',
      'scheduled',
      'active',
      'paused',
      'completed',
      'cancelled'
    )),

  -- sent_at is only meaningful once the campaign is beyond scheduling.
  CONSTRAINT chk_campaigns_sent_at_requires_non_draft
    CHECK (
      sent_at IS NULL
      OR status IN ('active', 'paused', 'completed', 'cancelled')
    )
);

-- Automatically update updated_at on every row mutation.
CREATE TRIGGER set_campaign_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();

-- Reject past-dated scheduled_at on insert.
CREATE TRIGGER check_campaign_scheduled_at_future
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_scheduled_at_future();

-- Index: status filter queries (dashboards, list endpoints).
-- Low cardinality (6 values) — planner may fall back to seq scan for
-- highly common statuses on large tables. Consider per-status partial
-- indexes for write-heavy workloads.
CREATE INDEX idx_campaigns_status
  ON campaigns (status);

-- Partial index: scheduler polling ("what needs sending now?").
-- Only indexes rows in 'scheduled' state — physically small and fast.
-- Rows leave this index automatically when status advances.
CREATE INDEX idx_campaigns_scheduled_active
  ON campaigns (scheduled_at)
  WHERE status = 'scheduled';

-- ---------------------------------------------------------------------------
-- recipients
--
-- Global subscriber registry, independent of any campaign.
-- ---------------------------------------------------------------------------
CREATE TABLE recipients (
  id              VARCHAR(36)   NOT NULL,
  email           VARCHAR(320)  NOT NULL,
  name            VARCHAR(255)  NOT NULL,
  metadata        JSONB         NULL,
  unsubscribed_at TIMESTAMPTZ   NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT pk_recipients_id
    PRIMARY KEY (id),

  -- Deduplicate subscribers at the DB level — no application-layer dedup required.
  CONSTRAINT uq_recipients_email
    UNIQUE (email),

  -- Guard against nonsensical future unsubscribe timestamps written by bugs.
  CONSTRAINT chk_recipients_unsubscribed_at_not_future
    CHECK (
      unsubscribed_at IS NULL
      OR unsubscribed_at <= now()
    )
);

CREATE TRIGGER set_recipient_updated_at
  BEFORE UPDATE ON recipients
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_recipients
--
-- Junction table: tracks per-recipient delivery status within a campaign.
-- ---------------------------------------------------------------------------
CREATE TABLE campaign_recipients (
  campaign_id  VARCHAR(36)  NOT NULL,
  recipient_id VARCHAR(36)  NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
  sent_at      TIMESTAMPTZ  NULL,
  opened_at    TIMESTAMPTZ  NULL,

  -- Composite PK eliminates duplicate (campaign, recipient) pairs and serves
  -- as the covering index for campaign-first lookups (campaign_id = ?).
  CONSTRAINT pk_campaign_recipients
    PRIMARY KEY (campaign_id, recipient_id),

  -- CASCADE: deleting a campaign removes all its delivery records.
  CONSTRAINT fk_cr_campaign_id
    FOREIGN KEY (campaign_id)
    REFERENCES campaigns (id)
    ON DELETE CASCADE,

  -- CASCADE: deleting a recipient removes all their delivery records.
  CONSTRAINT fk_cr_recipient_id
    FOREIGN KEY (recipient_id)
    REFERENCES recipients (id)
    ON DELETE CASCADE,

  CONSTRAINT chk_cr_status
    CHECK (status IN (
      'pending',
      'sent',
      'failed',
      'bounced',
      'opened',
      'clicked'
    )),

  -- Logical guard: a message cannot be "opened" if it was never sent.
  CONSTRAINT chk_cr_opened_requires_sent
    CHECK (
      opened_at IS NULL
      OR sent_at IS NOT NULL
    )
);

-- Reverse-lookup index: "which campaigns did recipient X appear in?"
-- The composite PK does NOT satisfy recipient-first scans — this index
-- is non-redundant and required for unsubscribe checks and analytics.
-- High write cost at bulk-send scale; use batch inserts to amortize.
CREATE INDEX idx_cr_recipient_id
  ON campaign_recipients (recipient_id);

-- Compound index: supports retry logic and delivery analytics queries
-- of the form: WHERE campaign_id = ? AND status = 'failed'
-- Overlaps with the PK's leading campaign_id column — the planner will
-- prefer this index only when the status predicate is also present.
CREATE INDEX idx_cr_campaign_status
  ON campaign_recipients (campaign_id, status);


-- migrate:down

DROP TRIGGER IF EXISTS set_recipient_updated_at  ON recipients;
DROP TRIGGER IF EXISTS set_campaign_updated_at   ON campaigns;
DROP TRIGGER IF EXISTS check_campaign_scheduled_at_future ON campaigns;

DROP TABLE IF EXISTS campaign_recipients;
DROP TABLE IF EXISTS recipients;
DROP TABLE IF EXISTS campaigns;

DROP FUNCTION IF EXISTS fn_check_scheduled_at_future();
DROP FUNCTION IF EXISTS fn_set_updated_at();
