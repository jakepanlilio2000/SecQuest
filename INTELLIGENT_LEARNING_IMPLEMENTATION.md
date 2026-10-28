# SecQuest intelligent learning upgrade

## Repository audit (before implementation, 2026-10-27)

This upgrade extends the existing project in place. The repository is not a Git checkout; no branch or reset is involved.

| Area inspected         | Existing implementation and integration point                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend               | Next.js 16.4 App Router, React 19, TypeScript 7. Client feature modules under `src/components`, existing dark/light CSS and accessible shared controls. URL query navigation in `secquest.tsx`; preserve the shell.                                       |
| API                    | Node catch-all route dispatches to `src/lib/api.ts`. JSON mutations, Zod validation, same-origin checks, per-user database throttling, no-store responses. Extend this authenticated boundary.                                                            |
| Authentication         | `auth.ts`: salted scrypt, hashed opaque HttpOnly sessions, ownership checks, role checks and user-row transaction locking. Reuse unchanged.                                                                                                               |
| Persistence            | Parameterized typed SQL repository; PostgreSQL deployment adapter and local SQLite WAL database. Migrations 001–003 are already applied to the local store. Add migration 004 only; do not rewrite existing migrations or populated tables.               |
| Question model         | 44 original starter questions, all 27 V8 objectives, categories, six formats, immutable revisions/options. Existing content is not a comprehensive or independently SME-approved bank. Add concept/distractor mappings in separate revision-aware tables. |
| Grading                | `engine.ts` validates selections and grades immutable revisions with `scheduler.grade`. Learning feedback is stored; mock drafts conceal answers until completion. Keep grading and attempt uniqueness unchanged.                                         |
| Reinforcement          | Wrong answers enter `review_schedules`, then a retry may be inserted after 3–8 other items. Subsequent schedules are SM-2-inspired, with first encounters, retries, and delayed retrieval distinguished. Reuse this queue.                                |
| Mastery                | `analytics.ts` uses real first encounters and an evidence-adjusted estimate. Reuse its calculation through a shared pure function; concept views restrict the same calculation to mapped questions. Do not add another mutable mastery counter.           |
| Progress               | Attempts, sessions, schedules, unique XP events, achievements, settings, flashcards and plans are durable. Existing account deletion/export are extended to new private records through foreign keys and scoped export.                                   |
| Current analytics      | Actual first/retry/delayed accuracy, objective/domain estimates, activity, mock reports and gated unofficial readiness. Add compact intelligence summaries without replacing these metrics.                                                               |
| Existing content tools | RBAC, draft/review/publish workflow, revision editor, source register, coverage and audit logs. Add validated concept, graph and distractor mapping tools here.                                                                                           |

## Integration plan

1. Create a recoverable SQLite online backup and a per-table preservation manifest before applying migration 004. All new schema objects are additive. PostgreSQL operators must take their normal database backup before deployment.
2. Add canonical concepts, explicit revision-aware question mappings, reviewed prerequisite edges, a misconception catalog and exact distractor mappings. Unknown or unmapped choices remain undiagnosed.
3. Record idempotent derived evidence in the same answer transaction. Classify on read using versioned configurable thresholds, distinct-question evidence, confidence, recency and later corrective retrieval. Historical backfill reads existing attempts without changing them.
4. Generate minimal prerequisite paths from validated acyclic edges. Unknown knowledge is distinct from demonstrated weakness. Expose an interactive map and equivalent keyboard-accessible list.
5. Read the existing review dates and history for deterministic review priority and a documented, explicitly uncalibrated forecast. Snapshot forecasts and evaluate only subsequent outcomes; never change the scheduler or train parameters automatically.
6. Add private Markdown notebooks with tags, folders, pinning, autosave with optimistic concurrency, recoverable deletion, question/concept/objective provenance, idempotent explanation saves and export.
7. Connect these views and actions to learning feedback, dashboard, concept material, daily review selection and administration; verify old and new workflows against isolated databases and the browser.

## Preservation contract

No user, question, answer, attempt, session, XP event, achievement, review date or preference will be reset or deleted by this upgrade. Existing migrations remain untouched. Derived backfills write only new tables. New concept mappings never rewrite question revisions. Opening notes or maps does not create recall evidence or rewards. Mock answers remain hidden until submission.

