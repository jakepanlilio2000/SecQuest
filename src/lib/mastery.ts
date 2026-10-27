import type { Attempt } from "./types";
// Shared existing estimate: extract without changing the objective calculation.
export function evidenceMastery(
  firsts: Pick<Attempt, "correct">[],
): number | null {
  return firsts.length
    ? Math.round(
        ((firsts.filter((a) => a.correct).length + 1) / (firsts.length + 2)) *
          100,
      )
    : null;
}
