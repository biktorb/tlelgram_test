-- Power Ups bought with fish, and what was paid for them so they can be refunded.
ALTER TABLE users ADD COLUMN powers JSONB NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN power_spent INTEGER NOT NULL DEFAULT 0 CHECK (power_spent >= 0);
-- The Power Ups a run started with; replays need them. Fish the run paid out.
ALTER TABLE cat_runs ADD COLUMN powers JSONB NOT NULL DEFAULT '{}';
ALTER TABLE cat_runs ADD COLUMN fish INTEGER NOT NULL DEFAULT 0;
