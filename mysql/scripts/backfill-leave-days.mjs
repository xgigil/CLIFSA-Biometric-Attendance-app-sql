/**
 * One-shot: backfill employee_leave_days for leaves that have none.
 * Also backfills reviewed_* on legacy leaves.
 *
 * Usage (from project root):
 *   node mysql/scripts/backfill-leave-days.mjs
 *   node mysql/scripts/backfill-leave-days.mjs --dry-run
 *
 * Needs DB_HOST, DB_USERNAME, DB_DATABASE (and optional DB_PASSWORD, DB_PORT).
 * Reads .env from project root if present.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DRY_RUN = process.argv.includes("--dry-run");

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function expandHolidayRanges(holidays) {
  const dates = new Set();
  const MAX = 366;
  for (const h of holidays) {
    const start = String(h.start_date || "").substring(0, 10);
    const end = String(h.end_date || h.start_date || "").substring(0, 10);
    if (!start || !end || end < start) continue;
    const cursor = new Date(`${start}T12:00:00Z`);
    const last = new Date(`${end}T12:00:00Z`);
    let guard = 0;
    while (cursor <= last && guard < MAX) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const d = String(cursor.getUTCDate()).padStart(2, "0");
      dates.add(`${y}-${m}-${d}`);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      guard++;
    }
  }
  return dates;
}

function buildLeaveDayRows(startDate, endDate, holidayDates) {
  const start = String(startDate).substring(0, 10);
  const end = String(endDate).substring(0, 10);
  if (!start || !end || end < start) return [];

  const holidays = holidayDates instanceof Set ? holidayDates : new Set(holidayDates);
  const rows = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  const MAX = 366;
  let guard = 0;

  while (cursor <= last && guard < MAX) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(dateStr)) {
      rows.push({ leave_date: dateStr, day_value: 1.0 });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return rows;
}

async function main() {
  loadEnvFile();

  const host = process.env.DB_HOST;
  const user = process.env.DB_USERNAME;
  const database = process.env.DB_DATABASE;
  if (!host || !user || !database) {
    console.error("Missing DB_HOST, DB_USERNAME, or DB_DATABASE");
    process.exit(1);
  }

  const pool = mysql.createPool({
    host,
    port: Number(process.env.DB_PORT || 3306),
    user,
    password: process.env.DB_PASSWORD || "",
    database,
    dateStrings: true,
  });

  let leavesProcessed = 0;
  let daysInserted = 0;
  let reviewedUpdated = 0;

  try {
    const [holidays] = await pool.query(
      "SELECT start_date, end_date FROM company_holidays"
    );
    const holidayDates = expandHolidayRanges(holidays);

    const [leaves] = await pool.query(`
      SELECT el.id, el.start_date, el.end_date
      FROM employee_leaves el
      LEFT JOIN employee_leave_days d ON d.leave_id = el.id
      GROUP BY el.id, el.start_date, el.end_date
      HAVING COUNT(d.id) = 0
    `);

    console.log(
      `Found ${leaves.length} leave(s) with no day rows. Dry-run: ${DRY_RUN}`
    );

    for (const leave of leaves) {
      const rows = buildLeaveDayRows(
        leave.start_date,
        leave.end_date,
        holidayDates
      );
      leavesProcessed++;

      if (rows.length === 0) {
        console.log(
          `  leave #${leave.id} ${leave.start_date}..${leave.end_date}: 0 counted days (header only)`
        );
        continue;
      }

      if (DRY_RUN) {
        for (const r of rows) {
          console.log(
            `  INSERT IGNORE employee_leave_days (${leave.id}, ${r.leave_date}, ${r.day_value})`
          );
        }
        daysInserted += rows.length;
        continue;
      }

      const values = rows.map((r) => [leave.id, r.leave_date, r.day_value]);
      const [result] = await pool.query(
        `INSERT IGNORE INTO employee_leave_days (leave_id, leave_date, day_value) VALUES ?`,
        [values]
      );
      const affected = Number(result.affectedRows || 0);
      daysInserted += affected;
      console.log(
        `  leave #${leave.id}: inserted ${affected} day row(s) (${rows.length} candidate)`
      );
    }

    // 4a — reviewed_* backfill (same UPDATE as Workbench)
    if (DRY_RUN) {
      const [[{ cnt }]] = await pool.query(`
        SELECT COUNT(*) AS cnt FROM employee_leaves WHERE reviewed_at IS NULL
      `);
      reviewedUpdated = Number(cnt);
      console.log(
        `DRY-RUN would update reviewed_* on ${reviewedUpdated} leave(s)`
      );
    } else {
      const [result] = await pool.query(`
        UPDATE employee_leaves
        SET reviewed_by = created_by, reviewed_at = created_at
        WHERE reviewed_at IS NULL
      `);
      reviewedUpdated = Number(result.affectedRows || 0);
    }

    console.log("\nSummary");
    console.log(`  leaves processed: ${leavesProcessed}`);
    console.log(`  day rows inserted: ${daysInserted}`);
    console.log(`  reviewed_* updated: ${reviewedUpdated}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});