import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// Companion to the strict verifier: explicitly report operational exceptions.
// Never use this to conceal changed learning evidence or notebook content.
const manifest = JSON.parse(readFileSync(process.argv[2], "utf8"));
const original = new DatabaseSync(manifest.destination, { readOnly: true });
const current = new DatabaseSync(
  resolve(process.env.SQLITE_PATH ?? manifest.source),
  { readOnly: true },
);
const hash = (row) =>
  createHash("sha256").update(JSON.stringify(row)).digest("hex");
const tables = [];
for (const name of Object.keys(manifest.tables)) {
  if (!/^[a-z_0-9]+$/i.test(name)) throw Error("Unexpected table identifier");
  const before = original.prepare(`SELECT * FROM ${name}`).all();
  const after = current.prepare(`SELECT * FROM ${name}`).all();
  const omitTimestamp = ({ evaluated_at: _timestamp, ...row }) => row;
  const normalize =
    name === "user_misconception_states" ? omitTimestamp : (row) => row;
  const hashes = new Map();
  for (const row of after) {
    const key = hash(normalize(row));
    hashes.set(key, (hashes.get(key) ?? 0) + 1);
  }
  let changed = 0;
  for (const row of before) {
    const key = hash(normalize(row));
    const count = hashes.get(key) ?? 0;
    if (count) hashes.set(key, count - 1);
    else changed++;
  }
  tables.push({
    name,
    before: before.length,
    after: after.length,
    missingOrChangedOriginalRows: changed,
    exception:
      name === "rate_limits"
        ? "Operational throttle counters may expire/change during live requests; excluded from learning preservation acceptance."
        : name === "user_misconception_states"
          ? "Only evaluated_at omitted; all owner IDs, definition IDs and stored finding JSON compared."
          : null,
  });
}
const integrityOk = current
  .prepare("PRAGMA integrity_check")
  .all()
  .every((r) => r.integrity_check === "ok");
const foreignKeyViolations = current
  .prepare("PRAGMA foreign_key_check")
  .all().length;
const backupMatchesManifest =
  createHash("sha256")
    .update(readFileSync(manifest.destination))
    .digest("hex") === manifest.sha256;
const result = {
  verifiedAt: new Date().toISOString(),
  backupSha256: manifest.sha256,
  backupMatchesManifest,
  integrityOk,
  foreignKeyViolations,
  learningAndContentPreserved:
    backupMatchesManifest &&
    integrityOk &&
    foreignKeyViolations === 0 &&
    tables
      .filter((t) => t.name !== "rate_limits")
      .every((t) => t.missingOrChangedOriginalRows === 0),
  tables,
};
original.close();
current.close();
writeFileSync(
  "data/qa/completion-preservation-audit.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
if (!result.learningAndContentPreserved) process.exitCode = 1;