## Implementation status

Implementation and local verification completed October 28, 2026 (Asia/Shanghai). This is a functional upgrade of the existing application. It is **not independently accepted for production deployment**: content coverage, model calibration, PostgreSQL execution and operational acceptance remain limited as documented below.

| Deliverable                        | Status and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Misconception engine and dashboard | Implemented. Exact revision/option/position mappings; idempotent evidence in the existing grading transaction; bounded historical backfill; recency/confidence weighting; distinct-question thresholds; possible/likely/recurring/improving/currently controlled states; reasons, supporting observations, comparisons, references, practice and existing-queue review actions. Seed mapping coverage is partial.                                                     |
| Directed knowledge map             | Implemented. 58 canonical concepts, 47 editorial relationships, dependency-cycle validation, multiple prerequisites, actual evidence-adjusted mastery, unknown versus weak status, zoom/pan/search/domain filtering, keyboard controls and equivalent list, lessons and minimal prerequisite paths with optional skipping. Relationships are editorial learning recommendations, not official exam prerequisites.                                                     |
| Retention forecast                 | Implemented as an explicitly uncalibrated heuristic. Uses real attempts and existing intervals/due dates, gates numeric curves, separates schedule status from recall estimates, displays observed events and projections, ranks daily/recovery practice deterministically, stores versioned forecasts and evaluates later outcomes. Statistical validity is not established.                                                                                         |
| Personal notebook                  | Implemented. Private Markdown with GFM tables/checklists/code/links, Edit/Preview/Split, folders/custom tags/search/pinning, knowledge-gap/due-review filters, linked question revisions/objectives/concepts/source references, autosave, retry deduplication, stale-write rejection, session-local recovery, comparison templates, explanation-copy permissions, Trash/restore, revision history API, Markdown/JSON exports and profile export/deletion integration. |
| Shared integration                 | Implemented. Existing dashboard summary, question reference notes before submission, contextual feedback after grading, completed-feedback Save Explanation, graph notes, forecast notes, targeted practice, and audited review requests. Notes/maps never create attempts, mastery evidence or XP.                                                                                                                                                                   |
| Content administration             | Implemented within existing RBAC dashboard. Validated JSON editors/import/export, node descriptions/objectives, relationship additions/removal, orphan and coverage reports, exact distractor mappings, copy permissions, immutable policy versions. Reviewer reads; content administrator edits content; only system administrator versions parameters.                                                                                                              |
| Preservation and migrations        | Verified locally. Migration 004 adds tables/indexes only. Original migrations 001–003 were not changed. Backup and per-row manifest exist; all 27 original tables passed the preservation comparison. Populated legacy learner data also passed an isolated migration test.                                                                                                                                                                                           |
| Testing                            | 52 passing automated tests, TypeScript check, content validator and optimized Next production build. Connected-browser checks cover desktop/mobile interfaces and two-tab conflict recovery. See `docs/QA.md`.                                                                                                                                                                                                                                                        |
| Optional AI                        | Not configured and not introduced. All four modules operate without AI keys or external note processing. No note text is sent to a model provider.                                                                                                                                                                                                                                                                                                                    |

## Architecture and database changes

`content/intelligence.ts` contains original editorial concept lessons, relationships, misconception explanations and revision-specific distractor mappings. `intelligence-store.ts` seeds these once without replacing editorial edits. New published question revisions require explicit mapping; old mappings never silently transfer to different answer choices.

`mastery.ts` extracts the pre-existing first-encounter formula for reuse. `knowledge-graph.ts` reads it for concept evidence; it does not maintain a second mastery score. `misconceptions.ts` records only small synchronous evidence rows; findings/backfill are derived separately. Historical processing is bounded to 300 attempts per request and reports outstanding work. `npm run intelligence:backfill` drains that work in bounded transactions without modifying attempts, rewards or schedules. No background job infrastructure is claimed.

`retention-forecast.ts` reads existing schedule state and evaluates forecasts; `intelligence.ts` joins the private learner evidence, concepts, notes and forecasts. Daily/recovery selection now sorts by scheduled urgency, lapse/confusion signals, unseen baseline need, due date and stable question ID. Other session selection and the original answer grading/scheduler transitions remain intact.

