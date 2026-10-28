import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ready } from "../src/lib/content";
import { db, first } from "../src/lib/db";
import { createUser, createAuthSession, hashToken } from "../src/lib/auth";
import { handle } from "../src/lib/api";
import {
  startSession,
  readSession,
  answer,
  sessionAction,
} from "../src/lib/engine";
import { questions } from "../content/questions";
import { overview } from "../src/lib/analytics";
import {
  issueVerification,
  consumeVerification,
  verificationStatus,
} from "../src/lib/email-verification";
import { learningInsights, wilsonInterval } from "../src/lib/learning-insights";
import { progressionFor, weekStart } from "../src/lib/progression";
import type { Attempt, Review } from "../src/lib/types";
import { defaultReviewPolicy } from "../src/lib/scheduler";
import { duplicateCandidates } from "../src/lib/content-similarity";
import { simulations } from "../content/simulations";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-completion-")),
  "test.sqlite",
);
process.env.DATABASE_URL = "";
process.env.SMTP_URL = "";
const password = "A synthetic completion test passphrase!";
before(async () => {
  await ready();
});
async function learner() {
  const u = await createUser(
    `${randomUUID()}@example.test`,
    "Local Learner",
    password,
  );
  return { ...u, token: await createAuthSession(u.id) };
}
async function req(
  token: string,
  path: string,
  method = "GET",
  data?: unknown,
) {
  const r = await handle(
    new Request(`http://localhost:3000/api/${path}`, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: `sq_session=${token}`,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
  return { status: r.status, body: await r.json() };
}
async function submit(
  user: string,
  qid: string,
  correct = true,
  finish = false,
) {
  const q = questions.find((q) => q.id === qid)!;
  const s = await startSession(user, "practice", {
    count: 1,
    questionIds: [qid],
  });
  const state = await readSession(user, s.id);
  const selected = correct
    ? q.correct
    : q.type === "matching" || q.type === "ordering"
      ? [...q.correct].reverse()
      : [
          q.options.find((o) => !q.correct.includes(o.id))!.id,
          ...q.correct.slice(1),
        ];
  const result = await answer(user, s.id, state.item!.id, selected, "knew");
  if (finish) await sessionAction(user, s.id, "finish");
  return result;
}
async function xp(user: string) {
  return Number(
    (await first<{ n: number }>(
      db(),
      "SELECT COALESCE(SUM(amount),0) n FROM xp_events WHERE user_id=?",
      [user],
    ))!.n,
  );
}
test("failed delayed retrieval keeps real failure evidence but cannot earn retention XP or recovery achievement", async () => {
  const u = await learner();
  await submit(u.id, "tls-confidentiality", false);
  await db().run("INSERT INTO xp_events VALUES (?,?,?,?)", [
    u.id,
    "historical-preserved",
    7,
    new Date().toISOString(),
  ]);
  const before = await xp(u.id);
  const old = new Date(Date.now() - 2 * 86400000).toISOString();
  await db().run("UPDATE review_schedules SET last_at=? WHERE user_id=?", [
    old,
    u.id,
  ]);
  await submit(u.id, "tls-confidentiality", false);
  assert.equal(await xp(u.id), before);
  assert.equal(
    (
      await db().all<Attempt>(
        "SELECT * FROM attempts WHERE user_id=? AND retention=1 AND correct=0",
        [u.id],
      )
    ).length,
    1,
  );
  assert.equal(
    await first(
      db(),
      "SELECT * FROM user_achievements WHERE user_id=? AND achievement_id='mistake-breaker'",
      [u.id],
    ),
    undefined,
  );
  await db().run("UPDATE review_schedules SET last_at=? WHERE user_id=?", [
    old,
    u.id,
  ]);
  await submit(u.id, "tls-confidentiality", true);
  assert.equal(await xp(u.id), before + 20);
  assert.ok(
    await first(
      db(),
      "SELECT * FROM user_achievements WHERE user_id=? AND achievement_id='mistake-breaker'",
      [u.id],
    ),
  );
});
test("readiness requires five successful delayed retrievals instead of five failures", async () => {
  const u = await learner();
  for (const q of questions.slice(0, 32)) await submit(u.id, q.id, true);
  const mock = await startSession(u.id, "mock", { count: 1 });
  await sessionAction(u.id, mock.id, "finish");
  const rows = await db().all<Attempt>(
    "SELECT * FROM attempts WHERE user_id=? LIMIT 5",
    [u.id],
  );
  for (const a of rows)
    await db().run("UPDATE attempts SET retention=1,correct=0 WHERE id=?", [
      a.id,
    ]);
  assert.equal((await overview(u.id)).readiness.score, null);
  for (const a of rows)
    await db().run("UPDATE attempts SET correct=1 WHERE id=?", [a.id]);
  assert.notEqual((await overview(u.id)).readiness.score, null);
});
test("weekly missions are observed, private, week-bounded and award once under concurrent claims", async () => {
  const u = await learner(),
    other = await learner();
  for (const q of questions.slice(0, 5)) await submit(u.id, q.id);
  assert.equal(
    (await progressionFor(u.id)).missions.find((m) => m.id === "explore")!
      .value,
    5,
  );
  const before = await xp(u.id);
  const [a, b] = await Promise.all([
    req(u.token, "progression/claim", "POST", { mission: "explore" }),
    req(u.token, "progression/claim", "POST", { mission: "explore" }),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.awarded + b.body.awarded, 25);
  assert.equal(await xp(u.id), before + 25);
  assert.equal(
    (
      await req(other.token, "progression/claim", "POST", {
        mission: "explore",
      })
    ).status,
    409,
  );
  const future = new Date(Date.now() + 14 * 86400000);
  assert.equal((await progressionFor(u.id, db(), future)).missions[0].value, 0);
  assert.equal(
    weekStart(new Date("2026-10-28T17:00:00Z")),
    "2026-10-26T00:00:00.000Z",
  );
});
test("expanded achievements persist from distinct questions and do not award merely for reading progression", async () => {
  const u = await learner();
  const domainQuestions = [1, 2, 3, 4, 5].map((n) =>
    questions.find((q) => q.objective.startsWith(String(n)))!,
  );
  const batch = [
    ...new Map(
      [...domainQuestions, ...questions].map((q) => [q.id, q]),
    ).values(),
  ].slice(0, 10);
  for (const q of batch) await submit(u.id, q.id, true, true);
  const state = await overview(u.id);
  assert.ok(state.achievements.find((a) => a.id === "curious-mind")!.earnedAt);
  assert.ok(
    state.achievements.find((a) => a.id === "domain-explorer")!.earnedAt,
  );
  const before = await xp(u.id);
  await req(u.token, "progression");
  await req(u.token, "overview");
  assert.equal(await xp(u.id), before);
});
test("notebook restoration appends history, rejects stale/foreign writes and recall card saves deduplicate", async () => {
  const u = await learner(),
    other = await learner();
  const input = {
    id: randomUUID(),
    mutationId: randomUUID(),
    expectedRevision: 0,
    title: "Original private note",
    body: "Original personal explanation",
    tags: ["exam tip"],
  };
  const before = await xp(u.id);
  assert.equal(
    (await req(u.token, "notebook/entries", "POST", input)).status,
    200,
  );
  await req(u.token, "notebook/entries", "POST", {
    ...input,
    mutationId: randomUUID(),
    expectedRevision: 1,
    body: "Changed personal explanation",
  });
  assert.equal(
    (
      await req(
        other.token,
        `notebook/entries/${input.id}/restore-revision`,
        "POST",
        { revision: 1, expectedRevision: 2, mutationId: randomUUID() },
      )
    ).status,
    404,
  );
  const mutationId = randomUUID();
  const restored = await req(
    u.token,
    `notebook/entries/${input.id}/restore-revision`,
    "POST",
    { revision: 1, expectedRevision: 2, mutationId },
  );
  assert.equal(restored.status, 200);
  assert.equal(restored.body.entry.revision, 3);
  assert.equal(restored.body.entry.body, input.body);
  assert.deepEqual(restored.body.entry.tags, ["exam tip"]);
  assert.equal(
    (
      await req(
        u.token,
        `notebook/entries/${input.id}/restore-revision`,
        "POST",
        { revision: 1, expectedRevision: 2, mutationId },
      )
    ).body.entry.revision,
    3,
  );
  assert.equal(
    (
      await req(
        u.token,
        `notebook/entries/${input.id}/restore-revision`,
        "POST",
        { revision: 2, expectedRevision: 2, mutationId: randomUUID() },
      )
    ).status,
    409,
  );
  const card = { front: "What is the control?", back: "My explanation" };
  const [a, b] = await Promise.all([
    req(u.token, `notebook/entries/${input.id}/flashcard`, "POST", card),
    req(u.token, `notebook/entries/${input.id}/flashcard`, "POST", card),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.card.id, b.body.card.id);
  assert.equal(
    (
      await req(
        other.token,
        `notebook/entries/${input.id}/flashcard`,
        "POST",
        card,
      )
    ).status,
    404,
  );
  assert.equal((await req(u.token, "flashcards")).body.cards.length, 1);
  assert.equal(await xp(u.id), before);
  assert.equal(
    (await req(u.token, `notebook/entries/${input.id}/history`)).body.history
      .length,
    3,
  );
});
test("email verification tokens are hashed, expire, cannot be replayed, and leave existing access intact", async () => {
  const u = await learner(),
    other = await learner();
  const token = await issueVerification(u.id);
  const row = await first<{ token_hash: string }>(
    db(),
    "SELECT * FROM email_verification_tokens WHERE user_id=?",
    [u.id],
  );
  assert.equal(row!.token_hash, hashToken(token));
  assert.notEqual(row!.token_hash, token);
  const results = await Promise.allSettled([
    consumeVerification(token),
    consumeVerification(token),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok((await verificationStatus(u.id)).verifiedAt);
  assert.equal((await verificationStatus(other.id)).verifiedAt, null);
  const expired = await issueVerification(
    other.id,
    db(),
    new Date(Date.now() - 2 * 86400000),
  );
  await assert.rejects(
    () => consumeVerification(expired),
    /invalid or expired/,
  );
  assert.equal(
    (await req(other.token, "verification", "POST", {})).status,
    503,
  );
  assert.equal((await req(other.token, "overview")).status, 200);
  const exported = await req(u.token, "profile/export");
  assert.doesNotMatch(JSON.stringify(exported.body), new RegExp(token));
  assert.ok(exported.body.email_verifications.length === 1);
});
test("learner board is opt-in, hides owner IDs/email/notes and removes an opted-out entry", async () => {
  const u = await learner();
  assert.equal(
    (await req(u.token, "progression/leaderboard")).body.entries.length,
    0,
  );
  await req(u.token, "progression/leaderboard", "POST", {
    enabled: true,
    alias: "Chosen public alias",
  });
  const board = await req(u.token, "progression/leaderboard");
  assert.equal(board.body.entries.length, 1);
  assert.equal(board.body.entries[0].alias, "Chosen public alias");
  assert.notEqual(board.body.entries[0].id, u.id);
  assert.doesNotMatch(JSON.stringify(board.body), new RegExp(u.email));
  await req(u.token, "progression/leaderboard", "POST", {
    enabled: false,
    alias: "Chosen public alias",
  });
  assert.equal(
    (await req(u.token, "progression/leaderboard")).body.entries.length,
    0,
  );
});
test("accent unlocks are enforced by server XP and preferences persist without a reward", async () => {
  const u = await learner();
  const settings = {
    ...JSON.parse(u.settings),
    accent: "forest",
    sounds: true,
  };
  assert.equal(
    (await req(u.token, "profile", "PATCH", { name: u.name, settings })).status,
    403,
  );
  await db().run("INSERT INTO xp_events VALUES (?,?,?,?)", [
    u.id,
    "test-earned-activity",
    150,
    new Date().toISOString(),
  ]);
  const r = await req(u.token, "profile", "PATCH", { name: u.name, settings });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.settings.accent, "forest");
  assert.equal(r.body.user.settings.sounds, true);
  assert.equal(await xp(u.id), 150);
});
test("four-week summaries never fabricate scores and elapsed-time insights exclude retries", () => {
  assert.equal(wilsonInterval(0, 0), null);
  assert.deepEqual(wilsonInterval(5, 10), {
    lower: 24,
    upper: 76,
    samples: 10,
  });
  const now = new Date("2026-10-28T12:00:00Z");
  const base = {
    question_id: "q",
    objective: "1.3",
    created_at: now.toISOString(),
    first_attempt: 1,
    correct: 1,
    duration_ms: 10000,
    retention: 0,
  } as Attempt;
  const result = learningInsights(
    [base, { ...base, id: "retry", first_attempt: 0, duration_ms: 900000 }],
    now,
  );
  assert.equal(result.weeks[0].firstAccuracy, null);
  assert.equal(result.weeks[3].attempts, 2);
  assert.equal(result.weeks[3].firsts, 1);
  assert.equal(result.objectives[0].samples, 1);
  assert.equal(result.objectives[0].medianSeconds, 10);
});
test("account deletion cascades new private verification, note-card and sharing records", async () => {
  const u = await learner();
  await issueVerification(u.id);
  await req(u.token, "progression/leaderboard", "POST", {
    enabled: true,
    alias: "Disposable alias",
  });
  assert.equal(
    (await req(u.token, "profile", "DELETE", { password })).status,
    200,
  );
  for (const table of [
    "email_verification_tokens",
    "email_verifications",
    "notebook_flashcards",
    "leaderboard_preferences",
  ])
    assert.equal(
      (await db().all(`SELECT * FROM ${table} WHERE user_id=?`, [u.id])).length,
      0,
    );
});
test("new review policy versions are role restricted, immutable and snapshotted without rescheduling old records", async () => {
  const u = await learner(),
    admin = await learner();
  await db().run("UPDATE users SET role='system_admin' WHERE id=?", [admin.id]);
  const oldSession = await startSession(u.id, "practice", {
    count: 1,
    questionIds: ["tls-confidentiality"],
  });
  await submit(u.id, "rpo");
  const before = await db().all<Review>(
    "SELECT * FROM review_schedules WHERE user_id=?",
    [u.id],
  );
  const policy = {
    ...defaultReviewPolicy,
    version: "operator-reviewed-v2",
    intervals: [2, 4, 8, 16],
  };
  assert.equal(
    (await req(u.token, "admin/review-policy", "POST", policy)).status,
    403,
  );
  assert.equal(
    (
      await req(admin.token, "admin/review-policy", "POST", {
        ...policy,
        intervals: [2, 1, 8, 16],
      })
    ).status,
    400,
  );
  assert.equal(
    (await req(admin.token, "admin/review-policy", "POST", policy)).status,
    200,
  );
  assert.deepEqual(
    await db().all("SELECT * FROM review_schedules WHERE user_id=?", [u.id]),
    before,
  );
  assert.equal(
    (await req(admin.token, "admin/review-policy", "POST", policy)).status,
    409,
  );
  assert.equal(
    (await req(admin.token, "admin/review-policy", "POST", defaultReviewPolicy))
      .status,
    409,
  );
  const state = await readSession(u.id, oldSession.id);
  await answer(
    u.id,
    oldSession.id,
    state.item!.id,
    questions.find((q) => q.id === "tls-confidentiality")!.correct,
    "knew",
  );
  assert.equal(
    (await first<Review>(
      db(),
      "SELECT * FROM review_schedules WHERE user_id=? AND question_id=?",
      [u.id, "tls-confidentiality"],
    ))!.interval_days,
    1,
  );
  await submit(u.id, "least-privilege");
  assert.equal(
    (await first<Review>(
      db(),
      "SELECT * FROM review_schedules WHERE user_id=? AND question_id=?",
      [u.id, "least-privilege"],
    ))!.interval_days,
    2,
  );
  const newSession = await startSession(u.id, "practice", { count: 1 });
  assert.equal(
    JSON.parse((await readSession(u.id, newSession.id)).session.settings)
      .reviewPolicyVersion,
    policy.version,
  );
});
test("near-duplicate signals compare real prompts without automatically rejecting or changing content", () => {
  const rows = [
    {
      id: "a",
      objective: "1.3",
      prompt:
        "An application protects customer data in transit using a trusted encrypted channel. Which control meets the confidentiality requirement?",
    },
    {
      id: "b",
      objective: "1.3",
      prompt:
        "An application protects customer data in transit using a trusted encrypted channel. Which control meets the confidentiality goal?",
    },
    {
      id: "c",
      objective: "4.7",
      prompt:
        "An application protects customer data in transit using a trusted encrypted channel. Which control meets the confidentiality goal?",
    },
  ];
  const pairs = duplicateCandidates(rows);
  assert.equal(pairs.length, 1);
  assert.ok(pairs[0].similarity > 70);
  assert.equal(rows.length, 3);
});
test("new fictional labs conceal answers, grade server-side and cannot farm simulation rewards", async () => {
  const u = await learner();
  const catalog = await req(u.token, "simulations");
  assert.equal(catalog.body.simulations.length, 5);
  assert.doesNotMatch(
    JSON.stringify(catalog.body.simulations),
    /"answer":|"why":/,
  );
  for (const sim of simulations.slice(2)) {
    const selected = Object.fromEntries(sim.tasks.map((t) => [t.id, t.answer]));
    const before = await xp(u.id);
    assert.equal(
      (await req(u.token, "simulations", "POST", { id: sim.id, selected })).body
        .score,
      100,
    );
    await req(u.token, "simulations", "POST", { id: sim.id, selected });
    assert.equal(await xp(u.id), before + 30);
  }
  assert.equal(
    await first(
      db(),
      "SELECT * FROM user_achievements WHERE user_id=? AND achievement_id='incident-commander'",
      [u.id],
    ),
    undefined,
  );
});
test("concept library includes reviewed foundation lessons and their shared concept identifiers", async () => {
  const u = await learner();
  const library = await req(u.token, "knowledge");
  assert.equal(library.status, 200);
  assert.ok(library.body.terms.length >= 58);
  assert.ok(
    library.body.terms.some(
      (t: { conceptId: string }) => t.conceptId === "cryptography-fundamentals",
    ),
  );
  for (const term of library.body.terms) {
    assert.ok(term.definition);
    assert.ok(term.sources.length);
  }
});
test("a reference note remains editable when its own session's question is later archived", async () => {
  const u = await learner(),
    other = await learner();
  await startSession(u.id, "practice", {
    count: 1,
    questionIds: ["tls-confidentiality"],
  });
  const r = await req(u.token, "notebook/context", "POST", {
    kind: "reference",
    questionId: "tls-confidentiality",
    revision: 1,
  });
  assert.equal(r.status, 200);
  await db().run(
    "UPDATE questions SET status='archived' WHERE id='tls-confidentiality'",
  );
  try {
    assert.equal(
      (
        await req(u.token, "notebook/entries", "POST", {
          id: r.body.entry.id,
          mutationId: randomUUID(),
          expectedRevision: 1,
          title: r.body.entry.title,
          body: "Personal analysis after archiving",
          questionId: "tls-confidentiality",
          questionRevision: 1,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req(other.token, "notebook/context", "POST", {
          kind: "reference",
          questionId: "tls-confidentiality",
          revision: 1,
        })
      ).status,
      403,
    );
  } finally {
    await db().run(
      "UPDATE questions SET status='published' WHERE id='tls-confidentiality'",
    );
  }
});
test("password reset is single-use under concurrent submissions and revokes sessions", async () => {
  const u = await learner(),
    token = "a".repeat(64);
  await db().run("INSERT INTO reset_tokens VALUES (?,?,?)", [
    hashToken(token),
    u.id,
    new Date(Date.now() + 60000).toISOString(),
  ]);
  const input = { token, password: "A replacement synthetic test passphrase!" };
  const [a, b] = await Promise.all([
    req(u.token, "auth/reset", "POST", input),
    req(u.token, "auth/reset", "POST", input),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  assert.equal(
    (await db().all("SELECT * FROM auth_sessions WHERE user_id=?", [u.id]))
      .length,
    0,
  );
  assert.equal((await req(u.token, "overview")).status, 401);
});
