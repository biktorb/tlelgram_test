-- A duel is a finished run shared by link: friends play a run from the same
-- seed and their final team fights the challenger's final team.
CREATE TABLE duels (
  code            TEXT PRIMARY KEY,
  run_id          UUID NOT NULL UNIQUE REFERENCES runs(id),
  challenger_id   BIGINT NOT NULL REFERENCES users(id),
  challenger_name TEXT NOT NULL,
  seed            BIGINT NOT NULL,
  wins            INTEGER NOT NULL,
  team            JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX duels_challenger ON duels (challenger_id);

ALTER TABLE runs ADD COLUMN duel_code TEXT REFERENCES duels(code);

CREATE TABLE duel_results (
  id          BIGSERIAL PRIMARY KEY,
  duel_code   TEXT NOT NULL REFERENCES duels(code),
  run_id      UUID NOT NULL UNIQUE REFERENCES runs(id),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  user_name   TEXT NOT NULL,
  wins        INTEGER NOT NULL,
  team        JSONB NOT NULL,
  battle_seed BIGINT NOT NULL,
  result      TEXT NOT NULL,                 -- for the friend: battle(friend team, challenger team, battle_seed)
  seen        BOOLEAN NOT NULL DEFAULT false, -- shown to the challenger
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX duel_results_duel ON duel_results (duel_code);
