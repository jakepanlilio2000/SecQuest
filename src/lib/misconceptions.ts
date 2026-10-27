import { db, first, type Database } from "./db";
import type { Attempt } from "./types";
import type {
  EvidenceRow,
  IntelligencePolicy,
  MisconceptionDefinition,
  MisconceptionFinding,
  MisconceptionMapping,
  MisconceptionStatus,
} from "./intelligence-types";
import {
  loadDefinitions,
  loadPolicy,
  evidenceVersion,
} from "./intelligence-store";
const DAY = 86400000;
export function evaluateMisconception(
  definition: MisconceptionDefinition,
  evidence: EvidenceRow[],
  policy: IntelligencePolicy,
  now = new Date(),
): MisconceptionFinding {
  const rows = evidence
    .filter(
      (e) =>
        e.misconception_id === definition.id &&
        Date.parse(e.created_at) <= now.getTime(),
    )
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) ||
        a.attempt_id.localeCompare(b.attempt_id),
    );
  const positives = rows.filter((r) => r.polarity > 0);
  const lastMistakeAt = positives.at(-1)?.created_at ?? null;
  const corrections = rows.filter(
    (r) => r.polarity < 0 && (!lastMistakeAt || r.created_at > lastMistakeAt),
  );
  const distinctMistakes = new Set(
    positives
      .filter(
        (r) =>
          now.getTime() - Date.parse(r.created_at) <=
          policy.halfLifeDays * 3 * DAY,
      )
      .map((r) => r.question_id),
  ).size;
  const independentCorrections = corrections.filter(
    (r) =>
      r.independent &&
      (!lastMistakeAt ||
        Date.parse(r.created_at) - Date.parse(lastMistakeAt) >=
          policy.minimumIndependentHours * 3600000),
  );
  const distinctCorrections = new Set(
    independentCorrections.map((r) => r.question_id),
  ).size;
  const weighted = (list: EvidenceRow[]) => {
    const byQuestion = new Map<string, number>();
    for (const r of list) {
      const value =
        r.weight *
        Math.pow(
          0.5,
          (now.getTime() - Date.parse(r.created_at)) /
            (policy.halfLifeDays * DAY),
        );
      byQuestion.set(
        r.question_id,
        Math.max(byQuestion.get(r.question_id) ?? 0, value),
      );
    }
    return [...byQuestion.values()].reduce((n, x) => n + x, 0);
  };
  const wrongWeight = weighted(positives),
    correctWeight = weighted(corrections);
  const support = wrongWeight
    ? Math.round((100 * wrongWeight) / (wrongWeight + correctWeight + 1))
    : 0;
  let status: MisconceptionStatus = "Insufficient evidence";
  if (distinctMistakes >= policy.possibleDistinct && support >= 20) {
    status =
      distinctMistakes >= policy.recurringDistinct
        ? "Recurring misconception"
        : distinctMistakes >= policy.likelyDistinct
          ? "Likely misconception"
          : "Possible misconception";
    if (corrections.length)
      status =
        distinctCorrections >= policy.resolutionDistinct
          ? "Currently controlled"
          : "Improving";
  }
  // Once independent corrections are established, low support must not erase their meaning.
  if (
    distinctMistakes >= policy.possibleDistinct &&
    distinctCorrections >= policy.resolutionDistinct
  )
    status = "Currently controlled";
  return {
    definition,
    status,
    support,
    confidence:
      distinctMistakes < policy.possibleDistinct
        ? "insufficient"
        : distinctMistakes >= policy.likelyDistinct
          ? "moderate"
          : "limited",
    distinctMistakes,
    distinctCorrections,
    recentMistakes: positives.filter(
      (r) => now.getTime() - Date.parse(r.created_at) <= 7 * DAY,
    ).length,
    lastMistakeAt,
    lastCorrectionAt: corrections.at(-1)?.created_at ?? null,
    trend:
      status === "Currently controlled"
        ? "Later independent retrieval supports improvement; future mistakes can reopen this finding."
        : status === "Improving"
          ? "A correction was observed; delayed independent checks are still needed."
          : distinctMistakes
            ? "Distinct-question mistake evidence is being collected."
            : "No mapped evidence yet.",
    reason:
      distinctMistakes < policy.possibleDistinct
        ? `${distinctMistakes} distinct mapped question(s); at least ${policy.possibleDistinct} are required before flagging a possible confusion.`
        : `${distinctMistakes} distinct questions show mapped mistakes; ${distinctCorrections} distinct delayed corrections followed the latest mistake. Repeated answers to one question are not independent evidence.`,
    modelVersion: policy.version,
    evidence: rows.slice(-30),
  };
}
export async function recordMisconceptionEvidence(
  tx: Database,
  attempt: Attempt,
) {
  const version = await evidenceVersion(tx);
  if (
    await first(
      tx,
      "SELECT attempt_id FROM intelligence_processed_attempts WHERE attempt_id=? AND model_version=?",
      [attempt.id, version],
    )
  )
    return false;
  const mappings = await tx.all<{
    question_id: string;
    revision: number;
    option_id: string;
    slot: number;
    misconception_id: string;
    weight: number;
  }>(
    "SELECT * FROM question_misconceptions WHERE question_id=? AND revision=? AND status=?",
    [attempt.question_id, attempt.revision, "validated"],
  );
  const selected = JSON.parse(attempt.selected) as string[];
  const byDefinition = new Map<string, number>();
  for (const m of mappings) {
    if (attempt.correct) {
      byDefinition.set(
        m.misconception_id,
        Math.max(byDefinition.get(m.misconception_id) ?? 0, 1),
      );
    } else if (
      m.slot >= 0
        ? selected[m.slot] === m.option_id
        : selected.includes(m.option_id)
    ) {
      byDefinition.set(
        m.misconception_id,
        Math.max(byDefinition.get(m.misconception_id) ?? 0, m.weight),
      );
    }
  }
  const policy = await loadPolicy(tx);
  const confidenceWeight =
    attempt.confidence === "knew"
      ? 1.2
      : attempt.confidence === "guessed"
        ? 0.65
        : 0.9;
  for (const [id, w] of byDefinition) {
    const independent = !!(attempt.first_attempt || attempt.retention);
    await tx.run(
      "INSERT INTO misconception_evidence(attempt_id,misconception_id,user_id,model_version,polarity,weight,independent,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(attempt_id,misconception_id,model_version) DO NOTHING",
      [
        attempt.id,
        id,
        attempt.user_id,
        version,
        attempt.correct ? -1 : 1,
        w * confidenceWeight * (independent ? 1 : 0.25),
        independent ? 1 : 0,
        attempt.created_at,
      ],
    );
  }
  await tx.run(
    "INSERT INTO intelligence_processed_attempts(attempt_id,user_id,model_version,unmapped,created_at) VALUES (?,?,?,?,?) ON CONFLICT(attempt_id) DO UPDATE SET model_version=excluded.model_version,unmapped=excluded.unmapped,created_at=excluded.created_at",
    [
      attempt.id,
      attempt.user_id,
      version,
      !attempt.correct && !byDefinition.size ? 1 : 0,
      new Date().toISOString(),
    ],
  );
  return true;
}
export async function backfillEvidence(
  user: string,
  database = db(),
  limit = 300,
) {
  return database.transaction(async (tx) => {
    const version = await evidenceVersion(tx);
    const rows = await tx.all<Attempt>(
      "SELECT a.* FROM attempts a LEFT JOIN intelligence_processed_attempts p ON p.attempt_id=a.id WHERE a.user_id=? AND (p.attempt_id IS NULL OR p.model_version<>?) ORDER BY a.created_at,a.id LIMIT ?",
      [user, version, limit],
    );
    for (const a of rows) await recordMisconceptionEvidence(tx, a);
    return rows.length;
  });
}
export async function findingsFor(
  user: string,
  database = db(),
  now = new Date(),
  persist = true,
) {
  const version = await evidenceVersion(database);
  const [definitions, policy, rows] = await Promise.all([
    loadDefinitions(database),
    loadPolicy(database),
    database.all<EvidenceRow>(
      "SELECT e.*,a.question_id,a.correct,a.confidence,a.retention,a.first_attempt,a.concept FROM misconception_evidence e JOIN attempts a ON a.id=e.attempt_id WHERE e.user_id=? AND e.model_version=? ORDER BY e.created_at,e.attempt_id",
      [user, version],
    ),
  ]);
  const findings = definitions
    .filter((d) => d.validationStatus === "editorial-reviewed")
    .map((d) => evaluateMisconception(d, rows, policy, now));
  if (persist)
    await database.transaction(async (tx) => {
      for (const f of findings)
        await tx.run(
          "INSERT INTO user_misconception_states(user_id,misconception_id,data,evaluated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,misconception_id) DO UPDATE SET data=excluded.data,evaluated_at=excluded.evaluated_at",
          [user, f.definition.id, JSON.stringify(f), now.toISOString()],
        );
    });
  return findings;
}
