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
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_settings (id, work_start_time, grace_period)
VALUES (1, '09:00', 15)
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS employee_leaves (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type VARCHAR(32) NOT NULL DEFAULT 'vacation',
  note VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'approved',
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY leaves_emp_range (employee_id, start_date, end_date),
  CONSTRAINT leaves_employee_fk FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE,
  CONSTRAINT leaves_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
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
  
SHOW TABLES;