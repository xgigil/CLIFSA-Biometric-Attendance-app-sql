# Changelog

## [1.1.3] - Leave Application Phase 3 (Admin or HR permissions)

Phase 3 adds permission helpers so leave and holiday management accept **Admin or HR**.
Admin still owns Settings, user management, and attendance CRUD. Assigning the HR role in
Settings UI is deferred to Phase 8; until then promote a user with SQL (`profiles.role = 'hr'`)
to exercise the HR path.

### Added

* **Role helpers** (`src/app/dashboard/attendance/admin.ts`)
  * `AppRole`, `isAdminRole`, `isAdminOrHrRole`, `canManageLeaveandHolidays`.
  * `checkIsAdminOrHr` for leave/holiday write gates; `checkIsAdmin` unchanged for Admin-only paths.
  * Unit tests covering admin, hr, member, signed-out, and null profile.

### Updated

* **Leave / holiday writes**
  * `setLeaveAction`, `setLeaveForAllAction`, `removeLeaveAction`, `setHolidayAction`, and
    `removeHolidayAction` use `checkIsAdminOrHr`.
  * Unauthorized message: `"Unauthorized access. Admin or HR privileges required."`

* **Sidebar chrome** (`src/components/app-sidebar.tsx`)
  * Add Attendance remains Admin-only.
  * Set Leave / Set Holiday shown for Admin or HR via `isAdminOrHrRole`.
  * Layout already passes `profiles.role` into the sidebar (no layout change).

* **Tests**
  * Leave and holiday action tests updated for the new unauthorized copy; HR-allowed cases as covered.

### Notes / limitations (future improvements)

* **HR role assignment UI:** Settings still only offers Admin / Member (Phase 8).
* **HR org views:** Dashboard / calendar / site-header day nav stay Admin-only until later phases.
* **Attendance CRUD** stays Admin-only.
* No schema migration — `profiles.role` is already `VARCHAR(32)` and accepts `hr`.

## [1.1.2] - Leave Application Phase 2 (workday calculator, day rows, holiday guard)

Phase 2 builds on Phase 1. Approach: **extend** existing Set Leave / Set Holiday flows.
Direct Set Leave still creates `approved` leaves and does not create `leave_applications` rows.

### Added

* **Workday calculator** (`src/utils/leave-day-calculator.ts`)
  * Builds counted leave day rows (skip weekends and company holidays; optional half-days).
  * Unit tests for weekdays, weekends, holidays, half-days, and year-end spans.

* **Day rows on Set Leave**
  * Set Leave / Set Leave for All insert matching `employee_leave_days` in the same DB transaction as the leave header.
  * Empty counted-day ranges (all weekends/holidays) still create the leave header for calendar range display.
  * Reason / note is required on Set Leave (UI + server validation).

* **Legacy backfill**
  * One-shot script: `mysql/scripts/backfill-leave-days.mjs`
    * Populates `employee_leave_days` for existing leaves that have zero day rows (skip weekends + company holidays; `day_value = 1.0`).
    * Also backfills `reviewed_by` / `reviewed_at` from `created_by` / `created_at` where `reviewed_at IS NULL`.
    * Idempotent: safe to re-run (`INSERT IGNORE` + unique `(leave_id, leave_date)`; reviewed UPDATE only touches null `reviewed_at`).
    * Supports `--dry-run`. Not a migration runner — run manually from the project root after Phase 2 app code is deployed.
  * Optional Workbench SQL: `mysql/schema_v1.1.2_optional.sql` for the same `reviewed_*` UPDATE if preferred over the script.

### Updated

* **Holiday conflict guard**
  * Set Holiday blocked by overlapping `pending` or `approved` leave (not only approved).
  * Error message names affected employees, dates, and status (capped list; fail-closed on query errors).

* **Tests**
  * Leave actions: day-row inserts, weekend skip, txn rollback, required note.
  * Holiday actions: pending blocks; denied/cancelled do not; named error text; fail-closed on DB errors.

### Notes / limitations (future improvements)

* **Backfill:** Use `mysql/scripts/backfill-leave-days.mjs` once per database (dry-run first). It is one-shot and idempotent; re-running should not duplicate day rows or re-stamp already-reviewed leaves.
* **`reviewed_*`:** Backfilled for legacy Set Leave rows via the script and/or `mysql/schema_v1.1.2_optional.sql`. App UI does not use these fields yet (approve/reject comes in a later phase).
* **Calendar / attendance:** Still treat leave as a date **range** (`buildLeaveIndex` / `isOnLeave`), not `employee_leave_days`. Day rows are for counted workdays and future balances only — display does not switch to day rows in Phase 2.
* Leave writes are hybrid: reads/guards still use the query-builder client; multi-table inserts use a raw MySQL transaction. A later cleanup could unify write paths on one style.
* Set Leave still **rejects** any range that overlaps a company holiday entirely. The calculator can skip holiday dates inside a range; that path is mainly for backfill and later application flows unless the hard holiday block is relaxed.
* No half-day toggle in Set Leave UI yet (calculator supports `0.5` for Phase 4+).
* No leave application form, print, approve/reject, or `getLeaveBalance` UI (later phases).
* No automated migration runner; schema/backfill remain manual Workbench / one-shot script.

