import { questions } from "../content/questions";
import { validateQuestion, fingerprint, blueprint } from "../src/lib/content";
import {
  concepts,
  relationships,
  misconceptions,
  distractorMappings,
} from "../content/intelligence";
import { sources } from "../content/sources";
import { validateGraph } from "../src/lib/knowledge-graph";
const seen = new Set<string>();
for (const q of questions) {
  validateQuestion(q);
  const f = fingerprint(q.prompt);
  if (seen.has(f)) throw Error(`Duplicate ${q.id}`);
  seen.add(f);
}
console.log(
  `${questions.length} structurally valid original questions. These checks do not replace independent subject-matter review.`,
);
for (const o of blueprint.objectives)
  console.log(
    `${o.id}: ${questions.filter((q) => q.objective === o.id).length} questions — ${o.description}`,
  );
validateGraph(concepts, relationships);
for (const item of [...concepts, ...misconceptions]) {
  for (const objective of item.objectives)
    if (!blueprint.objectives.some((o) => o.id === objective))
      throw Error(`Invalid intelligence objective: ${objective}`);
  for (const reference of item.references)
    if (
      !sources.some(
        (s) => s.id === reference && !s.status.startsWith("unverified"),
      )
    )
      throw Error(`Invalid intelligence source: ${reference}`);
}
for (const edge of relationships)
  for (const reference of edge.references)
    if (
      !sources.some(
        (s) => s.id === reference && !s.status.startsWith("unverified"),
      )
    )
      throw Error(`Invalid edge source: ${reference}`);
for (const m of misconceptions) {
  for (const id of [...m.conceptIds, ...m.prerequisiteIds])
    if (!concepts.some((c) => c.id === id))
      throw Error(`Missing misconception concept: ${id}`);
  for (const id of m.questionIds)
    if (!questions.some((q) => q.id === id))
      throw Error(`Missing remediation question: ${id}`);
}
for (const m of distractorMappings) {
  const q = questions.find(
    (q) => q.id === m.questionId && q.revision === m.revision,
  );
  if (
    !q ||
    !q.options.some((o) => o.id === m.optionId) ||
    !misconceptions.some((c) => c.id === m.misconceptionId)
  )
    throw Error("Invalid distractor mapping.");
  const positional = q.type === "matching" || q.type === "ordering";
  if (
    positional
      ? m.slot < 0 ||
        m.slot >= q.correct.length ||
        q.correct[m.slot] === m.optionId
      : m.slot !== -1 || q.correct.includes(m.optionId)
  )
    throw Error(`Mapping identifies a correct response: ${m.questionId}`);
}
console.log(
  `${concepts.length} concepts, ${relationships.length} cycle-checked relationships, ${misconceptions.length} misconception definitions, ${distractorMappings.length} incorrect-choice mappings. Editorial validation only; independent SME review remains outstanding.`,
);
for (const m of misconceptions)
  console.log(
    `${m.id}: ${new Set(distractorMappings.filter((d) => d.misconceptionId === m.id).map((d) => d.questionId)).size} distinct mapped questions`,
  );
