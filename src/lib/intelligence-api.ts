import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, first } from "./db";
import { AppError } from "./errors";
import type { Question, User } from "./types";
import { intelligenceFor } from "./intelligence";
import {
  loadGraph,
  loadDefinitions,
  loadPolicy,
  savePolicy,
  graphAudit,
} from "./intelligence-store";
import { validateGraph, learningPath } from "./knowledge-graph";
import {
  readEntry,
  listNotebook,
  saveEntry,
  saveContextNote,
  trashEntry,
  exportNotebook,
  restoreNoteRevision,
  noteToFlashcard,
} from "./notebook";
import { startSession } from "./engine";
import { lockUser } from "./auth";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const refs = z.array(z.string().max(100)).min(1).max(20);
const nodeSchema = z.object({
  id,
  name: z.string().trim().min(2).max(100),
  definition: z.string().min(20).max(4000),
  explanation: z.string().min(20).max(6000),
  objectives: z
    .array(z.string().regex(/^[1-5]\.\d+$/))
    .min(1)
    .max(8),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]),
  examples: z.array(z.string().min(10).max(1000)).min(1).max(5),
  references: refs,
  validationStatus: z.enum(["editorial-reviewed", "draft"]),
  glossaryTerm: z.string().min(1).max(100),
});
const edgeSchema = z.object({
  id: z.string().min(1).max(300),
  sourceId: id,
  targetId: id,
  kind: z.enum([
    "prerequisite",
    "builds_on",
    "related",
    "confused_with",
    "next",
  ]),
  status: z.enum(["validated", "draft"]),
  rationale: z.string().min(10).max(1000),
  references: refs,
});
const misconceptionSchema = z.object({
  id,
  title: z.string().min(5).max(160),
  description: z.string().min(20).max(3000),
  incorrectBelief: z.string().min(10).max(2000),
  correctExplanation: z.string().min(20).max(4000),
  objectives: z
    .array(z.string().regex(/^[1-5]\.\d+$/))
    .min(1)
    .max(8),
  conceptIds: z.array(id).min(1).max(10),
  assumptions: z.array(z.string().max(1000)).min(1).max(8),
  examples: z.array(z.string().min(10).max(1000)).min(1).max(5),
  questionIds: z.array(z.string().max(90)).max(30),
  prerequisiteIds: z.array(id).max(15),
  comparison: z
    .array(
      z.object({ label: z.string().max(100), meaning: z.string().max(1000) }),
    )
    .min(2)
    .max(8),
  references: refs,
  validationStatus: z.enum(["editorial-reviewed", "draft"]),
});
const mappingSchema = z.object({
  questionId: z.string().max(90),
  revision: z.number().int().positive(),
  optionId: z.string().max(40),
  slot: z.number().int().min(-1).max(7).default(-1),
  misconceptionId: id,
  weight: z.number().min(0.1).max(1.5),
  status: z.enum(["validated", "draft"]),
});
export const policySchema = z
  .object({
    version: z
      .string()
      .regex(/^[a-zA-Z0-9._-]+$/)
      .max(80),
    possibleDistinct: z.number().int().min(2).max(20),
    likelyDistinct: z.number().int().min(2).max(30),
    recurringDistinct: z.number().int().min(3).max(50),
    resolutionDistinct: z.number().int().min(2).max(20),
    halfLifeDays: z.number().min(7).max(365),
    minimumIndependentHours: z.number().min(24).max(168),
    minimumForecastReviews: z.number().int().min(3).max(30),
    minimumForecastSuccesses: z.number().int().min(2).max(30),
    forecastAnchor: z.number().min(0.6).max(0.95),
    reviewSoonDays: z.number().min(0.1).max(14),
    minimumCalibrationSamples: z.number().int().min(30).max(10000),
  })
  .refine(
    (p) =>
      p.possibleDistinct <= p.likelyDistinct &&
      p.likelyDistinct <= p.recurringDistinct &&
      p.minimumForecastSuccesses <= p.minimumForecastReviews,
    {
      message:
        "Evidence thresholds must be ordered and forecast successes cannot exceed review count.",
    },
  );
