import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const schemaPath = path.resolve(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");

const REQUIRED_TABLES = [
  "users",
  "employees",
  "profiles",
  "hik_biometric_logs",
  "system_settings",
  "leave_balance_pools",
  "leave_type_policies",
  "employee_leaves",
  "employee_leave_days",
  "leave_applications",
  "company_holidays",
] as const;

describe("MySQL database structure", () => {
  it("should define the expected MySQL tables and omit unused auth cache and jobs tables", () => {
    for (const table of REQUIRED_TABLES) {
      expect(schema).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`)
      );
    }
    expect(schema).not.toMatch(/CREATE TABLE IF NOT EXISTS auth\.users/);
    expect(schema).not.toMatch(/CREATE TABLE IF NOT EXISTS cache\b/);
    expect(schema).not.toMatch(/CREATE TABLE IF NOT EXISTS jobs\b/);
  });

  it("should link users, profiles, employees, leaves, holidays, and leave policies with the correct delete rules", () => {
    expect(schema).toContain(
      "CONSTRAINT profiles_id_fk FOREIGN KEY (id) REFERENCES users (id) ON DELETE CASCADE"
    );
    expect(schema).toContain(
      "CONSTRAINT profiles_employee_fk FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE SET NULL"
    );
    expect(schema).toContain(
      "CONSTRAINT leaves_employee_fk"
    );
    expect(schema).toContain(
      "FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE"
    );
    expect(schema).toContain(
      "CONSTRAINT leaves_leave_type_fk"
    );
    expect(schema).toContain(
      "FOREIGN KEY (leave_type_id) REFERENCES leave_type_policies (id) ON DELETE RESTRICT"
    );
    expect(schema).toContain(
      "CONSTRAINT leaves_created_by_fk"
    );
    expect(schema).toContain(
      "FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL"
    );
    expect(schema).toContain(
      "CONSTRAINT leaves_reviewed_by_fk"
    );
    expect(schema).toContain(
      "FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL"
    );
    expect(schema).toContain(
      "CONSTRAINT holidays_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL"
    );
    expect(schema).toContain(
      "CONSTRAINT leave_type_policies_pool_fk"
    );
    expect(schema).toContain(
      "FOREIGN KEY (pool_id) REFERENCES leave_balance_pools (id) ON DELETE RESTRICT"
    );
    expect(schema).toContain(
      "CONSTRAINT employee_leave_days_leave_fk"
    );
    expect(schema).toContain(
      "FOREIGN KEY (leave_id) REFERENCES employee_leaves (id) ON DELETE CASCADE"
    );
    expect(schema).toContain(
      "CONSTRAINT leave_applications_leave_fk"
    );
    expect(schema).toContain(
      "FOREIGN KEY (leave_id) REFERENCES employee_leaves (id) ON DELETE CASCADE"
    );
  });

  it("should define leave status/date CHECKs and day_value CHECK", () => {
    expect(schema).toContain("CONSTRAINT leaves_status_check");
    expect(schema).toMatch(
      /CHECK\s*\(\s*status\s+IN\s*\(\s*'pending'\s*,\s*'approved'\s*,\s*'denied'\s*,\s*'cancelled'\s*\)\s*\)/
    );
    expect(schema).toContain("CONSTRAINT leaves_date_range_check");
    expect(schema).toMatch(/CHECK\s*\(\s*end_date\s*>=\s*start_date\s*\)/);
    expect(schema).toContain("CONSTRAINT employee_leave_days_value_check");
    expect(schema).toMatch(/CHECK\s*\(\s*day_value\s+IN\s*\(\s*0\.5\s*,\s*1\.0\s*\)\s*\)/);
  });

  it("should define unique keys for leave pools, types, day rows, and applications", () => {
    expect(schema).toContain(
      "UNIQUE KEY leave_balance_pools_pool_name_unique (pool_name)"
    );
    expect(schema).toContain(
      "UNIQUE KEY leave_type_policies_name_unique (name)"
    );
    expect(schema).toContain(
      "UNIQUE KEY employee_leave_days_unique (leave_id, leave_date)"
    );
    expect(schema).toContain(
      "UNIQUE KEY leave_applications_leave_unique (leave_id)"
    );
  });

  it("should include printable form header columns on system_settings", () => {
    expect(schema).toContain("company_name VARCHAR(255) NULL");
    expect(schema).toContain("company_address VARCHAR(255) NULL");
    expect(schema).toContain("company_phones VARCHAR(255) NULL");
    expect(schema).toContain("company_email VARCHAR(255) NULL");
    expect(schema).toContain("form_title VARCHAR(255) NULL");
    expect(schema).toContain("signatory_name VARCHAR(255) NULL");
    expect(schema).toContain("signatory_title VARCHAR(255) NULL");
  });

  it("should seed default work start time, grace period, and form header placeholders", () => {
    expect(schema).toMatch(
      /INSERT INTO system_settings\s*\(\s*id\s*,\s*work_start_time\s*,\s*grace_period\s*,\s*company_name\s*,\s*company_address\s*,\s*company_phones\s*,\s*company_email\s*,\s*form_title\s*,\s*signatory_name\s*,\s*signatory_title\s*\)\s*VALUES\s*\(\s*1\s*,\s*'09:00'\s*,\s*15\s*,\s*'CLIFSA'\s*,\s*NULL\s*,\s*NULL\s*,\s*NULL\s*,\s*'Leave Application Form'\s*,\s*NULL\s*,\s*NULL\s*\)/
    );
  });

  it("should seed leave balance pools and leave type policies", () => {
    expect(schema).toMatch(/INSERT INTO leave_balance_pools/);
    expect(schema).toContain("('Vacation', 15.0)");
    expect(schema).toContain("('Application', 15.0)");
    expect(schema).toContain("('Maternity', 105.0)");
    expect(schema).toContain("('Paternity', 7.0)");
    expect(schema).toMatch(/INSERT INTO leave_type_policies/);
    expect(schema).toContain("'Leave w/Permission (w/o pay)'");
    expect(schema).toContain("'Maternity Leave'");
    expect(schema).toContain("'Paternity Leave'");
  });

  it("should require each user email to be unique", () => {
    expect(schema).toContain("UNIQUE KEY users_email_unique (email)");
  });

  it("should store profile role and status as plain text fields", () => {
    expect(schema).toMatch(/role VARCHAR\(32\)/);
    expect(schema).toMatch(/status VARCHAR\(32\)/);
    expect(schema).not.toMatch(/ENUM\s*\(/);
  });

  it("should include indexes for leave ranges, leave status, leave days, holiday ranges, and attendance logs", () => {
    expect(schema).toContain(
      "KEY leaves_emp_range (employee_id, start_date, end_date)"
    );
    expect(schema).toContain(
      "KEY leaves_status_range (status, start_date, end_date)"
    );
    expect(schema).toContain("KEY employee_leave_days_date (leave_date)");
    expect(schema).toContain("KEY holidays_date_range (start_date, end_date)");
    expect(schema).toContain("KEY logs_date (log_date)");
    expect(schema).toContain("KEY logs_employee_date (employee_id, log_date)");
  });

  it("should use leave_type_id on employee_leaves instead of a text leave_type column", () => {
    expect(schema).toContain("leave_type_id INT NOT NULL");
    expect(schema).toContain("reviewed_by CHAR(36) NULL");
    expect(schema).toContain("reviewed_at DATETIME NULL");
    expect(schema).toContain("review_note VARCHAR(255) NULL");
    // Fresh schema should not redefine the old text column on employee_leaves
    expect(schema).not.toMatch(
      /CREATE TABLE IF NOT EXISTS employee_leaves[\s\S]*leave_type VARCHAR\(32\)/
    );
  });

  it("should allow the schema file to be applied more than once without errors", () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS/g);
    const createCount = (schema.match(/CREATE TABLE IF NOT EXISTS/g) || [])
      .length;
    expect(createCount).toBe(REQUIRED_TABLES.length);
    expect(schema).toContain("ON DUPLICATE KEY UPDATE id = id");
  });

  it("should convert old holiday leave rows into one company holiday per date range", () => {
    const holidayMigration = path.resolve(
      __dirname,
      "../supabase/migrations/20260907015639_create_company_holidays.sql"
    );
    const sql = fs.readFileSync(holidayMigration, "utf-8");
    expect(sql).toMatch(/INSERT INTO public\.company_holidays/);
    expect(sql).toMatch(/WHERE leave_type = 'holiday'/);
    expect(sql).toMatch(
      /DELETE FROM public\.employee_leaves\s*WHERE leave_type = 'holiday'/
    );
    expect(sql).toMatch(/GROUP BY start_date, end_date/);
  });

  it("should treat mysql/schema.sql as the source of truth for the local MySQL database", () => {
    const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
    const entries = fs.readdirSync(migrationsDir);
    const phpFiles = entries.filter((f) => f.endsWith(".php"));
    const sqlFiles = entries.filter((f) => f.endsWith(".sql"));
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS company_holidays");
    expect(sqlFiles.length).toBeGreaterThan(0);
    // PHP stubs may exist in the tree; they must not be the MySQL source of truth
    expect(phpFiles.every((f) => f.endsWith(".php"))).toBe(true);
  });
});

describe("live MySQL database checks", () => {
  // Opt-in only: set RUN_MYSQL_INTEGRITY=1 with Docker MySQL on DB_* env.
  const runLive = process.env.RUN_MYSQL_INTEGRITY === "1";

  it.skipIf(!runLive)(
    "should enforce foreign keys, cascades, date strings, and date-range overlap against Docker MySQL",
    async () => {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USERNAME || "clifsaattendance",
        password: process.env.DB_PASSWORD || "clifsa_local",
        database: process.env.DB_DATABASE || "clifsa_attendance",
        dateStrings: true,
        connectTimeout: 5000,
      });

      try {
        const [tables] = await conn.query<any[]>("SHOW TABLES");
        const names = tables.map((r) => Object.values(r)[0]);
        for (const t of REQUIRED_TABLES) {
          expect(names).toContain(t);
        }

        const [settings] = await conn.query<any[]>(
          "SELECT work_start_time, grace_period, company_name, form_title FROM system_settings WHERE id = 1"
        );
        expect(settings[0]?.work_start_time).toBe("09:00");
        expect(Number(settings[0]?.grace_period)).toBe(15);

        const [vacationTypeRows] = await conn.query<any[]>(
          "SELECT id FROM leave_type_policies WHERE name = 'Vacation' LIMIT 1"
        );
        const vacationTypeId = vacationTypeRows[0]?.id;
        expect(vacationTypeId).toBeTruthy();

        const suffix = `${Date.now()}`.slice(-10);
        const userId = `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
        const email = `integrity_${suffix}@example.com`;

        await conn.query(
          "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
          [userId, email, "hash", "Integrity"]
        );

        let dupError: unknown = null;
        try {
          await conn.query(
            "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
            [`${userId.slice(0, -1)}1`, email, "hash", "Dup"]
          );
        } catch (e) {
          dupError = e;
        }
        expect(dupError).toBeTruthy();

        await conn.query(
          "INSERT INTO employees (employee_id, employee_name, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE employee_name = VALUES(employee_name)",
          [91001, "Integrity Emp"]
        );

        let fkError: unknown = null;
        try {
          await conn.query(
            "INSERT INTO employee_leaves (employee_id, start_date, end_date, leave_type_id, note, status) VALUES (?, ?, ?, ?, ?, 'approved')",
            [999999, "2026-09-01", "2026-09-01", vacationTypeId, "fk test"]
          );
        } catch (e) {
          fkError = e;
        }
        expect(fkError).toBeTruthy();

        await conn.query(
          "INSERT INTO employee_leaves (employee_id, start_date, end_date, leave_type_id, note, status, created_by) VALUES (?, ?, ?, ?, ?, 'approved', ?)",
          [
            91001,
            "2026-09-10",
            "2026-09-11",
            vacationTypeId,
            "integrity leave",
            userId,
          ]
        );
        await conn.query(
          "INSERT INTO company_holidays (start_date, end_date, note, created_by) VALUES (?, ?, ?, ?)",
          ["2026-09-07", "2026-09-07", "Company Holiday", userId]
        );

        const [leaveHits] = await conn.query<any[]>(
          "SELECT id FROM employee_leaves WHERE employee_id = ? AND start_date <= ? AND end_date >= ?",
          [91001, "2026-09-11", "2026-09-10"]
        );
        expect(leaveHits.length).toBeGreaterThan(0);

        const [holidayHits] = await conn.query<any[]>(
          "SELECT id FROM company_holidays WHERE start_date <= ? AND end_date >= ?",
          ["2026-09-07", "2026-09-07"]
        );
        expect(holidayHits.length).toBeGreaterThan(0);

        await conn.query(
          "INSERT INTO hik_biometric_logs (employee_id, employee_name, log_date, log_time, log_date_time) VALUES (?, ?, ?, ?, ?)",
          [
            91001,
            "Integrity Emp",
            "2026-09-07",
            "09:05:00",
            "2026-09-07 09:05:00",
          ]
        );
        const [logs] = await conn.query<any[]>(
          "SELECT log_date, log_time FROM hik_biometric_logs WHERE employee_id = ? ORDER BY id DESC LIMIT 1",
          [91001]
        );
        expect(String(logs[0].log_date).startsWith("2026-09-07")).toBe(true);
        expect(String(logs[0].log_time)).toMatch(/^09:05/);

        const [beforeHol] = await conn.query<any[]>(
          "SELECT id FROM company_holidays WHERE note = ? AND created_by = ?",
          ["Company Holiday", userId]
        );
        const holidayId = beforeHol[0].id;
        await conn.query("DELETE FROM users WHERE id = ?", [userId]);
        const [afterHol] = await conn.query<any[]>(
          "SELECT created_by FROM company_holidays WHERE id = ?",
          [holidayId]
        );
        expect(afterHol[0].created_by).toBeNull();

        await conn.query("DELETE FROM employee_leaves WHERE employee_id = ?", [
          91001,
        ]);
        await conn.query(
          "INSERT INTO employee_leaves (employee_id, start_date, end_date, leave_type_id, note, status) VALUES (?, '2026-09-21', '2026-09-21', ?, 'cascade test', 'approved')",
          [91001, vacationTypeId]
        );
        await conn.query("DELETE FROM employees WHERE employee_id = ?", [
          91001,
        ]);
        const [leftLeaves] = await conn.query<any[]>(
          "SELECT id FROM employee_leaves WHERE employee_id = ?",
          [91001]
        );
        expect(leftLeaves).toHaveLength(0);

        await conn.query("DELETE FROM company_holidays WHERE id = ?", [
          holidayId,
        ]);
        await conn.query(
          "DELETE FROM hik_biometric_logs WHERE employee_id = ?",
          [91001]
        );
      } finally {
        await conn.end();
      }
    },
    30000
  );
});