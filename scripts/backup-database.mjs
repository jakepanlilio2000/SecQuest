import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
if (process.env.DATABASE_URL?.startsWith("postgres"))
  throw Error("Use pg_dump for PostgreSQL; this utility backs up SQLite only.");
const source = resolve(process.env.SQLITE_PATH ?? "data/secquest.sqlite");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = resolve(
  process.argv[2] ?? `data/backups/pre-intelligence-${stamp}.sqlite`,
);
if (source === destination)
  throw Error("Backup destination must differ from the source.");
if (existsSync(destination) || existsSync(destination + ".manifest.json"))
  throw Error("Backup destination already exists; choose a new path.");
mkdirSync(dirname(destination), { recursive: true });
const connection = new DatabaseSync(source, { readOnly: true });
await backup(connection, destination);
connection.close();
const copy = new DatabaseSync(destination, { readOnly: true });
const tables = copy
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  .all();
const manifest = {
  source,
  destination,
  createdAt: new Date().toISOString(),
  sha256: createHash("sha256").update(readFileSync(destination)).digest("hex"),
  tables: {},
};
for (const { name } of tables) {
  if (!/^[a-z_0-9]+$/i.test(name)) throw Error("Unexpected table identifier.");
  const rows = copy.prepare(`SELECT * FROM ${name}`).all();
  manifest.tables[name] = {
    count: rows.length,
    rowHashes: rows
      .map((r) => createHash("sha256").update(JSON.stringify(r)).digest("hex"))
      .sort(),
  };
}
copy.close();
writeFileSync(
  destination + ".manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    backup: destination,
    sha256: manifest.sha256,
    tables: tables.length,
  }),
);
