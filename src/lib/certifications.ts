import {
  certifications,
  certificationGenerations,
  certificationExams,
  catalogCheckedOn,
} from "../../content/certifications";
import { db, type Database } from "./db";

export interface CatalogExam {
  code: string;
  generationId: string;
  certificationId: string;
  certificationName: string;
  version: string;
  requiredExams: number;
  name: string;
  position: number;
  availability:
    "available" | "upcoming" | "retiring" | "retired" | "unverified";
  checkedOn: string;
  sourceUrl: string;
  bankStatus: "unavailable" | "legacy-starter" | "reviewed";
  objectivesVerified: number;
  linkedExamCode: string | null;
}

export type LearnerCatalogExam = Pick<
  CatalogExam,
  | "code"
  | "generationId"
  | "certificationName"
  | "version"
  | "requiredExams"
  | "name"
  | "availability"
  | "checkedOn"
  | "bankStatus"
>;

export interface LearnerCertificationCatalog {
  switchingEnabled: false;
  exams: LearnerCatalogExam[];
}

// Whitelist public metadata; neither account data nor internal activation flags
// belong in the learner catalog. Readiness alone cannot enable switching yet.
export async function learnerCertificationCatalog(
  database = db(),
): Promise<LearnerCertificationCatalog> {
  const rows = await certificationRegistry(database);
  return {
    switchingEnabled: false,
    exams: rows.map((e) => ({
      code: e.code,
      generationId: e.generationId,
      certificationName: e.certificationName,
      version: e.version,
      requiredExams: e.requiredExams,
      name: e.name,
      availability: e.availability,
      checkedOn: e.checkedOn,
      bankStatus: e.bankStatus,
    })),
  };
}

// Use the caller's seed transaction. Existing catalog/editorial state is retained.
export async function seedCertificationRegistry(tx: Database) {
  for (const c of certifications)
    await tx.run(
      "INSERT INTO certifications(id,name) VALUES (?,?) ON CONFLICT(id) DO NOTHING",
      [c.id, c.name],
    );
  for (const g of certificationGenerations)
    await tx.run(
      "INSERT INTO certification_generations(id,certification_id,version,required_exams) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING",
      [g.id, g.certificationId, g.version, g.requiredExams],
    );
  for (const e of certificationExams) {
    await tx.run(
      "INSERT INTO certification_exams(code,generation_id,name,position,availability,checked_on,source_url,bank_status,objectives_verified) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO NOTHING",
      [
        e.code,
        e.generationId,
        e.name,
        e.position,
        e.availability,
        catalogCheckedOn,
        e.sourceUrl,
        e.bankStatus,
        0,
      ],
    );
    // A matching code establishes identity, not approval or content readiness.
    // Unknown legacy codes stay untouched rather than being guessed/reassigned.
    await tx.run(
      "INSERT INTO exam_catalog_links(exam_code,catalog_code) SELECT code,code FROM exam_versions WHERE code=? ON CONFLICT(exam_code) DO NOTHING",
      [e.code],
    );
  }
}

export async function certificationRegistry(database = db()) {
  const rows = await database.all<CatalogExam>(
    `SELECT e.code,e.generation_id AS "generationId",g.certification_id AS "certificationId",
      c.name AS "certificationName",g.version,g.required_exams AS "requiredExams",
      e.name,e.position,e.availability,e.checked_on AS "checkedOn",e.source_url AS "sourceUrl",
      e.bank_status AS "bankStatus",e.objectives_verified AS "objectivesVerified",
      l.exam_code AS "linkedExamCode"
    FROM certification_exams e
    JOIN certification_generations g ON g.id=e.generation_id
    JOIN certifications c ON c.id=g.certification_id
    LEFT JOIN exam_catalog_links l ON l.catalog_code=e.code
    ORDER BY c.id,g.id,e.position`,
  );
  return rows.map((exam) => ({
    ...exam,
    eligibleForNewStudy: eligibleForNewStudy(exam),
  }));
}

// Foundation gate for the future selector/API. The current legacy routes are
// unchanged; merely registering metadata cannot make a new exam selectable.
export function eligibleForNewStudy(exam: CatalogExam) {
  return (
    exam.availability === "available" &&
    exam.bankStatus === "reviewed" &&
    exam.objectivesVerified === 1 &&
    exam.linkedExamCode === exam.code
  );
}
