-- The cat a run is played with; replays need it. Earlier runs were all Рыжик.
ALTER TABLE cat_runs ADD COLUMN hero TEXT NOT NULL DEFAULT 'ryzhik';
