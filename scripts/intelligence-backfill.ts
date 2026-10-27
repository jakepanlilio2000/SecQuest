import { ready } from "../src/lib/content";
import { db } from "../src/lib/db";
import { backfillEvidence } from "../src/lib/misconceptions";
async function main() {
  await ready();
  const users = await db().all<{ id: string }>(
    "SELECT id FROM users ORDER BY id",
  );
  let total = 0;
  for (const user of users) {
    let count;
    do {
      count = await backfillEvidence(user.id);
      total += count;
    } while (count === 300);
  }
  console.log(
    JSON.stringify({
      users: users.length,
      derivedAttemptsProcessed: total,
      progressRecordsRewritten: 0,
    }),
  );
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
