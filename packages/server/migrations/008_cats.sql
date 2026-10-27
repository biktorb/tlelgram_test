-- «Коты против пылесосов»: a run is stored as its seed and, once finished,
-- its input record, which the server replays to get the result. The old
-- squad tables stay untouched; users, fish, items, leagues and events carry over.
CREATE TABLE cat_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT NOT NULL REFERENCES users(id),
  seed          BIGINT NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('free', 'daily', 'duel')),
  daily         DATE,                          -- the daily challenge this run plays
  duel_code     TEXT,                          -- the duel this run answers
  chat_instance TEXT,                          -- the chat the game was opened from
  aura          TEXT,                          -- the aura its player wore
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  won           BOOLEAN NOT NULL DEFAULT false,
  ticks         INTEGER NOT NULL DEFAULT 0,
  kills         INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 0,
  record        JSONB,                         -- {moves, picks}: progress so far, final once finished
  saved_at      TIMESTAMPTZ                    -- when the progress was last saved
);
CREATE INDEX cat_runs_user ON cat_runs (user_id, finished_at);
-- At most one unfinished run per player: it can be continued later.
CREATE UNIQUE INDEX cat_runs_one_active ON cat_runs (user_id) WHERE finished_at IS NULL;
CREATE UNIQUE INDEX cat_runs_daily_once ON cat_runs (user_id, daily) WHERE daily IS NOT NULL;
CREATE INDEX cat_runs_daily_board ON cat_runs (daily, won DESC, ticks DESC, kills DESC) WHERE daily IS NOT NULL AND finished_at IS NOT NULL;
CREATE INDEX cat_runs_chat ON cat_runs (chat_instance, finished_at) WHERE chat_instance IS NOT NULL;

-- A finished run shared by link: friends play its seed against its ghost.
CREATE TABLE cat_duels (
  code            TEXT PRIMARY KEY,
  run_id          UUID NOT NULL UNIQUE REFERENCES cat_runs(id),
  challenger_id   BIGINT NOT NULL,
  challenger_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cat_duels_challenger ON cat_duels (challenger_id);

CREATE TABLE cat_duel_results (
  id         BIGSERIAL PRIMARY KEY,
  duel_code  TEXT NOT NULL REFERENCES cat_duels(code),
  run_id     UUID NOT NULL UNIQUE REFERENCES cat_runs(id),
  user_id    BIGINT NOT NULL,
  user_name  TEXT NOT NULL,
  won        BOOLEAN NOT NULL,
  ticks      INTEGER NOT NULL,
  kills      INTEGER NOT NULL,
  beat       BOOLEAN NOT NULL,                 -- the friend did better than the challenger
  seen       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cat_duel_results_duel ON cat_duel_results (duel_code);