## [1.1.1] - Leave Application Phase 1 (database foundation + leave type policies)

Phase 1 only. Direct Set Leave still creates `approved` leaves. Day rows and leave applications are not written yet (Phase 2+).

### Added

* **Leave balance pools and leave type policies.**

  * New `leave_balance_pools` table with seeded allotments: Vacation (15), Application (15), Maternity (105), Paternity (7).
  * New `leave_type_policies` table linking named leave types to pools (`Vacation`, `Sick Leave`, `Enrollment`, `Birthday`, `Leave w/Permission (w/o pay)`, `Other`, `Maternity Leave`, `Paternity Leave`).

* **Leave day and application tables (schema only).**

  * New `employee_leave_days` table for counted workday rows (`leave_id`, `leave_date`, `day_value`).
  * New `leave_applications` table for future printed-form snapshots.
  * Phase 1 does **not** insert into either table from Set Leave.

* **Leave application form header columns on `system_settings`.**

  * Added nullable `company_name`, `company_address`, `company_phones`, `company_email`, `form_title`, `signatory_name`, `signatory_title`.
  * Seeded defaults for company name and form title; Settings UI still edits only work start / grace period.

* **Manual Workbench migration script.**

  * `mysql/schema_v1.1.1_migration_updates.sql` for existing databases (pools, types, `leave_type_id` backfill, drop text `leave_type`, new tables).

### Updated

* **`employee_leaves` schema.**

  * Replaced text `leave_type` with required `leave_type_id` FK to `leave_type_policies`.
  * Added review fields: `reviewed_by`, `reviewed_at`, `review_note`.
  * Kept default `status = 'approved'` for direct Set Leave compatibility.
  * Added status / date-range checks and status range index where applied.

* **`mysql/schema.sql`**

  * Source of truth updated for fresh installs to match the Phase 1 shape and seeds.

* **`src/app/dashboard/leaves/actions.ts`**

  * Payloads use `leave_type_id` instead of string `leave_type`.
  * Added `getActiveLeaveTypesAction()` and default Vacation type resolution by name (not hard-coded ids).
  * `getLeavesForRangedAction` returns `leave_type_name` via a policies map (no SQL joins).
  * Removed holiday-as-leave-type string guards; holidays remain a separate table.
  * Set Leave still inserts `status = 'approved'` and does not write day rows or applications.

* **Leave dialogs**

  * `set-leave-dialog.tsx` / `edit-day-dialog.tsx`: load active policies on open, submit `leave_type_id`, display `leave_type_name`.
  * `remove-leave-dialog.tsx`: display `leave_type_name` instead of legacy text `leave_type`.

* **Calendar display**

  * `calendar/page.tsx`: selects `leave_type_id` and resolves names from `leave_type_policies`.
  * `employee-attendance-calendar.tsx`: shows `leave_type_name` instead of hard-coded `LEAVE_TYPE_LABELS`.
  * `attendance-processor.ts`: `LeaveRow` uses `leave_type_id` / `leave_type_name`.

* **Tests**

  * `mysql/schema.integrity.test.ts`: asserts new tables, FKs, settings header columns, and `leave_type_id`.
  * `leaves/actions.test.ts`: payloads and insert expectations use `leave_type_id`; holiday-as-leave-type case replaced with invalid/unresolved leave type.

### Notes / non-goals (still Phase 2+)

* No `employee_leave_days` writes from Set Leave yet.
* No leave application form, print, approve/reject, or balance UI.
* Settings editors for pools, types, and form header wait for later phases.

## [1.0.4] - Leave and holiday details on the calendar

### Added

* **Leave type and note on the employee calendar.**

  * Month cells show the leave type on the first line and the note on the second, in the same place as punch times and hours.
  * The day dialog shows Reason for Leave and Additional Note when the selected day is on leave.

* **Holiday note on the employee calendar.**

  * Month cells show the holiday note on the same line as the leave type.
  * The day dialog shows the holiday note when the selected day is a holiday.

* **Remove leave from the Set Leave dialog.**

  * When an employee and date range overlap an existing approved leave, that leave is listed in the dialog with a remove action.
  * Removal requires confirmation; multi-day leaves warn that the entire leave span will be deleted, not only the selected range.
  * The existing-leave section appears only when overlaps exist, and sits at the bottom of the form.

