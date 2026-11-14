# Implementation checklist

Phase 2A adds the authenticated [learner certification catalog](CERTIFICATION_REGISTRY.md#phase-2a-learner-catalog), with dated availability, content readiness, disabled unready tracks and continuation of the existing workspace. Switching and per-exam progress remain blocked on Phase 1B; this is not a completed multi-certification selector.

Phase 1A adds the [certification registry foundation](CERTIFICATION_REGISTRY.md): additive migration 006, first-wave exam identities and a closed readiness gate. Existing learner flows stay on their original SY0-801 bank. Multi-certification APIs, objective imports and the learner selector are not implemented by this slice.

Multi-certification Phase 0 research was recorded on November 14, 2026: see the [official-source catalog and Phase 1 decisions](CERTIFICATION_CATALOG.md). No new certification is implemented or enabled by that research. In particular, SY0-701 is currently available; the existing SY0-801 content is aligned to an upcoming exam scheduled for November 17. Preserve its identity and learner history. The implementation snapshot below remains dated October 28.

Current verified state: October 28, 2026. Operational local release; independent production acceptance of the full master brief is outstanding. See [final audit](../FINAL_IMPLEMENTATION_AUDIT.md) and [feature gap analysis](../IMPLEMENTATION_GAP_ANALYSIS.md).

| Phase                 | Implemented and checked                                                                                                                                                                                                       | Remaining                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Research/architecture | Official V8 PDF v2.0, weights, 27 objectives/nested taxonomy; SQL adapters; five additive migrations; SQLite; container/environment files                                                                                     | Source/licensing rechecks, PostgreSQL/Docker execution                                                                                       |
| Core                  | Registration/login/logout, scrypt/opaque sessions, onboarding/profile/export/deletion, verification token/settings UI, concurrency-safe recovery tokens, six formats, durable sessions, mock drafts/deadline/redaction/report | Real verification/recovery email delivery needs SMTP; production abuse acceptance                                                            |
| Adaptivity            | Durable missed queue, randomized 3–8-item retry, distinct first/retry/delayed evidence, low-confidence conservatism; correct-only delayed rewards; immutable review-policy admin and session snapshot                         | Psychometric/model validation; existing schedules never rewritten                                                                            |
| Content               | 44 distinct original starter questions, 45 revisions, all 27 objectives mapped, rationales/examples, import/review/publish/source/coverage tools; lexical duplicate-review assistance                                         | 600 independently reviewed items then 1,200; complete subtopic coverage; full semantic deduplication; independent SME approval               |
| Gamification          | Bounded durable XP, ten ranks, eight evidence-based achievements, weekly missions, private personal bests, XP-gated accents, optional answer tones, opt-in alias leaderboard                                                  | Broader device/audio acceptance; UTC boundary localization                                                                                   |
| Analytics             | First/retry/delayed accuracy, objective/domain estimates, four-week trends, real history, objective elapsed-time medians, descriptive Wilson intervals, gated readiness                                                       | Statistical calibration and validated focused-attention measurement                                                                          |
| Learning tools        | 58 foundation concepts/library lessons, typo-tolerant lookup/local companion, private flashcards/schedule, editable plans, five original fictional labs                                                                       | Live AI/Taglish, full reviewed encyclopedia/acronym index, broader PBQ material                                                              |
| Intelligent learning  | Exact misconception evidence/remediation, directed graph/minimal paths/list, real-schedule forecasts/future outcome evaluation, private Markdown notebook/autosave/recovery/history restore/note cards/search/export/Trash    | Broader reviewed misconception mappings; forecast calibration; offline synchronization                                                       |
| UI/tooling            | Official shadcn MCP configured and registry verified; six scoped primitives; refined shell/dashboard/map/notebook; responsive desktop/tablet/mobile and keyboard checks                                                       | Restart Codex to load native MCP namespace; independent accessibility review                                                                 |
| QA/deployment         | 70 automated tests, 2 real HTTP E2E tests, lint/typecheck/content/build, connected browser, backup/row audits, populated migration test                                                                                       | Standalone GUI Playwright execution, PostgreSQL/Docker/SMTP, independent load/security/accessibility, public TLS/backups/monitoring/recovery |

## Acceptance and limits

The real account → learning → intentional error → teaching feedback → durable retry/schedule → refresh/resume → mock without early feedback → final report workflow remains operational. HTTP tests cover persistence, mock copy protection and cross-account privacy. Notebook browser QA restored old text as a new revision, retained existing history and created a recall card. No question/attempt/XP reset or database replacement occurred.

The 44-question bank cannot yield a 90-distinct-question mock; smaller available counts are disclosed. Content has source-informed editorial checks, **no documented independent SME approval**. Misconception coverage remains nine definitions/thirteen mappings over nine questions; only four definitions have two distinct mapped questions. Forecast/readiness values remain uncalibrated and evidence-gated.

## Deliberate implementation choices

- Parameterized SQL repositories with local SQLite and deployment PostgreSQL adapter.
- Scoped shadcn/Radix primitives and Tailwind utilities reuse existing CSS themes and shell.
- Database-backed queues/limits/rewards; no Redis dependency for this workload.
- Stored concept retrieval and editable note cards require no AI key; no notes sent externally.
- Online autosave/local draft recovery, without a claim of offline synchronization.
- Learner board off by default; private notes/history never appear in it.

## Preservation evidence

Completion backup: `data/backups/pre-shadcn-completion.sqlite`. Digest matches, integrity OK, zero foreign-key violations, original content/account/learning records preserved. Strict full-row comparison reports operational throttle changes and cache evaluation timestamps; the separate explicit operational-difference audit passes. The populated schema-004 migration fixture compares every original row without exceptions. See the final audit before interpreting the reports. Earlier phase-2 results in `INTELLIGENT_LEARNING_IMPLEMENTATION.md` and QA history are historical snapshots, superseded by this checklist.
