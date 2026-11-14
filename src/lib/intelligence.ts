import { db, first, type Database } from "./db";
import { loadGraph, loadPolicy, evidenceVersion } from "./intelligence-store";
import { backfillEvidence, findingsFor } from "./misconceptions";
import { conceptPerformance, learningPath } from "./knowledge-graph";
import {
  forecastQuestion,
  forecastEvaluation,
  snapshotForecasts,
  recallEstimate,
} from "./retention-forecast";
import type { Attempt, Review } from "./types";
import type { NotebookEntry } from "./intelligence-types";
import { blueprint, published, questionExamScope } from "./content";
export async function intelligenceFor(
  user: string,
  options: { snapshot?: boolean; conceptId?: string } = {},
  database = db(),
  now = new Date(),
) {
  await backfillEvidence(user, database);
  const [graph, policy, findings, attempts, reviews, bank, notes] =
    await Promise.all([
      loadGraph(database),
      loadPolicy(database),
      findingsFor(user, database, now),
      database.all<Attempt>(
        "SELECT * FROM attempts WHERE user_id=? ORDER BY created_at,id",
        [user],
      ),
      database.all<Review>("SELECT * FROM review_schedules WHERE user_id=?", [
        user,
      ]),
      published(database),
      database.all<
        Pick<
          NotebookEntry,
          | "id"
          | "title"
          | "concept_id"
          | "question_id"
          | "updated_at"
          | "pinned"
        >
      >(
        "SELECT id,title,concept_id,question_id,updated_at,pinned FROM notebook_entries WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC",
        [user],
      ),
    ]);
  const performances = graph.nodes.map((c) =>
    conceptPerformance(
      c.id,
      [
        ...new Set(
          graph.mappings
            .filter((m) => m.concept_id === c.id)
            .map((m) => m.question_id),
        ),
      ],
      attempts.filter((a) =>
        graph.mappings.some(
          (m) =>
            m.concept_id === c.id &&
            m.question_id === a.question_id &&
            m.revision === a.revision,
        ),
      ),
      reviews,
    ),
  );
  const questions = [...bank];
  // Include archived questions already scheduled for this learner without publishing their answers.
  for (const review of reviews.filter(
    (r) => !questions.some((q) => q.id === r.question_id),
  )) {
    const row = await first<{ content: string }>(
      database,
      `SELECT r.content FROM questions q JOIN question_revisions r ON r.question_id=q.id AND r.revision=q.current_revision WHERE q.id=? AND ${questionExamScope}`,
      [review.question_id, blueprint.code, blueprint.code],
    );
    if (row) questions.push(JSON.parse(row.content));
  }
  const forecasts = questions
    .map((q) =>
      forecastQuestion(
        q,
        attempts,
        reviews.find((r) => r.question_id === q.id),
        graph.mappings
          .filter((m) => m.question_id === q.id && m.revision === q.revision)
          .map((m) => m.concept_id),
        policy,
        findings,
        now,
        notes.filter((n) => n.question_id === q.id).length,
      ),
    )
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") ||
        a.questionId.localeCompare(b.questionId),
    );
  if (options.snapshot !== false)
    await snapshotForecasts(user, forecasts, database, now);
  const active = findings.filter(
    (f) =>
      !["Insufficient evidence", "Currently controlled"].includes(f.status),
  );
  const target = options.conceptId ?? active[0]?.definition.conceptIds[0];
  const path =
    target && graph.nodes.some((c) => c.id === target)
      ? learningPath(target, graph.nodes, graph.edges, performances)
      : [];
  const unmapped = await first<{ n: number }>(
    database,
    "SELECT COUNT(*) AS n FROM intelligence_processed_attempts WHERE user_id=? AND unmapped=1",
    [user],
  );
  const pending = await first<{ n: number }>(
    database,
    "SELECT COUNT(*) AS n FROM attempts a LEFT JOIN intelligence_processed_attempts p ON p.attempt_id=a.id WHERE a.user_id=? AND (p.attempt_id IS NULL OR p.model_version<>?)",
    [user, await evidenceVersion(database)],
  );
  return {
    asOf: now.toISOString(),
    policy,
    graph: { ...graph, performances },
    findings,
    unmappedMistakes: Number(unmapped?.n ?? 0),
    pendingBackfill: Number(pending?.n ?? 0),
    path,
    availableQuestions: bank.map((q) => {
      return {
        id: q.id,
        revision: q.revision,
        conceptIds: graph.mappings
          .filter((m) => m.question_id === q.id && m.revision === q.revision)
          .map((m) => m.concept_id),
      };
    }),
    forecasts: forecasts.map((f) => ({
      ...f,
      projection:
        f.stabilityDays && f.successfulAt
          ? Array.from({ length: 15 }, (_, i) => {
              const at = new Date(now.getTime() + i * 86400000).toISOString();
              return {
                at,
                probability: recallEstimate(
                  at,
                  f.successfulAt!,
                  f.stabilityDays!,
                ),
              };
            })
          : [],
    })),
    conceptForecasts: graph.nodes.map((c) => {
      const fs = forecasts.filter((f) => f.conceptIds.includes(c.id)),
        eligible = fs.filter((f) => f.probability !== null);
      return {
        conceptId: c.id,
        questions: fs.length,
        reviewed: fs.filter((f) => f.lastAt).length,
        due: fs.filter((f) =>
          ["Review Due", "Overdue"].includes(f.scheduledState),
        ).length,
        probability:
          eligible.length >= 2 && eligible.length === fs.length
            ? eligible.reduce((n, f) => n + f.probability!, 0) / eligible.length
            : null,
      };
    }),
    sources: (
      await database.all<{ data: string }>("SELECT data FROM content_sources")
    ).map(
      (r) =>
        JSON.parse(r.data) as {
          id: string;
          name: string;
          url: string;
          verifiedAt: string;
        },
    ),
    evaluation: await forecastEvaluation(user, database),
    notes,
    summary: {
      currentGap: active[0] ?? null,
      prerequisite: path.find((p) => p.concept.id !== target) ?? null,
      due: forecasts.filter((f) =>
        ["Review Due", "Overdue"].includes(f.scheduledState),
      ).length,
      retentionTrend: attempts.filter((a) => a.retention).length
        ? `${attempts.filter((a) => a.retention && a.correct).length} correct out of ${attempts.filter((a) => a.retention).length} actual delayed reviews`
        : "No delayed-review trend is established yet.",
      recentNotes: notes.slice(0, 3),
    },
  };
}
