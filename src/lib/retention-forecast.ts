import { randomUUID } from "node:crypto";
import { db, first, type Database } from "./db";
import type { Attempt, Review, Question } from "./types";
import type {
  IntelligencePolicy,
  QuestionForecast,
  MisconceptionFinding,
} from "./intelligence-types";
import { loadPolicy } from "./intelligence-store";
const DAY = 86400000;
export function recallEstimate(
  at: string,
  successfulAt: string,
  stabilityDays: number,
) {
  return Math.max(
    0.01,
    Math.min(
      0.99,
      Math.exp(
        -Math.max(0, Date.parse(at) - Date.parse(successfulAt)) /
          (DAY * stabilityDays),
      ),
    ),
  );
}
export function forecastQuestion(
  q: Pick<Question, "id" | "concept">,
  attempts: Attempt[],
  review: Review | undefined,
  conceptIds: string[],
  policy: IntelligencePolicy,
  findings: MisconceptionFinding[] = [],
  now = new Date(),
  noteCount = 0,
): QuestionForecast {
  const history = attempts
    .filter(
      (a) =>
        a.question_id === q.id && Date.parse(a.created_at) <= now.getTime(),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const delayed = history.filter((a) => a.retention),
    successes = delayed.filter(
      (a) =>
        a.correct && a.confidence !== "guessed" && a.confidence !== "unsure",
    );
  const lastSuccess = [...history].reverse().find((a) => a.correct);
  const sufficient =
    delayed.length >= policy.minimumForecastReviews &&
    successes.length >= policy.minimumForecastSuccesses &&
    !!review &&
    review.interval_days > 0 &&
    !!lastSuccess;
  const confusions = findings.filter(
    (f) =>
      f.definition.conceptIds.some((id) => conceptIds.includes(id)) &&
      [
        "Possible misconception",
        "Likely misconception",
        "Recurring misconception",
      ].includes(f.status),
  ).length;
  // An explicit heuristic curve anchored to the existing interval, not a second scheduler.
  const stability = sufficient
    ? Math.max(1, review!.interval_days) /
      (Math.max(0.02, -Math.log(policy.forecastAnchor)) *
        (1 +
          Math.min(review!.lapses, 3) * 0.1 +
          Math.min(confusions, 2) * 0.15))
    : null;
  const probability =
    stability && lastSuccess
      ? recallEstimate(now.toISOString(), lastSuccess.created_at, stability)
      : null;
  const delta = review ? Date.parse(review.due_at) - now.getTime() : Infinity;
  const scheduledState = !review
    ? "Unscheduled"
    : delta < -DAY
      ? "Overdue"
      : delta <= 0
        ? "Review Due"
        : delta <= policy.reviewSoonDays * DAY
          ? "Review Soon"
          : "Upcoming";
  const priority =
    (scheduledState === "Overdue"
      ? 1000
      : scheduledState === "Review Due"
        ? 600
        : scheduledState === "Review Soon"
          ? 200
          : 0) +
    (review?.lapses ?? 0) * 20 +
    confusions * 30 +
    (history.at(-1)?.correct === 0 ? 40 : 0);
  return {
    questionId: q.id,
    conceptIds,
    concept: q.concept,
    dueAt: review?.due_at ?? null,
    lastAt: review?.last_at ?? null,
    scheduledState,
    retentionState:
      probability === null
        ? "Insufficient Data"
        : probability >= 0.85 && review?.state === "retained"
          ? "Well Retained"
          : "Review Soon",
    probability,
    stabilityDays: stability,
    successfulAt: lastSuccess?.created_at ?? null,
    independentReviews: delayed.length,
    priority,
    reason:
      scheduledState === "Overdue"
        ? "An existing scheduled review is more than a day overdue."
        : scheduledState === "Review Due"
          ? "The existing review schedule is due."
          : scheduledState === "Review Soon"
            ? "The existing review date is approaching."
            : confusions
              ? "Mapped concept-confusion evidence suggests useful reinforcement."
              : !history.length
                ? "No answer history yet; a short baseline session can establish evidence."
                : !sufficient
                  ? "Not enough independent delayed reviews for a numerical estimate."
                  : "The curve uses the existing interval and stored retrieval history.",
    uncertainty: sufficient
      ? "Uncalibrated heuristic estimate; the uncertainty band is illustrative, not a statistical confidence interval."
      : "No recall probability is assigned without sufficient delayed-review evidence.",
    modelVersion: policy.version,
    noteCount,
    history: history.map((a) => ({
      at: a.created_at,
      correct: !!a.correct,
      kind: a.first_attempt
        ? "First encounter"
        : a.retention
          ? "Delayed review"
          : "Recent retry",
    })),
  };
}
export function rankForReview<T extends { id: string }>(
  bank: T[],
  forecasts: QuestionForecast[],
  attempts: Attempt[],
) {
  return [...bank].sort((a, b) => {
    const fa = forecasts.find((f) => f.questionId === a.id),
      fb = forecasts.find((f) => f.questionId === b.id);
    return (
      (fb?.priority ?? 0) - (fa?.priority ?? 0) ||
      Number(attempts.some((t) => t.question_id === a.id)) -
        Number(attempts.some((t) => t.question_id === b.id)) ||
      (fa?.dueAt ?? "9999").localeCompare(fb?.dueAt ?? "9999") ||
      a.id.localeCompare(b.id)
    );
  });
}
export async function snapshotForecasts(
  user: string,
  forecasts: QuestionForecast[],
  database = db(),
  now = new Date(),
) {
  await database.transaction(async (tx) => {
    for (const f of forecasts) {
      if (!f.lastAt) continue;
      await tx.run(
        "INSERT INTO forecast_snapshots(id,user_id,question_id,model_version,source_last_at,forecast_at,data) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,question_id,model_version,source_last_at) DO NOTHING",
        [
          randomUUID(),
          user,
          f.questionId,
          f.modelVersion,
          f.lastAt,
          now.toISOString(),
          JSON.stringify(f),
        ],
      );
    }
  });
}
export async function recordForecastOutcome(
  tx: Database,
  attempt: Attempt,
  previousLastAt: string | undefined,
) {
  if (!previousLastAt || !attempt.retention) return;
  const row = await first<{ id: string; data: string; model_version: string }>(
    tx,
    "SELECT id,data,model_version FROM forecast_snapshots WHERE user_id=? AND question_id=? AND source_last_at=? AND forecast_at<? AND outcome_attempt_id IS NULL ORDER BY forecast_at DESC LIMIT 1",
    [attempt.user_id, attempt.question_id, previousLastAt, attempt.created_at],
  );
  if (!row) return;
  const f = JSON.parse(row.data) as QuestionForecast;
  const prediction =
    f.stabilityDays && f.successfulAt
      ? recallEstimate(attempt.created_at, f.successfulAt, f.stabilityDays)
      : null;
  await tx.run(
    "INSERT INTO forecast_evaluations(snapshot_id,user_id,attempt_id,model_version,predicted,actual,error_squared,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(snapshot_id) DO NOTHING",
    [
      row.id,
      attempt.user_id,
      attempt.id,
      row.model_version,
      prediction,
      attempt.correct,
      prediction === null ? null : (prediction - attempt.correct) ** 2,
      attempt.created_at,
    ],
  );
  await tx.run(
    "UPDATE forecast_snapshots SET outcome_attempt_id=? WHERE id=? AND outcome_attempt_id IS NULL",
    [attempt.id, row.id],
  );
}
export async function forecastEvaluation(user: string, database = db()) {
  const rows = await database.all<{
    model_version: string;
    predicted: number | null;
    actual: number;
    error_squared: number | null;
  }>(
    "SELECT model_version,predicted,actual,error_squared FROM forecast_evaluations WHERE user_id=?",
    [user],
  );
  const policy = await loadPolicy(database);
  return [
    ...new Set([policy.version, ...rows.map((r) => r.model_version)]),
  ].map((version) => {
    const data = rows.filter(
      (r) => r.model_version === version && r.predicted !== null,
    );
    return {
      version,
      samples: data.length,
      minimumSamples: policy.minimumCalibrationSamples,
      status:
        data.length < policy.minimumCalibrationSamples
          ? "Not yet calibrated"
          : "Evaluation sample available; independent validation still required",
      brierScore: data.length
        ? data.reduce((n, r) => n + (r.error_squared ?? 0), 0) / data.length
        : null,
      bands: Array.from({ length: 5 }, (_, i) => {
        const lower = i / 5,
          upper = (i + 1) / 5,
          band = data.filter(
            (r) =>
              r.predicted! >= lower &&
              (r.predicted! < upper || (i === 4 && r.predicted === 1)),
          );
        return {
          lower,
          upper,
          samples: band.length,
          predicted: band.length
            ? band.reduce((n, r) => n + r.predicted!, 0) / band.length
            : null,
          observed: band.length
            ? band.reduce((n, r) => n + r.actual, 0) / band.length
            : null,
        };
      }),
    };
  });
}
