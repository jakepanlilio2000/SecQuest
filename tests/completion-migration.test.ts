import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { db, migrate } from "../src/lib/db";
process.env.DATABASE_URL = "";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-preserve-notes-")),
  "old.sqlite",
);
test("migration 005 preserves every original table row including populated notebook text and history", async () => {
  const old = new DatabaseSync(process.env.SQLITE_PATH!);
  old.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("migrations")
    .filter((f) => /^00[1-4]_/.test(f))
    .sort()) {
    old.exec(readFileSync(join("migrations", file), "utf8"));
    old
      .prepare("INSERT INTO migrations VALUES (?,?)")
      .run(file.split("_")[0], "2026-01-01T00:00:00Z");
  }
  const owner = randomUUID(),
    id = randomUUID(),
    at = "2026-01-01T00:00:00Z";
  old
    .prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)")
    .run(
      owner,
      "existing@example.test",
      "Existing learner",
      "unchanged-hash",
      "learner",
      '{"dailyGoal":17}',
      at,
    );
  old
    .prepare(
      "INSERT INTO notebook_entries(id,user_id,title,body,study_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    )
    .run(
      id,
      owner,
      "Existing private title",
      "Existing personal writing",
      "/?view=notebook",
      at,
      at,
    );
  old.prepare("INSERT INTO notebook_entry_history VALUES (?,?,?,?)").run(
    id,
    1,
    JSON.stringify({
      title: "Existing private title",
      body: "Existing personal writing",
    }),
    at,
  );
  old
    .prepare("INSERT INTO xp_events VALUES (?,?,?,?)")
    .run(owner, "existing-award", 130, at);
  const hash = (v: unknown) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const tables = old
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as { name: string }[];
  const previous = new Map(
    tables.map((t) => [
      t.name,
      old.prepare(`SELECT * FROM ${t.name}`).all().map(hash),
    ]),
  );
  old.close();
  await migrate();
  await migrate();
  for (const [table, hashes] of previous) {
    const current = new Set(
      (await db().all(`SELECT * FROM ${table}`)).map(hash),
    );
    for (const h of hashes)
      assert.ok(current.has(h), `${table}: changed original row`);
  }
  assert.equal(
    (await db().all("SELECT version FROM migrations WHERE version='005'"))
      .length,
    1,
  );
});