`intelligence-api.ts` runs inside the existing authenticated, rate-limited, same-origin API dispatcher. New routes cover `/api/intelligence`, `/path`, `/practice`, `/review`, `/api/notebook`, `/entries`, `/context`, `/folders`, `/export`, and `/api/admin/intelligence`. Entry-specific read/history/delete/restore endpoints enforce ownership before accessing revision history. Review requests can bring an existing due date forward to at most the next day while preserving any earlier date. They do not create another scheduling queue.

Migration `004_intelligent_learning.sql` adds:

- Global concepts, directed relationships, question/concept links and notebook-copy permissions.
- Misconception definitions, exact distractor mappings, processed-attempt pointers, versioned evidence, derived user states, immutable parameter policies and content versions.
- Forecast snapshots and later-outcome evaluations.
- Private folders, entries, tags, entry/tag links, revision history and idempotent save mutations.

Existing attempts retain their original immutable question revision. Derived evidence is keyed by attempt, misconception and policy/content version. A mapping or policy update invalidates only the processing pointer; bounded replay adds a new evidence version and retains the old rows. Administrative audits retain previous graph/definition/mapping values. PostgreSQL global graph edits use a shared advisory transaction lock; SQLite serializes transactions. PostgreSQL execution remains unverified on this host.

## Explainable policy and model limits

Default `intelligence-v1` thresholds require 2 distinct mapped questions for a possible finding, 3 for likely and 4 for recurring. Repeating a question does not add independent distinct-question support. Per-question support is capped, older evidence decays with a 45-day half-life, guesses are discounted, and recent retries carry quarter weight. The displayed support is a heuristic score, **not a probability of a cognitive diagnosis**.

Corrective answers reduce support. A finding can become improving after a correction, but currently controlled requires two distinct independent corrections at least 24 hours after the latest mapped mistake. A later mistake reopens the finding. Reading a lesson or note never resolves a finding. Unknown prerequisites are described as unassessed; they are not counted as demonstrated weakness. The graph omits proficient prerequisite steps while preserving the explicit target and dependency order.

The original scheduler is SM-2-inspired, not canonical SM-2 or FSRS. It has no fitted memory stability parameter. The forecast therefore derives an illustrative stability scale from the existing interval using `interval / -log(0.9)`, adjusted conservatively for lapses and active confusion. Recall follows `exp(-elapsedDays / stabilityDays)` with bounded output. It is not a validated forgetting law for an individual. At least 3 delayed observations and 2 successful delayed retrievals are required before showing a numeric item curve; low-confidence successes do not satisfy the successful-retrieval threshold. Concept averages require at least two eligible items and sufficient evidence for all mapped items. Future bands are illustrative, not statistical confidence intervals. Historical dots are actual stored attempts only.

Forecast snapshots freeze their parameters before outcomes. An evaluation requires a subsequent independent delayed review, a strictly later timestamp and the same prior schedule observation. Brier error, probability-band averages, actual outcomes, sample counts and policy version remain available privately. Fewer than 30 evaluated predictions are explicitly labeled not calibrated; even 30 is only an evaluation floor, not a validation certificate. Parameters never retrain automatically.

## Notebook correctness and privacy

Server queries are scoped to the authenticated owner, including search, folders, exports, Trash and history. Writes lock the user and check an expected revision. A UUID mutation key and request hash make network retries idempotent. Reusing a mutation key for changed content or submitting a stale revision returns 409 without overwriting the server copy. Repeated contextual saves return the existing entry, including an entry in Trash, without replacing personal writing.

Autosave waits about 1.1 seconds after editing and backs off after failures. While a note is dirty, a per-owner/per-entry sessionStorage recovery draft retains its original base revision. A save conflict fetches the newer server copy for comparison; leaving/reopening retains the conflict until explicit review. The UI offers draft download, server comparison, manual merge and reload. Navigation and unload guards protect pending edits. This is online server persistence with local recovery, **not offline synchronization**; sessionStorage can be unavailable or cleared and is not a backup. Server history remains private; the editor does not yet offer a general history-restore browser.

Markdown uses `react-markdown` plus GFM. Raw HTML, embedded scripts/frames/objects/styles and images are disabled; links are constrained and external links use isolation attributes. This prevents remote tracking-image loads and executable note markup. Markdown exports preserve text and source links but should be treated as text when imported into other tools.

