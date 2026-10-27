import { seed } from "../src/lib/content";
import { questions } from "../content/questions";
seed()
  .then(() => {
    console.log(
      `Seeded ${questions.length} original starter questions. Independent SME review outstanding.`,
    );
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
