import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { questions } from "../content/questions";
import {
  ready,
  blueprint,
  validateQuestion,
  getQuestion,
} from "../src/lib/content";
import { db, first } from "../src/lib/db";
import { handle } from "../src/lib/api";
import {
  createAuthSession,
  createUser,
  hashPassword,
  verifyPassword,
} from "../src/lib/auth";
import {
  answer,
  readSession,
  sessionAction,
  startSession,
} from "../src/lib/engine";
import { overview } from "../src/lib/analytics";
import type { Question, Review } from "../src/lib/types";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-test-")),
  "test.sqlite",
);
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
const origin = "http://localhost:3000";
const password = "A long synthetic testing passphrase!";
let userId = "",
  token = "";
before(async () => {
  await ready();
  const u = await createUser("learner@example.test", "Test Learner", password);
  userId = u.id;
  token = await createAuthSession(u.id);
});
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  auth = token,
) {
  const res = await handle(
    new Request(origin + "/api/" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: auth ? `sq_session=${auth}` : "",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
  return { status: res.status, body: await res.json(), response: res };
}
const original = (id: string) => questions.find((q) => q.id === id)!;
function wrong(q: Question) {
  if (q.type === "ordering" || q.type === "matching")
    return [...q.correct].reverse();
  const invalid = q.options.find((o) => !q.correct.includes(o.id))!.id;
  return [invalid, ...q.correct.slice(0, q.correct.length - 1)];
}
test("seed contains 44 distinct complete original items over every objective", () => {
  assert.equal(questions.length, 44);
  assert.equal(new Set(questions.map((q) => q.prompt)).size, 44);
  for (const o of blueprint.objectives)
    assert.ok(
      questions.some((q) => q.objective === o.id),
      o.id,
    );
  for (const q of questions) {
    validateQuestion(q);
    assert.ok(q.examples.length >= 2);
    assert.ok(q.options.every((o) => o.explanation.length >= 15));
  }
});
test("blueprint weights, identifiers, and nested subtopics remain versioned", () => {
  assert.equal(
    blueprint.domains.reduce((n, d) => n + d.weight, 0),
    100,
  );
  assert.equal(blueprint.objectives.length, 27);
  assert.ok(blueprint.objectives.every((o) => o.subtopics.length > 0));
  assert.ok(
    blueprint.objectives
      .find((o) => o.id === "2.6")
      ?.subtopics.some((s) => s.text === "Prompt injection"),
  );
  assert.ok(
    blueprint.objectives.every((o) => !/[2-5]\.0 /.test(o.description)),
  );
});
test("invalid answer mappings, missing examples, and unknown sources fail validation", () => {
  assert.throws(() => validateQuestion({ ...questions[0], correct: ["Z"] }));
  assert.throws(() =>
    validateQuestion({ ...questions[0], sources: ["not-a-source"] }),
  );
  assert.throws(() => validateQuestion({ ...questions[0], examples: [] }));
});
test("password hashes use different random salts and verify correctly", async () => {
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.ok(await verifyPassword(password, a));
  assert.equal(await verifyPassword("wrong", a), false);
});
test("registration, login and HttpOnly cookie work; clients cannot select a role", async () => {
  const registered = await request(
    "auth/register",
    "POST",
    {
      email: "new@example.test",
      name: "New Learner",
      password,
      role: "system_admin",
    },
    "",
  );
  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.role, "learner");
  assert.match(registered.response.headers.get("set-cookie")!, /HttpOnly/);
  assert.ok(!("password_hash" in registered.body.user));
  assert.equal(
    (
      await request(
        "auth/login",
        "POST",
        { email: "new@example.test", password },
        "",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "auth/login",
        "POST",
        { email: "new@example.test", password: "an incorrect long password" },
        "",
      )
    ).status,
    401,
  );
});
test("API requires authentication and blocks cross-origin mutations", async () => {
  assert.equal((await request("overview", "GET", undefined, "")).status, 401);
  const r = await handle(
    new Request(origin + "/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
        Cookie: `sq_session=${token}`,
      },
      body: JSON.stringify({ mode: "learning", count: 10 }),
    }),
  );
  assert.equal(r.status, 403);
});
test("wrong answer persists, explains alternatives, repeats after 3–8 items, and retry is not first mastery", async () => {
  const s = await startSession(userId, "learning", { count: 20 });
  let state = await readSession(userId, s.id);
  assert.ok(!state.completed && state.item);
  const q = original(state.item!.question.id),
    missedId = q.id;
  const initial = await answer(
    userId,
    s.id,
    state.item!.id,
    wrong(q),
    "guessed",
  );
  assert.equal("correct" in initial && initial.correct, false);
  assert.ok(
    "question" in initial &&
      initial.question.options.every((o) => o.explanation),
  );
  assert.equal(
    (
      await first<Review>(
        db(),
        "SELECT * FROM review_schedules WHERE user_id=? AND question_id=?",
        [userId, q.id],
      )
    )?.lapses,
    1,
  );
  const retry = await first<{ position: number }>(
    db(),
    "SELECT position FROM session_items WHERE session_id=? AND question_id=? AND retry=1",
    [s.id, q.id],
  );
  assert.ok(retry && retry.position >= 4 && retry.position <= 9);
  state = await readSession(userId, s.id);
  assert.deepEqual(state.item?.selected, wrong(q));
  assert.equal(state.item?.feedback?.correct, false);
  for (let i = 0; i < retry!.position; i++) {
    await sessionAction(userId, s.id, "next");
    state = await readSession(userId, s.id);
    if (state.item?.question.id === missedId) break;
    await answer(
      userId,
      s.id,
      state.item!.id,
      original(state.item!.question.id).correct,
      "knew",
    );
  }
  assert.equal(state.item?.question.id, missedId);
  await answer(userId, s.id, state.item!.id, q.correct, "knew");
  const attempts = await db().all<{
    first_attempt: number;
    retry: number;
    retention: number;
  }>(
    "SELECT first_attempt,retry,retention FROM attempts WHERE user_id=? AND question_id=? ORDER BY created_at",
    [userId, q.id],
  );
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].first_attempt, 1);
  assert.equal(attempts[1].first_attempt, 0);
  assert.equal(attempts[1].retry, 1);
  assert.equal(attempts[1].retention, 0);
  const next = await first<Review>(
    db(),
    "SELECT * FROM review_schedules WHERE user_id=? AND question_id=?",
    [userId, q.id],
  );
  assert.equal(next?.interval_days, 1);
  assert.notEqual(next?.state, "retained");
});
test("simultaneous repeated answer submissions create one attempt and one reward", async () => {
  const s = await startSession(userId, "practice", {
    count: 1,
    objective: "5.4",
  });
  const state = await readSession(userId, s.id);
  const q = original(state.item!.question.id);
  await Promise.all([
    answer(userId, s.id, state.item!.id, q.correct, "knew"),
    answer(userId, s.id, state.item!.id, q.correct, "knew"),
  ]);
  assert.equal(
    Number(
      (
        await first<{ n: number }>(
          db(),
          "SELECT COUNT(*) AS n FROM attempts WHERE item_id=?",
          [state.item!.id],
        )
      )?.n,
    ),
    1,
  );
});
test("future sessions cannot farm first-answer XP for a previously encountered question", async () => {
  const before = (await overview(userId)).xp,
    s = await startSession(userId, "practice", { count: 1, objective: "5.4" }),
    st = await readSession(userId, s.id);
  await answer(
    userId,
    s.id,
    st.item!.id,
    original(st.item!.question.id).correct,
    "knew",
  );
  assert.equal((await overview(userId)).xp, before);
});
test("too-short sessions defer a wrong question and preserve its review schedule", async () => {
  const s = await startSession(userId, "practice", {
      count: 1,
      objective: "5.5",
    }),
    st = await readSession(userId, s.id);
  await answer(
    userId,
    s.id,
    st.item!.id,
    wrong(original(st.item!.question.id)),
    null,
  );
  assert.equal(
    Number(
      (
        await first<{ n: number }>(
          db(),
          "SELECT COUNT(*) AS n FROM session_items WHERE session_id=?",
          [s.id],
        )
      )?.n,
    ),
    1,
  );
  assert.ok(
    await first(
      db(),
      "SELECT question_id FROM review_schedules WHERE user_id=? AND question_id=?",
      [userId, st.item!.question.id],
    ),
  );
});
test("mock data never reveals answers; revisions are allowed only until final submission", async () => {
  const s = await startSession(userId, "mock", { count: 5 });
  let st = await readSession(userId, s.id);
  assert.equal(st.item!.feedback, null);
  const serialized = JSON.stringify(st);
  for (const key of [
    '"correct":',
    '"explanation":',
    '"definition":',
    '"examples":',
    '"sources":',
  ])
    assert.ok(!serialized.includes(key), key);
  const q = original(st.item!.question.id);
  await answer(userId, s.id, st.item!.id, wrong(q), null);
  await answer(userId, s.id, st.item!.id, q.correct, null);
  st = await readSession(userId, s.id);
  assert.deepEqual(st.item!.selected, q.correct);
  assert.equal(st.item!.feedback, null);
  await sessionAction(userId, s.id, "finish");
  const finished = await readSession(userId, s.id);
  assert.equal(finished.completed, true);
  assert.ok(finished.items?.every((i) => i.feedback));
  await assert.rejects(
    () => answer(userId, s.id, st.item!.id, wrong(q), null),
    /complete/,
  );
});
test("mock timer expires on the server and cannot be reset by refreshing", async () => {
  const s = await startSession(userId, "mock", { count: 2 });
  await db().transaction((tx) =>
    tx.run("UPDATE quiz_sessions SET expires_at=? WHERE id=?", [
      new Date(Date.now() - 1000).toISOString(),
      s.id,
    ]),
  );
  const st = await readSession(userId, s.id);
  assert.equal(st.completed, true);
  assert.equal(st.items?.length, 2);
  assert.ok(st.items?.every((i) => i.feedback?.correct === false));
});
test("learners cannot access other accounts sessions or content administration", async () => {
  const other = await createUser(
      "other@example.test",
      "Other Learner",
      password,
    ),
    s = await startSession(other.id, "learning", { count: 5 });
  await assert.rejects(() => readSession(userId, s.id), /not found/);
  assert.equal((await request("admin")).status, 403);
  assert.equal(
    (await request("admin/question", "POST", questions[0])).status,
    403,
  );
});
test("flashcards persist and reviews do not inflate exam attempt counts", async () => {
  const n = await first<{ n: number }>(
    db(),
    "SELECT COUNT(*) AS n FROM attempts WHERE user_id=?",
    [userId],
  );
  await request("flashcards", "POST", { questionId: "tls-confidentiality" });
  await request("flashcards", "POST", { questionId: "tls-confidentiality" });
  const cards = await request("flashcards");
  assert.equal(cards.body.cards.length, 1);
  assert.equal(
    (
      await request("flashcards/" + cards.body.cards[0].id, "POST", {
        rating: 2,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("flashcards/" + cards.body.cards[0].id, "POST", {
        rating: 2,
      })
    ).status,
    409,
  );
  assert.equal(
    Number(n?.n),
    Number(
      (
        await first<{ n: number }>(
          db(),
          "SELECT COUNT(*) AS n FROM attempts WHERE user_id=?",
          [userId],
        )
      )?.n,
    ),
  );
});
test("study plans persist with editable day notes", async () => {
  const plan = {
    targetDate: "2027-12-01",
    minutes: 25,
    days: [1, 3, 5],
    notes: { "2027-01-01": "Review identity" },
  };
  assert.equal((await request("plan", "POST", plan)).status, 200);
  assert.deepEqual((await request("plan")).body.plan, plan);
});
test("simulation grading is server-side and cannot repeatedly award XP", async () => {
  const a = {
    id: "firewall",
    selected: {
      "guest-web": "allow",
      "guest-payroll": "deny",
      "app-db": "allow",
      "internet-db": "deny",
      default: "deny",
    },
  };
  assert.equal(
    (await request("simulations", "POST", { ...a, score: 0 })).body.score,
    100,
  );
  const xp = (await overview(userId)).xp;
  await request("simulations", "POST", a);
  assert.equal((await overview(userId)).xp, xp);
});
test("administrator imports are atomic, new content is draft, and same-author approval is denied", async () => {
  const admin = await createUser("admin@example.test", "Editor", password);
  await db().transaction((tx) =>
    tx.run("UPDATE users SET role='system_admin' WHERE id=?", [admin.id]),
  );
  const adminToken = await createAuthSession(admin.id),
    a = {
      ...questions[0],
      id: "imported-question",
      prompt:
        "A synthetic import validation scenario asks which control protects encrypted transport confidentiality?",
    },
    invalid = { ...a, id: "invalid-import", correct: ["Z"] };
  assert.equal(
    (
      await request(
        "admin/import",
        "POST",
        { questions: [a, invalid] },
        adminToken,
      )
    ).status,
    400,
  );
  assert.equal(
    await first(db(), "SELECT id FROM questions WHERE id=?", [a.id]),
    undefined,
  );
  assert.equal(
    (await request("admin/import", "POST", { questions: [a] }, adminToken))
      .status,
    200,
  );
  assert.equal(
    (
      await first<{ status: string }>(
        db(),
        "SELECT status FROM questions WHERE id=?",
        [a.id],
      )
    )?.status,
    "draft",
  );
  assert.ok(
    !(await request("catalog?search=synthetic")).body.questions.some(
      (q: Question) => q.id === a.id,
    ),
  );
  assert.equal(
    (
      await request(
        "admin/status",
        "POST",
        {
          id: a.id,
          status: "under_review",
          note: "Editorial validation complete.",
        },
        adminToken,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "admin/status",
        "POST",
        {
          id: a.id,
          status: "approved",
          note: "Approve my own authored content.",
        },
        adminToken,
      )
    ).status,
    403,
  );
});
test("historical question revision is available independently of current publication", async () => {
  const q = original("tls-confidentiality"),
    old = await getQuestion(db(), q.id, 1);
  assert.equal(old.prompt, q.prompt);
});
test("analytics excludes retries from first encounters and never masters an unseen objective", async () => {
  const stats = await overview(userId),
    n = await first<{ n: number }>(
      db(),
      "SELECT COUNT(*) AS n FROM attempts WHERE user_id=? AND first_attempt=1",
      [userId],
    );
  assert.equal(stats.firstCount, Number(n?.n));
  assert.ok(
    stats.objectives.filter((o) => !o.evidence).every((o) => o.mastery === 0),
  );
  assert.ok(stats.retryCount > 0);
});
test("data export omits password hashes and deletion cascades only the account history", async () => {
  const u = await createUser(
      "delete@example.test",
      "Disposable Test",
      password,
    ),
    t = await createAuthSession(u.id),
    s = await startSession(u.id, "practice", { count: 1 }),
    ex = await request("profile/export", "GET", undefined, t);
  assert.equal(ex.status, 200);
  assert.ok(!JSON.stringify(ex.body).includes("password_hash"));
  assert.equal(
    (await request("profile", "DELETE", { password }, t)).status,
    200,
  );
  assert.equal(
    await first(db(), "SELECT id FROM users WHERE id=?", [u.id]),
    undefined,
  );
  assert.equal(
    await first(db(), "SELECT id FROM quiz_sessions WHERE id=?", [s.id]),
    undefined,
  );
  assert.equal((await request("auth/me", "GET", undefined, t)).status, 401);
  assert.ok(await first(db(), "SELECT id FROM questions LIMIT 1"));
});
