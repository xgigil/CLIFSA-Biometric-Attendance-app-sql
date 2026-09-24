import mysql from "mysql2/promise";

// Share MySQL pool. Replaces the old remote Supabase connection.
let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USERNAME;
    const database = process.env.DB_DATABASE;
    if (!host || !user || !database) {
      throw new Error("Missing MySQL environment variables (DB_HOST, DB_USERNAME, DB_DATABASE).");
    }
    pool = mysql.createPool({
      host,
      port: Number(process.env.DB_PORT || 3306),
      user,
      password: process.env.DB_PASSWORD || "",
      database,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 10000,
      dateStrings: true, // keep DATE/TIME as strings so attendance logic stays unchanged
    });
  }
  return pool;
}
