import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const url =
  "https://lecbyo.files.cmp.optimizely.com/download/77f3bd3223ac11f180820e495f189928";
const bytes = process.argv[2]
  ? readFileSync(process.argv[2])
  : Buffer.from(await (await fetch(url)).arrayBuffer());
const pdf = await getDocument({
  data: new Uint8Array(bytes),
  useSystemFonts: true,
}).promise;
const objectives = [];
let active = null;
let bullet = null;
const flush = () => {
  if (bullet && active) active.subtopics.push(bullet);
  bullet = null;
};
for (let i = 4; i <= 23; i++) {
  const page = await pdf.getPage(i);
  const items = (await page.getTextContent()).items
    .map((x) => x.str.trim())
    .filter(Boolean);
  for (const text of items) {
    if (/^(CompTIA Security|Exam Objectives Document|Copyright)/.test(text))
      continue;
    if (/^[1-5]\.0(?:\s|$)/.test(text)) {
      flush();
      active = null;
      continue;
    }
    if (/^[1-5]\.[1-9]$/.test(text)) {
      flush();
      active = { id: text, description: "", subtopics: [], page: i };
      objectives.push(active);
      continue;
    }
    if (!active) continue;
    if (["", "•", "♦", ""].includes(text)) {
      flush();
      bullet = { level: ["", "•", "♦", ""].indexOf(text), text: "" };
      continue;
    }
    if (bullet) bullet.text += (bullet.text ? " " : "") + text;
    else active.description += (active.description ? " " : "") + text;
  }
  flush();
}
if (
  objectives.length !== 27 ||
  objectives.some((x) => !x.description || !x.subtopics.length)
)
  throw Error("Unexpected PDF structure; manual review needed.");
writeFileSync(
  "content/blueprint.json",
  JSON.stringify(
    {
      code: "SY0-801",
      name: "CompTIA Security+ V8",
      revision: "2.0",
      verifiedAt: "2026-10-27",
      status: "published-objectives; exam launch date not verified",
      sourceUrl: url,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      maxQuestions: 90,
      durationMinutes: 90,
      domains: [
        { number: 1, name: "General Security Concepts", weight: 16 },
        {
          number: 2,
          name: "Threats, Vulnerabilities, and Attacks",
          weight: 24,
        },
        { number: 3, name: "Security Architecture", weight: 19 },
        { number: 4, name: "Security Operations", weight: 27 },
        {
          number: 5,
          name: "Security Program Management and Oversight",
          weight: 14,
        },
      ],
      objectives,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Imported ${objectives.length} objectives and ${objectives.reduce((n, o) => n + o.subtopics.length, 0)} hierarchical subtopic nodes. Review before seeding.`,
);