Question reference notes may be created from the learner's own saved session before answering and contain a personal-writing template, not the question prompt, answer or explanation. Explanation copying requires a stored graded attempt and explicit revision-level copy permission. Active mock drafts do not qualify. Default copy permission is granted only to original SecQuest-authored seed revisions; imported content defaults to denied. Administrators must verify rights before granting it. Concept/comparison actions and notes maintain source/objective/question provenance. All notebook records cascade on account deletion; note contents are not exposed in public progression data.

## Remaining content mapping work

The question bank remains the original 44 items across 27 objectives, with 45 immutable revisions. The upgrade adds no exam questions and does not claim independent SME approval. Nine misconception definitions have thirteen exact incorrect-choice mappings over nine distinct questions:

| Misconception                            | Distinct mapped questions | Consequence                                                                                                          |
| ---------------------------------------- | ------------------------: | -------------------------------------------------------------------------------------------------------------------- |
| Hashing provides confidentiality         |                         1 | Cannot independently reach the default possible threshold yet.                                                       |
| Authentication versus authorization      |                         2 | Possible evidence is supported; needs new formulations for likely/recurring.                                         |
| Detection versus prevention              |                         2 | Possible evidence is supported; later checks can assess improvement.                                                 |
| Transformation versus security           |                         2 | Possible evidence is supported.                                                                                      |
| Symmetric versus asymmetric              |                         0 | Educational catalog only; no automatic finding is fabricated.                                                        |
| RTO versus RPO                           |                         1 | Insufficient distinct mappings for a possible finding.                                                               |
| Severity versus exploitation             |                         2 | Possible evidence is supported.                                                                                      |
| False positive versus false negative     |                         0 | Educational catalog only.                                                                                            |
| Certificate versus certificate authority |                         0 | Educational catalog and PKI path only. The existing revocation distractors do not reliably establish this confusion. |

Nineteen concepts are currently orphans in the editorial relationship graph. Administrators can inspect them; no artificial prerequisite is added merely to connect the picture. Many foundational lessons have sparse or no directly mapped questions, so their mastery remains unknown/insufficient. More independently reviewed questions, alternate formulations, exact distractor mappings and expert review of relationships are required to broaden inference. Neither empty evidence nor a single mistake is converted into a diagnosis.

## Migration, backup and rollback

Local backup made before migration 004:

The recoverable database snapshot is `C:\wamp64\www\SecQuest\data\backups\pre-intelligence-upgrade.sqlite` with its `.manifest.json` and `.manifest.json.verification.json` reports.

SHA-256: `7480e4a00887794b27a8e1cd476586bf6de65b97b2ed254a53b1661a6d551b5d`.

The verifier checks the backup digest, SQLite integrity, foreign keys, and every original row hash with multiplicity. Result: **passed; zero changed/missing original rows across 27 tables; no foreign-key violations**. Only the new migration record and one new public source reference were appended to original tables. This local store had zero users/attempts at backup time; preservation of populated learner history was separately tested using the real old schema and synthetic accounts, attempts, settings, review schedules, XP and achievements.

For another SQLite deployment, stop application writers or take the online snapshot before the schema change. The backup utility needs Node 22.16+ (or 23.8+); the app itself retains its existing Node 22.13+ requirement. Choose a new backup path: the tool refuses to overwrite a prior backup.

```powershell
npm ci --cache .npm-cache
npm run db:backup -- data/backups/before-upgrade.sqlite
npm run db:seed
npm run db:verify -- data/backups/before-upgrade.sqlite.manifest.json
npm run intelligence:backfill
npm test
npm run typecheck
npm run content:validate
npm run build
```

CLI scripts use the environment supplied by the shell. Explicitly set `SQLITE_PATH` or `DATABASE_URL` for the intended store; do not point tests at real learner data. Keep backups access-controlled and outside any publicly browsable web root. The backup here is inside the local checkout for recovery; move a secure copy to your normal backup storage before deployment.

For PostgreSQL, take and restore-test an operator-managed `pg_dump` backup first. Run a single migration/seed job before starting replicas; use `npm run intelligence:backfill` with the intended `DATABASE_URL`. The SQLite backup/verifier deliberately refuses PostgreSQL URLs. Production image/operator instructions remain in `docs/DEPLOYMENT.md`.

