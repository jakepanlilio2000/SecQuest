import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, retryPosition, schedule, DAY } from "../src/lib/scheduler";
import type { Review } from "../src/lib/types";
const now = new Date("2026-10-27T08:00:00Z");
function prior(extra: Partial<Review> = {}): Review {
  return {
    user_id: "u",
    question_id: "q",
    due_at: now.toISOString(),
    interval_days: 1,
    ease: 2.5,
    repetitions: 1,
    lapses: 1,
    retained: 0,
    last_at: new Date(now.getTime() - 2 * DAY).toISOString(),
    state: "learning",
    ...extra,
  };
}
test("wrong answers are scheduled automatically without claiming mastery", () => {
  const s = schedule(undefined, false, null, now, false);
  assert.equal(s.state, "relearning");
  assert.equal(s.lapses, 1);
  assert.equal(s.retained, 0);
  assert.equal(Date.parse(s.due_at) - now.getTime(), 15 * 60000);
});
test("short-term correct retry schedules tomorrow without independent evidence", () => {
  const s = schedule(prior(), true, "knew", now, true);
  assert.equal(s.retained, 0);
  assert.equal(s.repetitions, 1);
  assert.equal(s.interval_days, 1);
  assert.equal(s.retention, 0);
});
test("delayed recall expands intervals to 3, 7, and 14 days", () => {
  let p = prior();
  for (const expected of [3, 7, 14]) {
    const s = schedule(p, true, "knew", now, false);
    assert.equal(s.interval_days, expected);
    p = {
      ...p,
      ...s,
      last_at: new Date(now.getTime() - 3 * DAY).toISOString(),
    };
  }
  assert.equal(p.state, "retained");
});
test("a correct guess limits the interval to one day", () =>
  assert.equal(
    schedule(
      prior({ repetitions: 5, interval_days: 14 }),
      true,
      "guessed",
      now,
      false,
    ).interval_days,
    1,
  ));
test("failure on a delayed review remains retention evidence and resets repetition", () => {
  const s = schedule(
    prior({ repetitions: 5, retained: 3 }),
    false,
    "knew",
    now,
    false,
  );
  assert.equal(s.retention, 1);
  assert.equal(s.repetitions, 0);
  assert.equal(s.lapses, 2);
  assert.equal(s.state, "relearning");
});
test("same-day repeat is not independent evidence", () => {
  const s = schedule(
    prior({ last_at: new Date(now.getTime() - 60000).toISOString() }),
    true,
    "knew",
    now,
    false,
  );
  assert.equal(s.retention, 0);
  assert.equal(s.retained, 0);
});
test("short retry spacing is randomized from three to eight intervening items", () => {
  assert.equal(
    retryPosition(0, 20, () => 0),
    4,
  );
  assert.equal(
    retryPosition(0, 20, () => 0.9999),
    9,
  );
});
test("insufficient remaining questions defer the retry", () => {
  assert.equal(
    retryPosition(8, 12, () => 0),
    null,
  );
  assert.equal(
    retryPosition(0, 4, () => 0),
    null,
  );
});
test("multiple-response grading requires the exact set with no duplicates", () => {
  assert.equal(grade(["A", "B"], ["B", "A"]), true);
  assert.equal(grade(["A", "B"], ["A"]), false);
  assert.equal(grade(["A", "B"], ["A", "B", "C"]), false);
  assert.equal(grade(["A", "B"], ["A", "A"]), false);
});
test("matching and ordering require sequence equality", () => {
  assert.equal(grade(["A", "B", "C"], ["A", "B", "C"], true), true);
  assert.equal(grade(["A", "B", "C"], ["B", "A", "C"], true), false);
});
