import { createHash, randomUUID } from "node:crypto";
import blueprint from "../../content/blueprint.json";
import { sources } from "../../content/sources";
import { questions } from "../../content/questions";
import { db, first, migrate, type Database } from "./db";
import { questionSchema, type Question, type PublicQuestion } from "./types";
import { seedIntelligence } from "./intelligence-store";
import { seedCertificationRegistry } from "./certifications";
import { AppError } from "./errors";
export { blueprint };
// Fixed SQL for a question_revisions alias `r`; bind the exam code twice.
// A bare objective (for example 1.1) never establishes an exam identity.
export const questionExamScope = `
  EXISTS (SELECT 1 FROM question_objectives qo
    JOIN objectives o ON o.id=qo.objective_id JOIN domains d ON d.id=o.domain_id
    WHERE qo.question_id=r.question_id AND qo.revision=r.revision AND d.exam_code=?)
  AND NOT EXISTS (SELECT 1 FROM question_objectives qo
    JOIN objectives o ON o.id=qo.objective_id JOIN domains d ON d.id=o.domain_id
    WHERE qo.question_id=r.question_id AND qo.revision=r.revision AND d.exam_code<>?)`;
export async function currentBlueprint(
  database = db(),
): Promise<typeof blueprint> {
  const row = await first<{ data: string }>(
    database,
    "SELECT data FROM exam_versions WHERE code=?",
    [blueprint.code],
  );
  return row ? JSON.parse(row.data) : blueprint;
}
export const fingerprint = (prompt: string) =>
  createHash("sha256")
    .update(prompt.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .digest("hex");
export function validateQuestion(
  input: unknown,
  exam: Pick<typeof blueprint, "objectives"> = blueprint,
): Question {
  const q = questionSchema.parse(input);
  if (!exam.objectives.some((o) => o.id === q.objective))
    throw Error("Unknown objective");
  if (
    q.sources.some(
      (s) =>
        !sources.some((x) => x.id === s && !x.status.startsWith("unverified")),
    )
  )
    throw Error("Source must have verified provenance");
  if (new Set(q.options.map((x) => x.id)).size !== q.options.length)
    throw Error("Duplicate option ID");
  if (
    q.correct.some((c) => !q.options.some((o) => o.id === c)) ||
    new Set(q.correct).size !== q.correct.length
  )
    throw Error("Invalid correct answers");
  if (["single", "scenario", "log"].includes(q.type) && q.correct.length !== 1)
    throw Error("Single-response question must have one answer");
  if (q.type === "multiple" && q.correct.length < 2)
    throw Error("Multiple-response question needs at least two answers");
  if (q.type === "ordering" && q.correct.length !== q.options.length)
    throw Error("Ordering must include every item");
  if (
    q.type === "matching" &&
    (!q.pairs ||
      q.pairs.length !== q.correct.length ||
      new Set(q.correct).size !== q.correct.length)
  )
    throw Error("Matching needs one answer per pair");
  if (q.type === "log" && !q.artifact)
    throw Error("Log analysis needs an artifact");
  return q;
}
export function publicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    revision: q.revision,
    type: q.type,
    objective: q.objective,
    difficulty: q.difficulty,
    prompt: q.prompt,
    concept: q.concept,
    categories: q.categories,
    pairs: q.pairs,
    artifact: q.artifact,
    required: q.correct.length,
    // Stable variation prevents answer-position training and keeps refreshes consistent.
    options: q.options
      .map(({ id, text }) => ({ id, text }))
      .sort((a, b) =>
        createHash("sha256")
          .update(q.id + a.id)
          .digest("hex")
          .localeCompare(
            createHash("sha256")
              .update(q.id + b.id)
              .digest("hex"),
          ),
      ),
  };
}
export async function saveRevision(
  tx: Database,
  q: Question,
  actor: string,
  examCode = blueprint.code,
) {
  if (
    !(await first(
      tx,
      "SELECT o.id FROM objectives o JOIN domains d ON d.id=o.domain_id WHERE o.id=? AND d.exam_code=?",
      [`${examCode}:${q.objective}`, examCode],
    ))
  )
    throw new AppError("Unknown objective for this exam");
  // Every older revision must have an unambiguous identity in the same exam.
  // Do not relabel an existing ID, including one with missing ownership links.
  if (
    await first(
      tx,
      `SELECT r.revision FROM question_revisions r WHERE r.question_id=? AND NOT (${questionExamScope}) LIMIT 1`,
      [q.id, examCode, examCode],
    )
  )
    throw new AppError("A question cannot move between exams", 409);
  const now = new Date().toISOString();
  await tx.run(
    "INSERT INTO question_revisions(question_id,revision,content,created_by,created_at) VALUES (?,?,?,?,?)",
    [q.id, q.revision, JSON.stringify(q), actor, now],
  );
  for (const o of q.options)
    await tx.run(
      "INSERT INTO question_options(question_id,revision,option_id,text,explanation,is_correct) VALUES (?,?,?,?,?,?)",
      [
        q.id,
        q.revision,
        o.id,
        o.text,
        o.explanation,
        q.correct.includes(o.id) ? 1 : 0,
      ],
    );
  await tx.run(
    "INSERT INTO question_objectives(question_id,revision,objective_id) VALUES (?,?,?)",
    [q.id, q.revision, `${examCode}:${q.objective}`],
  );
  for (const category of new Set(q.categories))
    await tx.run(
      "INSERT INTO question_categories(question_id,revision,category) VALUES (?,?,?)",
      [q.id, q.revision, category],
    );
}
export async function seed(database = db()) {
  await migrate(database);
  await database.transaction(async (tx) => {
    for (const source of sources)
      await tx.run(
        "INSERT INTO content_sources(id,data) VALUES (?,?) ON CONFLICT(id) DO NOTHING",
        [source.id, JSON.stringify(source)],
      );
    await tx.run(
      "INSERT INTO exam_versions(code,revision,data) VALUES (?,?,?) ON CONFLICT(code) DO NOTHING",
      [blueprint.code, blueprint.revision, JSON.stringify(blueprint)],
    );
    await tx.run(
      "INSERT INTO blueprint_revisions(exam_code,revision,data,created_at) VALUES (?,?,?,?) ON CONFLICT(exam_code,revision) DO NOTHING",
      [
        blueprint.code,
        blueprint.revision,
        JSON.stringify(blueprint),
        new Date().toISOString(),
      ],
    );
    for (const d of blueprint.domains)
      await tx.run(
        "INSERT INTO domains(id,exam_code,number,name,weight) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
        [
          `${blueprint.code}:${d.number}`,
          blueprint.code,
          d.number,
          d.name,
          d.weight,
        ],
      );
    for (const o of blueprint.objectives)
      await tx.run(
        "INSERT INTO objectives(id,domain_id,description,subtopics,source_id) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
        [
          `${blueprint.code}:${o.id}`,
          `${blueprint.code}:${o.id[0]}`,
          o.description,
          JSON.stringify(o.subtopics),
          "comptia-v8",
        ],
      );
    for (const input of questions) {
      const q = validateQuestion(input);
      const existing = await first<{
        current_revision: number;
        status: string;
        created_by: string;
      }>(
        tx,
        "SELECT q.current_revision,q.status,r.created_by FROM questions q JOIN question_revisions r ON r.question_id=q.id AND r.revision=q.current_revision WHERE q.id=?",
        [q.id],
      );
      if (existing) {
        if (
          existing.current_revision >= q.revision ||
          existing.status !== "published" ||
          existing.created_by !== "original-seed-editorial"
        )
          continue;
        await tx.run(
          "UPDATE questions SET current_revision=?,fingerprint=? WHERE id=?",
          [q.revision, fingerprint(q.prompt), q.id],
        );
      } else
        await tx.run(
          "INSERT INTO questions(id,current_revision,status,fingerprint,created_at) VALUES (?,?,?,?,?)",
          [
            q.id,
            q.revision,
            "published",
            fingerprint(q.prompt),
            new Date().toISOString(),
          ],
        );
      await saveRevision(tx, q, "original-seed-editorial");
    }
    await seedIntelligence(tx);
    await seedCertificationRegistry(tx);
  });
}
const globalReady = globalThis as unknown as { secquestReady?: Promise<void> };
export function ready() {
  return (globalReady.secquestReady ??= seed().catch((e) => {
    globalReady.secquestReady = undefined;
    throw e;
  }));
}
export async function getQuestion(
  database: Database,
  id: string,
  revision: number,
) {
  const row = await first<{ content: string }>(
    database,
    "SELECT content FROM question_revisions WHERE question_id=? AND revision=?",
    [id, revision],
  );
  if (!row) throw Error("Question revision missing");
  return JSON.parse(row.content) as Question;
}
export async function published(database = db(), examCode = blueprint.code) {
  return (
    await database.all<{ content: string }>(
      `SELECT r.content FROM questions q JOIN question_revisions r ON r.question_id=q.id AND r.revision=q.current_revision WHERE q.status='published' AND ${questionExamScope}`,
      [examCode, examCode],
    )
  ).map((r) => JSON.parse(r.content) as Question);
}
export async function audit(
  tx: Database,
  user: string,
  action: string,
  id: string,
  detail: unknown = {},
) {
  await tx.run(
    "INSERT INTO audit_log(id,user_id,action,entity_id,detail,created_at) VALUES (?,?,?,?,?,?)",
    [
      randomUUID(),
      user,
      action,
      id,
      JSON.stringify(detail),
      new Date().toISOString(),
    ],
  );
}
