CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  employee_id INT NOT NULL,
  employee_name VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NULL,
  name VARCHAR(255) NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'member',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  employee_id INT NULL,
  PRIMARY KEY (id),
  KEY profiles_employee_id (employee_id),
  CONSTRAINT profiles_id_fk FOREIGN KEY (id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT profiles_employee_fk FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hik_biometric_logs (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  employee_name VARCHAR(255) NULL,
  log_date DATE NULL,
  log_time TIME NULL,
  log_date_time DATETIME NULL,
  PRIMARY KEY (id),
  KEY logs_date (log_date),
  KEY logs_employee_date (employee_id, log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  id INT NOT NULL,
  work_start_time VARCHAR(8) NOT NULL DEFAULT '09:00',
  grace_period INT NOT NULL DEFAULT 15,
  company_name VARCHAR(255) NULL,
  company_address VARCHAR(255) NULL,
  company_phones VARCHAR(255) NULL,
  company_email VARCHAR(255) NULL,
  form_title VARCHAR(255) NULL,
  signatory_name VARCHAR(255) NULL,
  signatory_title VARCHAR(255) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leave_balance_pools (
  id INT NOT NULL AUTO_INCREMENT,
  pool_name VARCHAR(255) NOT NULL,
  annual_allotment DECIMAL(5,1) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY leave_balance_pools_pool_name_unique (pool_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS employee_leaves (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type_id INT NOT NULL,
  note VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'approved',
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY leaves_emp_range (employee_id, start_date, end_date),
  KEY leaves_status_range (status, start_date, end_date),
  CONSTRAINT leaves_employee_fk
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE,
  CONSTRAINT leaves_leave_type_fk
    FOREIGN KEY (leave_type_id) REFERENCES leave_type_policies (id) ON DELETE RESTRICT,
  CONSTRAINT leaves_created_by_fk
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT leaves_reviewed_by_fk
    FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT leaves_status_check
    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  CONSTRAINT leaves_date_range_check
    CHECK (end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_holidays (
  id INT NOT NULL AUTO_INCREMENT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note VARCHAR(255) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY holidays_date_range (start_date, end_date),
  CONSTRAINT holidays_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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



-- Initial Leave Balance Pools
INSERT INTO leave_balance_pools (pool_name, annual_allotment) VALUES
  ('Vacation', 15.0),
  ('Application', 15.0),
  ('Maternity', 105.0),
  ('Paternity', 7.0)
ON DUPLICATE KEY UPDATE annual_allotment = VALUES(annual_allotment);

-- Initial Leave Type Policies
-- Seeded after pools exist. Uses pool_name lookups so IDs stay correct even if AUTO_INCREMENT differs.
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

-- Initial System Settings
INSERT INTO system_settings (
  id, work_start_time, grace_period,
  company_name, company_address, company_phones, company_email,
  form_title, signatory_name, signatory_title
) VALUES (
  1, '09:00', 15,
  'CLIFSA', NULL, NULL, NULL,
  'Leave Application Form', NULL, NULL
)
ON DUPLICATE KEY UPDATE id = id;

-- For Testing Only
INSERT INTO employees (employee_id, employee_name, is_active) VALUES
  (1001, 'Ana Reyes', 1),
  (1002, 'Ben Santos', 1),
  (1003, 'Carla Mendoza', 1),
  (1004, 'Diego Cruz', 1),
  (1005, 'Elena Garcia', 1),
  (1006, 'Francis Lim', 1),
  (1007, 'Gina Torres', 1),
  (1008, 'Hiro Tanaka', 1),
  (1009, 'Isabel Navarro', 1),
  (1010, 'Jake Villanueva', 1);