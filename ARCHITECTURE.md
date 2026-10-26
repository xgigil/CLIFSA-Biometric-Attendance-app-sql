# Application Architecture

Map of the CLIFSA Biometric Attendance dashboard: how the repo is organized, what each major area does, and how requests flow through auth, UI, and MySQL.

For setup and a product overview, see [README.md](./README.md).

---

## Stack at a glance

| Layer | Choice |
|--------|--------|
| Framework | Next.js (App Router) + React + TypeScript |
| UI | Tailwind CSS, shadcn/ui, Recharts, TanStack Table |
| Data | Local/on-prem **MySQL** (`mysql2`) |
| Auth | Cookie JWT session (`jose` + `bcryptjs`), not live Supabase Auth |
| Tests | Vitest (+ Testing Library / happy-dom) |

**Important:** Imports from `@/lib/supabase/*` are **compatibility shims**. They re-export the MySQL-backed client so older call sites keep a Supabase-like `.from().select()` / `auth.getUser()` API. The live database is MySQL; see `mysql/schema.sql`.

---

## High-level request flow

```text
Browser
  → src/proxy.ts          (session + profile status gates)
  → App Router pages      (src/app/...)
  → Server Actions / RSC  (createClient from @/lib/supabase/server → db-server → db-client)
  → MySQL                 (getPool() in src/lib/db.ts)
```

1. **`proxy`** checks the session cookie and `profiles.status` (`pending` / `rejected` / `approved`) and redirects before page logic runs.
2. **Dashboard layout** loads the user + role and wraps pages in the sidebar shell.
3. **Pages** fetch data in Server Components or call **`"use server"`** actions.
4. **Domain utils** (`src/utils/*`) turn raw biometric / leave / holiday rows into attendance statuses and balances.

---

## Repository layout

```text
.
├── ARCHITECTURE.md          # This file
├── README.md                # Product overview & badges
├── package.json             # Scripts: dev, build, test, lint
├── next.config.ts
├── vitest.config.ts
├── .env.example             # DB_* and SESSION_SECRET
│
├── mysql/                   # Canonical MySQL schema & helpers
│   ├── schema.sql           # Full schema + seed data
│   ├── schema_v1.1.*.sql    # Incremental / optional migrations
│   ├── schema.integrity.test.ts
│   └── scripts/             # One-off maintenance (e.g. leave-day backfill)
│
├── supabase/migrations/     # Legacy Postgres/RLS history (reference only)
│
├── public/                  # Static assets (logo, icons)
│
└── src/
    ├── proxy.ts             # Auth / approval routing (Next proxy)
    ├── app/                 # Routes, layouts, server actions
    ├── components/          # Shared UI and feature dialogs
    ├── hooks/               # Client hooks (e.g. mobile sidebar)
    ├── lib/                 # DB pool, session client, small helpers
    └── utils/               # Pure domain logic (attendance, leave math)
```

---

## `src/app` — routes and features

Next.js App Router: folders map to URLs. Route groups like `(login)` do **not** appear in the path.

### Auth — `src/app/(login)/`

| Path | Role |
|------|------|
| `/sign-in`, `/sign-up` | Login / registration forms |
| `/pending-approval` | Signed-in user waiting for admin approval |
| `/rejected` | Registration rejected |
| `actions.ts` | `login` / `signup` / sign-out server actions |

New accounts land as `profiles.status = pending` until an admin approves them.

### Root

| Path | Role |
|------|------|
| `/` (`app/page.tsx`) | Entry / redirect into the app |
| `app/layout.tsx` | Root HTML shell, theme, global styles |
| `app/globals.css` | Global Tailwind / design tokens |

### Dashboard shell — `src/app/dashboard/`

| Piece | Role |
|--------|------|
| `layout.tsx` | Requires signed-in user; sidebar + header; passes `role` and `canManageLeave` (admin/HR) into the header |
| `page.tsx` | Home dashboard: **admin** attendance view, or **employee** attendance view plus that member's own leave-pool balances |
| `loading.tsx` | Route-level loading UI |

Sidebar navigation (see `components/app-sidebar.tsx`) groups:

- **Overview** — Dashboard
- **Attendance** — Daily Logs (`/dashboard/analytics`), Calendar
- **Leave Management** — Leave Requests
- **System** — Settings

Quick actions (admin/HR): add attendance, set leave, set holiday.

The admin home stays attendance-only. A member's own pool remaining is loaded on `page.tsx` with `getEmployeeLeaveBalancesAction` and rendered by `EmployeeDashboardView`.

### Feature areas under `dashboard/`

#### Attendance helpers — `attendance/`

No dedicated page; shared modules used by dialogs and other features.

