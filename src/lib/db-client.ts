/* eslint-disable @typescript-eslint/no-explicit-any */
// MySQL stand-in for the old Supabase client.
import { hash as hashPassword, compare as comparePassword } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getPool } from "@/lib/db";

export const SESSION_COOKIE = "clifsa_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

// Mirrors the old supabase.auth user object so dashboard pages did not need a rewrite.
export type AuthUser = {
    id: string;
    email?: string;
    user_metadata: {
        name?: string;
        full_name?: string;
        avatar_url?: string;
    };
};

type CookieToSet = {
    name: string;
    value: string;
    options?: {
        httpOnly?: boolean;
        path?: string;
        sameSite?: "lax" | "strict" | "none";
        secure?: boolean;
        maxAge?: number;
    };
};

export type CookieAdapter = {
    getAll: () => { name: string; value: string }[];
    setAll?: (cookies: CookieToSet[]) => void;
};

type QueryError = {message: string } | null;

function dbErrorMessage(err: unknown): string {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
    const message = err instanceof Error ? err.message : String(err);
    if (
        code === "ETIMEDOUT" ||
        code === "ECONNREFUSED" ||
        code === "ENOTFOUND" ||
        code === "EHOSTUNREACH" ||
        /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/i.test(message)
    ) {
        return "Cannot reach the MySQL database. Check that MySQL is running and DB_HOST/DB_PORT in .env are correct.";
    }
    return message;
}

function ident(name: string) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error(`Invalid identifier: ${name}`);
    }
    return `\`${name}\``;
}

function sessionSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
        throw new Error("SESSION_SECRET must be set and at least 16 characters long.");
    }
    return new TextEncoder().encode(secret);
}

function cookieOptions(maxAge = SESSION_MAX_AGE) {
    return {
        httpOnly: true,
        path: "/",
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        maxAge,
    };
}

function toUser(id: string, email?: string | null, name?: string | null): AuthUser {
    return {
        id,
        email: email || undefined,
        user_metadata: {
        name: name || undefined,
        full_name: name || undefined,
        avatar_url: "",
        },
    };
}

async function signSession(user: AuthUser) {
    return new SignJWT({ email: user.email || "", name: user.user_metadata.name || "" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_MAX_AGE}s`)
        .sign(sessionSecret());
}

async function readSession(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
     try {
        const { payload } = await jwtVerify(token, sessionSecret());
        if (!payload.sub) return null;
        return toUser(payload.sub, String(payload.email || ""), String(payload.name || ""));
    } catch {
        return null;
    }
}


class QueryBuilder {
    private table: string;
    private columns = "*";
    private filters: { sql: string; params: unknown[] }[] = [];
    private orderSql = "";
    private op: "select" | "insert" | "update" | "delete" = "select";
    private payload: Record<string, unknown> | null = null;

    constructor(table: string) {
        this.table = table;
    }

    select(cols: string) {
        this.columns = cols;
        this.op = "select";
        return this;
    }

    insert(row: Record<string, unknown>) {
        this.op = "insert";
        this.payload = row;
        return this;
    }

    update(row: Record<string, unknown>) {
        this.op = "update";
        this.payload = row;
        return this;
    }

    delete() {
        this.op = "delete";
        return this;
    }

    eq(column: string, value: unknown) {
        this.filters.push({ sql: `${ident(column)} = ?`, params: [value] });
        return this;
    }

    neq(column: string, value: unknown) {
        this.filters.push({ sql: `${ident(column)} <> ?`, params: [value] });
        return this;
    }

    gte(column: string, value: unknown) {
        this.filters.push({ sql: `${ident(column)} >= ?`, params: [value] });
        return this;
    }

    lte(column: string, value: unknown) {
        this.filters.push({ sql: `${ident(column)} <= ?`, params: [value] });
        return this;
    }

    order(column: string, opts?: { ascending?: boolean }) {
        this.orderSql = ` ORDER BY ${ident(column)} ${opts?.ascending === false ? "DESC" : "ASC"}`;
        return this;
    }

    then<TResult1 = { data: any; error: QueryError }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: QueryError }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async single(): Promise<{ data: any; error: QueryError }> {
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!row) return { data: null, error: { message: "Not found" } };
    return { data: row, error: null };
  }

  async maybeSingle(): Promise<{ data: any; error: QueryError }> {
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    const row = Array.isArray(res.data) ? res.data[0] ?? null : res.data;
    return { data: row, error: null };
  }

  private whereClause() {
    if (!this.filters.length) return { sql: "", params: [] as unknown[] };
    return {
      sql: ` WHERE ${this.filters.map((f) => f.sql).join(" AND ")}`,
      params: this.filters.flatMap((f) => f.params),
    };
  }

  private async execute(): Promise<{ data: any; error: QueryError }> {
    try {
      const pool = getPool();
      const where = this.whereClause();

      if (this.op === "select") {
        const cols =
          this.columns.trim() === "*"
            ? "*"
            : this.columns
                .split(",")
                .map((c) => ident(c.trim()))
                .join(", ");
        const sql = `SELECT ${cols} FROM ${ident(this.table)}${where.sql}${this.orderSql}`;
        const [rows] = await pool.query(sql, where.params);
        return { data: rows, error: null };
      }

      if (this.op === "insert") {
        const row = this.payload || {};
        const keys = Object.keys(row);
        const sql = `INSERT INTO ${ident(this.table)} (${keys.map(ident).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
        await pool.query(sql, keys.map((k) => row[k]));
        return { data: null, error: null };
      }

      if (this.op === "update") {
        const row = this.payload || {};
        const keys = Object.keys(row);
        const sql = `UPDATE ${ident(this.table)} SET ${keys.map((k) => `${ident(k)} = ?`).join(", ")}${where.sql}`;
        await pool.query(sql, [...keys.map((k) => row[k]), ...where.params]);
        return { data: null, error: null };
      }

      const sql = `DELETE FROM ${ident(this.table)}${where.sql}`;
      await pool.query(sql, where.params);
      return { data: null, error: null };
    } catch (err) {
      const message = dbErrorMessage(err);
      return { data: null, error: { message } };
    }
  }
}

