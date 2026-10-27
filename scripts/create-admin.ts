import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { db, first } from "../src/lib/db";
import { ready } from "../src/lib/content";
// Promote an existing registered account; no default credentials or public role assignment.
async function main() {
  await ready();
  const rl = createInterface({ input: stdin, output: stdout });
  const email = (await rl.question("Existing account email to promote: "))
    .trim()
    .toLowerCase();
  const role =
    (
      await rl.question(
        "Role (learner, reviewer, content_admin, system_admin) [system_admin]: ",
      )
    ).trim() || "system_admin";
  rl.close();
  if (!["learner", "reviewer", "content_admin", "system_admin"].includes(role))
    throw Error("Unknown role.");
  const user = await first<{ id: string }>(
    db(),
    "SELECT id FROM users WHERE email=?",
    [email],
  );
  if (!user) throw Error("Register this account first.");
  await db().transaction((tx) =>
    tx.run("UPDATE users SET role=? WHERE id=?", [role, user.id]),
  );
  console.log(`Account role updated to ${role}.`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
