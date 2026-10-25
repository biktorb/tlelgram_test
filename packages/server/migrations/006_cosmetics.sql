-- Fish are earned by daily tasks and spent on card frames.
ALTER TABLE users ADD COLUMN fish INTEGER NOT NULL DEFAULT 0 CHECK (fish >= 0);
ALTER TABLE users ADD COLUMN frame TEXT; -- equipped frame, null for the plain one

CREATE TABLE user_items (
  user_id    BIGINT NOT NULL REFERENCES users(id),
  item       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item)
);

-- One row per reward paid, so a task pays once a day however often it is checked.
CREATE TABLE task_claims (
  user_id    BIGINT NOT NULL REFERENCES users(id),
  day        DATE NOT NULL,
  task       TEXT NOT NULL,
  reward     INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day, task)
);

-- Opponents see the frame the player wore.
ALTER TABLE ghosts ADD COLUMN frame TEXT;
