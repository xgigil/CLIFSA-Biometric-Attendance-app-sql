# Phase 1–2 migration (live database)

Upgrade an existing live DB. Do **not** recreate from `mysql/schema.sql`.

**Order:**

1. Backup  
2. Run `schema_v1.1.1_migration_updates.sql`  
3. Deploy the new app (Phase 1 + 2 code)  
4. Run `schema_v1.1.2_optional.sql` (optional — `reviewed_*` only)  
5. Run `backfill-leave-days.mjs`  

---

## 1. Backup

```bash
mysqldump -h <host> -P <port> -u <user> -p <database> > backup_YYYYMMDD.sql
```

---

## 2. Phase 1 schema

**File:** `mysql/schema_v1.1.1_migration_updates.sql`

1. Change `USE ...` to your live database name.  
2. Run the whole script in MySQL Workbench.  
3. Quick check:

```sql
SELECT COUNT(*) AS missing_type FROM employee_leaves WHERE leave_type_id IS NULL;
-- expect 0
```

---

## 3. Deploy the app

Deploy the build that includes leave types, day-row writes, and the holiday guard.  
Do this **after** Step 2 so the app matches the new schema.

---

## 4. Optional — `reviewed_*` (Workbench)

**File:** `mysql/schema_v1.1.2_optional.sql`

1. Change `USE ...` to your live database.  
2. Run in Workbench.  

Skip this if you prefer the backfill script to set `reviewed_*` for you (Step 5 does that too).

---

## 5. Backfill day rows

**File:** `mysql/scripts/backfill-leave-days.mjs`  
From project root, with `.env` (or shell env) pointing at the live DB:

```bash
node mysql/scripts/backfill-leave-days.mjs --dry-run
node mysql/scripts/backfill-leave-days.mjs
```

Fills `employee_leave_days` for old leaves (and `reviewed_*` if still null). Safe to re-run.

---

## 6. Quick verify

```sql
SELECT COUNT(*) FROM employee_leave_days;
SELECT COUNT(*) AS still_null_reviewed FROM employee_leaves WHERE reviewed_at IS NULL;
```

Smoke: Set Leave (with reason), Remove Leave, Calendar, Set Holiday vs leave.

---

## Files

| File | Purpose |
|------|---------|
| `mysql/schema_v1.1.1_migration_updates.sql` | Schema upgrade (required) |
| `mysql/schema_v1.1.2_optional.sql` | `reviewed_*` UPDATE (optional) |
| `mysql/scripts/backfill-leave-days.mjs` | Day-row (+ reviewed) backfill (required for old leaves) |