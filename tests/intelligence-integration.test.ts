import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { questions } from "../content/questions";
import {
  concepts,
  relationships,
  distractorMappings,
  policy,
} from "../content/intelligence";
import {
  ready,
  blueprint,
  saveRevision,
  fingerprint,
} from "../src/lib/content";
import { db, first } from "../src/lib/db";
import { createUser, createAuthSession } from "../src/lib/auth";
import { startSession, readSession, answer } from "../src/lib/engine";
import { handle } from "../src/lib/api";
import { backfillEvidence, findingsFor } from "../src/lib/misconceptions";
import {
  forecastQuestion,
  snapshotForecasts,
  recordForecastOutcome,
  forecastEvaluation,
} from "../src/lib/retention-forecast";
import { intelligenceFor } from "../src/lib/intelligence";
import type { Attempt, Review } from "../src/lib/types";
process.env.DATABASE_URL = "";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-upgrade-")),
  "test.sqlite",
);
const password = "An isolated upgrade test passphrase!";
let user = "",
  token = "",
  other = "",
  otherToken = "",
  adminToken = "";
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  auth = token,
) {
  const response = await handle(
    new Request("http://localhost:3000/api/" + path, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: auth ? `sq_session=${auth}` : "",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
  return { status: response.status, body: await response.json() };
}
const count = async (table: string, owner = user) =>
  Number(
    (
      await first<{ n: number }>(
        db(),
        `SELECT COUNT(*) n FROM ${table} WHERE user_id=?`,
        [owner],
      )
    )?.n ?? 0,
  );
async function submit(qid: string, selected: string[]) {
  const s = await startSession(user, "practice", {
    count: 1,
    questionIds: [qid],
  });
  const state = await readSession(user, s.id);
  await answer(user, s.id, state.item!.id, selected, "knew");
  return (await first<Attempt>(
    db(),
    "SELECT * FROM attempts WHERE session_id=?",
    [s.id],
  ))!;
}
before(async () => {
  // Start at the actual pre-upgrade schema and populate progress BEFORE migration 004.
  const old = new DatabaseSync(process.env.SQLITE_PATH!);
  old.exec("PRAGMA foreign_keys=ON");
  for (const file of readdirSync("migrations")
    .filter((f) => /^00[1-3]_/.test(f))
    .sort()) {
    old.exec(readFileSync(join("migrations", file), "utf8"));
    old
      .prepare("INSERT INTO migrations VALUES (?,?)")
      .run(file.split("_")[0], "2026-01-01T00:00:00Z");
  }
  old.close();
  const q = questions[0],
    stamp = "2026-01-01T00:00:00Z";
  await db().run("INSERT INTO content_sources VALUES (?,?)", [
    "legacy-source",
    JSON.stringify({ name: "Preserved reference" }),
  ]);
  await db().run("INSERT INTO exam_versions VALUES (?,?,?)", [
    blueprint.code,
    blueprint.revision,
    JSON.stringify(blueprint),
  ]);
  const domain = blueprint.domains.find(
    (d) => String(d.number) === q.objective[0],
  )!;
  await db().run("INSERT INTO domains VALUES (?,?,?,?,?)", [
    `SY0-801:${domain.number}`,
    blueprint.code,
    domain.number,
    domain.name,
    domain.weight,
  ]);
  await db().run("INSERT INTO objectives VALUES (?,?,?,?,?)", [
    `SY0-801:${q.objective}`,
    `SY0-801:${domain.number}`,
    "Preserved objective",
    "[]",
    "legacy-source",
  ]);
  await db().run("INSERT INTO questions VALUES (?,?,?,?,?)", [
    q.id,
    q.revision,
    "published",
    fingerprint(q.prompt),
    stamp,
  ]);
  await saveRevision(db(), q, "original-seed");
  user = (
    await createUser("upgrade@example.test", "Existing learner", password)
  ).id;
  await db().run("UPDATE users SET settings=? WHERE id=?", [
    '{"theme":"light","dailyGoal":17}',
    user,
  ]);
  await db().run(
    "INSERT INTO quiz_sessions(id,user_id,mode,settings,status,created_at,completed_at) VALUES (?,?,?,?,?,?,?)",
    ["legacy-session", user, "practice", "{}", "completed", stamp, stamp],
  );
  await db().run(
    "INSERT INTO session_items(id,session_id,question_id,revision,position,selected,answered_at) VALUES (?,?,?,?,?,?,?)",
    [
      "legacy-item",
      "legacy-session",
      q.id,
      q.revision,
      0,
      JSON.stringify(q.correct),
      stamp,
    ],
  );
  await db().run(
    "INSERT INTO attempts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      "legacy-attempt",
      user,
      "legacy-session",
      "legacy-item",
      q.id,
      q.revision,
      JSON.stringify(q.correct),
      1,
      1,
      0,
      0,
      "knew",
      1234,
      stamp,
      q.objective,
      q.difficulty,
      q.concept,
    ],
  );
  await db().run("INSERT INTO review_schedules VALUES (?,?,?,?,?,?,?,?,?,?)", [
    user,
    q.id,
    "2026-12-01T00:00:00Z",
    7,
    2.5,
    3,
    0,
    1,
    stamp,
    "retained",
  ]);
  await db().run("INSERT INTO xp_events VALUES (?,?,?,?)", [
    user,
    "legacy-reward",
    125,
    stamp,
  ]);
  await db().run("INSERT INTO user_achievements VALUES (?,?,?)", [
    user,
    "first-steps",
    stamp,
  ]);
  const tables = (
    await db().all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
  ).map((r) => r.name);
  const hash = (r: unknown) =>
    createHash("sha256").update(JSON.stringify(r)).digest("hex");
  const previous = new Map<string, string[]>();
  for (const t of tables)
    previous.set(t, (await db().all(`SELECT * FROM ${t}`)).map(hash));
  await ready();
  for (const [t, hashes] of previous) {
    const current = new Set((await db().all(`SELECT * FROM ${t}`)).map(hash));
    for (const h of hashes)
      assert.ok(current.has(h), `Migration changed an existing row in ${t}`);
  }
  assert.equal(await count("attempts"), 1);
  assert.equal(await count("xp_events"), 1);
  token = await createAuthSession(user);
  other = (await createUser("private@example.test", "Other learner", password))
    .id;
  otherToken = await createAuthSession(other);
  const admin = await createUser(
    "upgrade-admin@example.test",
    "Admin",
    password,
  );
  await db().run("UPDATE users SET role='system_admin' WHERE id=?", [admin.id]);
  adminToken = await createAuthSession(admin.id);
});
test("additive migration preserves populated original rows and backfill never alters progress", async () => {
  const before = await db().all(
    "SELECT * FROM attempts WHERE id='legacy-attempt'",
  );
  const schedule = await db().all(
    "SELECT * FROM review_schedules WHERE user_id=?",
    [user],
  );
  await backfillEvidence(user);
  await backfillEvidence(user);
  assert.deepEqual(
    await db().all("SELECT * FROM attempts WHERE id='legacy-attempt'"),
    before,
  );
  assert.deepEqual(
    await db().all("SELECT * FROM review_schedules WHERE user_id=?", [user]),
    schedule,
  );
  assert.equal(await count("intelligence_processed_attempts"), 1);
});
test("notebooks reject cross-account reads, writes, history, folder assignment and exports", async () => {
  const input = {
    id: randomUUID(),
    mutationId: randomUUID(),
    expectedRevision: 0,
    title: "Private cryptography",
    body: "PRIVATE-SENTINEL",
    tags: ["Exam", "exam"],
    pinned: true,
    conceptId: "hashing",
    objective: "1.3",
  };
  const saved = await request("notebook/entries", "POST", input);
  assert.equal(saved.status, 200);
  const id = saved.body.entry.id;
  assert.equal(
    (await request(`notebook/entries/${id}`, "GET", undefined, otherToken))
      .status,
    404,
  );
  assert.equal(
    (
      await request(
        `notebook/entries/${id}/history`,
        "GET",
        undefined,
        otherToken,
      )
    ).status,
    404,
  );
  assert.equal(
    (await request(`notebook/entries/${id}`, "DELETE", {}, otherToken)).status,
    404,
  );
  assert.equal(
    (
      await request(
        "notebook/entries",
        "POST",
        { ...input, mutationId: randomUUID() },
        otherToken,
      )
    ).status,
    404,
  );
  const folders = (await request("notebook")).body.folders;
  assert.equal(
    (
      await request(
        "notebook/entries",
        "POST",
        {
          ...input,
          id: randomUUID(),
          mutationId: randomUUID(),
          notebookId: folders[0].id,
        },
        otherToken,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        "notebook?search=PRIVATE-SENTINEL",
        "GET",
        undefined,
        otherToken,
      )
    ).body.total,
    0,
  );
  assert.doesNotMatch(
    JSON.stringify(
      (await request("notebook/export", "GET", undefined, otherToken)).body,
    ),
    /PRIVATE-SENTINEL/,
  );
  assert.equal(
    (await request("notebook?search=exam&pinned=true")).body.total,
    1,
  );
  assert.equal((await request("notebook", "GET", undefined, "")).status, 401);
});
test("autosave retries are idempotent and concurrent stale writes cannot overwrite a newer revision", async () => {
  const input = {
    id: randomUUID(),
    mutationId: randomUUID(),
    expectedRevision: 0,
    title: "Concurrent note",
    body: "Original",
  };
  const [a, b] = await Promise.all([
    request("notebook/entries", "POST", input),
    request("notebook/entries", "POST", input),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.deepEqual(a.body, b.body);
  const edit = {
    ...input,
    mutationId: randomUUID(),
    expectedRevision: 1,
    body: "New server copy",
  };
  assert.equal((await request("notebook/entries", "POST", edit)).status, 200);
  const stale = await request("notebook/entries", "POST", {
    ...edit,
    mutationId: randomUUID(),
    body: "Stale tab",
  });
  assert.equal(stale.status, 409);
  assert.equal(
    (await request(`notebook/entries/${input.id}`)).body.entry.body,
    "New server copy",
  );
  assert.equal(
    (await request(`notebook/entries/${input.id}/history`)).body.history.length,
    2,
  );
  assert.equal(
    (
      await request("notebook/entries", "POST", {
        ...edit,
        body: "Reused mutation",
      })
    ).status,
    409,
  );
});
test("misconception evidence flows through practice, comparison notes, prerequisite paths, and existing review queue", async () => {
  await submit("control-detective", ["A"]);
  let f = (await findingsFor(user)).find(
    (f) => f.definition.id === "detect-prevent",
  )!;
  assert.equal(f.status, "Insufficient evidence");
  await submit("ids-ips", ["B"]);
  f = (await findingsFor(user)).find(
    (f) => f.definition.id === "detect-prevent",
  )!;
  assert.equal(f.status, "Possible misconception");
  assert.equal(f.distinctMistakes, 2);
  const explanation = await request("notebook/context", "POST", {
    questionId: "control-detective",
    revision: 1,
    kind: "explanation",
  });
  assert.equal(explanation.status, 200);
  assert.match(
    explanation.body.entry.body,
    /## Definition[\s\S]*## Explanation/,
  );
  assert.ok(JSON.parse(explanation.body.entry.source_refs).length > 0);
  const before = await count("xp_events");
  const note = await request("notebook/context", "POST", {
    kind: "comparison",
    misconceptionId: "detect-prevent",
  });
  assert.equal(note.status, 200);
  assert.match(note.body.entry.body, /IDS|Detective/);
  const edited = { ...note.body.entry };
  await request("notebook/entries", "POST", {
    id: edited.id,
    mutationId: randomUUID(),
    expectedRevision: 1,
    title: edited.title,
    body: "My own explanation",
    conceptId: edited.concept_id,
  });
  const repeat = await request("notebook/context", "POST", {
    kind: "comparison",
    misconceptionId: "detect-prevent",
  });
  assert.equal(repeat.body.entry.id, edited.id);
  assert.equal(repeat.body.entry.body, "My own explanation");
  assert.ok(
    (await request("notebook?focus=gaps")).body.entries.some(
      (e: { id: string }) => e.id === edited.id,
    ),
  );
  assert.equal(
    (await request("notebook?focus=gaps", "GET", undefined, otherToken)).body
      .total,
    0,
  );
  await db().run(
    "UPDATE review_schedules SET due_at=? WHERE user_id=? AND question_id=?",
    ["2026-01-01T00:00:00Z", user, "control-detective"],
  );
  assert.ok(
    (await request("notebook?focus=due")).body.entries.some(
      (e: { id: string }) => e.id === edited.id,
    ),
  );
  const path = await request("intelligence/path?concept=pki");
  assert.equal(path.status, 200);
  assert.equal(path.body.path.at(-1).concept.id, "pki");
  const schedules = await db().all<Review>(
    "SELECT * FROM review_schedules WHERE user_id=?",
    [user],
  );
  assert.equal(
    (
      await request("intelligence/review", "POST", {
        misconceptionId: "detect-prevent",
      })
    ).status,
    200,
  );
  for (const row of schedules)
    assert.ok(
      (await first<Review>(
        db(),
        "SELECT * FROM review_schedules WHERE user_id=? AND question_id=?",
        [user, row.question_id],
      ))!.due_at <= row.due_at,
    );
  assert.equal(await count("xp_events"), before);
  assert.equal(
    (
      await request("intelligence/practice", "POST", {
        misconceptionId: "detect-prevent",
        count: 2,
      })
    ).status,
    201,
  );
  const q = questions.find((q) => q.id === "ids-ips")!;
  await submit(q.id, q.correct);
  assert.equal(
    (await findingsFor(user)).find((f) => f.definition.id === "detect-prevent")!
      .status,
    "Improving",
  );
});
test("unmapped distractors stay unmapped; mock drafts and unlicensed explanations cannot be copied", async () => {
  const newAttempt = await submit("tls-confidentiality", ["D"]);
  const unmapped = await first<{ unmapped: number }>(
    db(),
    "SELECT unmapped FROM intelligence_processed_attempts WHERE attempt_id=?",
    [newAttempt.id],
  );
  assert.equal(unmapped?.unmapped, 1);
  const mock = await startSession(other, "mock", {
    count: 1,
    questionIds: ["password-salting"],
  });
  const state = await readSession(other, mock.id);
  await answer(other, mock.id, state.item!.id, ["A"], "knew");
  assert.equal(
    (
      await request(
        "notebook/context",
        "POST",
        { questionId: "password-salting", revision: 1, kind: "explanation" },
        otherToken,
      )
    ).status,
    403,
  );
  const mockReference = await request(
    "notebook/context",
    "POST",
    { questionId: "password-salting", revision: 1, kind: "reference" },
    otherToken,
  );
  assert.equal(mockReference.status, 200);
  assert.doesNotMatch(
    mockReference.body.entry.body,
    /## Explanation|Salt makes/,
  );
  await db().run(
    "UPDATE question_notebook_policy SET copy_allowed=0 WHERE question_id='tls-confidentiality'",
  );
  assert.equal(
    (
      await request("notebook/context", "POST", {
        questionId: "tls-confidentiality",
        revision: 1,
        kind: "explanation",
      })
    ).status,
    403,
  );
  const ref = await request("notebook/context", "POST", {
    questionId: "tls-confidentiality",
    revision: 1,
    kind: "reference",
  });
  assert.equal(ref.status, 200);
  assert.equal(ref.body.entry.question_revision, 1);
  assert.doesNotMatch(ref.body.entry.body, /TLS protects/);
});
test("Trash, restoration, provenance export and note operations do not award learning progress", async () => {
  const progress = [
    await count("attempts"),
    await count("xp_events"),
    await count("review_schedules"),
  ];
  const note = await request("notebook/context", "POST", {
    conceptId: "encryption",
    kind: "reference",
  });
  const id = note.body.entry.id;
  assert.equal(
    (await request(`notebook/entries/${id}`, "DELETE", {})).status,
    200,
  );
  assert.ok(
    (await request("notebook?trash=true")).body.entries.some(
      (e: { id: string }) => e.id === id,
    ),
  );
  const again = await request("notebook/context", "POST", {
    conceptId: "encryption",
    kind: "reference",
  });
  assert.equal(again.body.entry.id, id);
  assert.ok(again.body.entry.deleted_at);
  assert.equal(
    (await request(`notebook/entries/${id}/restore`, "POST", {})).body.entry
      .deleted_at,
    null,
  );
  const exported = await request("notebook/export");
  assert.match(exported.body.markdown, /Study link: \/\?view=knowledge-map/);
  assert.ok(
    exported.body.data.entries.some((e: { id: string }) => e.id === id),
  );
  assert.deepEqual(
    [
      await count("attempts"),
      await count("xp_events"),
      await count("review_schedules"),
    ],
    progress,
  );
});
test("admin imports reject cycles and correct-option mappings atomically; learners cannot administer", async () => {
  assert.equal((await request("admin/intelligence")).status, 403);
  const edge = relationships.find((e) => e.kind === "prerequisite")!;
  const version = (await first<{ version: number }>(
    db(),
    "SELECT MAX(version) version FROM intelligence_content_versions",
  ))!.version;
  assert.equal(
    (
      await request(
        "admin/intelligence",
        "POST",
        {
          relationships: [
            {
              ...edge,
              id: "cycle",
              sourceId: edge.targetId,
              targetId: edge.sourceId,
            },
          ],
        },
        adminToken,
      )
    ).status,
    400,
  );
  const q = questions.find((q) => q.id === "tls-confidentiality")!;
  assert.equal(
    (
      await request(
        "admin/intelligence",
        "POST",
        {
          distractorMappings: [
            { ...distractorMappings[0], optionId: q.correct[0] },
          ],
        },
        adminToken,
      )
    ).status,
    400,
  );
  assert.equal(
    (await first<{ version: number }>(
      db(),
      "SELECT MAX(version) version FROM intelligence_content_versions",
    ))!.version,
    version,
  );
});
test("mapping edits preserve old evidence and backfill only one current version per attempt", async () => {
  const attemptsBefore = await db().all("SELECT * FROM attempts ORDER BY id");
  const evidenceBefore = await count("misconception_evidence");
  const m = distractorMappings.find((m) => m.questionId === "ids-ips")!;
  assert.equal(
    (
      await request(
        "admin/intelligence",
        "POST",
        { distractorMappings: [{ ...m, status: "draft" }] },
        adminToken,
      )
    ).status,
    200,
  );
  await backfillEvidence(user);
  const after = await count("misconception_evidence");
  assert.ok(after >= evidenceBefore);
  await backfillEvidence(user);
  assert.equal(await count("misconception_evidence"), after);
  assert.equal(
    (await findingsFor(user)).find((f) => f.definition.id === "detect-prevent")!
      .distinctMistakes,
    1,
  );
  assert.deepEqual(
    await db().all("SELECT * FROM attempts ORDER BY id"),
    attemptsBefore,
  );
});
test("forecast evaluation uses only later independent outcomes, versions and deduplicates snapshots", async () => {
  const attempt = (await first<Attempt>(
    db(),
    "SELECT * FROM attempts WHERE user_id=? AND question_id=? ORDER BY created_at DESC LIMIT 1",
    [user, "ids-ips"],
  ))!;
  const review = (await first<Review>(
    db(),
    "SELECT * FROM review_schedules WHERE user_id=? AND question_id=?",
    [user, attempt.question_id],
  ))!;
  const time = new Date("2026-10-29T00:00:00Z");
  const history = [1, 2, 3].map((n) => ({
    ...attempt,
    id: String(n),
    correct: 1,
    confidence: "knew" as const,
    retention: 1,
    created_at: `2026-10-${20 + n}T00:00:00Z`,
  }));
  const f = forecastQuestion(
    { id: attempt.question_id, concept: attempt.concept },
    history,
    { ...review, interval_days: 7 },
    [],
    policy,
    [],
    time,
  );
  await snapshotForecasts(user, [f], db(), time);
  await snapshotForecasts(user, [f], db(), time);
  assert.equal(await count("forecast_snapshots"), 1);
  await db().transaction((tx) =>
    recordForecastOutcome(
      tx,
      { ...attempt, retention: 1, created_at: time.toISOString() },
      review.last_at,
    ),
  );
  assert.equal(await count("forecast_evaluations"), 0);
  const outcome = {
    ...attempt,
    retention: 1,
    created_at: "2026-10-30T00:00:00Z",
  };
  await db().transaction((tx) =>
    recordForecastOutcome(tx, outcome, review.last_at),
  );
  await db().transaction((tx) =>
    recordForecastOutcome(tx, outcome, review.last_at),
  );
  assert.equal(await count("forecast_evaluations"), 1);
  const evals = await forecastEvaluation(user);
  assert.equal(evals[0].samples, 1);
  assert.equal(evals[0].status, "Not yet calibrated");
  assert.ok(evals[0].brierScore !== null);
  const intel = await intelligenceFor(other);
  assert.equal(intel.notes.length, 1);
  assert.equal(intel.notes[0].question_id, "password-salting");
  assert.ok(intel.forecasts.every((f) => f.probability === null));
});
test("reviewers cannot edit, content admins cannot change model parameters, and policy versions are immutable", async () => {
  await db().run("UPDATE users SET role='reviewer' WHERE id=?", [other]);
  assert.equal(
    (await request("admin/intelligence", "GET", undefined, otherToken)).status,
    200,
  );
  assert.equal(
    (
      await request(
        "admin/intelligence",
        "POST",
        { concepts: [concepts[0]] },
        otherToken,
      )
    ).status,
    403,
  );
  await db().run("UPDATE users SET role='content_admin' WHERE id=?", [other]);
  const next = { ...policy, version: "intelligence-test-v2", halfLifeDays: 50 };
  assert.equal(
    (await request("admin/intelligence", "POST", { policy: next }, otherToken))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        "admin/intelligence",
        "POST",
        { policy: { ...next, possibleDistinct: 1 } },
        adminToken,
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("admin/intelligence", "POST", { policy: next }, adminToken))
      .status,
    200,
  );
  assert.equal(
    (
      await request(
        "admin/intelligence",
        "POST",
        { policy: { ...next, halfLifeDays: 60 } },
        adminToken,
      )
    ).status,
    409,
  );
  assert.equal(
    JSON.parse(
      (await first<{ data: string }>(
        db(),
        "SELECT data FROM intelligence_policies WHERE version=?",
        [next.version],
      ))!.data,
    ).halfLifeDays,
    50,
  );
  assert.ok(
    await first(
      db(),
      "SELECT version FROM intelligence_policies WHERE version=?",
      [policy.version],
    ),
  );
});
test("account deletion cascades private notebook records and leaves other accounts and global graph intact", async () => {
  const note = await request(
    "notebook/context",
    "POST",
    { conceptId: "hashing", kind: "reference" },
    otherToken,
  );
  assert.equal(note.status, 200);
  assert.equal(
    (await request("profile", "DELETE", { password }, otherToken)).status,
    200,
  );
  for (const table of [
    "notebook_entries",
    "notebooks",
    "notebook_tags",
    "notebook_mutations",
    "user_misconception_states",
    "forecast_snapshots",
    "forecast_evaluations",
    "misconception_evidence",
  ])
    assert.equal(await count(table, other), 0, table);
  assert.ok((await count("notebook_entries")) > 0);
  assert.equal(
    (await db().all("SELECT id FROM security_concepts")).length,
    concepts.length,
  );
});
