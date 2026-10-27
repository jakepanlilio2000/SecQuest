import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeMarkdown } from "../src/components/safe-markdown";
import {
  concepts,
  relationships,
  misconceptions,
  policy,
} from "../content/intelligence";
import { evaluateMisconception } from "../src/lib/misconceptions";
import {
  conceptPerformance,
  learningPath,
  validateGraph,
} from "../src/lib/knowledge-graph";
import { forecastQuestion, rankForReview } from "../src/lib/retention-forecast";
import type {
  EvidenceRow,
  ConceptPerformance,
} from "../src/lib/intelligence-types";
import type { Attempt, Review } from "../src/lib/types";
const now = new Date("2026-10-28T12:00:00Z");
const definition = misconceptions[0];
const evidence = (
  question: string,
  correct = false,
  day = 25,
  independent = 1,
): EvidenceRow => ({
  attempt_id: `${question}:${day}:${correct}`,
  misconception_id: definition.id,
  user_id: "u",
  polarity: correct ? -1 : 1,
  weight: independent ? 1 : 0.25,
  independent,
  created_at: `2026-10-${day}T12:00:00Z`,
  question_id: question,
  correct: +correct,
  confidence: "knew",
  retention: +correct,
  first_attempt: +!correct,
  concept: "Test",
});
const evaluate = (rows: EvidenceRow[]) =>
  evaluateMisconception(definition, rows, policy, now);
test("one mistake and many repeats of that question never diagnose a misconception", () => {
  const f = evaluate([
    evidence("a"),
    evidence("a", false, 26, 0),
    evidence("a", false, 27, 0),
  ]);
  assert.equal(f.status, "Insufficient evidence");
  assert.equal(f.distinctMistakes, 1);
  assert.equal(f.support, evaluate([evidence("a")]).support);
});
test("distinct-question evidence, delayed corrections, and later relapse change the finding", () => {
  const wrong = [evidence("a"), evidence("b")];
  assert.equal(evaluate(wrong).status, "Possible misconception");
  assert.equal(
    evaluate([...wrong, evidence("c")]).status,
    "Likely misconception",
  );
  assert.equal(
    evaluate([...wrong, evidence("c"), evidence("d")]).status,
    "Recurring misconception",
  );
  const retry = [...wrong, evidence("a", true, 26, 0)];
  assert.equal(evaluate(retry).status, "Improving");
  assert.equal(evaluate(retry).distinctCorrections, 0);
  const controlled = [
    ...wrong,
    evidence("a", true, 26),
    evidence("b", true, 27),
  ];
  assert.equal(evaluate(controlled).status, "Currently controlled");
  assert.ok(evaluate(controlled).support < evaluate(wrong).support);
  assert.equal(
    evaluate([...controlled, evidence("b", false, 28)]).status,
    "Possible misconception",
  );
});
test("dependency validation rejects missing nodes, duplicate links, and directed cycles", () => {
  assert.ok(validateGraph(concepts, relationships));
  const edge = relationships.find((e) => e.kind === "prerequisite")!;
  assert.throws(
    () =>
      validateGraph(concepts, [
        ...relationships,
        {
          ...edge,
          id: "reverse",
          sourceId: edge.targetId,
          targetId: edge.sourceId,
        },
      ]),
    /cycle/,
  );
  assert.throws(
    () => validateGraph(concepts, [{ ...edge, targetId: "unknown" }]),
    /missing/,
  );
  assert.throws(
    () => validateGraph(concepts, [edge, { ...edge, id: "duplicate" }]),
    /Duplicate/,
  );
  assert.ok(
    validateGraph(concepts, [
      edge,
      {
        ...edge,
        id: "related",
        sourceId: edge.targetId,
        targetId: edge.sourceId,
        kind: "related",
      },
    ]),
  );
});
test("paths follow prerequisite direction, omit mastered steps, and distinguish unknown from weak", () => {
  const target = "pki";
  const path = learningPath(target, concepts, relationships, []);
  assert.equal(path.at(-1)?.concept.id, target);
  assert.ok(path.length > 3);
  assert.ok(path[0].reason.includes("unknown"));
  for (const edge of relationships.filter((e) =>
    ["prerequisite", "builds_on"].includes(e.kind),
  )) {
    const a = path.findIndex((p) => p.concept.id === edge.sourceId),
      b = path.findIndex((p) => p.concept.id === edge.targetId);
    if (a >= 0 && b >= 0) assert.ok(a < b);
  }
  const mastered = {
    ...conceptPerformance(path[0].concept.id, [], [], []),
    status: "Proficient",
  } as ConceptPerformance;
  assert.ok(
    !learningPath(target, concepts, relationships, [mastered]).some(
      (p) => p.concept.id === mastered.id,
    ),
  );
  const unseen = conceptPerformance("unknown", [], [], []);
  assert.equal(unseen.status, "Not studied");
  assert.equal(unseen.mastery, null);
});
test("forecast uses real delayed history and schedule without mutating it; ranking is stable", () => {
  const q = { id: "q", concept: "Cryptography" };
  const empty = forecastQuestion(q, [], undefined, [], policy, [], now);
  assert.equal(empty.probability, null);
  assert.equal(empty.history.length, 0);
  const review = {
    user_id: "u",
    question_id: "q",
    due_at: "2026-10-29T12:00:00Z",
    interval_days: 7,
    ease: 2.5,
    repetitions: 3,
    lapses: 0,
    retained: 1,
    last_at: "2026-10-25T12:00:00Z",
    state: "retained",
  } satisfies Review;
  const attempts = [20, 22, 25].map(
    (day, i) =>
      ({
        id: String(i),
        question_id: "q",
        created_at: `2026-10-${day}T12:00:00Z`,
        correct: 1,
        retention: 1,
        first_attempt: 0,
        confidence: "knew",
      }) as Attempt,
  );
  const before = JSON.stringify(review);
  assert.equal(
    forecastQuestion(q, attempts.slice(0, 2), review, [], policy, [], now)
      .probability,
    null,
  );
  const f = forecastQuestion(q, attempts, review, [], policy, [], now);
  assert.ok(f.probability! > 0 && f.probability! < 1);
  assert.equal(f.scheduledState, "Review Soon");
  assert.match(f.uncertainty, /Uncalibrated/);
  assert.equal(f.history.length, 3);
  assert.equal(JSON.stringify(review), before);
  assert.deepEqual(
    rankForReview([{ id: "z" }, { id: "q" }, { id: "a" }], [f], attempts).map(
      (q) => q.id,
    ),
    ["q", "a", "z"],
  );
  assert.deepEqual(
    rankForReview([{ id: "a" }, { id: "q" }, { id: "z" }], [f], attempts).map(
      (q) => q.id,
    ),
    ["q", "a", "z"],
  );
});
test("safe Markdown renders GFM and never embeds HTML, script URLs, frames, or tracking images", () => {
  const html = renderToStaticMarkup(
    createElement(SafeMarkdown, {
      children:
        '# Heading\n\n**Bold**\n\n- [x] Checked\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script><iframe src="https://evil.test"></iframe>\n\n[bad](javascript:alert%281%29)\n\n![track](https://evil.test/track)\n\n[Safe](https://nist.gov)',
    }),
  );
  assert.match(html, /<h1>Heading/);
  assert.match(html, /<strong>Bold/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(
    html,
    /<script|<iframe|<img|href="javascript:|evil\.test/,
  );
  assert.match(html, /rel="noopener noreferrer"/);
});
