-- Daily challenge: everyone gets the same seed for a date, one attempt per player.
ALTER TABLE runs ADD COLUMN daily DATE;
CREATE UNIQUE INDEX runs_daily_once ON runs (user_id, daily) WHERE daily IS NOT NULL;
CREATE INDEX runs_daily_board ON runs (daily, wins DESC) WHERE daily IS NOT NULL AND finished;
