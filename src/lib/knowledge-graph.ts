import type {
  SecurityConcept,
  ConceptRelationship,
  ConceptPerformance,
} from "./intelligence-types";
import type { Attempt, Review } from "./types";
import { evidenceMastery } from "./mastery";
export const isDependency = (edge: ConceptRelationship) =>
  edge.kind === "prerequisite" || edge.kind === "builds_on";
export function validateGraph(
  nodes: SecurityConcept[],
  edges: ConceptRelationship[],
) {
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw Error("Duplicate concept identifier.");
  const keys = new Set<string>();
  for (const e of edges) {
    if (!ids.has(e.sourceId) || !ids.has(e.targetId))
      throw Error("Relationship references a missing concept.");
    if (e.sourceId === e.targetId)
      throw Error("A concept cannot depend on itself.");
    const key = `${e.sourceId}:${e.kind}:${e.targetId}`;
    if (keys.has(key)) throw Error("Duplicate concept relationship.");
    keys.add(key);
  }
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw Error("Prerequisite cycle detected.");
    if (done.has(id)) return;
    visiting.add(id);
    for (const e of edges.filter((e) => isDependency(e) && e.sourceId === id))
      visit(e.targetId);
    visiting.delete(id);
    done.add(id);
  }
  ids.forEach(visit);
  return true;
}
export function conceptPerformance(
  id: string,
  questionIds: string[],
  attempts: Attempt[],
  reviews: Review[],
): ConceptPerformance {
  const matches = attempts.filter((a) => questionIds.includes(a.question_id)),
    firsts = matches.filter((a) => a.first_attempt),
    delayed = matches.filter((a) => a.retention);
  const correct = firsts.filter((a) => a.correct).length;
  const accuracy = firsts.length
    ? Math.round((correct / firsts.length) * 100)
    : null;
  const retained = reviews.filter(
    (r) => questionIds.includes(r.question_id) && r.state === "retained",
  ).length;
  return {
    id,
    mastery: evidenceMastery(firsts),
    firstAccuracy: accuracy,
    distinctQuestions: firsts.length,
    delayedReviews: delayed.length,
    lastReviewAt: matches.length
      ? matches
          .map((a) => a.created_at)
          .sort()
          .at(-1)!
      : null,
    status: !matches.length
      ? "Not studied"
      : firsts.length < 3
        ? "Insufficient evidence"
        : retained >= 2
          ? "Strongly retained"
          : (accuracy ?? 0) < 60
            ? "Needs improvement"
            : (accuracy ?? 0) >= 80 &&
                delayed.filter((a) => a.correct).length >= 2
              ? "Proficient"
              : "Developing mastery",
  };
}
export function learningPath(
  target: string,
  nodes: SecurityConcept[],
  edges: ConceptRelationship[],
  performance: ConceptPerformance[],
) {
  validateGraph(nodes, edges);
  if (!nodes.some((n) => n.id === target))
    throw Error("Target concept does not exist.");
  const ordered: string[] = [],
    seen = new Set<string>();
  function walk(id: string) {
    if (seen.has(id)) return;
    seen.add(id);
    for (const e of edges
      .filter(
        (e) => isDependency(e) && e.status === "validated" && e.targetId === id,
      )
      .sort((a, b) => a.sourceId.localeCompare(b.sourceId)))
      walk(e.sourceId);
    const p = performance.find((p) => p.id === id);
    if (
      id === target ||
      !p ||
      !["Proficient", "Strongly retained"].includes(p.status)
    )
      ordered.push(id);
  }
  walk(target);
  return ordered.map((id) => ({
    concept: nodes.find((n) => n.id === id)!,
    performance: performance.find((p) => p.id === id),
    reason:
      id === target
        ? "Your target concept"
        : !performance.find((p) => p.id === id)?.distinctQuestions
          ? "Prerequisite not yet assessed; this is unknown, not demonstrated weakness."
          : performance.find((p) => p.id === id)?.status === "Needs improvement"
            ? "Prerequisite shows repeated difficulty."
            : "Prerequisite evidence is still developing.",
  }));
}