### Updated

* **`src/utils/attendance-processor.ts`**

  * Added `leave_type` and `note` to `LeaveRow`.
  * Added `note` to `HolidayRow`.

* **`src/app/dashboard/calendar/page.tsx`**

  * Calendar leave and holiday queries now select those text columns.

* **`src/components/employee-attendance-calendar.tsx`**

  * Looked up the matching leave or holiday for a day and rendered the type and notes in the month cell and the day dialog.

* **`src/components/attendance/set-leave-dialog.tsx`**

  * Fetched overlapping leaves for the selected employee and range.
  * Added inline remove with confirmation messaging.
  * Made the dialog scrollable and layout friendlier on smaller screens.

* **`src/components/attendance/set-holiday-dialog.tsx`**

  * Made the dialog scrollable and stacked holiday rows/actions more cleanly on smaller screens.

## [1.0.3] - Admin dashboard card update

### Updated

* **Replaced Total Employees with On Leave in admin dashboard cards.**

  * Admin dashboard summary cards now show employees currently on leave instead of total employees.

## [1.0.2] - Company holidays and bulk leave entry

### Added

* **Admin ability to set company holidays.**

  * Holidays are stored in a dedicated `company_holidays` table instead of per-employee leave rows.
  * Holiday status takes precedence over attendance punches and leave, except weekends.
  * Setting a holiday is blocked if any employee already has an approved `on_leave` status in the selected range; those leaves must be removed first.
  * Holiday handling does not interfere with the existing on-leave checker.

* **Bulk on-leave entry for all employees.**

  * Admins can apply leave to every active employee in one action.
  * Employees already on leave for the selected range are skipped.

* **UI updates for holiday and leave workflows.**

  * Sidebar actions for setting holidays and leave.
  * Calendar and related views updated to display holiday status.

### Updated

* **`mysql/schema.sql`**

  * Added `company_holidays` (`id`, `start_date`, `end_date`, `note`, `created_by`, `created_at`).

* **`database/migrations/2026_09_07_015639_create_company_holidays_table.php`**

  * Added `company_holidays` table and migrated existing holiday leave rows into company holidays.

* **`resources/js/app/dashboard/holidays/actions.ts`**

  * Added admin actions to fetch, set, and remove company holidays.
  * Enforced leave-conflict and overlap checks before creating holidays.

* **`resources/js/app/dashboard/leaves/actions.ts`**

  * Added bulk leave action for all active employees.
  * Blocked leave creation on holiday dates and removed holiday as a leave type.

* **`resources/js/utils/attendance-processor.ts`**

  * Integrated holiday indexing and status evaluation.
  * Applied holiday precedence after weekends, before leave and punches.
  * Excluded holiday days from attendance and weekly hour calculations.

* **`resources/js/components/attendance/set-holiday-dialog.tsx`**

  * Added dialog for creating and managing company holidays.

* **`resources/js/components/attendance/set-leave-dialog.tsx`**

  * Added option to apply leave to all employees.

* **`resources/js/components/app-sidebar.tsx`**

  * Added sidebar entry points for Set Holiday and related admin actions.

## [1.0.1] - Prioritize leave status over attendance punches

### Fixed

* **Leave status now takes precedence over attendance punches.**

  * Days marked as `on_leave` are treated as leave even when attendance punches exist.
  * Applies to Daily Logs, the calendar, and the member dashboard.

* **Excluded leave days from attendance calculations.**

  * `on_leave` days are no longer counted toward **Days Present**.
  * `on_leave` days are excluded from the **Monthly On-Time Rate** denominator, even when punches exist.

* **Excluded leave days from weekly logged hours.**

  * Punches recorded on `on_leave` days do not contribute to **Logged Hours This Week**.
  * Punch times remain visible in Daily Logs and the calendar for reference.

### Updated

* **`resources/js/utils/attendance-processor.ts`**

  * Updated attendance processing to evaluate leave status before attendance punches.
  * Excluded leave days from attendance and weekly hour calculations.
  * Preserved punch times for display purposes.

* **`resources/js/components/attendance/edit-day-dialog.tsx`**

  * Updated the warning message displayed when a day contains attendance punches but is marked as `on_leave`.

## [1.0.0] - MySQL conversion and on-leave feature support

Forked from the original HikCentral dashboard, which used hosted **Supabase** (Postgres + Auth). This release makes the app run against local **MySQL** and adds employee leave tracking.

### Added

