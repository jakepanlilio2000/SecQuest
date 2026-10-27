import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUser, createAuthSession } from "../src/lib/auth";
import { ready } from "../src/lib/content";
import { db, first, migrate } from "../src/lib/db";
import { handle } from "../src/lib/api";
import { startSession, readSession } from "../src/lib/engine";
import { questions } from "../content/questions";
process.env.DATABASE_URL = "";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-editorial-")),
  "test.sqlite",
);
const password = "A synthetic content workflow passphrase!";
async function request(
  token: string,
  path: string,
  data: unknown,
  method = "POST",
) {
  const r = await handle(
    new Request("http://localhost:3000/api/" + path, {
      method,
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
        Cookie: `sq_session=${token}`,
      },
      body: JSON.stringify(data),
    }),
  );
  return { status: r.status, body: await r.json() };
}
test("reviewer approves, editor publishes, edits preserve active session revision, and reviewer deletion anonymizes history", async () => {
  await ready();
  await migrate();
  const editor = await createUser("editor@example.test", "Editor", password),
    reviewer = await createUser("reviewer@example.test", "Reviewer", password);
  await db().transaction(async (tx) => {
    await tx.run("UPDATE users SET role=? WHERE id=?", [
      "content_admin",
      editor.id,
    ]);
    await tx.run("UPDATE users SET role=? WHERE id=?", [
      "reviewer",
      reviewer.id,
    ]);
  });
  const et = await createAuthSession(editor.id),
    rt = await createAuthSession(reviewer.id),
    q = {
      ...questions[0],
      id: "editorial-fixture",
      prompt:
        "A fictional application needs to protect a session token sent over public Wi-Fi. Which transport control best meets that goal?",
    };
  assert.equal((await request(et, "admin/question", q)).status, 200);
  const status = (token: string, value: string) =>
    request(token, "admin/status", {
      id: q.id,
      status: value,
      note: "A synthetic test verifies the editorial transition.",
    });
  assert.equal((await status(et, "under_review")).status, 200);
  assert.equal((await status(rt, "approved")).status, 200);
  assert.equal((await status(rt, "published")).status, 403);
  assert.equal((await status(et, "published")).status, 200);
  const session = await startSession(editor.id, "practice", {
    count: 1,
    category: q.categories[0],
    objective: q.objective,
  });
  // Pin the reviewed fixture explicitly in this synthetic session to verify immutable references.
  await db().transaction((tx) =>
    tx.run(
      "UPDATE session_items SET question_id=?,revision=1 WHERE session_id=?",
      [q.id, session.id],
    ),
  );
  const edited = {
    ...q,
    revision: 2,
    prompt: q.prompt + " Consider a validated certificate.",
  };
  assert.equal((await request(et, "admin/question", edited)).status, 200);
  assert.equal(
    (
      await first<{ status: string }>(
        db(),
        "SELECT status FROM questions WHERE id=?",
        [q.id],
      )
    )?.status,
    "draft",
  );
  const st = await readSession(editor.id, session.id);
  assert.equal(st.item?.question.prompt, q.prompt);
  assert.equal(st.item?.question.revision, 1);
  assert.equal(
    (await request(rt, "profile", { password }, "DELETE")).status,
    200,
  );
  const reviews = await db().all<{ reviewer_id: string | null }>(
    "SELECT reviewer_id FROM content_reviews WHERE question_id=? AND decision=?",
    [q.id, "approved"],
  );
  assert.equal(reviews[0].reviewer_id, null);
  assert.ok(await first(db(), "SELECT id FROM questions WHERE id=?", [q.id]));
});
