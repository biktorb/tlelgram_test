-- Weekly leagues: a row per player for each week they finished a run in.
CREATE TABLE league_weeks (
  user_id    BIGINT NOT NULL REFERENCES users(id),
  week       DATE NOT NULL,               -- the week's Monday, Moscow time
  league     SMALLINT NOT NULL,           -- 0 bronze, 1 silver, 2 gold, 3 diamond
  moved      SMALLINT NOT NULL DEFAULT 0, -- -1, 0 or 1 against the last week played
  points     INTEGER NOT NULL DEFAULT 0,  -- wins of the counted runs
  day        DATE,                        -- day of the last counted run
  day_runs   SMALLINT NOT NULL DEFAULT 0, -- runs counted on that day
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week)
);
CREATE INDEX league_weeks_board ON league_weeks (week, league, points DESC, updated_at);
