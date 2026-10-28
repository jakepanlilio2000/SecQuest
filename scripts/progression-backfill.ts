import { ready } from "../src/lib/content";
import { db } from "../src/lib/db";
import { syncLearningAchievements } from "../src/lib/progression";
async function main() {
  await ready();
  const users = await db().all<{ id: string }>(
    "SELECT id FROM users ORDER BY id",
  );
  for (const user of users)
    await db().transaction((tx) => syncLearningAchievements(tx, user.id));
  console.log(
    JSON.stringify({
      usersChecked: users.length,
      originalProgressRewritten: 0,
      xpAwarded: 0,
    }),
  );
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
