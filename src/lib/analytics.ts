import { db, first } from "./db";
import { blueprint } from "./content";
import type { Attempt, Review, Session, Feedback } from "./types";
import { rankFor } from "./types";
import { evidenceMastery } from "./mastery";
import { extraAchievements, accents } from "./progression";
import { learningInsights, wilsonInterval } from "./learning-insights";
export const achievements = [
  {
    id: "first-defense",
    name: "First Defense",
    description: "Complete your first learning session.",
    icon: "shield",
  },
  {
    id: "mistake-breaker",
    name: "Mistake Breaker",
    description:
      "Recover a missed question and recall it at least a day later.",
    icon: "zap",
  },
  {
    id: "mock-complete",
    name: "Trial by Fire",
    description: "Submit a timed practice exam.",
    icon: "target",
  },
  {
    id: "incident-commander",
    name: "Incident Commander",
    description: "Solve the incident triage simulation without a mistake.",
    icon: "flag",
  },
  ...extraAchievements,
];
const pct = (a: Attempt[]) =>
  a.length
    ? Math.round((100 * a.filter((t) => t.correct).length) / a.length)
    : null;
export async function overview(user: string) {
  const database = db();
  const [attempts, reviews, xpRow, sessions, earned, simulations, count] =
    await Promise.all([
      database.all<Attempt>(
        "SELECT * FROM attempts WHERE user_id=? ORDER BY created_at",
        [user],
      ),
      database.all<Review>("SELECT * FROM review_schedules WHERE user_id=?", [
        user,
      ]),
      first<{ xp: number }>(
        database,
        "SELECT COALESCE(SUM(amount),0) AS xp FROM xp_events WHERE user_id=?",
        [user],
      ),
      database.all<Session>(
        "SELECT * FROM quiz_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 30",
        [user],
      ),
      database.all<{ achievement_id: string; awarded_at: string }>(
        `SELECT * FROM user_achievements WHERE user_id=?`,
        [user],
      ),
      database.all<{ score: number }>(
        "SELECT score FROM simulation_attempts WHERE user_id=?",
        [user],
      ),
      first<{ n: number }>(
        database,
        "SELECT COUNT(*) AS n FROM questions WHERE status='published'",
      ),
    ]);
  const firsts = attempts.filter((a) => a.first_attempt),
    retry = attempts.filter((a) => a.retry),
    retention = attempts.filter((a) => a.retention);
  const xp = Number(xpRow?.xp ?? 0);
  const objectives = blueprint.objectives.map((o) => {
    const evidence = firsts.filter((a) => a.objective === o.id),
      all = attempts.filter((a) => a.objective === o.id),
      due = reviews.filter(
        (r) =>
          r.due_at <= new Date().toISOString() &&
          all.some((a) => a.question_id === r.question_id),
      );
    const score = pct(evidence);
    return {
      ...o,
      evidence: evidence.length,
      accuracy: score,
      mastery: evidenceMastery(evidence) ?? 0,
      state: !evidence.length
        ? "Not started"
        : due.length
          ? "Needs review"
          : evidence.length < 3
            ? "Learning"
            : score! >= 80
              ? "Developing"
              : "Needs review",
      due: due.length,
      misses: all.filter((a) => !a.correct).length,
    };
  });
  const domains = blueprint.domains.map((d) => {
    const os = objectives.filter((o) => o.id[0] === String(d.number));
    return {
      ...d,
      mastery: Math.round(os.reduce((n, o) => n + o.mastery, 0) / os.length),
      coverage: os.filter((o) => o.evidence).length,
      totalObjectives: os.length,
      attempts: firsts.filter((a) => a.objective[0] === String(d.number))
        .length,
    };
  });
  const activity = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    const a = attempts.filter((a) => a.created_at.startsWith(date));
    return {
      date,
      label: new Date(`${date}T12:00:00Z`).toLocaleDateString("en", {
        weekday: "short",
        timeZone: "UTC",
      }),
      count: a.length,
      accuracy: pct(a),
    };
  });
  const coverage =
    objectives.filter((o) => o.evidence).length / objectives.length;
  const mockSessions = sessions.filter(
    (s) => s.mode === "mock" && s.status === "completed",
  );
  const mockItems = await database.all<{
    session_id: string;
    feedback: string;
  }>(
    "SELECT i.session_id,i.feedback FROM session_items i JOIN quiz_sessions s ON s.id=i.session_id WHERE s.user_id=? AND s.mode=? AND s.status=? AND i.feedback IS NOT NULL",
    [user, "mock", "completed"],
  );
  const mockCorrect = mockItems.filter(
    (i) => (JSON.parse(i.feedback) as Feedback).correct,
  ).length;
  const mockAccuracy = mockItems.length
    ? Math.round((100 * mockCorrect) / mockItems.length)
    : null;
  const mockHistory = mockSessions.map((s) => {
    const items = mockItems.filter((i) => i.session_id === s.id);
    return {
      id: s.id,
      date: s.completed_at ?? s.created_at,
      count: items.length,
      accuracy: items.length
        ? Math.round(
            (100 *
              items.filter((i) => (JSON.parse(i.feedback) as Feedback).correct)
                .length) /
              items.length,
          )
        : 0,
    };
  });
  const factors = [
    {
      name: "Objective coverage",
      weight: 25,
      value: Math.round(coverage * 100),
    },
    { name: "First encounters", weight: 25, value: pct(firsts) ?? 0 },
    { name: "Mock accuracy", weight: 20, value: mockAccuracy ?? 0 },
    { name: "Delayed retention", weight: 15, value: pct(retention) ?? 0 },
    {
      name: "Hard scenarios",
      weight: 10,
      value:
        pct(firsts.filter((a) => ["hard", "expert"].includes(a.difficulty))) ??
        0,
    },
    {
      name: "Simulations",
      weight: 5,
      value: simulations.length
        ? Math.round(
            simulations.reduce((n, s) => n + s.score, 0) / simulations.length,
          )
        : 0,
    },
  ];
  const ready =
    firsts.length >= 30 &&
    mockSessions.length > 0 &&
    retention.filter((a) => a.correct).length >= 5 &&
    coverage >= 0.6;
  return {
    xp,
    appearance: accents.map((a) => ({ ...a, unlocked: xp >= a.xp })),
    insights: learningInsights(attempts),
    firstAccuracyInterval: wilsonInterval(
      firsts.filter((a) => a.correct).length,
      firsts.length,
    ),
    rank: rankFor(xp),
    totalQuestions: Number(count?.n ?? 0),
    uniqueAttempted: firsts.length,
    uniqueCorrect: new Set(
      attempts.filter((a) => a.correct).map((a) => a.question_id),
    ).size,
    firstAccuracy: pct(firsts),
    retryAccuracy: pct(retry),
    retentionAccuracy: pct(retention),
    firstCount: firsts.length,
    retryCount: retry.length,
    retentionCount: retention.length,
    mastered: reviews.filter((r) => r.state === "retained").length,
    due: reviews.filter((r) => r.due_at <= new Date().toISOString()).length,
    needsReview: reviews.filter((r) => r.state === "relearning").length,
    studyMinutes: Math.round(
      attempts.reduce((n, a) => n + a.duration_ms, 0) / 60000,
    ),
    objectives,
    domains,
    activity,
    attempts: attempts.slice(-30).reverse(),
    recentMistakes: attempts
      .filter((a) => !a.correct)
      .slice(-5)
      .reverse(),
    sessions,
    mockHistory,
    achievements: achievements.map((a) => ({
      ...a,
      earnedAt:
        earned.find((e) => e.achievement_id === a.id)?.awarded_at ?? null,
    })),
    readiness: {
      score: ready
        ? Math.round(
            factors.reduce((n, f) => n + (f.weight * f.value) / 100, 0),
          )
        : null,
      factors,
      criteria:
        "Requires 30 first encounters, a submitted mock, 5 successful delayed reviews, and 60% objective coverage. Coverage 25%; first encounters 25%; mocks 20%; delayed recall 15%; hard scenarios 10%; simulations 5%. Educational estimate; not a pass prediction.",
    },
    byDifficulty: ["easy", "medium", "hard", "expert"].map((d) => ({
      difficulty: d,
      count: firsts.filter((a) => a.difficulty === d).length,
      accuracy: pct(firsts.filter((a) => a.difficulty === d)),
    })),
  };
}
