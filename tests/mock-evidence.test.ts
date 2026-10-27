import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUser } from "../src/lib/auth";
import { ready } from "../src/lib/content";
import {
  startSession,
  readSession,
  sessionAction,
  answer,
} from "../src/lib/engine";
import { overview } from "../src/lib/analytics";
import { questions } from "../content/questions";
process.env.DATABASE_URL = "";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-evidence-")),
  "test.sqlite",
);
test("unanswered mock questions affect raw score but do not fabricate question encounters or XP", async () => {
  await ready();
  const user = await createUser(
    "blank@example.test",
    "Blank Mock",
    "A long synthetic test passphrase!",
  );
  const s = await startSession(user.id, "mock", { count: 5 });
  const st = await readSession(user.id, s.id);
  await answer(
    user.id,
    s.id,
    st.item!.id,
    questions.find((q) => q.id === st.item!.question.id)!.correct,
    null,
  );
  await sessionAction(user.id, s.id, "finish");
  const stats = await overview(user.id);
  assert.equal(stats.firstCount, 1);
  assert.equal(stats.mockHistory[0].accuracy, 20);
  assert.equal(stats.mockHistory[0].count, 5);
  const report = await readSession(user.id, s.id);
  assert.equal(report.items?.filter((i) => i.feedback?.skipped).length, 4);
});
test("matching mock drafts can save a partially completed mapping without losing positions", async () => {
  const user = await createUser(
    "partial@example.test",
    "Partial Mock",
    "A long synthetic test passphrase!",
  );
  const s = await startSession(user.id, "mock", { count: 1, type: "matching" });
  const st = await readSession(user.id, s.id);
  await answer(user.id, s.id, st.item!.id, ["", "B", ""], null);
  const restored = await readSession(user.id, s.id);
  assert.deepEqual(restored.item?.selected, ["", "B", ""]);
});
