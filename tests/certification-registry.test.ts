import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db, migrate } from "../src/lib/db";
import {
  certificationRegistry,
  eligibleForNewStudy,
  seedCertificationRegistry,
} from "../src/lib/certifications";

process.env.DATABASE_URL = "";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-registry-")),
  "synthetic-v5.sqlite",
);

test("registry upgrade and repeated seed preserve populated v5 records and revision identities", async () => {
  const old = new DatabaseSync(process.env.SQLITE_PATH!);
  old.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("migrations")
    .filter((f) => /^00[1-5]_/.test(f))
    .sort()) {
    old.exec(readFileSync(join("migrations", file), "utf8"));
    old
      .prepare("INSERT INTO migrations VALUES (?,?)")
      .run(file.split("_")[0], "2026-01-01");
  }
  const insert = (table: string, row: Record<string, string | number | null>) =>
    old
      .prepare(
        `INSERT INTO ${table}(${Object.keys(row).join(",")}) VALUES (${Object.keys(
          row,
        )
          .map(() => "?")
          .join(",")})`,
      )
      .run(...Object.values(row));
  const at = "2026-01-01T00:00:00Z";
  insert("users", {
    id: "owner",
    email: "owner@example.test",
    name: "Synthetic learner",
    password_hash: "synthetic-hash",
    role: "learner",
    settings: '{"exam":"SY0-801","dailyGoal":17}',
    created_at: at,
  });
  insert("auth_sessions", {
    token_hash: "synthetic-token-hash",
    user_id: "owner",
    expires_at: "2027-01-01",
  });
  insert("content_sources", { id: "synthetic-source", data: "{}" });
  insert("exam_versions", {
    code: "SY0-801",
    revision: "custom-existing",
    data: '{"code":"SY0-801","custom":true}',
  });
  insert("blueprint_revisions", {
    exam_code: "SY0-801",
    revision: "custom-existing",
    data: "{}",
    created_at: at,
  });
  insert("domains", {
    id: "SY0-801:1",
    exam_code: "SY0-801",
    number: 1,
    name: "Existing domain",
    weight: 16,
  });
  insert("objectives", {
    id: "SY0-801:1.1",
    domain_id: "SY0-801:1",
    description: "Existing objective",
    subtopics: "[]",
    source_id: "synthetic-source",
  });
  insert("questions", {
    id: "existing-item",
    current_revision: 2,
    status: "published",
    fingerprint: "synthetic-fingerprint",
    created_at: at,
  });
  for (const revision of [1, 2]) {
    insert("question_revisions", {
      question_id: "existing-item",
      revision,
      content: JSON.stringify({ revision, original: true }),
      created_by: "existing-editor",
      created_at: at,
    });
    insert("question_objectives", {
      question_id: "existing-item",
      revision,
      objective_id: "SY0-801:1.1",
    });
  }
  insert("quiz_sessions", {
    id: "saved",
    user_id: "owner",
    mode: "learning",
    settings: '{"exam":"SY0-801","blueprintRevision":"custom-existing"}',
    status: "active",
    created_at: at,
  });
  insert("session_items", {
    id: "item",
    session_id: "saved",
    question_id: "existing-item",
    revision: 1,
    position: 0,
    selected: '["A"]',
    answered_at: at,
  });
  insert("attempts", {
    id: "answer",
    user_id: "owner",
    session_id: "saved",
    item_id: "item",
    question_id: "existing-item",
    revision: 1,
    selected: '["A"]',
    correct: 0,
    first_attempt: 1,
    retry: 0,
    retention: 0,
    confidence: "unsure",
    duration_ms: 1000,
    created_at: at,
    objective: "1.1",
    difficulty: "easy",
    concept: "Synthetic concept",
  });
  insert("review_schedules", {
    user_id: "owner",
    question_id: "existing-item",
    due_at: "2026-02-01",
    interval_days: 1,
    ease: 2.5,
    repetitions: 0,
    lapses: 1,
    retained: 0,
    last_at: at,
    state: "relearning",
  });
  insert("notebook_entries", {
    id: "note",
    user_id: "owner",
    title: "Synthetic note",
    body: "Synthetic existing writing",
    study_url: "/?view=notebook",
    question_id: "existing-item",
    question_revision: 1,
    revision: 2,
    created_at: at,
    updated_at: at,
  });
  insert("notebook_entry_history", {
    entry_id: "note",
    revision: 1,
    data: '{"body":"Synthetic earlier writing"}',
    saved_at: at,
  });
  insert("flashcards", {
    id: "card",
    user_id: "owner",
    question_id: "existing-item",
    front: "Synthetic front",
    back: "Synthetic back",
    objective: "1.1",
    due_at: "2026-02-01",
  });
  insert("study_plans", {
    user_id: "owner",
    data: '{"days":[1,3,5]}',
    updated_at: at,
  });
  insert("xp_events", {
    user_id: "owner",
    event_key: "existing",
    amount: 40,
    created_at: at,
  });
  const tables = old
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'migrations'",
    )
    .all() as { name: string }[];
  const canonical = (rows: unknown[]) =>
    rows.map((r) => JSON.stringify(r)).sort();
  const originalMigrations = canonical(
    old.prepare("SELECT * FROM migrations").all(),
  );
  const before = new Map(
    tables.map(({ name }) => [
      name,
      canonical(old.prepare(`SELECT * FROM ${name}`).all()),
    ]),
  );
  old.close();

  for (let i = 0; i < 2; i++) {
    await migrate();
    await db().transaction(seedCertificationRegistry);
  }
  for (const [name, rows] of before)
    assert.deepEqual(
      canonical(await db().all(`SELECT * FROM ${name}`)),
      rows,
      `${name}: original rows changed`,
    );
  assert.deepEqual(await db().all("PRAGMA foreign_key_check"), []);
  const migrated = canonical(await db().all("SELECT * FROM migrations"));
  assert.equal(migrated.length, originalMigrations.length + 1);
  for (const row of originalMigrations) assert.ok(migrated.includes(row));
  assert.equal(
    (await db().all("SELECT version FROM migrations WHERE version='006'"))
      .length,
    1,
  );
  const catalog = await certificationRegistry();
  assert.equal(catalog.length, 5);
  assert.ok(catalog.every((e) => !e.eligibleForNewStudy));
  const legacy = catalog.find((e) => e.code === "SY0-801")!;
  assert.equal(legacy.linkedExamCode, "SY0-801");
  assert.equal(legacy.bankStatus, "legacy-starter");
  assert.equal(legacy.availability, "upcoming");
  const cores = catalog.filter((e) => e.certificationId === "a-plus");
  assert.deepEqual(
    cores.map((e) => [e.code, e.generationId, e.requiredExams, e.position]),
    [
      ["220-1201", "a-plus-v15", 2, 1],
      ["220-1202", "a-plus-v15", 2, 2],
    ],
  );
});

