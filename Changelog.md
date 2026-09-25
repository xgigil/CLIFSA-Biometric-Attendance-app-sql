# Changelog

## [1.0.4] - Leave and holiday details on the calendar

### Added

* **Leave type and note on the employee calendar.**

  * Month cells show the leave type on the first line and the note on the second, in the same place as punch times and hours.
  * The day dialog shows Reason for Leave and Additional Note when the selected day is on leave.

* **Holiday note on the employee calendar.**

  * Month cells show the holiday note on the same line as the leave type.
  * The day dialog shows the holiday note when the selected day is a holiday.

### Updated

* **`src/utils/attendance-processor.ts`**

  * Added `leave_type` and `note` to `LeaveRow`.
  * Added `note` to `HolidayRow`.

* **`src/app/dashboard/calendar/page.tsx`**

  * Calendar leave and holiday queries now select those text columns.

* **`src/components/employee-attendance-calendar.tsx`**

  * Looked up the matching leave or holiday for a day and rendered the type and notes in the month cell and the day dialog.

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
