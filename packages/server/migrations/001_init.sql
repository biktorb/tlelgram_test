CREATE TABLE users (
  id          BIGINT PRIMARY KEY,           -- Telegram user id
  first_name  TEXT NOT NULL,
  username    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  version     INTEGER NOT NULL DEFAULT 1,
  state       JSONB NOT NULL,
  finished    BOOLEAN NOT NULL DEFAULT false,
  wins        INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- At most one unfinished run per player.
CREATE UNIQUE INDEX runs_one_active ON runs (user_id) WHERE NOT finished;
CREATE INDEX runs_user ON runs (user_id);

CREATE TABLE ghosts (
  id          BIGSERIAL PRIMARY KEY,
  round       INTEGER NOT NULL,
  wins        INTEGER NOT NULL,
  user_id     BIGINT,                        -- null for seeded bot teams
  name        TEXT NOT NULL,
  team        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ghosts_round_recent ON ghosts (round, id DESC);
