import { randomUUID, randomInt } from "node:crypto";
import { db, first, type Database } from "./db";
import {
  getQuestion,
  publicQuestion,
  published,
  blueprint,
  currentBlueprint,
} from "./content";
import { lockUser } from "./auth";
import { grade, retryPosition, schedule, DAY } from "./scheduler";
import { AppError } from "./errors";
export { AppError } from "./errors";
import { recordMisconceptionEvidence, findingsFor } from "./misconceptions";
import {
  forecastQuestion,
  rankForReview,
  recordForecastOutcome,
} from "./retention-forecast";
import { loadGraph, loadPolicy } from "./intelligence-store";
import { syncLearningAchievements } from "./progression";
import { loadReviewPolicy } from "./review-policy";
import type {
  Attempt,
  Confidence,
  Feedback,
  Item,
  Mode,
  Question,
  Review,
  Session,
} from "./types";
export interface SessionSettings {
  conceptId?: string;
  questionIds?: string[];
  count: number;
  domain?: string;
  objective?: string;
  difficulty?: string;
  type?: string;
  category?: string;
  selection?: string;
}
function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function owned(tx: Database, user: string, id: string) {
  const s = await first<Session>(
    tx,
    "SELECT * FROM quiz_sessions WHERE id=? AND user_id=?",
    [id, user],
  );
  if (!s) throw new AppError("Session not found", 404);
  return s;
}
const sessionItems = (tx: Database, id: string) =>
  tx.all<Item>(
    "SELECT * FROM session_items WHERE session_id=? ORDER BY position",
    [id],
  );