| File | Purpose |
|------|---------|
| `roles.ts` | Role checks: `admin`, `hr`, `member` |
| `admin.ts` | Admin/HR guards + cache revalidation helpers |
| `date-range.ts` | Shared date-range validation |

#### Daily logs — `analytics/`

Listed in the UI as **Daily Logs**. Table of processed attendance for a date range, charts/columns, and server actions for log queries.

#### Calendar — `calendar/`

Month/day calendar view of attendance, leave, and holidays (`calendar-view.tsx`).

#### Leaves (admin set leave) — `leaves/`

Server actions to **set / clear approved leave** on the calendar (admin/HR), including day expansion and holiday conflict checks. Distinct from formal leave *applications* below.

#### Leave requests (applications) — `leave-requests/`

Formal leave application workflow (apply → pending → approve or deny → print form). Pages stay thin. Reads, apply writes, and review writes are separate server-action files. Private helpers stay in `_lib/` and are not routes.

| Path / file | Purpose |
|-------------|---------|
| `page.tsx` | List applications. Members are scoped to their own employee inside the list action. Admin/HR may filter with `?employee_id=` and `?status=`. |
| `applications-table.tsx`, `format.ts` | List table and shared date/day formatting |
| `new/page.tsx`, `new/apply-form.tsx` | Apply form |
| `[id]/page.tsx` | Detail: filed snapshot plus live remaining for that pool |
| `[id]/detail-actions.tsx` | Back and Print links |
| `[id]/review-panel.tsx` | Admin/HR approve or deny (optional note), and delete while pending |
| `[id]/print/` | Printable leave application form |
| `read-actions.ts` | `listLeaveApplicationAction`, `getLeaveApplicationDetailAction`, `getEmployeeLeaveBalancesAction` (all pools for one employee and year) |
| `apply-actions.ts` | Submit, delete a pending application, preview days |
| `review-actions.ts` | `reviewLeaveRequestAction`: Admin/HR only. Updates `employee_leaves` status and review fields. Does not write day rows or form rows. |
| `actions.test.ts` | Apply, list/detail, review, and balance-read tests |
| `_lib/caller.ts` | `getCallerContext`, `checkEmployeeAccess` (member = own employee; admin/HR = any) |
| `_lib/queries.ts` | Submit overlap (pending or approved), approve overlap (approved only, excluding this leave), holidays, active leave type |
| `_lib/insert-application.ts` | Pending insert transaction (leave + day rows + form snapshot). Review does not use this. |
| `_lib/errors.ts` | Shared messages, including review errors (`reviewUnauthorized`, `invalidDecision`, `reviewNotPending`, `noteTooLong`, `approvedOverlap`, `reviewFailed`) |

**Member** sees their own requests and their own balances (on the home dashboard). **Admin/HR** can list and review any employee. The employee picker for that list lives in `site-header.tsx` on `/dashboard/leave-requests`, shown only when `canManageLeave` is set. Approving with another approved leave on the same dates fails. A low remaining balance warns and still approves. Deny does not change balances. Pending and denied days are ignored by `getLeaveBalance` (`status = 'approved'` only).

#### Holidays — `holidays/`

Server actions for company holiday ranges (used from sidebar dialogs and attendance processing).

#### Settings — `settings/`

System settings (work start time, grace period, company letterhead fields for leave forms) and related actions. Admin-oriented.

#### Reports — `reports/`

Placeholder route (skeleton UI); not a full reporting feature yet.

---

## `src/components` — UI building blocks

| Area | Purpose |
|------|---------|
| `ui/` | shadcn primitives (button, table, sidebar, dialog, textarea, etc.) |
| `attendance/` | Dialogs: add/edit/delete attendance, set/remove leave, set holiday |
| `skeletons/` | Loading placeholders for admin/employee dashboard & analytics |
| `app-sidebar.tsx`, `nav-*.tsx` | App chrome and navigation |
| `site-header.tsx` | Route title and right-side controls. Daily Logs and Calendar keep the attendance date controls. Leave Requests uses `StatusFilter` with leave statuses; Admin/HR also get the employee picker on the list. |
| `status-filter.tsx` | Shared status menu. `ATTENDANCE_STATUS_OPTIONS` for Daily Logs; `LEAVE_STATUS_OPTIONS` (`pending`, `approved`, `denied`, `cancelled`) for Leave Requests. |
| `confirm-dialog.tsx` | Shared confirm step for apply, review, and delete |
| `admin-dashboard-view.tsx` | Admin home: attendance counts and weekly chart. No leave-balance cards. |
| `employee-dashboard-view.tsx` | Member home: attendance stats plus **My Leave Balances** (pool name, remaining, used, allotment) |
| `employee-attendance-calendar.tsx` | Calendar widget used on employee surfaces |
| `login-form.tsx` / `signup-form.tsx` | Auth forms |
| `theme-provider.tsx`, `mode-toggle.tsx` | Light/dark theme |

