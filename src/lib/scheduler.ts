import type { Confidence, Review } from "./types";
export const DAY = 86_400_000;
export interface ReviewPolicy {
  version: string;
  intervals: [number, number, number, number];
  minimumIndependentHours: number;
  failureMinutes: number;
  minimumEase: number;
  maximumEase: number;
}
export const defaultReviewPolicy: ReviewPolicy = {
  version: "sm2-inspired-v1",
  intervals: [1, 3, 7, 14],
  minimumIndependentHours: 24,
  failureMinutes: 15,
  minimumEase: 1.3,
  maximumEase: 3,
};
// SM-2-inspired schedule. Short-term retries are separate from long-term retrieval.
export function schedule(
  previous: Review | undefined,
  correct: boolean,
  confidence: Confidence,
  now: Date,
  isShortRetry: boolean,
  policy: ReviewPolicy = defaultReviewPolicy,
) {
  const elapsed = previous
    ? now.getTime() - Date.parse(previous.last_at)
    : Infinity;
  const independent =
    elapsed >= policy.minimumIndependentHours * 3600000 && !isShortRetry;
  let repetitions = previous?.repetitions ?? 0,
    interval = previous?.interval_days ?? 0,
    ease = previous?.ease ?? 2.5,
    retained = previous?.retained ?? 0,
    lapses = previous?.lapses ?? 0;
  if (!correct) {
    repetitions = 0;
    interval = 0;
    lapses++;
    ease = Math.max(policy.minimumEase, ease - 0.2);
  } else if (isShortRetry || !independent) {
    interval = Math.max(1, interval);
  } else if (confidence === "guessed" || confidence === "unsure") {
    interval = 1;
    repetitions = Math.min(repetitions, 1);
  } else {
    repetitions++;
    interval =
      repetitions <= 4
        ? policy.intervals[repetitions - 1]
        : Math.round(Math.max(policy.intervals[3], interval) * ease);
    if (previous) retained++;
    ease = Math.min(
      policy.maximumEase,
      ease + (confidence === "knew" ? 0.05 : 0),
    );
  }
  return {
    due_at: new Date(
      now.getTime() +
        (correct
          ? Math.max(1, interval) * DAY
          : policy.failureMinutes * 60_000),
    ).toISOString(),
    interval_days: interval,
    ease,
    repetitions,
    lapses,
    retained,
    last_at: now.toISOString(),
    state: !correct
      ? "relearning"
      : retained >= 2 && repetitions >= 3
        ? "retained"
        : "learning",
    retention: !!previous && independent ? 1 : 0,
  };
}
export function retryPosition(
  current: number,
  total: number,
  random = Math.random,
) {
  const gap = 3 + Math.floor(random() * 6);
  return current + gap + 1 < total ? current + gap + 1 : null;
}
export function grade(correct: string[], selected: string[], ordered = false) {
  if (
    correct.length !== selected.length ||
    new Set(selected).size !== selected.length
  )
    return false;
  return ordered
    ? correct.every((c, i) => c === selected[i])
    : correct.every((c) => selected.includes(c));
}