async function addXP(
  tx: Database,
  user: string,
  key: string,
  amount: number,
  now: string,
) {
  return (await tx.run(
    "INSERT INTO xp_events(user_id,event_key,amount,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING",
    [user, key, amount, now],
  ))
    ? amount
    : 0;
}
async function award(tx: Database, user: string, id: string, now: string) {
  await tx.run(
    "INSERT INTO user_achievements(user_id,achievement_id,awarded_at) VALUES (?,?,?) ON CONFLICT(user_id,achievement_id) DO NOTHING",
    [user, id, now],
  );
}
export async function startSession(
  user: string,
  mode: Mode,
  settings: SessionSettings,
  database = db(),
) {
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    const exam = await currentBlueprint(tx);
    const reviewPolicy = await loadReviewPolicy(tx);
    let bank = await published(tx);
    if (settings.conceptId) {
      const links = await tx.all<{ question_id: string; revision: number }>(
        "SELECT question_id,revision FROM question_concepts WHERE concept_id=?",
        [settings.conceptId],
      );
      bank = bank.filter((q) =>
        links.some((m) => m.question_id === q.id && m.revision === q.revision),
      );
    }
    if (settings.questionIds)
      bank = bank.filter((q) => settings.questionIds!.includes(q.id));
    bank = bank.filter(
      (q) =>
        (!settings.domain || q.objective[0] === settings.domain) &&
        (!settings.objective || q.objective === settings.objective) &&
        (!settings.difficulty || q.difficulty === settings.difficulty) &&
        (!settings.type || q.type === settings.type) &&
        (!settings.category || q.categories.includes(settings.category)),
    );
    if (!bank.length)
      throw new AppError(
        "No published questions match these filters. Choose a broader selection.",
      );
    const prior = await tx.all<Attempt>(
      "SELECT * FROM attempts WHERE user_id=?",
      [user],
    );
    const reviews = await tx.all<Review>(
      "SELECT * FROM review_schedules WHERE user_id=?",
      [user],
    );
    const now = new Date();
    shuffle(bank);
    if (mode === "mock") {
      const count = Math.min(exam.maxQuestions, bank.length, settings.count);
      const chosen: Question[] = [];
      const remaining = [...bank];
      while (chosen.length < count && remaining.length) {
        const weights = exam.domains
          .map((d) => ({
            d,
            deficit:
              ((chosen.length + 1) * d.weight) / 100 -
              chosen.filter((q) => q.objective[0] === String(d.number)).length,
          }))
          .sort((a, b) => b.deficit - a.deficit);
        const d = weights.find((w) =>
          remaining.some((q) => q.objective[0] === String(w.d.number)),
        )!;
        const i = remaining.findIndex(
          (q) => q.objective[0] === String(d.d.number),
        );
        chosen.push(...remaining.splice(i, 1));
      }
      bank = shuffle(chosen);
    } else if (mode === "recovery" || mode === "daily") {
      const policy = await loadPolicy(tx),
        graph = await loadGraph(tx);
      const findings = await findingsFor(user, tx, now, false);
      const forecasts = bank.map((q) =>
        forecastQuestion(
          q,
          prior,
          reviews.find((r) => r.question_id === q.id),
          graph.mappings
            .filter((m) => m.question_id === q.id && m.revision === q.revision)
            .map((m) => m.concept_id),
          policy,
          findings,
          now,
        ),
      );
      bank = rankForReview(bank, forecasts, prior);
    } else if (mode === "learning") {
      bank.sort(
        (a, b) =>
          Number(prior.some((t) => t.question_id === a.id)) -
          Number(prior.some((t) => t.question_id === b.id)),
      );
    }
    const id = randomUUID();
    const selected = bank.slice(0, Math.min(settings.count, 90));
    const expires =
      mode === "mock"
        ? new Date(now.getTime() + exam.durationMinutes * 60000).toISOString()
        : mode === "challenge"
          ? new Date(now.getTime() + 10 * 60000).toISOString()
          : null;
    await tx.run(
      "INSERT INTO quiz_sessions(id,user_id,mode,settings,status,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
      [
        id,
        user,
        mode,
        JSON.stringify({
          ...settings,
          actualCount: selected.length,
          exam: blueprint.code,
          blueprintRevision: exam.revision,
          reviewPolicyVersion: reviewPolicy.version,
        }),
        "active",
        now.toISOString(),
        expires,
      ],
    );
    for (let i = 0; i < selected.length; i++)
      await tx.run(
        "INSERT INTO session_items(id,session_id,question_id,revision,position) VALUES (?,?,?,?,?)",
        [randomUUID(), id, selected[i].id, selected[i].revision, i],
      );
    return { id, count: selected.length };
  });
}
async function recordAttempt(
  tx: Database,
  user: string,
  s: Session,
  item: Item,
  selected: string[],
  confidence: Confidence,
  now: Date,
): Promise<Feedback> {
  const q = await getQuestion(tx, item.question_id, item.revision);
  const correct = grade(
    q.correct,
    selected,
    q.type === "ordering" || q.type === "matching",
  );
  const prior = await first<Attempt>(
    tx,
    "SELECT * FROM attempts WHERE user_id=? AND question_id=? ORDER BY created_at LIMIT 1",
    [user, q.id],
  );
  const previous = await first<Review>(
    tx,
    "SELECT * FROM review_schedules WHERE user_id=? AND question_id=?",
    [user, q.id],
  );
  const policyVersion =
    (JSON.parse(s.settings) as { reviewPolicyVersion?: string })
      .reviewPolicyVersion ?? "sm2-inspired-v1";
  const next = schedule(
    previous,
    correct,
    confidence,
    now,
    !!item.retry,
    await loadReviewPolicy(tx, policyVersion),
  );
  const attemptId = randomUUID();
  const duration = item.shown_at
    ? Math.max(
        0,
        Math.min(30 * 60000, now.getTime() - Date.parse(item.shown_at)),
      )
    : 0;
  await tx.run(
    "INSERT INTO attempts(id,user_id,session_id,item_id,question_id,revision,selected,correct,first_attempt,retry,retention,confidence,duration_ms,created_at,objective,difficulty,concept) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      attemptId,
      user,
      s.id,
      item.id,
      q.id,
      q.revision,
      JSON.stringify(selected),
      correct ? 1 : 0,
      prior ? 0 : 1,
      prior ? 1 : 0,
      next.retention,
      confidence,
      duration,
      now.toISOString(),
      q.objective,
      q.difficulty,
      q.concept,
    ],
  );
  const stored = await first<Attempt>(tx, "SELECT * FROM attempts WHERE id=?", [
    attemptId,
  ]);
  if (stored) {
    await recordMisconceptionEvidence(tx, stored);
    await recordForecastOutcome(tx, stored, previous?.last_at);
  }
  await tx.run(
    "INSERT INTO review_schedules(user_id,question_id,due_at,interval_days,ease,repetitions,lapses,retained,last_at,state) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,question_id) DO UPDATE SET due_at=excluded.due_at,interval_days=excluded.interval_days,ease=excluded.ease,repetitions=excluded.repetitions,lapses=excluded.lapses,retained=excluded.retained,last_at=excluded.last_at,state=excluded.state",
    [
      user,
      q.id,
      next.due_at,
      next.interval_days,
      next.ease,
      next.repetitions,
      next.lapses,
      next.retained,
      next.last_at,
      next.state,
    ],
  );
  let xp = 0;
  if (correct && !prior)
    xp += await addXP(tx, user, `first:${q.id}`, 10, now.toISOString());
  if (correct && previous?.lapses)
    xp += await addXP(tx, user, `recovery:${q.id}`, 5, now.toISOString());
  if (correct && next.retention)
    xp += await addXP(tx, user, `retention:${q.id}`, 15, now.toISOString());
  if (correct && next.retention && previous?.lapses)
    await award(tx, user, "mistake-breaker", now.toISOString());
  await syncLearningAchievements(tx, user, now);
  return {
    attemptId,
    correct,
    selected,
    answer: q.correct,
    question: q,
    reviewDue: next.due_at,
    retry: !!prior,
    xp,
  };
}
async function complete(
  tx: Database,
  user: string,
  s: Session,
  now = new Date(),
) {
  if (s.status !== "active") return;
  if (s.mode === "mock")
    for (const item of await sessionItems(tx, s.id)) {
      if (!item.feedback) {
        const selected = JSON.parse(item.selected ?? "[]") as string[];
        const unattempted = !selected.some(Boolean);
        const q = unattempted
          ? await getQuestion(tx, item.question_id, item.revision)
          : null;
        const feedback: Feedback = q
          ? {
              correct: false,
              selected,
              answer: q.correct,
              question: q,
              reviewDue: "",
              retry: false,
              xp: 0,
              skipped: true,
            }
          : await recordAttempt(tx, user, s, item, selected, null, now);
        await tx.run(
          "UPDATE session_items SET feedback=?,answered_at=? WHERE id=?",
          [JSON.stringify(feedback), now.toISOString(), item.id],
        );
      }
    }
  await tx.run(
    "UPDATE quiz_sessions SET status='completed',completed_at=? WHERE id=?",
    [now.toISOString(), s.id],
  );
  // Completion XP is limited per UTC study date, rather than unlimited new sessions.
  const n = await first<{ n: number }>(
    tx,
    "SELECT COUNT(*) AS n FROM attempts WHERE session_id=?",
    [s.id],
  );
  if (n && n.n > 0) {
    await addXP(
      tx,
      user,
      `session:${now.toISOString().slice(0, 10)}`,
      20,
      now.toISOString(),
    );
    await award(tx, user, "first-defense", now.toISOString());
  }
  if (s.mode === "mock" && Number(n?.n ?? 0) > 0)
    await award(tx, user, "mock-complete", now.toISOString());
  await syncLearningAchievements(tx, user, now);
}
async function expire(tx: Database, user: string, s: Session) {
  if (
    s.status === "active" &&
    s.expires_at &&
    s.expires_at <= new Date().toISOString()
  ) {
    await complete(tx, user, s, new Date(s.expires_at));
    s.status = "completed";
  }
}
export async function readSession(
  user: string,
  id: string,
  index?: number,
  database = db(),
) {
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    const s = await owned(tx, user, id);
    await expire(tx, user, s);
    const items = await sessionItems(tx, id);
    let current =
      s.mode === "mock"
        ? Math.max(0, Math.min(items.length - 1, index ?? s.cursor))
        : s.cursor;
    if (s.status === "active" && current >= items.length) {
      await complete(tx, user, s);
      s.status = "completed";
    }
    if (s.status === "completed")
      return {
        session: s,
        items: await Promise.all(
          items.map(async (item) => ({
            id: item.id,
            question: await getQuestion(tx, item.question_id, item.revision),
            selected: JSON.parse(item.selected ?? "[]"),
            feedback: item.feedback ? JSON.parse(item.feedback) : null,
            flagged: !!item.flagged,
            retry: !!item.retry,
          })),
        ),
        completed: true,
      };
    const item = items[current];
    if (!item) throw new AppError("Session has no remaining questions");
    await tx.run(
      "UPDATE session_items SET shown_at=COALESCE(shown_at,?) WHERE id=?",
      [new Date().toISOString(), item.id],
    );
    await tx.run("UPDATE quiz_sessions SET cursor=? WHERE id=?", [current, id]);
    const q = await getQuestion(tx, item.question_id, item.revision);
    return {
      session: s,
      completed: false,
      index: current,
      total: items.length,
      item: {
        id: item.id,
        question: publicQuestion(q),
        selected: JSON.parse(item.selected ?? "[]"),
        flagged: !!item.flagged,
        feedback:
          s.mode === "mock"
            ? null
            : item.feedback
              ? JSON.parse(item.feedback)
              : null,
        retry: !!item.retry,
      },
      navigator: items.map((i) => ({
        id: i.id,
        answered: !!i.selected && i.selected !== "[]",
        flagged: !!i.flagged,
      })),
    };
  });
}
export async function answer(
  user: string,
  id: string,
  itemId: string,
  selected: string[],
  confidence: Confidence,
  database = db(),
) {
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    const s = await owned(tx, user, id);
    await expire(tx, user, s);
    if (s.status !== "active")
      throw new AppError(
        "This session is complete. Answers can no longer be changed.",
        409,
      );
    const items = await sessionItems(tx, id),
      item = items.find((i) => i.id === itemId);
    if (!item) throw new AppError("Question not in this session");
    const q = await getQuestion(tx, item.question_id, item.revision);
    if (
      selected.some(
        (c) =>
          !(s.mode === "mock" && q.type === "matching" && c === "") &&
          !q.options.some((o) => o.id === c),
      ) ||
      new Set(selected.filter(Boolean)).size !== selected.filter(Boolean).length
    )
      throw new AppError("Invalid selection");
    if (s.mode !== "mock" && selected.length !== q.correct.length)
      throw new AppError(`Select exactly ${q.correct.length} answer(s).`);
    if (s.mode !== "mock" && items[s.cursor]?.id !== itemId)
      throw new AppError("Answer the current question first.");
    if (s.mode === "mock") {
      if (selected.length > q.correct.length)
        throw new AppError("Too many selections");
      await tx.run("UPDATE session_items SET selected=? WHERE id=?", [
        JSON.stringify(selected),
        item.id,
      ]);
      return { saved: true };
    }
    if (item.feedback) return JSON.parse(item.feedback) as Feedback;
    const feedback = await recordAttempt(
      tx,
      user,
      s,
      item,
      selected,
      confidence,
      new Date(),
    );
    await tx.run(
      "UPDATE session_items SET selected=?,feedback=?,answered_at=? WHERE id=?",
      [
        JSON.stringify(selected),
        JSON.stringify(feedback),
        new Date().toISOString(),
        item.id,
      ],
    );
    if (
      !feedback.correct &&
      items.filter((i) => i.question_id === q.id).length < 3
    ) {
      const pos = retryPosition(
        s.cursor,
        items.length,
        () => randomInt(100000) / 100000,
      );
      if (pos !== null) {
        // Two-phase shift avoids UNIQUE(session_id,position) collisions on both databases.
        await tx.run(
          "UPDATE session_items SET position=-position-1 WHERE session_id=? AND position>=?",
          [id, pos],
        );
        await tx.run(
          "UPDATE session_items SET position=-position WHERE session_id=? AND position<0",
          [id],
        );
        await tx.run(
          "INSERT INTO session_items(id,session_id,question_id,revision,position,retry) VALUES (?,?,?,?,?,?)",
          [randomUUID(), id, q.id, q.revision, pos, 1],
        );
      }
    }
    return feedback;
  });
}
export async function sessionAction(
  user: string,
  id: string,
  action: string,
  itemId?: string,
  database = db(),
) {
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    const s = await owned(tx, user, id);
    await expire(tx, user, s);
    if (s.status !== "active") return { completed: true };
    if (action === "finish") {
      if (s.mode !== "mock") {
        const items = await sessionItems(tx, id);
        if (items.some((i) => !i.feedback))
          throw new AppError(
            "Complete the questions or leave the session saved for later.",
          );
      }
      await complete(tx, user, s);
      return { completed: true };
    }
    if (action === "flag") {
      if (s.mode !== "mock")
        throw new AppError("Flags are available in mock exams");
      await tx.run(
        "UPDATE session_items SET flagged=1-flagged WHERE id=? AND session_id=?",
        [itemId ?? "", id],
      );
      return { saved: true };
    }
    if (action === "next") {
      const items = await sessionItems(tx, id);
      if (!items[s.cursor]?.feedback)
        throw new AppError("Submit an answer before continuing.");
      const cursor = s.cursor + 1;
      await tx.run("UPDATE quiz_sessions SET cursor=? WHERE id=?", [
        cursor,
        id,
      ]);
      if (cursor >= items.length) {
        await complete(tx, user, s);
        return { completed: true };
      }
      return { saved: true };
    }
    throw new AppError("Unsupported action");
  });
}
