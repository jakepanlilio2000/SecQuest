import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Pool, type PoolClient } from "pg";
type Params = (string | number | null)[];
export interface Database {
  all<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T[]>;
  run(sql: string, params?: Params): Promise<number>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
}
class Postgres implements Database {
  constructor(
    private pool: Pool,
    private client?: PoolClient,
  ) {}
  async all<T>(sql: string, params: Params = []): Promise<T[]> {
    let n = 0;
    return (
      await (this.client ?? this.pool).query(
        sql.replace(/\?/g, () => `$${++n}`),
        params,
      )
    ).rows;
  }
  async run(sql: string, params: Params = []) {
    let n = 0;
    return (
      (
        await (this.client ?? this.pool).query(
          sql.replace(/\?/g, () => `$${++n}`),
          params,
        )
      ).rowCount ?? 0
    );
  }
  async transaction<T>(fn: (db: Database) => Promise<T>) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const result = await fn(new Postgres(this.pool, c));
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}
class Sqlite implements Database {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private connection: DatabaseSync,
    private nested = false,
  ) {}
  async all<T>(sql: string, params: Params = []): Promise<T[]> {
    return this.connection.prepare(sql).all(...params) as T[];
  }
  async run(sql: string, params: Params = []) {
    return Number(this.connection.prepare(sql).run(...params).changes);
  }
  async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
    if (this.nested) return fn(this);
    const task = this.queue.then(async () => {
      this.connection.exec("BEGIN IMMEDIATE");
      try {
        const r = await fn(new Sqlite(this.connection, true));
        this.connection.exec("COMMIT");
        return r;
      } catch (e) {
        this.connection.exec("ROLLBACK");
        throw e;
      }
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
const globalDb = globalThis as unknown as { secquestDb?: Database };
export function db(): Database {
  if (globalDb.secquestDb) return globalDb.secquestDb;
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("postgres"))
    globalDb.secquestDb = new Postgres(
      new Pool({ connectionString: url, max: 10 }),
    );
  else {
    const file =
      process.env.SQLITE_PATH ?? join(process.cwd(), "data", "secquest.sqlite");
    mkdirSync(dirname(file), { recursive: true });
    const c = new DatabaseSync(file);
    c.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    globalDb.secquestDb = new Sqlite(c);
  }
  return globalDb.secquestDb;
}
export async function migrate(database = db()) {
  await database.transaction(async (tx) => {
    if (process.env.DATABASE_URL?.startsWith("postgres"))
      await tx.run("SELECT pg_advisory_xact_lock(726301)");
    await tx.run(
      "CREATE TABLE IF NOT EXISTS migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    for (const file of readdirSync(join(process.cwd(), "migrations"))
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort()) {
      const version = file.split("_")[0];
      if (
        (
          await tx.all("SELECT version FROM migrations WHERE version=?", [
            version,
          ])
        ).length
      )
        continue;
      const sql = readFileSync(join(process.cwd(), "migrations", file), "utf8");
      for (const s of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.run(s);
      await tx.run("INSERT INTO migrations(version,applied_at) VALUES (?,?)", [
        version,
        new Date().toISOString(),
      ]);
    }
  });
}
export const first = async <T>(
  database: Database,
  sql: string,
  params: Params = [],
) => (await database.all<T>(sql, params))[0];
