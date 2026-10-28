-- The simulation version a run was played on (cats.SIM_VERSION). Older runs
-- replay differently on newer code, so only their stored results count.
ALTER TABLE cat_runs ADD COLUMN sim INTEGER NOT NULL DEFAULT 1;
-- Runs started after version 3 went live (PR #33, 2026-10-27 15:16 UTC).
UPDATE cat_runs SET sim = 3 WHERE started_at >= '2026-10-27T15:16:05Z';
