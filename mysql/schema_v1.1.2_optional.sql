-- Change to your database name
USE clifsa_attendance_test;

SET SQL_SAFE_UPDATES = 0;

UPDATE employee_leaves
SET
  reviewed_by = created_by,
  reviewed_at = created_at
WHERE reviewed_at IS NULL;

SET SQL_SAFE_UPDATES = 1;

-- TESTS AFTER BACKFILL

-- Day rows exist now
SELECT leave_id, COUNT(*) AS days, SUM(day_value) AS total
FROM employee_leave_days
GROUP BY leave_id
ORDER BY leave_id
LIMIT 20;

-- Leaves that still have ZERO day rows (should be rare: weekend/holiday-only ranges)
SELECT el.id, el.start_date, el.end_date, COUNT(d.id) AS day_count
FROM employee_leaves el
LEFT JOIN employee_leave_days d ON d.leave_id = el.id
GROUP BY el.id, el.start_date, el.end_date
HAVING day_count = 0;
-- reviewed_* filled

SELECT COUNT(*) AS still_null_reviewed
FROM employee_leaves
WHERE reviewed_at IS NULL;
-- Expect 0 (or only odd rows with no created_at)

-- SELECT * FROM employee_leave_days WHERE leave_id = <id> ORDER BY leave_date;
-- Expect weekday dates, day_value 1.0, no Sat/Sun