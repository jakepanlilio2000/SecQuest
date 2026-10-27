import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
if (!process.argv[2])
  throw Error(
    "Usage: node scripts/verify-preservation.mjs <backup.manifest.json>",
  );
if (process.env.DATABASE_URL?.startsWith("postgres"))
  throw Error("This verifier supports SQLite snapshots only.");
const manifestPath = resolve(process.argv[2]);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const backupMatchesManifest =
  createHash("sha256")
    .update(readFileSync(manifest.destination))
    .digest("hex") === manifest.sha256;
const source = resolve(process.env.SQLITE_PATH ?? manifest.source);
const database = new DatabaseSync(source, { readOnly: true });
const tables = [];
for (const [name, old] of Object.entries(manifest.tables)) {
  if (!/^[a-z_0-9]+$/i.test(name)) throw Error("Unexpected table identifier.");
  const rows = database.prepare(`SELECT * FROM ${name}`).all();
  const counts = new Map();
  for (const row of rows) {
    const hash = createHash("sha256").update(JSON.stringify(row)).digest("hex");
    counts.set(hash, (counts.get(hash) ?? 0) + 1);
  }
  let missing = 0;
  for (const hash of old.rowHashes) {
    const n = counts.get(hash) ?? 0;
    if (n) counts.set(hash, n - 1);
    else missing++;
  }
  tables.push({
    name,
    before: old.count,
    after: rows.length,
    missingOrChangedOriginalRows: missing,
  });
}
const integrityOk = database
  .prepare("PRAGMA integrity_check")
  .all()
  .every((r) => r.integrity_check === "ok");
const foreignKeyViolations = database
  .prepare("PRAGMA foreign_key_check")
  .all().length;
database.close();
const result = {
  verifiedAt: new Date().toISOString(),
  source,
  backup: manifest.destination,
  backupSha256: manifest.sha256,
  backupMatchesManifest,
  integrityOk,
  foreignKeyViolations,
  passed:
    backupMatchesManifest &&
    integrityOk &&
    foreignKeyViolations === 0 &&
    tables.every((t) => t.missingOrChangedOriginalRows === 0),
  tables,
};
writeFileSync(
  manifestPath + ".verification.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
