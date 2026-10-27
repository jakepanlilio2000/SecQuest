import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db, first, type Database } from "./db";
import { lockUser } from "./auth";
import { AppError } from "./errors";
import type { NotebookEntry, SecurityConcept } from "./intelligence-types";
import type { Question, Attempt, Review } from "./types";
import { loadDefinitions, loadGraph } from "./intelligence-store";
import { conceptPerformance } from "./knowledge-graph";
import { backfillEvidence, findingsFor } from "./misconceptions";
export const defaultFolders = [
  "Cryptography",
  "Network Security",
  "Cloud Security",
  "Threats and Vulnerabilities",
  "Security Architecture",
  "Incident Response",
  "Governance and Compliance",
  "Personal Study Notes",
];
export const entrySchema = z.object({
  id: z.string().uuid(),
  mutationId: z.string().uuid(),
  expectedRevision: z.number().int().min(0),
  title: z.string().trim().min(1).max(180),
  body: z.string().max(50000),
  notebookId: z.string().uuid().nullable().default(null),
  category: z.string().trim().min(1).max(80).default("Personal Study Notes"),
  objective: z.string().max(20).nullable().default(null),
  conceptId: z.string().max(100).nullable().default(null),
  questionId: z.string().max(90).nullable().default(null),
  questionRevision: z.number().int().positive().nullable().default(null),
  sourceRefs: z.array(z.string().max(100)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  pinned: z.boolean().default(false),
});
export type NoteInput = z.infer<typeof entrySchema>;
async function ownedEntry(
  tx: Database,
  user: string,
  id: string,
  deleted = true,
) {
  const e = await first<NotebookEntry>(
    tx,
    `SELECT * FROM notebook_entries WHERE id=? AND user_id=?${deleted ? "" : " AND deleted_at IS NULL"}`,
    [id, user],
  );
  if (!e) throw new AppError("Note not found.", 404);
  const tags = await tx.all<{ name: string }>(
    "SELECT t.name FROM notebook_tags t JOIN notebook_entry_tags et ON et.tag_id=t.id WHERE et.entry_id=? AND t.user_id=? ORDER BY t.name",
    [id, user],
  );
  return { ...e, tags: tags.map((t) => t.name) };
}
export async function readEntry(user: string, id: string, database = db()) {
  return ownedEntry(database, user, id);
}
async function ensureFolders(tx: Database, user: string) {
  for (const name of defaultFolders)
    await tx.run(
      "INSERT INTO notebooks(id,user_id,name,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,name) DO NOTHING",
      [randomUUID(), user, name, new Date().toISOString()],
    );
}
async function validateLinks(tx: Database, user: string, input: NoteInput) {
  if (
    input.notebookId &&
    !(await first(tx, "SELECT id FROM notebooks WHERE id=? AND user_id=?", [
      input.notebookId,
      user,
    ]))
  )
    throw new AppError("Folder not found.", 404);
  if (
    input.conceptId &&
    !(await first(tx, "SELECT id FROM security_concepts WHERE id=?", [
      input.conceptId,
    ]))
  )
    throw new AppError("Concept not found.");
  if (
    input.objective &&
    !(await first(tx, "SELECT id FROM objectives WHERE id=?", [
      `SY0-801:${input.objective}`,
    ]))
  )
    throw new AppError("Objective not found.");
  if (!!input.questionId !== !!input.questionRevision)
    throw new AppError("Question and revision must be supplied together.");
  if (
    input.questionId &&
    !(await first(
      tx,
      "SELECT r.revision FROM question_revisions r JOIN questions q ON q.id=r.question_id WHERE r.question_id=? AND r.revision=? AND (q.status='published' OR EXISTS (SELECT 1 FROM attempts a WHERE a.user_id=? AND a.question_id=r.question_id AND a.revision=r.revision))",
      [input.questionId, input.questionRevision, user],
    ))
  )
    throw new AppError("Question reference is unavailable.");
  for (const id of input.sourceRefs)
    if (!(await first(tx, "SELECT id FROM content_sources WHERE id=?", [id])))
      throw new AppError("Unknown source reference.");
}
async function history(tx: Database, e: NotebookEntry) {
  await tx.run(
    "INSERT INTO notebook_entry_history(entry_id,revision,data,saved_at) VALUES (?,?,?,?)",
    [e.id, e.revision, JSON.stringify(e), e.updated_at],
  );
}
export async function saveEntry(
  user: string,
  value: unknown,
  database = db(),
  originKey: string | null = null,
) {
  const input = entrySchema.parse(value);
  input.tags = [...new Set(input.tags.map((t) => t.toLowerCase()))].sort();
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    const retry = await first<{ request_hash: string; response: string }>(
      tx,
      "SELECT request_hash,response FROM notebook_mutations WHERE user_id=? AND mutation_id=?",
      [user, input.mutationId],
    );
    if (retry) {
      if (retry.request_hash !== requestHash)
        throw new AppError(
          "This save identifier was already used for different content.",
          409,
        );
      return JSON.parse(retry.response) as NotebookEntry;
    }
    await validateLinks(tx, user, input);
    const old = await first<NotebookEntry>(
      tx,
      "SELECT * FROM notebook_entries WHERE id=? AND user_id=?",
      [input.id, user],
    );
    if (
      !old &&
      (await first(tx, "SELECT id FROM notebook_entries WHERE id=?", [
        input.id,
      ]))
    )
      throw new AppError("Note not found.", 404);
    if (old?.deleted_at)
      throw new AppError("Restore this note from Trash before editing.", 409);
    if (
      old
        ? old.revision !== input.expectedRevision
        : input.expectedRevision !== 0
    )
      throw new AppError(
        "This note changed elsewhere. Your local draft is retained; reload and compare before saving.",
        409,
      );
    const at = new Date().toISOString();
    if (old) {
      await tx.run(
        "UPDATE notebook_entries SET notebook_id=?,title=?,body=?,category=?,objective=?,concept_id=?,question_id=?,question_revision=?,source_refs=?,pinned=?,study_url=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?",
        [
          input.notebookId,
          input.title,
          input.body,
          input.category,
          input.objective,
          input.conceptId,
          input.questionId,
          input.questionRevision,
          JSON.stringify(input.sourceRefs),
          input.pinned ? 1 : 0,
          input.conceptId
            ? `/?view=knowledge-map&concept=${encodeURIComponent(input.conceptId)}`
            : "/?view=notebook",
          at,
          input.id,
          user,
          input.expectedRevision,
        ],
      );
    } else
      await tx.run(
        "INSERT INTO notebook_entries(id,user_id,notebook_id,title,body,category,objective,concept_id,question_id,question_revision,source_refs,study_url,pinned,origin_key,revision,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          input.id,
          user,
          input.notebookId,
          input.title,
          input.body,
          input.category,
          input.objective,
          input.conceptId,
          input.questionId,
          input.questionRevision,
          JSON.stringify(input.sourceRefs),
          input.conceptId
            ? `/?view=knowledge-map&concept=${encodeURIComponent(input.conceptId)}`
            : "/?view=notebook",
          input.pinned ? 1 : 0,
          originKey,
          1,
          at,
          at,
        ],
      );
    if (old)
      await tx.run("DELETE FROM notebook_entry_tags WHERE entry_id=?", [
        input.id,
      ]);
    for (const name of input.tags) {
      await tx.run(
        "INSERT INTO notebook_tags(id,user_id,name) VALUES (?,?,?) ON CONFLICT(user_id,name) DO NOTHING",
        [randomUUID(), user, name],
      );
      const tag = await first<{ id: string }>(
        tx,
        "SELECT id FROM notebook_tags WHERE user_id=? AND name=?",
        [user, name],
      );
      await tx.run(
        "INSERT INTO notebook_entry_tags(entry_id,tag_id) VALUES (?,?)",
        [input.id, tag!.id],
      );
    }
    const result = await ownedEntry(tx, user, input.id);
    await history(tx, result);
    await tx.run(
      "INSERT INTO notebook_mutations(user_id,mutation_id,entry_id,request_hash,response) VALUES (?,?,?,?,?)",
      [user, input.mutationId, input.id, requestHash, JSON.stringify(result)],
    );
    return result;
  });
}
export async function listNotebook(
  user: string,
  params: URLSearchParams,
  database = db(),
) {
  await database.transaction((tx) => ensureFolders(tx, user));
  const where = [
    "e.user_id=?",
    params.get("trash") === "true"
      ? "e.deleted_at IS NOT NULL"
      : "e.deleted_at IS NULL",
  ];
  const values: (string | number | null)[] = [user];
  const query = (params.get("search") ?? "").slice(0, 200).toLowerCase();
  if (query) {
    where.push(
      "(LOWER(e.title) LIKE ? OR LOWER(e.body) LIKE ? OR LOWER(e.objective) LIKE ? OR LOWER(e.category) LIKE ? OR EXISTS (SELECT 1 FROM notebook_entry_tags et JOIN notebook_tags t ON t.id=et.tag_id WHERE et.entry_id=e.id AND t.user_id=? AND LOWER(t.name) LIKE ?))",
    );
    const like = "%" + query + "%";
    values.push(like, like, like, like, user, like);
  }
  if (params.get("folder")) {
    where.push("e.notebook_id=?");
    values.push(params.get("folder"));
  }
  if (params.get("concept")) {
    where.push("e.concept_id=?");
    values.push(params.get("concept"));
  }
  if (params.get("tag")) {
    where.push(
      "EXISTS (SELECT 1 FROM notebook_entry_tags et JOIN notebook_tags t ON t.id=et.tag_id WHERE et.entry_id=e.id AND t.user_id=? AND t.name=?)",
    );
    values.push(user, params.get("tag")!.toLowerCase());
  }
  if (params.get("pinned") === "true") where.push("e.pinned=1");
  if (params.get("focus") === "due") {
    where.push(
      "EXISTS (SELECT 1 FROM review_schedules rs WHERE rs.user_id=e.user_id AND rs.due_at<=? AND (rs.question_id=e.question_id OR EXISTS (SELECT 1 FROM question_concepts qc WHERE qc.question_id=rs.question_id AND qc.concept_id=e.concept_id)))",
    );
    values.push(new Date().toISOString());
  }
  if (params.get("focus") === "gaps") {
    await backfillEvidence(user, database);
    const [graph, findings, attempts, reviews] = await Promise.all([
      loadGraph(database),
      findingsFor(user, database, new Date(), false),
      database.all<Attempt>("SELECT * FROM attempts WHERE user_id=?", [user]),
      database.all<Review>("SELECT * FROM review_schedules WHERE user_id=?", [
        user,
      ]),
    ]);
    const conceptIds = new Set(
      findings
        .filter((f) =>
          [
            "Possible misconception",
            "Likely misconception",
            "Recurring misconception",
          ].includes(f.status),
        )
        .flatMap((f) => f.definition.conceptIds),
    );
    for (const c of graph.nodes) {
      const links = graph.mappings.filter((m) => m.concept_id === c.id);
      if (
        conceptPerformance(
          c.id,
          links.map((m) => m.question_id),
          attempts.filter((a) =>
            links.some(
              (m) =>
                m.question_id === a.question_id && m.revision === a.revision,
            ),
          ),
          reviews,
        ).status === "Needs improvement"
      )
        conceptIds.add(c.id);
    }
    const questionIds = [
      ...new Set(
        graph.mappings
          .filter((m) => conceptIds.has(m.concept_id))
          .map((m) => m.question_id),
      ),
    ];
    const ids = [...conceptIds];
    const clauses = [];
    if (ids.length) {
      clauses.push(`e.concept_id IN (${ids.map(() => "?").join(",")})`);
      values.push(...ids);
    }
    if (questionIds.length) {
      clauses.push(
        `e.question_id IN (${questionIds.map(() => "?").join(",")})`,
      );
      values.push(...questionIds);
    }
    where.push(clauses.length ? `(${clauses.join(" OR ")})` : "1=0");
  }
  const page = Math.max(0, Math.min(10000, Number(params.get("page")) || 0));
  const total = await first<{ n: number }>(
    database,
    `SELECT COUNT(*) AS n FROM notebook_entries e WHERE ${where.join(" AND ")}`,
    values,
  );
  const entries = await database.all<NotebookEntry>(
    `SELECT e.* FROM notebook_entries e WHERE ${where.join(" AND ")} ORDER BY e.pinned DESC,e.updated_at DESC,e.id LIMIT 20 OFFSET ?`,
    [...values, page * 20],
  );
  for (const e of entries)
    e.tags = (
      await database.all<{ name: string }>(
        "SELECT t.name FROM notebook_tags t JOIN notebook_entry_tags et ON et.tag_id=t.id WHERE et.entry_id=? AND t.user_id=? ORDER BY t.name",
        [e.id, user],
      )
    ).map((t) => t.name);
  return {
    entries,
    total: Number(total?.n ?? 0),
    page,
    folders: await database.all<{ id: string; name: string }>(
      "SELECT id,name FROM notebooks WHERE user_id=? ORDER BY name",
      [user],
    ),
    tags: await database.all<{ id: string; name: string }>(
      "SELECT id,name FROM notebook_tags WHERE user_id=? ORDER BY name",
      [user],
    ),
    sources: (
      await database.all<{ data: string }>("SELECT data FROM content_sources")
    ).map(
      (r) => JSON.parse(r.data) as { id: string; name: string; url: string },
    ),
  };
}
export async function trashEntry(
  user: string,
  id: string,
  restore: boolean,
  database = db(),
) {
  return database.transaction(async (tx) => {
    await lockUser(tx, user);
    const old = await ownedEntry(tx, user, id);
    if ((restore && !old.deleted_at) || (!restore && old.deleted_at))
      return old;
    await tx.run(
      "UPDATE notebook_entries SET deleted_at=?,updated_at=?,revision=revision+1 WHERE id=? AND user_id=?",
      [
        restore ? null : new Date().toISOString(),
        new Date().toISOString(),
        id,
        user,
      ],
    );
    const result = await ownedEntry(tx, user, id);
    await history(tx, result);
    return result;
  });
}
export async function saveContextNote(
  user: string,
  input: {
    questionId?: string;
    revision?: number;
    conceptId?: string;
    misconceptionId?: string;
    kind: "reference" | "explanation" | "comparison";
  },
  database = db(),
) {
  let origin = "",
    title = "",
    body = "",
    objective: string | null = null,
    conceptId = input.conceptId ?? null,
    questionId = input.questionId ?? null,
    revision = input.revision ?? null,
    sources: string[] = [];
  if (input.misconceptionId) {
    const m = (await loadDefinitions(database)).find(
      (m) =>
        m.id === input.misconceptionId &&
        m.validationStatus === "editorial-reviewed",
    );
    if (!m) throw new AppError("Comparison not found.", 404);
    origin = `comparison:${m.id}`;
    title = m.title;
    body = `# ${m.title}\n\n## A common incorrect model\n${m.incorrectBelief}\n\n## Correct principle\n${m.correctExplanation}\n\n| Concept | Meaning |\n| --- | --- |\n${m.comparison.map((r) => `| ${r.label.replaceAll("|", "/")} | ${r.meaning.replaceAll("|", "/")} |`).join("\n")}\n\n## Practical example\n${m.examples.join("\n\n")}\n\n## My explanation\n`;
    conceptId = m.conceptIds[0];
    objective = m.objectives[0] ?? null;
    sources = m.references;
  } else if (questionId && revision) {
    const row = await first<{ content: string; copy_allowed: number }>(
      database,
      "SELECT r.content,COALESCE(p.copy_allowed,0) AS copy_allowed FROM question_revisions r LEFT JOIN question_notebook_policy p ON p.question_id=r.question_id AND p.revision=r.revision WHERE r.question_id=? AND r.revision=?",
      [questionId, revision],
    );
    if (!row) throw new AppError("Question not found.", 404);
    const q = JSON.parse(row.content) as Question;
    const attempted = await first(
      database,
      "SELECT id FROM attempts WHERE user_id=? AND question_id=? AND revision=?",
      [user, questionId, revision],
    );
    const inSession =
      input.kind === "reference" &&
      (await first(
        database,
        "SELECT i.id FROM session_items i JOIN quiz_sessions s ON s.id=i.session_id WHERE s.user_id=? AND i.question_id=? AND i.revision=?",
        [user, questionId, revision],
      ));
    if (!attempted && !inSession)
      throw new AppError(
        "Submit this question before saving its learning context.",
        403,
      );
    title = q.concept;
    objective = q.objective;
    conceptId =
      (await loadGraph(database)).mappings.find(
        (m) => m.question_id === questionId && m.revision === revision,
      )?.concept_id ?? null;
    origin = `${input.kind}:${questionId}:${revision}`;
    if (input.kind === "explanation") {
      if (!row.copy_allowed)
        throw new AppError(
          "This content has no notebook-copy permission. Create a reference note and write your own explanation.",
          403,
        );
      body = `# ${q.concept}\n\n## Definition\n${q.definition}\n\n## Explanation\n${q.explanation}\n\n## Examples\n${q.examples.map((e) => "- " + e).join("\n")}\n\n## My explanation\n`;
      sources = q.sources;
    } else
      body = `# My understanding of ${q.concept}\n\n## My explanation\n\n## Personal example\n`;
  } else if (conceptId) {
    const row = await first<{ data: string }>(
      database,
      "SELECT data FROM security_concepts WHERE id=?",
      [conceptId],
    );
    if (!row) throw new AppError("Concept not found.", 404);
    const c = JSON.parse(row.data) as SecurityConcept;
    title = c.name;
    objective = c.objectives[0] ?? null;
    origin = `concept:${conceptId}`;
    body = `# My understanding of ${c.name}\n\n## My explanation\n\n## Personal example\n`;
  } else
    throw new AppError("Choose a concept, answered question, or comparison.");
  const existing = await first<{ id: string }>(
    database,
    "SELECT id FROM notebook_entries WHERE user_id=? AND origin_key=?",
    [user, origin],
  );
  if (existing) return readEntry(user, existing.id, database);
  try {
    return await saveEntry(
      user,
      {
        id: randomUUID(),
        mutationId: randomUUID(),
        expectedRevision: 0,
        title,
        body,
        objective,
        conceptId,
        questionId,
        questionRevision: revision,
        sourceRefs: sources,
        tags: input.misconceptionId ? ["frequently confused"] : [],
        category: input.misconceptionId
          ? "Comparisons"
          : "Personal Study Notes",
      },
      database,
      origin,
    );
  } catch (e) {
    const duplicate = await first<{ id: string }>(
      database,
      "SELECT id FROM notebook_entries WHERE user_id=? AND origin_key=?",
      [user, origin],
    );
    if (duplicate) return readEntry(user, duplicate.id, database);
    throw e;
  }
}
export async function exportNotebook(user: string, database = db()) {
  const entries = await database.all<NotebookEntry>(
    "SELECT * FROM notebook_entries WHERE user_id=? ORDER BY updated_at DESC",
    [user],
  );
  for (const e of entries)
    e.tags = (await readEntry(user, e.id, database)).tags;
  const sources = await database.all<{ id: string; data: string }>(
    "SELECT id,data FROM content_sources",
  );
  const sourceMap = new Map(sources.map((s) => [s.id, JSON.parse(s.data)]));
  const data = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    entries: entries.map((e) => ({
      ...e,
      references: (JSON.parse(e.source_refs) as string[])
        .map((id) => sourceMap.get(id))
        .filter(Boolean),
    })),
  };
  const markdown = data.entries
    .map(
      (e) =>
        `# ${e.title}\n\n${e.body}\n\n---\nObjective: ${e.objective ?? "None"}\n\nConcept: ${e.concept_id ?? "None"}\n\nQuestion: ${e.question_id ?? "None"}${e.question_revision ? " revision " + e.question_revision : ""}\n\nTags: ${e.tags.join(", ")}\n\nCategory: ${e.category}\n\nStudy link: ${e.study_url}\n\nDeleted: ${e.deleted_at ?? "No"}\n\nReferences:\n${e.references.map((s: { name: string; url: string }) => `- [${s.name}](${s.url})`).join("\n")}`,
    )
    .join("\n\n\n");
  return { data, markdown };
}