export async function intelligenceRoutes(
  req: Request,
  url: URL,
  path: string,
  user: User,
  readBody: (r: Request) => Promise<unknown>,
): Promise<Response | undefined> {
  const method = req.method;
  if (path === "intelligence" && method === "GET")
    return json(
      await intelligenceFor(user.id, {
        conceptId: url.searchParams.get("concept") ?? undefined,
      }),
    );
  if (path === "intelligence/path" && method === "GET") {
    const value = await intelligenceFor(user.id, {
      conceptId: id.parse(url.searchParams.get("concept")),
      snapshot: false,
    });
    return json({ path: value.path });
  }
  if (path === "intelligence/practice" && method === "POST") {
    const a = z
      .object({
        conceptId: id.optional(),
        misconceptionId: id.optional(),
        count: z.number().int().min(1).max(30).default(8),
      })
      .parse(await readBody(req));
    let questionIds: string[] | undefined;
    if (a.misconceptionId) {
      const m = (await loadDefinitions()).find(
        (m) =>
          m.id === a.misconceptionId &&
          m.validationStatus === "editorial-reviewed",
      );
      if (!m) throw new AppError("Misconception not found.", 404);
      const linked = await db().all<{ question_id: string }>(
        "SELECT DISTINCT question_id FROM question_misconceptions WHERE misconception_id=? AND status=?",
        [m.id, "validated"],
      );
      questionIds = [
        ...new Set([...m.questionIds, ...linked.map((m) => m.question_id)]),
      ];
    }
    if (!a.conceptId && !questionIds)
      throw new AppError("Choose a concept or misconception.");
    return json(
      await startSession(user.id, "recovery", {
        count: a.count,
        conceptId: a.conceptId,
        questionIds,
      }),
      201,
    );
  }
  if (path === "intelligence/review" && method === "POST") {
    const a = z
      .object({
        questionId: z.string().max(90).optional(),
        misconceptionId: id.optional(),
        conceptId: id.optional(),
      })
      .parse(await readBody(req));
    const ids = new Set<string>();
    if (a.questionId) ids.add(a.questionId);
    if (a.misconceptionId) {
      const m = (await loadDefinitions()).find(
        (m) => m.id === a.misconceptionId,
      );
      if (!m) throw new AppError("Misconception not found.", 404);
      m.questionIds.forEach((id) => ids.add(id));
    }
    if (a.conceptId)
      (await loadGraph()).mappings
        .filter((m) => m.concept_id === a.conceptId)
        .forEach((m) => ids.add(m.question_id));
    const due = new Date(Date.now() + 86400000).toISOString();
    let count = 0;
    await db().transaction(async (tx) => {
      await lockUser(tx, user.id);
      for (const qid of ids) {
        const row = await first<{ due_at: string }>(
          tx,
          "SELECT due_at FROM review_schedules WHERE user_id=? AND question_id=?",
          [user.id, qid],
        );
        if (!row) continue;
        await tx.run(
          "UPDATE review_schedules SET due_at=? WHERE user_id=? AND question_id=?",
          [row.due_at < due ? row.due_at : due, user.id, qid],
        );
        count++;
      }
      if (count)
        await graphAudit(
          tx,
          user.id,
          "intelligence.review",
          a.questionId ?? a.conceptId ?? a.misconceptionId!,
          { count, earlierDatesPreserved: true },
        );
    });
    if (!count)
      throw new AppError(
        "Practice a linked question first to establish its existing review schedule.",
      );
    return json({
      scheduled: count,
      message:
        "Kept in the existing review queue; earlier review dates were preserved.",
    });
  }
  if (path === "notebook" && method === "GET")
    return json(await listNotebook(user.id, url.searchParams));
  if (path === "notebook/export" && method === "GET")
    return json(await exportNotebook(user.id));
  if (path === "notebook/context" && method === "POST") {
    const a = z
      .object({
        questionId: z.string().max(90).optional(),
        revision: z.number().int().positive().optional(),
        conceptId: id.optional(),
        misconceptionId: id.optional(),
        kind: z
          .enum(["reference", "explanation", "comparison"])
          .default("reference"),
      })
      .parse(await readBody(req));
    return json({ entry: await saveContextNote(user.id, a) });
  }
  if (path === "notebook/entries" && method === "POST")
    return json({ entry: await saveEntry(user.id, await readBody(req)) });
  const entry = path.match(
    /^notebook\/entries\/([a-f0-9-]+)(?:\/(restore|history|restore-revision|flashcard))?$/,
  );
  if (entry) {
    const noteId = z.string().uuid().parse(entry[1]);
    if (method === "POST" && entry[2] === "restore-revision") {
      const input = z
        .object({
          revision: z.number().int().positive(),
          expectedRevision: z.number().int().positive(),
          mutationId: z.string().uuid(),
        })
        .parse(await readBody(req));
      return json({
        entry: await restoreNoteRevision(
          user.id,
          noteId,
          input.revision,
          input.expectedRevision,
          input.mutationId,
        ),
      });
    }
    if (method === "POST" && entry[2] === "flashcard") {
      const input = z
        .object({
          front: z.string().trim().min(2).max(500),
          back: z.string().trim().min(2).max(3000),
        })
        .parse(await readBody(req));
      return json({
        card: await noteToFlashcard(user.id, noteId, input.front, input.back),
      });
    }
    if (method === "GET") {
      const note = await readEntry(user.id, noteId);
      if (entry[2] === "history")
        return json({
          history: await db().all(
            "SELECT revision,data,saved_at FROM notebook_entry_history WHERE entry_id=? ORDER BY revision DESC LIMIT 30",
            [note.id],
          ),
        });
      return json({ entry: note });
    }
    if (method === "DELETE" && !entry[2])
      return json({ entry: await trashEntry(user.id, noteId, false) });
    if (method === "POST" && entry[2] === "restore")
      return json({ entry: await trashEntry(user.id, noteId, true) });
  }
  if (path === "notebook/folders" && method === "POST") {
    const a = z
      .object({
        name: z.string().trim().min(1).max(80),
        id: z.string().uuid().optional(),
      })
      .parse(await readBody(req));
    await db().transaction(async (tx) => {
      await lockUser(tx, user.id);
      if (a.id) {
        if (
          !(await first(
            tx,
            "SELECT id FROM notebooks WHERE id=? AND user_id=?",
            [a.id, user.id],
          ))
        )
          throw new AppError("Folder not found.", 404);
        await tx.run("UPDATE notebooks SET name=? WHERE id=? AND user_id=?", [
          a.name,
          a.id,
          user.id,
        ]);
      } else
        await tx.run(
          "INSERT INTO notebooks(id,user_id,name,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,name) DO NOTHING",
          [randomUUID(), user.id, a.name, new Date().toISOString()],
        );
    });
    return json({ saved: true });
  }
  if (path.startsWith("admin/intelligence")) {
    if (!["reviewer", "content_admin", "system_admin"].includes(user.role))
      throw new AppError("Content role required.", 403);
    if (method === "GET" && path === "admin/intelligence") {
      const graph = await loadGraph(db(), true);
      return json({
        ...graph,
        misconceptions: await loadDefinitions(),
        distractorMappings: (
          await db().all<Record<string, unknown>>(
            "SELECT * FROM question_misconceptions",
          )
        ).map((m) => ({
          questionId: m.question_id,
          revision: m.revision,
          optionId: m.option_id,
          slot: m.slot,
          misconceptionId: m.misconception_id,
          weight: m.weight,
          status: m.status,
        })),
        policy: await loadPolicy(),
        orphans: graph.nodes
          .filter(
            (n) =>
              !graph.edges.some(
                (e) => e.sourceId === n.id || e.targetId === n.id,
              ),
          )
          .map((n) => n.id),
        coverage: graph.nodes.map((n) => ({
          conceptId: n.id,
          questions: graph.mappings.filter((m) => m.concept_id === n.id).length,
        })),
        copyPermissions: await db().all(
          "SELECT * FROM question_notebook_policy",
        ),
      });
    }
    if (!["content_admin", "system_admin"].includes(user.role))
      throw new AppError("Content administrator role required.", 403);
    if (method === "DELETE" && path === "admin/intelligence/relationship") {
      const a = z
        .object({ id: z.string().max(300) })
        .parse(await readBody(req));
      await db().transaction(async (tx) => {
        await lockUser(tx, user.id);
        if (process.env.DATABASE_URL?.startsWith("postgres"))
          await tx.run("SELECT pg_advisory_xact_lock(726302)");
        const old = await first<{ data: string }>(
          tx,
          "SELECT data FROM concept_relationships WHERE id=?",
          [a.id],
        );
        if (!old) throw new AppError("Relationship not found.", 404);
        await tx.run("DELETE FROM concept_relationships WHERE id=?", [a.id]);
        await graphAudit(tx, user.id, "graph.relationship.remove", a.id, {
          previous: JSON.parse(old.data),
        });
      });
      return json({ saved: true });
    }
    if (method === "POST" && path === "admin/intelligence") {
      const input = z
        .object({
          concepts: z.array(nodeSchema).max(200).default([]),
          relationships: z.array(edgeSchema).max(300).default([]),
          misconceptions: z.array(misconceptionSchema).max(100).default([]),
          distractorMappings: z.array(mappingSchema).max(300).default([]),
          questionConcepts: z
            .array(
              z.object({
                questionId: z.string().max(90),
                revision: z.number().int().positive(),
                conceptId: id,
              }),
            )
            .max(300)
            .default([]),
          copyPermissions: z
            .array(
              z.object({
                questionId: z.string().max(90),
                revision: z.number().int().positive(),
                allowed: z.boolean(),
              }),
            )
            .max(100)
            .default([]),
          policy: policySchema.optional(),
        })
        .parse(await readBody(req));
      if (input.policy && user.role !== "system_admin")
        throw new AppError(
          "Only a system administrator may version intelligence parameters.",
          403,
        );
      await db().transaction(async (tx) => {
        await lockUser(tx, user.id);
        if (process.env.DATABASE_URL?.startsWith("postgres"))
          await tx.run("SELECT pg_advisory_xact_lock(726302)");
        const old = await loadGraph(tx, true);
        const previousDefinitions = await loadDefinitions(tx);
        const previousMappings = await tx.all(
          "SELECT * FROM question_misconceptions",
        );
        const nodes = [
            ...old.nodes.filter(
              (n) => !input.concepts.some((c) => c.id === n.id),
            ),
            ...input.concepts,
          ],
          edges = [
            ...old.edges.filter(
              (e) => !input.relationships.some((x) => x.id === e.id),
            ),
            ...input.relationships,
          ];
        try {
          validateGraph(nodes, edges);
        } catch (e) {
          throw new AppError((e as Error).message);
        }
        const definitions = [
          ...previousDefinitions.filter(
            (m) => !input.misconceptions.some((v) => v.id === m.id),
          ),
          ...input.misconceptions,
        ];
        const references = [
          ...input.concepts.flatMap((c) => c.references),
          ...input.relationships.flatMap((e) => e.references),
          ...input.misconceptions.flatMap((m) => m.references),
        ];
        for (const source of new Set(references)) {
          const row = await first<{ data: string }>(
            tx,
            "SELECT data FROM content_sources WHERE id=?",
            [source],
          );
          if (!row || JSON.parse(row.data).status.startsWith("unverified"))
            throw new AppError("Verified source references are required.");
        }
        for (const objective of new Set([
          ...input.concepts.flatMap((c) => c.objectives),
          ...input.misconceptions.flatMap((m) => m.objectives),
        ]))
          if (
            !(await first(tx, "SELECT id FROM objectives WHERE id=?", [
              `SY0-801:${objective}`,
            ]))
          )
            throw new AppError("Invalid objective mapping.");
        for (const m of input.misconceptions) {
          if (
            [...m.conceptIds, ...m.prerequisiteIds].some(
              (id) => !nodes.some((n) => n.id === id),
            )
          )
            throw new AppError("Misconception references a missing concept.");
          for (const qid of m.questionIds)
            if (
              !(await first(tx, "SELECT id FROM questions WHERE id=?", [qid]))
            )
              throw new AppError(
                "Misconception references a missing question.",
              );
        }
        for (const c of input.concepts)
          await tx.run(
            "INSERT INTO security_concepts(id,name,data,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data,updated_at=excluded.updated_at",
            [c.id, c.name, JSON.stringify(c), new Date().toISOString()],
          );
        for (const e of input.relationships)
          await tx.run(
            "INSERT INTO concept_relationships(id,source_id,target_id,kind,status,data) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id,target_id=excluded.target_id,kind=excluded.kind,status=excluded.status,data=excluded.data",
            [e.id, e.sourceId, e.targetId, e.kind, e.status, JSON.stringify(e)],
          );
        for (const m of input.misconceptions)
          await tx.run(
            "INSERT INTO misconception_definitions(id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
            [m.id, JSON.stringify(m), new Date().toISOString()],
          );
        for (const m of input.distractorMappings) {
          const row = await first<{ content: string }>(
            tx,
            "SELECT content FROM question_revisions WHERE question_id=? AND revision=?",
            [m.questionId, m.revision],
          );
          if (!row || !definitions.some((d) => d.id === m.misconceptionId))
            throw new AppError(
              "Mapping references a missing question revision or misconception.",
            );
          const q = JSON.parse(row.content) as Question;
          if (!q.options.some((o) => o.id === m.optionId))
            throw new AppError("Mapping references a missing answer option.");
          const positional = q.type === "matching" || q.type === "ordering";
          if (
            positional
              ? m.slot < 0 ||
                m.slot >= q.correct.length ||
                q.correct[m.slot] === m.optionId
              : m.slot !== -1 || q.correct.includes(m.optionId)
          )
            throw new AppError(
              "Mappings must identify an incorrect choice in the correct slot.",
            );
          await tx.run(
            "INSERT INTO question_misconceptions(question_id,revision,option_id,slot,misconception_id,weight,status) VALUES (?,?,?,?,?,?,?) ON CONFLICT(question_id,revision,option_id,slot,misconception_id) DO UPDATE SET weight=excluded.weight,status=excluded.status",
            [
              m.questionId,
              m.revision,
              m.optionId,
              m.slot,
              m.misconceptionId,
              m.weight,
              m.status,
            ],
          );
        }
        for (const m of input.questionConcepts) {
          if (
            !nodes.some((n) => n.id === m.conceptId) ||
            !(await first(
              tx,
              "SELECT revision FROM question_revisions WHERE question_id=? AND revision=?",
              [m.questionId, m.revision],
            ))
          )
            throw new AppError("Invalid question/concept link.");
          await tx.run(
            "INSERT INTO question_concepts(question_id,revision,concept_id) VALUES (?,?,?) ON CONFLICT(question_id,revision,concept_id) DO NOTHING",
            [m.questionId, m.revision, m.conceptId],
          );
        }
        for (const p of input.copyPermissions) {
          if (
            !(await first(
              tx,
              "SELECT revision FROM question_revisions WHERE question_id=? AND revision=?",
              [p.questionId, p.revision],
            ))
          )
            throw new AppError("Invalid notebook-copy permission revision.");
          await tx.run(
            "INSERT INTO question_notebook_policy(question_id,revision,copy_allowed) VALUES (?,?,?) ON CONFLICT(question_id,revision) DO UPDATE SET copy_allowed=excluded.copy_allowed",
            [p.questionId, p.revision, p.allowed ? 1 : 0],
          );
        }
        if (input.policy) await savePolicy(tx, input.policy, user.id);
        const contentVersion = await first<{ version: number }>(
          tx,
          "SELECT MAX(version) AS version FROM intelligence_content_versions",
        );
        await tx.run(
          "INSERT INTO intelligence_content_versions(version,created_at) VALUES (?,?)",
          [(contentVersion?.version ?? 0) + 1, new Date().toISOString()],
        );
        await graphAudit(tx, user.id, "intelligence.content.update", "global", {
          input,
          previous: {
            concepts: old.nodes,
            relationships: old.edges,
            misconceptions: previousDefinitions,
            distractorMappings: previousMappings,
            questionConcepts: old.mappings,
          },
        });
      });
      return json({ saved: true });
    }
  }
  return undefined;
}