export function createDbClient(cookies: CookieAdapter) {
    const setSessionCookie = (token: string, maxAge = SESSION_MAX_AGE) => {
        cookies.setAll?.([
            { name: SESSION_COOKIE, value: token, options: cookieOptions(maxAge) },
        ]);
    };

    const clearSessionCookie = () => {
        cookies.setAll?.([{ name: SESSION_COOKIE, value: "", options: cookieOptions(0) }]);
    }

    return {
        from(table: string) {
            return new QueryBuilder(table);
        },
        auth: {
            async getUser() {
                const token = cookies.getAll().find((c) => c.name === SESSION_COOKIE)?.value;
                const user = await readSession(token);
                return { data: { user }, error: null };
            },
            
            async signInWithPassword({ email, password }: { email: string; password: string }) {
                try {
                    const pool = getPool();
                    const [rows] = await pool.query(
                        "SELECT id, email, password_hash, name FROM users WHERE email = ? LIMIT 1",
                        [email],
                    );
                    const userRow = (rows as { id: string; email: string; password_hash: string; name: string | null }[])[0];
                    if (!userRow || !(await comparePassword(password, userRow.password_hash))) {
                        return { data: { user: null }, error: { message: "Invalid login credentials" }};
                    }
                    const user = toUser(userRow.id, userRow.email, userRow.name);
                    setSessionCookie(await signSession(user));
                    return { data: { user }, error: null };
                } catch (err) {
                    return { data: { user: null }, error: { message: dbErrorMessage(err) }};
                }
            },

            async signUp({ email, password, options, }: {
                email: string;
                password: string;
                options?: { data?: { name?: string } };
            }) {
                try {
                    const pool = getPool();
                    const conn = await pool.getConnection();
                    try {
                        const id = crypto.randomUUID();
                        const name = options?.data?.name || null;
                        const passwordHash = await hashPassword(password, 10);

                        await conn.beginTransaction();

                        const [countRows] = await conn.query("SELECT COUNT(*) AS cnt FROM users");
                        const isFirstUser = Number((countRows as { cnt: number }[])[0]?.cnt || 0) === 0;
                        const role = isFirstUser ? "admin" : "member";
                        const status = isFirstUser ? "approved" : "pending";

                        await conn.query(
                            "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
                            [id, email, passwordHash, name],
                        );
                        await conn.query(
                            "INSERT INTO profiles (id, email, name, role, status) VALUES (?, ?, ?, ?, ?)",
                            [id, email, name, role, status],
                        );

                        await conn.commit();

                        const user = toUser(id, email, name);
                        setSessionCookie(await signSession(user));
                        return { data: { user }, error: null };
                    } catch (err) {
                        try {
                            await conn.rollback();
                        } catch {
                            // Ignore rollback errors when the insert never started.
                        }
                        throw err;
                    } finally {
                        conn.release();
                    }
                } catch (err) {
                    const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
                    const message = code === "ER_DUP_ENTRY" ? "Email already in use" : dbErrorMessage(err);
                    return { data: { user: null }, error: { message }};
                }
            },

            async signOut() {
                clearSessionCookie();
                return { error: null };
            },

            async updateUser({ data }: { data?: { name?: string; full_name?: string } }) {
                try {
                    const token = cookies.getAll().find((c) => c.name === SESSION_COOKIE)?.value;
                    const current = await readSession(token);

                    if (!current) 
                        return { data: { user: null }, error: { message: "Unauthorized" }};

                    const name = data?.full_name || data?.name || current.user_metadata.name || null;
                    const pool = getPool();
                    await pool.query(
                        "UPDATE users SET name = ? WHERE id = ?",
                        [name, current.id]
                    );
                    await pool.query(
                        "UPDATE profiles SET name = ? WHERE id = ?",
                        [name, current.id]
                    );

                    const user = toUser(current.id, current.email, name);
                    setSessionCookie(await signSession(user));
                    return { data: { user }, error: null };
                } catch (err) {
                    return { data: { user: null }, error: { message: dbErrorMessage(err) }};
                }
            },

            admin: {
                async deleteUser(userId: string) {
                    try {
                        const pool = getPool();
                        // Delete the login row; profiles cascade via profiles_id_fk.
                        await pool.query("DELETE FROM users WHERE id = ?", [userId]);
                        return { error: null }; 
                    } catch (err) {
                        return { error: { message: dbErrorMessage(err) } };
                    }
                },
            },
        },
    };
}

export type DbClient = ReturnType<typeof createDbClient>;