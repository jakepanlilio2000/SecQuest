import { z } from "zod";
import { db, first, type Database } from "./db";
import { defaultReviewPolicy, type ReviewPolicy } from "./scheduler";
import { AppError } from "./errors";
export const reviewPolicySchema = z
  .object({
    version: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/),
    intervals: z.tuple([
      z.number().int().min(1).max(30),
      z.number().int().min(2).max(60),
      z.number().int().min(3).max(120),
      z.number().int().min(4).max(180),
    ]),
    minimumIndependentHours: z.number().min(24).max(168),
    failureMinutes: z.number().int().min(1).max(60),
    minimumEase: z.number().min(1.3).max(2),
    maximumEase: z.number().min(2.5).max(4),
  })
  .refine(
    (p) => p.intervals.every((n, i) => i === 0 || n > p.intervals[i - 1]),
    { message: "Review intervals must increase strictly." },
  );
export async function loadReviewPolicy(
  database: Database = db(),
  version?: string,
): Promise<ReviewPolicy> {
  if (version === defaultReviewPolicy.version) return defaultReviewPolicy;
  const row = await first<{ data: string }>(
    database,
    version
      ? "SELECT data FROM review_policies WHERE version=?"
      : "SELECT data FROM review_policies ORDER BY created_at DESC,version DESC LIMIT 1",
    version ? [version] : [],
  );
  if (version && !row)
    throw new AppError("The session's review policy is unavailable.", 409);
  return row ? JSON.parse(row.data) : defaultReviewPolicy;
}
