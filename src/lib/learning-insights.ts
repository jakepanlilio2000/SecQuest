import type { Attempt } from "./types";
export function wilsonInterval(correct: number, total: number) {
  if (!total) return null;
  const z = 1.959963984540054,
    p = correct / total,
    denominator = 1 + (z * z) / total;
  const middle = (p + (z * z) / (2 * total)) / denominator;
  const half =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
    denominator;
  return {
    lower: Math.max(0, Math.round(100 * (middle - half))),
    upper: Math.min(100, Math.round(100 * (middle + half))),
    samples: total,
  };
}
export function learningInsights(attempts: Attempt[], now = new Date()) {
  const day = 86400000,
    today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = new Date(today - (27 - i * 7) * day).toISOString(),
      end = new Date(today - (20 - i * 7) * day).toISOString();
    const rows = attempts.filter(
        (a) => a.created_at >= start && a.created_at < end,
      ),
      firsts = rows.filter((a) => a.first_attempt),
      delayed = rows.filter((a) => a.retention);
    return {
      start,
      end,
      attempts: rows.length,
      firsts: firsts.length,
      firstAccuracy: firsts.length
        ? Math.round(
            (100 * firsts.filter((a) => a.correct).length) / firsts.length,
          )
        : null,
      delayed: delayed.length,
      delayedAccuracy: delayed.length
        ? Math.round(
            (100 * delayed.filter((a) => a.correct).length) / delayed.length,
          )
        : null,
    };
  });
  const objectives = [...new Set(attempts.map((a) => a.objective))]
    .sort()
    .map((objective) => {
      const firsts = attempts.filter(
          (a) => a.objective === objective && a.first_attempt,
        ),
        times = firsts
          .map((a) => a.duration_ms)
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
      const mid = Math.floor(times.length / 2),
        median = times.length
          ? times.length % 2
            ? times[mid]
            : (times[mid - 1] + times[mid]) / 2
          : null;
      return {
        objective,
        samples: times.length,
        medianSeconds: median === null ? null : Math.round(median / 1000),
        interval: wilsonInterval(
          firsts.filter((a) => a.correct).length,
          firsts.length,
        ),
      };
    });
  return { weeks, objectives };
}
