-- Data cleanup, not a schema change: removes the one duplicate job row
-- confirmed (via 20260712220000's diagnostic) to be leftover repro data
-- from tonight's Bug A double-booking demonstration -- created
-- 2026-07-13 00:18:02 UTC, ~30 minutes before the Bug A fix commit
-- (87be8af, 00:48:52 UTC). Keeps the earlier of the two identical rows.
delete from jobs where id = 'd216d10d-d987-4e66-98a5-10c4618c6b5b';