* **MySQL backend with a Supabase-compatible data layer.**

  * Replaced the remote Supabase Postgres connection with a local MySQL pool (`mysql2`).
  * Added a query builder that keeps the existing `from().select().eq()` / `insert` / `update` / `delete` call style, so dashboard pages did not need a full rewrite.
  * Added `mysql/schema.sql` with MySQL equivalents of the original tables: `users`, `employees`, `profiles`, `hik_biometric_logs`, `system_settings`, and `employee_leaves`.
  * DATE/TIME values are returned as strings so attendance processing stays unchanged.

* **Docker Compose for local MySQL testing.**

  * Added `docker-compose.yml` to run a MySQL 8.0 server locally (`clifsa-mysql`) for testing the converted database layer.
  * Publishes MySQL on host port `3307` and creates the `clifsa_attendance` database on first start.
  * Loads `mysql/schema.sql` automatically via `/docker-entrypoint-initdb.d`.

* **Local authentication instead of Supabase Auth.**

  * Accounts are stored in a `users` table with bcrypt password hashes.
  * Sessions use a signed JWT cookie (`clifsa_session`) instead of Supabase session cookies.
  * The first registered user becomes an approved admin; later sign-ups stay pending until an admin approves them.
  * Login, signup, and logout still go through server actions, now backed by MySQL.

* **On-leave option for employees.**

  * Admins can mark an employee as on leave for a date or date range.
  * Leave types: Vacation, Sick Leave, Unpaid Leave, and Other, with an optional note.
  * Leave can be set from the sidebar (**Set Leave**) or from a calendar day (**Mark this day as on leave**).
  * Overlapping leave for the same employee is blocked.
  * Leave can be removed from the calendar day dialog or the remove-leave dialog.

* **On-leave status in attendance views.**

  * Daily Logs, the calendar, the admin dashboard, and the member dashboard show `on_leave` as its own status.
  * Status filters include On Leave.
  * Member dashboard shows an On Leave badge and headline when the employee is on approved leave today.

* **Server actions for browser data access.**

  * The browser can no longer query the database directly (MySQL is server-only).
  * Settings loads, profile/role/status updates, and calendar employee lists now use server actions instead of the old browser-side Supabase client.

### Updated

* **`mysql/schema.sql`**

  * Added the MySQL schema used in place of the original Supabase migrations.

* **`docker-compose.yml`**

  * Added a local MySQL 8.0 service for testing the MySQL conversion without a remote server.

* **`src/lib/db.ts`**

  * Added a shared MySQL connection pool using `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE`.

* **`src/lib/db-client.ts`**

  * Added the MySQL stand-in for the old Supabase client, including auth (`signInWithPassword`, `signUp`, `signOut`, `getUser`, `updateUser`, admin `deleteUser`).

* **`src/lib/db-server.ts`**

  * Wired Next.js cookies into the MySQL client for server components and server actions.

* **`src/lib/supabase/server.ts`**

  * Re-exported `createClient` / `createAdminClient` from the MySQL layer so existing imports keep working.

* **`src/lib/supabase/client.ts`**

  * Disabled the browser Supabase client. Browser code must use a server action.

* **`src/proxy.ts`**

  * Replaced Supabase session checks with the local JWT session and MySQL `profiles` lookup.

* **`src/app/(login)/actions.ts`**

  * Pointed login, signup, and logout at the MySQL auth client.

* **`src/app/dashboard/settings/actions.ts`**

  * Moved settings reads and user management (display name, role, status, employee link, delete user) to MySQL-backed server actions.

* **`src/app/dashboard/leaves/actions.ts`**

  * Added admin actions to fetch, set, and remove employee leave, including overlap checks.

* **`src/utils/attendance-processor.ts`**

  * Added leave indexing (`buildLeaveIndex`, `isOnLeave`) and `on_leave` status evaluation for daily logs, weekly stats, and the calendar.

* **`src/components/attendance/set-leave-dialog.tsx`**

  * Added the admin dialog for creating leave with type, date range, and note.

* **`src/components/attendance/edit-day-dialog.tsx`**

  * Added the per-day "Mark this day as on leave" option and leave removal.

* **`src/components/attendance/remove-leave-dialog.tsx`**

  * Added confirmation when removing an existing leave record.

* **`src/components/app-sidebar.tsx`**

  * Added the sidebar **Set Leave** action for admins.

* **`src/components/status-filter.tsx`**

  * Included `on_leave` in Daily Logs status filters.

* **`src/components/employee-attendance-calendar.tsx`**

  * Displayed on-leave days in the calendar.

* **`src/components/employee-dashboard-view.tsx`**

  * Displayed today's on-leave state on the member dashboard.

* **`src/app/dashboard/analytics/columns.tsx`**

  * Rendered the On Leave badge in Daily Logs.

* **`next.config.ts`**

  * Marked `mysql2` and `bcryptjs` as server external packages.
