-- Version 1.1.1 Manual Database Migration Updates

-- Change to your database name
USE clifsa_attendance_test;

SET SQL_SAFE_UPDATES = 0;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER //
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;
DROP PROCEDURE IF EXISTS add_constraint_if_missing;
DELIMITER //
CREATE PROCEDURE add_constraint_if_missing(
  IN p_table VARCHAR(64),
  IN p_constraint VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND CONSTRAINT_NAME = p_constraint
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_constraint, '` ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DELIMITER //
CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_columns TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND INDEX_NAME = p_index
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD KEY `', p_index, '` (', p_columns, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- 1) system_settings header columns
CALL add_column_if_missing('system_settings', 'company_name', 'VARCHAR(255) NULL AFTER grace_period');
CALL add_column_if_missing('system_settings', 'company_address', 'VARCHAR(255) NULL AFTER company_name');
CALL add_column_if_missing('system_settings', 'company_phones', 'VARCHAR(255) NULL AFTER company_address');
CALL add_column_if_missing('system_settings', 'company_email', 'VARCHAR(255) NULL AFTER company_phones');
CALL add_column_if_missing('system_settings', 'form_title', 'VARCHAR(255) NULL AFTER company_email');
CALL add_column_if_missing('system_settings', 'signatory_name', 'VARCHAR(255) NULL AFTER form_title');
CALL add_column_if_missing('system_settings', 'signatory_title', 'VARCHAR(255) NULL AFTER signatory_name');
UPDATE system_settings
SET
  company_name = COALESCE(company_name, 'CLIFSA'),
  form_title = COALESCE(form_title, 'Leave Application Form')
WHERE id = 1;

-- 2) leave_balance_pools
CREATE TABLE IF NOT EXISTS leave_balance_pools (
  id INT NOT NULL AUTO_INCREMENT,
  pool_name VARCHAR(32) NOT NULL,
  annual_allotment DECIMAL(5,1) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY leave_balance_pools_name_unique (pool_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO leave_balance_pools (pool_name, annual_allotment) VALUES
  ('Vacation', 15.0),
  ('Application', 15.0),
  ('Maternity', 105.0),
  ('Paternity', 7.0) AS new
ON DUPLICATE KEY UPDATE annual_allotment = new.annual_allotment;

-- 3) leave_type_policies
CREATE TABLE IF NOT EXISTS leave_type_policies (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL,
  pool_id INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY leave_type_policies_name_unique (name),
  CONSTRAINT leave_type_policies_pool_fk
    FOREIGN KEY (pool_id) REFERENCES leave_balance_pools (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO leave_type_policies (name, pool_id, is_active)
SELECT v.name, p.id, 1
FROM (
  SELECT 'Vacation' AS name, 'Vacation' AS pool_name UNION ALL
  SELECT 'Sick Leave', 'Application' UNION ALL
  SELECT 'Enrollment', 'Application' UNION ALL
  SELECT 'Birthday', 'Application' UNION ALL
  SELECT 'Leave w/Permission (w/o pay)', 'Application' UNION ALL
  SELECT 'Other', 'Application' UNION ALL
  SELECT 'Maternity Leave', 'Maternity' UNION ALL
  SELECT 'Paternity Leave', 'Paternity'
) AS v
JOIN leave_balance_pools p ON p.pool_name = v.pool_name
WHERE NOT EXISTS (
  SELECT 1 FROM leave_type_policies t WHERE t.name = v.name
);

-- 4) employee_leaves: add columns, backfill, harden
CALL add_column_if_missing('employee_leaves', 'leave_type_id', 'INT NULL AFTER end_date');
CALL add_column_if_missing('employee_leaves', 'reviewed_by', 'CHAR(36) NULL AFTER created_at');
CALL add_column_if_missing('employee_leaves', 'reviewed_at', 'DATETIME NULL AFTER reviewed_by');
CALL add_column_if_missing('employee_leaves', 'review_note', 'VARCHAR(255) NULL AFTER reviewed_at');
-- Map old text leave_type → policy id (only if leave_type column still exists)
SET @has_leave_type := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employee_leaves'
    AND COLUMN_NAME = 'leave_type'
);
SET @sql := IF(
  @has_leave_type > 0,
  'UPDATE employee_leaves el
   JOIN leave_type_policies tp ON tp.name = CASE el.leave_type
     WHEN ''vacation'' THEN ''Vacation''
     WHEN ''sick'' THEN ''Sick Leave''
     WHEN ''unpaid'' THEN ''Leave w/Permission (w/o pay)''
     WHEN ''other'' THEN ''Other''
     ELSE ''Other''
   END
   SET el.leave_type_id = tp.id
   WHERE el.id > 0 AND el.leave_type_id IS NULL',
  'SELECT ''leave_type already dropped; skip text mapping'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- Any leftover NULLs → Other
UPDATE employee_leaves el
CROSS JOIN (
  SELECT id AS other_id
  FROM leave_type_policies
  WHERE name = 'Other'
  LIMIT 1
) o
SET el.leave_type_id = o.other_id
WHERE el.id > 0
  AND el.leave_type_id IS NULL;
-- Ensure note is filled before NOT NULL
UPDATE employee_leaves
SET note = ''
WHERE id > 0
  AND note IS NULL;
-- Hard stop if any leave_type_id is still NULL
SET @missing_type_id := (
  SELECT COUNT(*) FROM employee_leaves WHERE leave_type_id IS NULL
);
SET @msg := CONCAT('Cannot set leave_type_id NOT NULL; still missing on ', @missing_type_id, ' row(s)');
IF @missing_type_id > 0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @msg;
END IF;
-- note: IF/SIGNAL above must run in a procedure in some Workbench modes.
-- If SIGNAL block fails to parse outside a procedure, run this check manually:
--   SELECT COUNT(*) FROM employee_leaves WHERE leave_type_id IS NULL;
-- and only continue when it returns 0.
ALTER TABLE employee_leaves
  MODIFY COLUMN note VARCHAR(255) NOT NULL;
ALTER TABLE employee_leaves
  MODIFY COLUMN leave_type_id INT NOT NULL;
CALL add_constraint_if_missing(
  'employee_leaves',
  'leaves_leave_type_fk',
  'FOREIGN KEY (leave_type_id) REFERENCES leave_type_policies (id) ON DELETE RESTRICT'
);
CALL add_constraint_if_missing(
  'employee_leaves',
  'leaves_reviewed_by_fk',
  'FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL'
);
-- Drop old text column if it still exists
SET @sql := IF(
  @has_leave_type > 0,
  'ALTER TABLE employee_leaves DROP COLUMN leave_type',
  'SELECT ''leave_type already dropped'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
CALL add_constraint_if_missing(
  'employee_leaves',
  'leaves_status_check',
  'CHECK (status IN (''pending'', ''approved'', ''denied'', ''cancelled''))'
);
CALL add_constraint_if_missing(
  'employee_leaves',
  'leaves_date_range_check',
  'CHECK (end_date >= start_date)'
);
CALL add_index_if_missing(
  'employee_leaves',
  'leaves_status_range',
  'status, start_date, end_date'
);

-- 5) employee_leave_days
CREATE TABLE IF NOT EXISTS employee_leave_days (
  id INT NOT NULL AUTO_INCREMENT,
  leave_id INT NOT NULL,
  leave_date DATE NOT NULL,
  day_value DECIMAL(2,1) NOT NULL DEFAULT 1.0,
  PRIMARY KEY (id),
  UNIQUE KEY employee_leave_days_unique (leave_id, leave_date),
  KEY employee_leave_days_date (leave_date),
  CONSTRAINT employee_leave_days_leave_fk
    FOREIGN KEY (leave_id) REFERENCES employee_leaves (id) ON DELETE CASCADE,
  CONSTRAINT employee_leave_days_value_check
    CHECK (day_value IN (0.5, 1.0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) leave_applications
CREATE TABLE IF NOT EXISTS leave_applications (
  id INT NOT NULL AUTO_INCREMENT,
  leave_id INT NOT NULL,
  applicant_name VARCHAR(255) NOT NULL,
  date_filed DATETIME NOT NULL,
  position VARCHAR(255) NULL,
  department VARCHAR(255) NULL,
  beginning_balance DECIMAL(5,1) NOT NULL,
  leave_taken DECIMAL(3,1) NOT NULL,
  allowable_leave DECIMAL(5,1) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY leave_applications_leave_unique (leave_id),
  CONSTRAINT leave_applications_leave_fk
    FOREIGN KEY (leave_id) REFERENCES employee_leaves (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7) Sanity checks
SELECT 'pools' AS what, COUNT(*) AS n FROM leave_balance_pools
UNION ALL SELECT 'types', COUNT(*) FROM leave_type_policies
UNION ALL SELECT 'leaves_missing_type', COUNT(*) FROM employee_leaves WHERE leave_type_id IS NULL;
SHOW COLUMNS FROM system_settings;
SHOW COLUMNS FROM employee_leaves;
-- Cleanup helpers
DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_constraint_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
SET SQL_SAFE_UPDATES = 1;


-- Important: The IF @missing_type_id > 0 THEN SIGNAL ... END IF; block can fail to parse in Workbench outside a stored procedure. 
-- If Workbench complains about that, delete that IF ... END IF block and instead run this before the MODIFY ... NOT NULL lines:
SELECT COUNT(*) AS missing_type_id
FROM employee_leaves
WHERE leave_type_id IS NULL;