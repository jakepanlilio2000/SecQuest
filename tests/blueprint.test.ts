import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ready, currentBlueprint } from "../src/lib/content";
import { createUser, createAuthSession } from "../src/lib/auth";
import { db, first } from "../src/lib/db";
import { handle } from "../src/lib/api";
import { readSession, startSession, answer } from "../src/lib/engine";
import { questions } from "../content/questions";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-blueprint-")),
  "test.sqlite",
);
process.env.DATABASE_URL = "";
test("exam configurations are versioned and only new sessions use changed limits", async () => {
  await ready();
  const user = await createUser(
    "editor@example.test",
    "Editor",
    "A long synthetic testing passphrase!",
  );
  await db().transaction((tx) =>
    tx.run("UPDATE users SET role='system_admin' WHERE id=?", [user.id]),
  );
  const token = await createAuthSession(user.id);
  const original = await startSession(user.id, "mock", { count: 5 });
  const response = await handle(
    new Request("http://localhost:3000/api/admin/blueprint", {
      method: "PATCH",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: `sq_session=${token}`,
      },
      body: JSON.stringify({
        revision: "2.0-local-test",
        maxQuestions: 3,
        durationMinutes: 10,
        note: "Verify that versioned limits affect new sessions only.",
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await currentBlueprint()).maxQuestions, 3);
  const next = await startSession(user.id, "mock", { count: 5 });
  assert.equal(next.count, 3);
  const oldState = await readSession(user.id, original.id),
    newState = await readSession(user.id, next.id);
  assert.equal(JSON.parse(oldState.session.settings).blueprintRevision, "2.0");
  assert.equal(
    JSON.parse(newState.session.settings).blueprintRevision,
    "2.0-local-test",
  );
  assert.equal(
    Date.parse(newState.session.expires_at!) -
      Date.parse(newState.session.created_at),
    600000,
  );
  assert.ok(
    await first(
      db(),
      "SELECT revision FROM blueprint_revisions WHERE revision=?",
      ["2.0"],
    ),
  );
});
test("matching, ordering, and multiple answers are graded by server semantics", async () => {
  const user = await createUser(
    "formats@example.test",
    "Format Test",
    "A long synthetic testing passphrase!",
  );
  for (const type of ["matching", "ordering", "multiple"]) {
    const s = await startSession(user.id, "practice", { count: 1, type });
    const state = await readSession(user.id, s.id);
    const q = questions.find((q) => q.id === state.item!.question.id)!;
    const result = await answer(
      user.id,
      s.id,
      state.item!.id,
      q.correct,
      "knew",
    );
    assert.ok("correct" in result && result.correct);
  }
});