test("seed never overwrites operator catalog decisions or links unsupported legacy codes", async () => {
  await db().run(
    "UPDATE certification_exams SET availability='retired',checked_on='2026-01-02' WHERE code='N10-009'",
  );
  await db().run(
    "INSERT INTO exam_versions(code,revision,data) VALUES ('UNKNOWN-EXAM','1','{}')",
  );
  await db().transaction(seedCertificationRegistry);
  const network = (await certificationRegistry()).find(
    (e) => e.code === "N10-009",
  )!;
  assert.equal(network.availability, "retired");
  assert.equal(network.checkedOn, "2026-01-02");
  assert.equal(network.linkedExamCode, null);
  assert.equal(
    (
      await db().all(
        "SELECT * FROM exam_catalog_links WHERE exam_code='UNKNOWN-EXAM'",
      )
    ).length,
    0,
  );
});

test("new-study gate requires availability, reviewed bank, verified objectives and identical exam link", async () => {
  const template = (await certificationRegistry())[0];
  const approved = {
    ...template,
    availability: "available" as const,
    bankStatus: "reviewed" as const,
    objectivesVerified: 1,
    linkedExamCode: template.code,
  };
  assert.ok(eligibleForNewStudy(approved));
  for (const availability of [
    "upcoming",
    "retiring",
    "retired",
    "unverified",
  ] as const)
    assert.equal(eligibleForNewStudy({ ...approved, availability }), false);
  for (const bankStatus of ["unavailable", "legacy-starter"] as const)
    assert.equal(eligibleForNewStudy({ ...approved, bankStatus }), false);
  assert.equal(
    eligibleForNewStudy({ ...approved, objectivesVerified: 0 }),
    false,
  );
  assert.equal(
    eligibleForNewStudy({ ...approved, linkedExamCode: null }),
    false,
  );
  assert.equal(
    eligibleForNewStudy({ ...approved, linkedExamCode: "DIFFERENT-EXAM" }),
    false,
  );
});

test("database rejects relabeling legacy history, missing generations and duplicate A+ core positions", async () => {
  await assert.rejects(
    db().run(
      "UPDATE exam_catalog_links SET catalog_code='SY0-701' WHERE exam_code='SY0-801'",
    ),
  );
  await assert.rejects(
    db().run(
      "UPDATE certification_exams SET generation_id='missing' WHERE code='220-1201'",
    ),
  );
  await assert.rejects(
    db().run("UPDATE certification_exams SET position=1 WHERE code='220-1202'"),
  );
  const links = await db().all(
    "SELECT exam_code,catalog_code FROM exam_catalog_links",
  );
  assert.deepEqual(
    links.map((row) => ({ ...row })),
    [{ exam_code: "SY0-801", catalog_code: "SY0-801" }],
  );
});
