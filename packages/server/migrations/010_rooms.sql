-- The room a run is played in; earlier runs were all in the flat.
ALTER TABLE cat_runs ADD COLUMN room TEXT NOT NULL DEFAULT 'flat';
