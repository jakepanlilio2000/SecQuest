import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { questions } from "../content/questions";
import {
  blueprint,
  fingerprint,
  getQuestion,
  published,
  ready,
  saveRevision,
  validateQuestion,
} from "../src/lib/content";
import { db } from "../src/lib/db";
import { createAuthSession, createUser } from "../src/lib/auth";
import { handle } from "../src/lib/api";
import { answer, readSession, startSession } from "../src/lib/engine";
import { overview } from "../src/lib/analytics";
import { intelligenceFor } from "../src/lib/intelligence";
import type { Question } from "../src/lib/types";

process.env.DATABASE_URL = "";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-exam-boundaries-")),
  "synthetic.sqlite",
);
const foreignExam = "SYNTHETIC-EXAM-B";
const fixture = (id: string): Question => ({
  ...questions[0],
  id,
  revision: 1,
  concept: id,
  prompt: `${questions[0].prompt} Boundaryfixture marker ${id}.`,
});
const local = fixture("boundary-local");
const foreign = fixture("boundary-foreign");
const sixth = { ...fixture("boundary-sixth"), objective: "6.1" };
const mixed = fixture("boundary-mixed");
const unlinked = fixture("boundary-unlinked");
let user: string, token: string;
async function request(path: string, data?: unknown) {
  return handle(
    new Request(`http://localhost:3000/api/${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: `sq_session=${token}`,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
  );
}
async function addQuestion(q: Question, exam: string) {
  await db().transaction(async (tx) => {
    await tx.run(
      "INSERT INTO questions(id,current_revision,status,fingerprint,created_at) VALUES (?,?,?,?,?)",
      [q.id, q.revision, "published", fingerprint(q.prompt), "2026-01-01"],
    );
    await saveRevision(tx, q, "synthetic-fixture", exam);
  });
}
// Used only with the disposable fixture. Never interpolate user-supplied names.
async function snapshot() {
  const tables = await db().all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'rate_limits' ORDER BY name",
  );
  return Promise.all(
    tables.map(async ({ name }) => [
      name,
      (await db().all(`SELECT * FROM ${name}`))
        .map((row) => JSON.stringify(row))
        .sort(),
    ]),
  );
}
before(async () => {
  await ready();
  const learner = await createUser(
    "boundaries@example.test",
    "Synthetic boundary learner",
    "Synthetic exam boundary testing passphrase!",
  );
  user = learner.id;
  await db().run("UPDATE users SET role='content_admin' WHERE id=?", [user]);
  token = await createAuthSession(user);
  await db().transaction(async (tx) => {
    await tx.run(
      "INSERT INTO exam_versions(code,revision,data) VALUES (?,?,?)",
      [foreignExam, "synthetic", JSON.stringify({ code: foreignExam })],
    );
    await tx.run("INSERT INTO content_sources(id,data) VALUES (?,?)", [
      "synthetic-boundary-source",
      "{}",
    ]);
    for (const domain of [Number(foreign.objective.split(".")[0]), 6])
      await tx.run("INSERT INTO domains VALUES (?,?,?,?,?)", [
        `${foreignExam}:${domain}`,
        foreignExam,
        domain,
        "Synthetic domain, not exam content",
        50,
      ]);
    for (const objective of [foreign.objective, "6.1"])
      await tx.run("INSERT INTO objectives VALUES (?,?,?,?,?)", [
        `${foreignExam}:${objective}`,
        `${foreignExam}:${objective.split(".")[0]}`,
        "Synthetic objective, not exam content",
        "[]",
        "synthetic-boundary-source",
      ]);
  });
  for (const q of [local, mixed, unlinked])
    await addQuestion(q, blueprint.code);
  for (const q of [foreign, sixth]) await addQuestion(q, foreignExam);
  // Deliberately malformed ownership fixtures: never repair/guess their exam.
  await db().run("INSERT INTO question_objectives VALUES (?,?,?)", [
    mixed.id,
    1,
    `${foreignExam}:${mixed.objective}`,
  ]);
  await db().run("DELETE FROM question_objectives WHERE question_id=?", [
    unlinked.id,
  ]);
});

test("objective syntax permits six domains but membership requires the selected tree", () => {
  const tree = {
    objectives: [{ ...blueprint.objectives[0], id: "6.1" }],
  };
  assert.equal(validateQuestion(sixth, tree).objective, "6.1");
  assert.throws(() => validateQuestion(sixth), /Unknown objective/);
  assert.throws(() => validateQuestion(foreign, tree), /Unknown objective/);
  assert.throws(() => validateQuestion({ ...sixth, objective: "6.2" }, tree));
});

test("published repositories separate identical objective numbers and exclude ambiguous identities without writes", async () => {
  const beforeRead = await snapshot();
  const current = await published();
  assert.equal(current.length, questions.length + 1);
  assert.ok(current.some((q) => q.id === local.id));
  assert.deepEqual(
    (await published(db(), foreignExam)).map((q) => q.id).sort(),
    [foreign.id, sixth.id].sort(),
  );
  assert.deepEqual(await published(db(), "UNKNOWN-EXAM"), []);
  assert.deepEqual(await snapshot(), beforeRead);
});

test("catalog, library, forecasts, flashcard creation and bank count stay in the legacy workspace", async () => {
  const response = await request("catalog?search=boundaryfixture&domain=1");
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.equal(catalog.total, 1);
  assert.deepEqual(
    catalog.questions.map((q: Question) => q.id),
    [local.id],
  );
  const knowledge = await (await request("knowledge")).json();
  assert.ok(
    knowledge.terms.some((t: { term: string }) => t.term === local.concept),
  );
  assert.ok(
    !knowledge.terms.some((t: { term: string }) => t.term === foreign.concept),
  );
  const tutor = await (
    await request("tutor", { query: foreign.concept })
  ).json();
  assert.ok(
    !tutor.concepts.some((c: { term: string }) => c.term === foreign.concept),
  );
  const card = await request("flashcards", { questionId: foreign.id });
  assert.equal(card.status, 400);
  assert.deepEqual(await db().all("SELECT * FROM flashcards"), []);
  assert.equal((await overview(user)).totalQuestions, questions.length + 1);

  // Even an old schedule must not reintroduce a foreign item into forecasts.
  await db().run("INSERT INTO review_schedules VALUES (?,?,?,?,?,?,?,?,?,?)", [
    user,
    foreign.id,
    "2026-01-01",
    1,
    2.5,
    1,
    0,
    0,
    "2026-01-01",
    "review",
  ]);
  const intelligence = await intelligenceFor(user, { snapshot: false });
  assert.ok(intelligence.availableQuestions.some((q) => q.id === local.id));
  for (const id of [foreign.id, sixth.id, mixed.id, unlinked.id]) {
    assert.ok(!intelligence.availableQuestions.some((q) => q.id === id));
    assert.ok(!intelligence.forecasts.some((f) => f.questionId === id));
  }
});

test("every session mode selects only current-exam questions and foreign explicit requests write nothing", async () => {
  for (const mode of [
    "learning",
    "practice",
    "recovery",
    "daily",
    "mock",
    "challenge",
  ] as const) {
    const session = await startSession(user, mode, { count: 90 });
    const items = await db().all<{ question_id: string }>(
      "SELECT question_id FROM session_items WHERE session_id=?",
      [session.id],
    );
    assert.equal(items.length, questions.length + 1);
    assert.ok(
      items.every(
        (i) =>
          ![foreign.id, sixth.id, mixed.id, unlinked.id].includes(
            i.question_id,
          ),
      ),
    );
    assert.equal(
      JSON.parse((await readSession(user, session.id)).session.settings).exam,
      blueprint.code,
    );
  }
  const beforeFailure = await snapshot();
  await assert.rejects(
    startSession(user, "practice", { count: 1, questionIds: [foreign.id] }),
    /No published questions/,
  );
  assert.deepEqual(await snapshot(), beforeFailure);
});

test("revision ownership rejects moves and missing links atomically while existing sessions retain immutable revisions", async () => {
  const beforeFailure = await snapshot();
  const response = await request("admin/question", {
    ...foreign,
    revision: 2,
    prompt: foreign.prompt + " Synthetic edit attempt.",
  });
  assert.equal(response.status, 409);
  for (const q of [mixed, unlinked])
    await assert.rejects(
      db().transaction((tx) =>
        saveRevision(tx, { ...q, revision: 2 }, "synthetic", blueprint.code),
      ),
      /cannot move between exams/,
    );
  await assert.rejects(
    db().transaction((tx) =>
      saveRevision(
        tx,
        { ...local, revision: 2, objective: "6.1" },
        "synthetic",
      ),
    ),
    /Unknown objective/,
  );
  await assert.rejects(
    db().transaction((tx) =>
      saveRevision(tx, { ...local, revision: 2 }, "synthetic", foreignExam),
    ),
    /cannot move between exams/,
  );
  assert.deepEqual(await snapshot(), beforeFailure);

  const session = await startSession(user, "practice", {
    count: 1,
    questionIds: [local.id],
  });
  const state = await readSession(user, session.id);
  await answer(user, session.id, state.item!.id, local.correct, "knew");
  const oldAttempt = await db().all(
    "SELECT * FROM attempts WHERE session_id=?",
    [session.id],
  );
  const oldSchedule = await db().all(
    "SELECT * FROM review_schedules WHERE question_id=?",
    [local.id],
  );
  await db().transaction(async (tx) => {
    await saveRevision(
      tx,
      {
        ...local,
        revision: 2,
        prompt: local.prompt + " Later synthetic revision.",
      },
      "synthetic",
    );
    await tx.run("UPDATE questions SET current_revision=2 WHERE id=?", [
      local.id,
    ]);
  });
  assert.deepEqual(await getQuestion(db(), local.id, 1), local);
  assert.equal((await getQuestion(db(), local.id, 2)).revision, 2);
  assert.deepEqual(
    await db().all("SELECT * FROM attempts WHERE session_id=?", [session.id]),
    oldAttempt,
  );
  assert.deepEqual(
    await db().all("SELECT * FROM review_schedules WHERE question_id=?", [
      local.id,
    ]),
    oldSchedule,
  );
  assert.equal(
    (
      await db().all<{ revision: number }>(
        "SELECT revision FROM session_items WHERE session_id=?",
        [session.id],
      )
    )[0].revision,
    1,
  );
  assert.deepEqual(await db().all("PRAGMA foreign_key_check"), []);
});