---

## `src/lib` — data & session

| Module | Purpose |
|--------|---------|
| `db.ts` | MySQL connection pool (`getPool()`); reads `DB_*` env vars |
| `db-client.ts` | Supabase-shaped query + `auth` API over MySQL + JWT cookie session |
| `db-server.ts` | `createClient` / `createAdminClient` wired to Next `cookies()` |
| `supabase/server.ts`, `supabase/client.ts` | Thin re-exports of the MySQL client (legacy import paths) |
| `utils.ts` | `cn()` and small shared helpers |

Session cookie name: `clifsa_session` (see `db-client.ts`). Secret: `SESSION_SECRET` in `.env`.

---

## `src/utils` — domain logic

| Module | Purpose |
|--------|---------|
| `attendance-processor.ts` | Core engine: raw Hik logs + leave + holidays → daily status (present, late, absent, on leave, etc.) and stats |
| `leave-day-calculator.ts` | Expand leave ranges into per-day rows (full / half day), respect holidays |
| `leave-balance.ts` | Pool allotment minus approved `day_value` in the calendar year. Used for the apply-form snapshot, the approval re-check, and on-screen remaining balances. |

Keep page/actions thin; put reusable attendance/leave math here. Listing every pool for one employee stays in `getEmployeeLeaveBalancesAction`; the util still takes one `poolId` per call.

---

## Database model (MySQL)

Canonical definition: **`mysql/schema.sql`**.

| Table | Role |
|-------|------|
| `users` | Credentials (`password_hash`) |
| `profiles` | App user: `role`, `status`, optional `employee_id` link |
| `employees` | People known to HikCentral / payroll (numeric `employee_id`) |
| `hik_biometric_logs` | Raw punch logs from the biometric system |
| `system_settings` | Work hours, grace, company letterhead |
| `leave_balance_pools` / `leave_type_policies` | Leave categories and annual allotments |
| `employee_leaves` | Leave records (`pending` / `approved` / `denied` / `cancelled`), plus `reviewed_by`, `reviewed_at`, `review_note` after review |
| `employee_leave_days` | Materialized leave days (0.5 / 1.0). Written on submit, not on approve/deny. |
| `leave_applications` | Form metadata snapshot for printing. Written on submit, not on review. |
| `company_holidays` | Non-working company holiday ranges |

`supabase/migrations/` documents an earlier Supabase/Postgres design (RLS, etc.). Prefer `mysql/` for the current runtime schema.

---

## Roles and access

Defined in `src/app/dashboard/attendance/roles.ts`:

| Role | Typical access |
|------|----------------|
| `member` | Own attendance, own leave requests, and own pool balances on the home dashboard (via linked `profiles.employee_id`) |
| `hr` | Manage leave and holidays; list, filter, and review any leave request; look up any employee's balances |
| `admin` | Full console, settings, user approval, attendance edits, plus the same leave-request review access as HR |

Registration gate (`profiles.status`) is enforced in `src/proxy.ts` independently of role.

---

## Testing conventions

- Colocated `*.test.ts` / `*.test.tsx` next to the module under test.
- Domain tests for `utils/` (including approved-only and year-split balance math in `leave-balance.test.ts`), schema integrity under `mysql/`, and action tests under feature folders (`leave-requests/actions.test.ts` covers apply, read, review, and balance reads).
- Header and member-dashboard tests cover the leave list controls and the balance cards (`site-header.test.tsx`, `employee-dashboard-view.test.tsx`).
- Run: `pnpm test` (or `npm test` / `vitest run`).

---

## Conventions worth preserving

1. **Server Actions** live next to the feature (`*-actions.ts` or `actions.ts`) with `"use server"`. Leave requests split reads (`read-actions.ts`), apply writes (`apply-actions.ts`), and review writes (`review-actions.ts`).
2. **`_lib/`** under a feature holds private helpers not meant as routes.
3. Prefer **`createClient()`** from `@/lib/supabase/server` (or `@/lib/db-server`) in RSC/actions so cookies stay in sync.
4. Use **`createAdminClient()`** when the query must bypass the caller’s row scope but still runs on the server after an explicit authz check.
5. After writes that affect dashboards/calendars, call the shared **revalidate** helpers (e.g. from `attendance/admin.ts`). Review also revalidates `/dashboard/leave-requests`.
6. Do not treat `@/lib/supabase` as a remote Supabase project — it is a local API façade over MySQL.

---

## Related docs

- [README.md](./README.md) — product summary
- [mysql/Leave-Application_Migration_Steps.md](./mysql/Leave-Application_Migration_Steps.md) — leave-application DB migration notes
- `.env.example` — required environment variables