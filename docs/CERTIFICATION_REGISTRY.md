# Certification registry foundation — Phase 1A

This slice implements identities and preservation boundaries from the [Phase 0 catalog](CERTIFICATION_CATALOG.md). It does not enable multiple-certification learning or replace the existing Security+ flow. The selector, exam-aware API/grading/analytics, per-exam learner settings and complete objective imports remain subsequent slices.

## Model

Migration `006_certification_registry.sql` adds four tables without altering existing ones:

- `certifications`: stable family identities, such as `a-plus`.
- `certification_generations`: versions within a family, with required exam count. A+ V15 requires two exams.
- `certification_exams`: individual codes and ordered membership in a generation, dated availability evidence, source URL, bank status and objective-verification gate.
- `exam_catalog_links`: links an existing `exam_versions` code to the identical registry code. A database constraint rejects relabeling an existing code as another exam.

`content/certifications.ts` contains the first-wave metadata snapshot: Security+ V7/V8, Network+ V9 and both A+ V15 cores. It is not a complete objective tree. `src/lib/certifications.ts` seeds this metadata inside the existing content-seed transaction and provides a typed registry read. SQL parameters are bound through the current SQLite/PostgreSQL adapter.

Seeds insert missing records and never overwrite existing catalog/operator decisions. Historical exam versions with unknown codes are left unchanged and unlinked. The existing SY0-801 exam JSON, question revisions, session settings, attempt references, schedules, accounts and notes are not rewritten. New installs get the compatibility link after the original blueprint is inserted; existing installs get it on the next normal seed.

## Activation boundary

All five seeded exams fail the new-study readiness gate. New banks are unavailable; the existing SY0-801 bank is `legacy-starter`, with objective verification off for new-registry activation. Its existing app routes continue to work. A record becomes an eligible candidate only when availability is explicitly `available`, bank status is `reviewed`, full objectives are verified and its existing-exam link is identical.

This helper is a future selector/API building block, not a replacement authorization layer or an automated editorial reviewer. Phase 1B must enforce exam ownership, verified objective membership, eligible content queries, same-generation exam selection and version-aware sessions before any new learner selection is exposed. No public catalog-write or activation endpoint is added here. Do not manually flip production flags as a substitute for that implementation.

Availability is a dated snapshot from November 14, 2026, not a clock-driven rule. SY0-801 is recorded as upcoming on that date. Reaching a launch date does not update it. Later source/status changes require an explicitly reviewed update; seed reruns do not change them. No latest-version default or cross-exam progress transfer is introduced.

## Upgrade, validation and rollback

Back up before starting a version containing migration 006: normal API initialization still applies migrations automatically. Follow [deployment and recovery](DEPLOYMENT.md). For SQLite, use a new online backup and manifest before startup; verify original rows immediately after controlled initialization, before learner activity. For PostgreSQL, use operator-managed database-native backup/restore verification and test against a disposable target-version instance. This phase's populated upgrade fixture is SQLite; PostgreSQL execution is not claimed.

The new regression fixture creates a populated schema-005 SQLite database with an account/session, two question revisions, old-revision attempt, due schedule, note/history, flashcard, study plan and XP. It applies migration/registry seed twice and compares every original table row exactly, checks foreign keys and validates the identity/readiness constraints. Existing integration/browser checks exercise the legacy flow with the new seed path.

Code rollback retains the additive registry tables and migration record and redeploys the retained prior release. It does not drop tables, replace the database or relabel content. If registry metadata has subsequently been edited, preserve it too. Database restoration requires a fresh current-state snapshot, stopped writers and an isolated verified restore; never discard newer progress or notes.
