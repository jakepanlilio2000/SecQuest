import type { Question } from "./types";
const stop = new Set(
  "a an the which what is are of to and for in on with when most best should be this that organization needs wants it its".split(
    " ",
  ),
);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w)),
  );
export function duplicateCandidates(
  questions: Pick<Question, "id" | "prompt" | "objective">[],
  threshold = 0.55,
) {
  const rows = questions.map((q) => ({ ...q, words: tokens(q.prompt) })),
    pairs = [];
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i],
        b = rows[j];
      if (a.objective !== b.objective) continue;
      const union = new Set([...a.words, ...b.words]).size,
        intersection = [...a.words].filter((w) => b.words.has(w)).length;
      const score = union ? intersection / union : 0;
      if (score >= threshold)
        pairs.push({
          left: { id: a.id, prompt: a.prompt },
          right: { id: b.id, prompt: b.prompt },
          objective: a.objective,
          similarity: Math.round(score * 100),
        });
    }
  return pairs
    .sort(
      (a, b) =>
        b.similarity - a.similarity || a.left.id.localeCompare(b.left.id),
    )
    .slice(0, 30);
}