Preferred rollback: stop writers and redeploy your previously retained application release while **keeping the additive tables and migration record**. Older code ignores the new tables; this preserves any new notes and evidence for a later upgrade. This checkout is not a Git repository and contains no retained pre-upgrade source release, so use your actual release artifact rather than pretending a Git reset is available.

If a data restore is required, first snapshot the current database, including notes written after the upgrade. Restore the pre-upgrade backup into a **new isolated destination**, validate its integrity and original record counts, test sign-in/session resumption and schedules, and only then switch the stopped application to that validated copy. Do not overwrite an active WAL database or blindly restore the old snapshot over newer learner work. PostgreSQL restoration similarly belongs in an isolated database before cutover. No destructive down migration or automated loss of post-upgrade notes is supplied.

## Verification and remaining acceptance work

The 52 automated tests include all 35 original checks plus model rules, dependency direction/cycles, unknown mastery, stable forecasts, safe Markdown, populated legacy migration, owner isolation, concurrent idempotent saves, stale revisions, search/export/Trash/recovery, mock explanation protection, permitted explanation copies, deterministic review integration, versioned mapping replay, future-only calibration, policy RBAC/immutability and deletion cascades. Tests use temporary SQLite files and synthetic users.

Connected-browser QA used a separately named `data/upgrade-browser-qa.sqlite`: actual sign-in/onboarding, dashboard summary, misconception evidence and comparison, map zoom/fit/list and prerequisite lessons, Markdown editing/autosave/preview, 390×844 mobile notebook/forecast layouts, admin coverage, and two-tab conflict plus unmount/reopen recovery. Screenshots are in `docs/screenshots/intelligence-*.png`. The synthetic fixture script refuses a differently named database or unrelated accounts. No QA user or mock learning history was inserted into the main database.

Still unverified: standalone Playwright execution, PostgreSQL and Docker runtime behavior, external SMTP, load/concurrency under production volume, independent accessibility/security review, real backup cutover rehearsal, independently SME-approved mappings and statistical forecast calibration. Optional AI assistance, distributed asynchronous analytics, general notebook revision restoration UI, and offline merge/synchronization are not implemented. None is represented by a decorative or fake button.

## Technical references

- [Node SQLite online backup API](https://nodejs.org/api/sqlite.html): snapshot tooling; API availability noted above.
- [Original SM-2 description](https://super-memory.com/english/ol/sm2.htm): context for the existing inspired scheduler; no claim that this forecast implements canonical SM-2 or FSRS.
- [react-markdown security guidance](https://github.com/remarkjs/react-markdown#security): safe rendering configuration and limited URL/content support.
- [NIST cryptographic hash glossary](https://csrc.nist.gov/glossary/term/cryptographic_hash_function) and [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final): original paraphrases for hashing/Zero Trust lessons. Other existing sources remain in `content/sources.ts`; source checks dated October 27, 2026. Learning sequences and model thresholds are explicitly editorial choices.

## Completion release update · October 28, 2026

The sections above record the phase-2 snapshot. Current implementation now includes notebook history/restore UI and editable private recall cards, 58 foundation lessons in the library, five fictional labs, eight achievements/weekly missions/private bests, optional sharing/sounds/accents, four-week elapsed-time insights, email verification tokens and immutable scheduler-policy administration. Correct delayed rewards/readiness gating and concurrent reset-token use are fixed. Original question content, attempts, historical XP and due dates retained.

Migration 005 adds five tables without rewriting 001–004. Current verification is **70 automated tests, 2 real HTTP E2E tests**, lint/typecheck/content/build and connected-browser desktop/tablet/mobile checks. Node tooling minimum is now ^22.18.0 or >=24.11.0. The original phase-2 backup and 52-test result remain historical evidence, not the latest counts.

Official shadcn MCP configured with a pre-change TOML backup; actual stdio registry queries pass. Native tools need a Codex restart/new session. Six scoped official primitives are integrated. See [final audit](FINAL_IMPLEMENTATION_AUDIT.md) for complete evidence, the completion backup, operational counter/cache differences and unchanged learning/content comparisons. Independent content/model/production acceptance and offline synchronization remain outstanding.
