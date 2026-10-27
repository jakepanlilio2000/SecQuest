import { randomUUID } from "node:crypto";
import { db, first, type Database } from "./db";
import {
  concepts,
  relationships,
  misconceptions,
  distractorMappings,
  policy,
  conceptId,
} from "../../content/intelligence";
import { questions } from "../../content/questions";
import type {
  SecurityConcept,
  ConceptRelationship,
  MisconceptionDefinition,
  IntelligencePolicy,
  MisconceptionMapping,
} from "./intelligence-types";
import { validateGraph } from "./knowledge-graph";
export async function seedIntelligence(tx: Database) {
  if (
    await first(
      tx,
      "SELECT version FROM intelligence_policies WHERE version=?",
      [policy.version],
    )
  )
    return;
  validateGraph(concepts, relationships);
  const now = new Date().toISOString();
  await tx.run(
    "INSERT INTO intelligence_content_versions(version,created_at) VALUES (1,?) ON CONFLICT(version) DO NOTHING",
    [now],
  );
  for (const c of concepts)
    await tx.run(
      "INSERT INTO security_concepts(id,name,data,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING",
      [c.id, c.name, JSON.stringify(c), now],
    );
  for (const e of relationships)
    await tx.run(
      "INSERT INTO concept_relationships(id,source_id,target_id,kind,status,data) VALUES (?,?,?,?,?,?) ON CONFLICT(source_id,target_id,kind) DO NOTHING",
      [e.id, e.sourceId, e.targetId, e.kind, e.status, JSON.stringify(e)],
    );
  for (const m of misconceptions)
    await tx.run(
      "INSERT INTO misconception_definitions(id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING",
      [m.id, JSON.stringify(m), now],
    );
  for (const q of questions) {
    const exists = await first(
      tx,
      "SELECT revision FROM question_revisions WHERE question_id=? AND revision=?",
      [q.id, q.revision],
    );
    if (!exists) continue;
    await tx.run(
      "INSERT INTO question_concepts(question_id,revision,concept_id) VALUES (?,?,?) ON CONFLICT(question_id,revision,concept_id) DO NOTHING",
      [q.id, q.revision, conceptId(q.concept)],
    );
    const author = await first<{ created_by: string }>(
      tx,
      "SELECT created_by FROM question_revisions WHERE question_id=? AND revision=?",
      [q.id, q.revision],
    );
    await tx.run(
      "INSERT INTO question_notebook_policy(question_id,revision,copy_allowed) VALUES (?,?,?) ON CONFLICT(question_id,revision) DO NOTHING",
      [
        q.id,
        q.revision,
        author?.created_by === "original-seed-editorial" ? 1 : 0,
      ],
    );
  }
  // Map foundational lessons to the exact existing questions that test them.
  const extra: Record<string, string[]> = {
    "tls-confidentiality": ["encryption"],
    "password-salting": ["hashing"],
    "digital-signature": ["digital-signatures", "public-private-keys"],
    "aaa-matching": ["authentication", "authorization"],
    passkeys: ["authentication"],
    "control-detective": ["detection", "prevention"],
    "ids-ips": ["detection", "prevention"],
    "certificate-revocation": [
      "digital-certificates",
      "certificate-authorities",
    ],
  };
  for (const [qid, ids] of Object.entries(extra)) {
    const q = questions.find((q) => q.id === qid)!;
    for (const id of ids)
      await tx.run(
        "INSERT INTO question_concepts(question_id,revision,concept_id) VALUES (?,?,?) ON CONFLICT(question_id,revision,concept_id) DO NOTHING",
        [qid, q.revision, id],
      );
  }
  for (const m of distractorMappings)
    await tx.run(
      "INSERT INTO question_misconceptions(question_id,revision,option_id,slot,misconception_id,weight,status) VALUES (?,?,?,?,?,?,?) ON CONFLICT(question_id,revision,option_id,slot,misconception_id) DO NOTHING",
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
  await tx.run(
    "INSERT INTO intelligence_policies(version,data,created_at,created_by) VALUES (?,?,?,?) ON CONFLICT(version) DO NOTHING",
    [policy.version, JSON.stringify(policy), now, "source-reviewed-bootstrap"],
  );
}
export async function loadGraph(database = db(), includeDrafts = false) {
  const nodes = (
    await database.all<{ data: string }>(
      "SELECT data FROM security_concepts ORDER BY id",
    )
  ).map((r) => JSON.parse(r.data) as SecurityConcept);
  const edges = (
    await database.all<{ data: string }>(
      "SELECT data FROM concept_relationships ORDER BY id",
    )
  ).map((r) => JSON.parse(r.data) as ConceptRelationship);
  const mappings = await database.all<{
    question_id: string;
    revision: number;
    concept_id: string;
  }>("SELECT * FROM question_concepts");
  if (includeDrafts) return { nodes, edges, mappings };
  const reviewed = nodes.filter(
    (n) => n.validationStatus === "editorial-reviewed",
  );
  const ids = new Set(reviewed.map((n) => n.id));
  return {
    nodes: reviewed,
    edges: edges.filter(
      (e) =>
        e.status === "validated" && ids.has(e.sourceId) && ids.has(e.targetId),
    ),
    mappings: mappings.filter((m) => ids.has(m.concept_id)),
  };
}
export async function loadDefinitions(database = db()) {
  return (
    await database.all<{ data: string }>(
      "SELECT data FROM misconception_definitions ORDER BY id",
    )
  ).map((r) => JSON.parse(r.data) as MisconceptionDefinition);
}
export async function loadPolicy(database = db()) {
  const row = await first<{ data: string }>(
    database,
    "SELECT data FROM intelligence_policies ORDER BY created_at DESC,version DESC LIMIT 1",
  );
  return row ? (JSON.parse(row.data) as IntelligencePolicy) : policy;
}
export async function evidenceVersion(database = db()) {
  const [policy, row] = await Promise.all([
    loadPolicy(database),
    first<{ version: number }>(
      database,
      "SELECT MAX(version) AS version FROM intelligence_content_versions",
    ),
  ]);
  return `${policy.version}:content-${row?.version ?? 1}`;
}
export async function savePolicy(
  tx: Database,
  value: IntelligencePolicy,
  actor: string,
) {
  await tx.run(
    "INSERT INTO intelligence_policies(version,data,created_at,created_by) VALUES (?,?,?,?)",
    [value.version, JSON.stringify(value), new Date().toISOString(), actor],
  );
}
export async function graphAudit(
  tx: Database,
  actor: string,
  action: string,
  entity: string,
  detail: unknown,
) {
  await tx.run(
    "INSERT INTO audit_log(id,user_id,action,entity_id,detail,created_at) VALUES (?,?,?,?,?,?)",
    [
      randomUUID(),
      actor,
      action,
      entity,
      JSON.stringify(detail),
      new Date().toISOString(),
    ],
  );
}
