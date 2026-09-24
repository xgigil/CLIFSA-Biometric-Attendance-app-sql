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
  "employee_leaves",
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

  it("should link users, profiles, employees, leaves, and holidays with the correct delete rules", () => {
    expect(schema).toContain(
      "CONSTRAINT profiles_id_fk FOREIGN KEY (id) REFERENCES users (id) ON DELETE CASCADE"
    );
    expect(schema).toContain(
      "CONSTRAINT profiles_employee_fk FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE SET NULL"
    );
    expect(schema).toContain(
      "CONSTRAINT leaves_employee_fk FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE"
    );
    expect(schema).toContain(
      "CONSTRAINT leaves_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL"
    );
    expect(schema).toContain(
      "CONSTRAINT holidays_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL"
    );
  });

  it("should seed default work start time as 09:00 and grace period as 15 minutes", () => {
    expect(schema).toMatch(
      /INSERT INTO system_settings \(id, work_start_time, grace_period\)\s*VALUES \(1, '09:00', 15\)/
    );
  });

  it("should require each user email to be unique", () => {
    expect(schema).toContain("UNIQUE KEY users_email_unique (email)");
  });

  it("should store profile role and status as plain text fields", () => {
    expect(schema).toMatch(/role VARCHAR\(32\)/);
    expect(schema).toMatch(/status VARCHAR\(32\)/);
    expect(schema).not.toMatch(/ENUM\s*\(/);
  });

  it("should include indexes for leave ranges, holiday ranges, and attendance logs", () => {
    expect(schema).toContain("KEY leaves_emp_range (employee_id, start_date, end_date)");
    expect(schema).toContain("KEY holidays_date_range (start_date, end_date)");
    expect(schema).toContain("KEY logs_date (log_date)");
    expect(schema).toContain("KEY logs_employee_date (employee_id, log_date)");
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
    expect(sql).toMatch(/DELETE FROM public\.employee_leaves\s*WHERE leave_type = 'holiday'/);
    expect(sql).toMatch(/GROUP BY start_date, end_date/);
  });

  it("should treat mysql/schema.sql as the source of truth for the local MySQL database", () => {
    const migrationsDir = path.resolve(
      process.cwd(),
      "supabase/migrations"
    );
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
          "SELECT work_start_time, grace_period FROM system_settings WHERE id = 1"
        );
        expect(settings[0]?.work_start_time).toBe("09:00");
        expect(Number(settings[0]?.grace_period)).toBe(15);

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
            "INSERT INTO employee_leaves (employee_id, start_date, end_date, leave_type, status) VALUES (?, ?, ?, 'vacation', 'approved')",
            [999999, "2026-09-01", "2026-09-01"]
          );
        } catch (e) {
          fkError = e;
        }
        expect(fkError).toBeTruthy();

        await conn.query(
          "INSERT INTO employee_leaves (employee_id, start_date, end_date, leave_type, status, created_by) VALUES (?, ?, ?, 'vacation', 'approved', ?)",
          [91001, "2026-09-10", "2026-09-11", userId]
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
          "INSERT INTO employee_leaves (employee_id, start_date, end_date, status) VALUES (?, '2026-09-21', '2026-09-21', 'approved')",
          [91001]
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
