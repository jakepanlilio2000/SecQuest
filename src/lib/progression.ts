import { randomUUID } from "node:crypto";
import { db, first, type Database } from "./db";
import { lockUser } from "./auth";
import { AppError } from "./errors";
import type { Attempt } from "./types";
import { rankFor } from "./types";
export const extraAchievements = [
  {
    id: "curious-mind",
    name: "Curious Mind",
    description: "Encounter 10 distinct questions.",
    icon: "book",
  },
  {
    id: "patient-defender",
    name: "Patient Defender",
    description: "Complete 3 correct delayed retrievals on distinct questions.",
    icon: "brain",
  },
  {
    id: "domain-explorer",
    name: "Domain Explorer",
    description: "Answer a first-encounter question in all five exam domains.",
    icon: "network",
  },
  {
    id: "steady-practice",
    name: "Steady Practice",
    description: "Complete meaningful sessions on 7 distinct UTC dates.",
    icon: "calendar",
  },
];
export const accents = [
  { id: "blue", name: "Analyst blue", xp: 0 },
  { id: "forest", name: "Forest operations", xp: 150 },
  { id: "amber", name: "Amber signal", xp: 300 },
  { id: "violet", name: "Violet watch", xp: 500 },
] as const;
export function weekStart(now = new Date()) {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString();
}
export async function syncLearningAchievements(
  tx: Database,
  user: string,
  now = new Date(),
) {
  const attempts = await tx.all<Attempt>(
    "SELECT * FROM attempts WHERE user_id=?",
    [user],
  );
  const completed = await tx.all<{ completed_at: string }>(
    "SELECT completed_at FROM quiz_sessions WHERE user_id=? AND status='completed' AND EXISTS(SELECT 1 FROM attempts a WHERE a.session_id=quiz_sessions.id)",
    [user],
  );
  const rules = [
    new Set(attempts.filter((a) => a.first_attempt).map((a) => a.question_id))
      .size >= 10,
    new Set(
      attempts
        .filter((a) => a.retention && a.correct)
        .map((a) => a.question_id),
    ).size >= 3,
    new Set(attempts.filter((a) => a.first_attempt).map((a) => a.objective[0]))
      .size === 5,
    new Set(completed.map((s) => s.completed_at.slice(0, 10))).size >= 7,
  ];
  for (let i = 0; i < rules.length; i++)
    if (rules[i])
      await tx.run(
        "INSERT INTO user_achievements(user_id,achievement_id,awarded_at) VALUES (?,?,?) ON CONFLICT(user_id,achievement_id) DO NOTHING",
        [user, extraAchievements[i].id, now.toISOString()],
      );
}
export async function progressionFor(
  user: string,
  database = db(),
  now = new Date(),
) {
  const start = weekStart(now),
    end = new Date(Date.parse(start) + 7 * 86400000).toISOString();
  const [attempts, events, sessions, preference] = await Promise.all([
    database.all<Attempt>(
      "SELECT * FROM attempts WHERE user_id=? AND created_at>=? AND created_at<?",
      [user, start, end],
    ),
    database.all<{ event_key: string; amount: number }>(
      "SELECT event_key,amount FROM xp_events WHERE user_id=?",
      [user],
    ),
    database.all<{
      id: string;
      mode: string;
      completed_at: string;
      feedback: string;
    }>(
      "SELECT s.id,s.mode,s.completed_at,i.feedback FROM quiz_sessions s JOIN session_items i ON i.session_id=s.id WHERE s.user_id=? AND s.status='completed' AND i.feedback IS NOT NULL",
      [user],
    ),
    first<{ alias: string; enabled: number }>(
      database,
      "SELECT alias,enabled FROM leaderboard_preferences WHERE user_id=?",
      [user],
    ),
  ]);
  const firstCount = new Set(
    attempts.filter((a) => a.first_attempt).map((a) => a.question_id),
  ).size;
  const recalled = new Set(
    attempts.filter((a) => a.retention && a.correct).map((a) => a.question_id),
  ).size;
  const days = new Set(
    sessions
      .filter((s) => s.completed_at >= start && s.completed_at < end)
      .filter((s) => {
        const f = JSON.parse(s.feedback);
        return !f.skipped;
      })
      .map((s) => s.completed_at.slice(0, 10)),
  ).size;
  const missions = [
    {
      id: "explore",
      title: "Explore five questions",
      description: "Five distinct first encounters this week.",
      value: firstCount,
      target: 5,
      xp: 25,
    },
    {
      id: "retrieve",
      title: "Return and retrieve",
      description:
        "Three correct delayed reviews on different questions this week.",
      value: recalled,
      target: 3,
      xp: 40,
    },
    {
      id: "consistency",
      title: "Three study dates",
      description:
        "Complete sessions containing answers on three UTC dates this week.",
      value: days,
      target: 3,
      xp: 30,
    },
  ].map((m) => ({
    ...m,
    claimed: events.some(
      (e) => e.event_key === `mission:${start.slice(0, 10)}:${m.id}`,
    ),
  }));
  const grouped = new Map<
    string,
    { mode: string; correct: number; count: number }
  >();
  for (const s of sessions) {
    const old = grouped.get(s.id) ?? { mode: s.mode, correct: 0, count: 0 };
    const f = JSON.parse(s.feedback);
    old.count++;
    if (f.correct) old.correct++;
    grouped.set(s.id, old);
  }
  const scores = [...grouped.values()].filter((s) => s.count >= 5);
  return {
    weekStart: start,
    weekEnd: end,
    missions,
    xp: events.reduce((n, e) => n + e.amount, 0),
    accents,
    preference: preference
      ? { alias: preference.alias, enabled: !!preference.enabled }
      : { alias: "", enabled: false },
    personalBests: ["mock", "challenge", "practice"].map((mode) => {
      const ss = scores.filter((s) => s.mode === mode);
      return {
        mode,
        sessions: ss.length,
        bestAccuracy: ss.length
          ? Math.max(...ss.map((s) => Math.round((100 * s.correct) / s.count)))
          : null,
        minimumQuestions: 5,
      };
    }),
  };
}
export async function claimMission(
  user: string,
  id: string,
  database = db(),
  now = new Date(),
) {
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    const state = await progressionFor(user, tx, now);
    const mission = state.missions.find((m) => m.id === id);
    if (!mission) throw new AppError("Mission not found.", 404);
    if (mission.value < mission.target)
      throw new AppError("Complete the mission before claiming it.", 409);
    const inserted = await tx.run(
      "INSERT INTO xp_events(user_id,event_key,amount,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING",
      [
        user,
        `mission:${state.weekStart.slice(0, 10)}:${id}`,
        mission.xp,
        now.toISOString(),
      ],
    );
    return { awarded: inserted ? mission.xp : 0 };
  });
}
export async function setLeaderboardPreference(
  user: string,
  enabled: boolean,
  alias: string,
  database = db(),
) {
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    await tx.run(
      "INSERT INTO leaderboard_preferences(user_id,public_id,alias,enabled,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET alias=excluded.alias,enabled=excluded.enabled,updated_at=excluded.updated_at",
      [user, randomUUID(), alias, enabled ? 1 : 0, new Date().toISOString()],
    );
    return { enabled, alias };
  });
}
export async function leaderboard(database = db()) {
  const rows = await database.all<{
    public_id: string;
    alias: string;
    xp: number;
  }>(
    "SELECT p.public_id,p.alias,COALESCE(SUM(x.amount),0) AS xp FROM leaderboard_preferences p LEFT JOIN xp_events x ON x.user_id=p.user_id WHERE p.enabled=1 GROUP BY p.public_id,p.alias ORDER BY xp DESC,p.public_id LIMIT 50",
  );
  return rows.map((r, i) => ({
    place: i + 1,
    id: r.public_id,
    alias: r.alias,
    xp: Number(r.xp),
    rank: rankFor(Number(r.xp)),
  }));
}
