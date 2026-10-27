// Synthetic local browser fixture. Never point this script at a learner database.
import { basename } from "node:path";
import { ready } from "../src/lib/content";
import { createUser } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { startSession, readSession, answer } from "../src/lib/engine";
import { saveEntry } from "../src/lib/notebook";
import { randomUUID } from "node:crypto";
async function main() {
  if (
    process.env.DATABASE_URL ||
    basename(process.env.SQLITE_PATH ?? "") !== "upgrade-browser-qa.sqlite"
  )
    throw Error(
      "Requires SQLITE_PATH pointing to upgrade-browser-qa.sqlite and no DATABASE_URL.",
    );
  await ready();
  const existing = await db().all<{ id: string; email: string }>(
    "SELECT id,email FROM users",
  );
  if (existing.some((u) => u.email !== "browser-qa@example.test"))
    throw Error("QA fixture contains another account; refusing changes.");
  const user =
    existing[0] ??
    (await createUser(
      "browser-qa@example.test",
      "QA Learner",
      "Local browser QA only passphrase!",
    ));
  await db().run("UPDATE users SET role='system_admin' WHERE id=?", [user.id]);
  for (const [qid, choice] of [
    ["control-detective", "A"],
    ["ids-ips", "B"],
  ]) {
    if (
      (
        await db().all(
          "SELECT id FROM attempts WHERE user_id=? AND question_id=?",
          [user.id, qid],
        )
      ).length
    )
      continue;
    const s = await startSession(user.id, "practice", {
      count: 1,
      questionIds: [qid],
    });
    const state = await readSession(user.id, s.id);
    await answer(user.id, s.id, state.item!.id, [choice], "knew");
  }
  await saveEntry(user.id, {
    id: randomUUID(),
    mutationId: randomUUID(),
    expectedRevision: 0,
    title: "IDS and IPS — my working model",
    body: "# Detection and prevention\n\n**IDS** detects suspicious activity and alerts. **IPS** can block traffic when correctly deployed inline.\n\n| Control | Main action |\n| --- | --- |\n| IDS | Detect and alert |\n| IPS | Detect and block |\n\n## Retrieval checklist\n- [x] Explain the distinction\n- [ ] Verify it on a later question\n\n> An alert alone does not stop an attack.\n\n```text\nobserve → assess → respond\n```",
    conceptId: "detection",
    objective: "1.1",
    sourceRefs: ["nist-ir"],
    tags: ["frequently confused", "network"],
    pinned: true,
  });
  console.log("Created synthetic browser fixture; no production data changed.");
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
