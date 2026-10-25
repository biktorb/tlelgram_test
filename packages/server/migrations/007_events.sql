-- Product analytics for the closed test: what players do, not how the game works.
CREATE TABLE events (
  id      BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name    TEXT NOT NULL,
  data    JSONB,
  at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_at ON events (at);
