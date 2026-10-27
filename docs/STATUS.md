# Implementation checklist

As of October 27, 2026. This is an operational first release, **not a completed production acceptance of the entire master development prompt**.

| Phase | Implemented and checked | Remaining |
|---|---|---|
| 1 · Research/architecture | Official linked V8 PDF v2.0; weights; 27 objectives and nested taxonomy; normalized schema; three migrations; local SQLite and PostgreSQL adapter; environment and container files | Re-check inaccessible product/policy pages; licensing review for commercial taxonomy use; PostgreSQL/Docker execution |
| 2 · Core | Registration/login/logout; scrypt; onboarding; shell; profile; revisioned content; persistent sessions; server grading; six formats; mock navigation/flags/drafts/deadline/report | SMTP delivery test; email verification; operational password recovery configuration |
| 3 · Adaptivity | Persistent missed queue; randomized 3–8-item retry; capped session occurrences; separate delayed recall; low-confidence handling; unique encounter stats; later schedules | Validated psychometric model; richer prerequisite recommendations; configurable scheduler policy UI |
| 4 · Content | 44 distinct original starter items; all 27 objectives mapped; option rationales and examples; schema checks; import/review/publish workflow; source register; coverage matrix | **600 independently reviewed items**; 1,200 long-term target; complete subtopic question coverage; semantic deduplication; independent SME approval |
| 5 · Gamification | Durable bounded XP events; ten ranks; four actual achievements; two defensive missions; objective skill tree | Expanded achievement rules; personal bests; weekly missions; theme unlocks; sounds; optional leaderboard |
| 6 · Analytics | First/retry/delayed recall; objective/domain estimates; difficulty; 7-day activity; actual recent attempts; session/mock history; transparent gated readiness | Statistical calibration; confidence intervals; multi-week trends; objective response-time insights; trustworthy focused-time measurement |
| 7 · Learning tools | Stored concept library; typo-tolerant search; deterministic companion; personal flashcards and recall schedule; editable study-day planner; two safe simulations | Optional live AI provider, retrieval citations/Taglish; full encyclopedia term list and diagrams; more PBQ-style labs; richer automatic card formats |
| 8 · QA/deployment | Unit/integration tests; successful Next production build; strict TypeScript; content validator; browser desktop/mobile QA; Docker development/production setup; operator docs | Standalone Playwright runner execution; Docker/PostgreSQL runtime test; real SMTP test; external accessibility audit; load testing; independent security review; deployed TLS/backups/monitoring |

## Acceptance workflow status

The local application supports account creation → SY0-801 onboarding → real stored question → intentional error → complete teaching feedback → stored attempt → later in-session retry → separate retry evidence and future schedule → refreshed/resumed progress → actual dashboard → timed mock without early feedback. Database integration tests exercise this chain and enforce idempotency/ownership. Browser QA separately checks the major account, learning, refresh, flashcard, mobile, and mock flows.

Not fulfilled: the requirement for at least 600 **fully reviewed** questions and an independently verified production deployment. The starter bank is 44 authored/automatically checked items, with independent approval outstanding. A 90-question mock cannot be assembled from this bank without repetition; the UI discloses the smaller distinct count.

## Deliberate implementation choices

- Parameterized typed repositories instead of Prisma avoid a native ORM generation dependency and support a service-free SQLite developer install plus PostgreSQL deployment.
- Accessible CSS components and Lucide icons instead of shadcn/Tailwind; no animation library is required for the restrained interface. Reduced motion is supported.
- Database-backed limits and queues instead of Redis for this workload.
- Stored concept retrieval instead of claiming an unconfigured AI service is functional.
- No offline attempt synchronization/PWA, external competition, real-target scanning, or fabricated certification scores.

## Intelligent learning upgrade · October 28, 2026

Implemented in the existing app: distractor-specific misconception evidence and remediation dashboard, validated directed prerequisite graph and interactive map/list, minimal learning paths, real-schedule retention timeline and future-outcome evaluation, private Markdown notebook and contextual integrations, role-restricted mapping tools, additive migration 004 and backup/preservation utilities. Local checks now pass 52 tests, strict TypeScript, content validation and production build. The actual database preserved all original rows across 27 tables; populated legacy progress preservation is also tested separately.

Coverage is partial: 58 concepts, 47 relationships, nine misconception definitions, thirteen distractor mappings over nine questions. Only four definitions currently have the two distinct questions needed for a possible finding. More reviewed alternate formulations and expert review are required for broad likely/recurring detection. Forecasts are explicitly uncalibrated, with numbers withheld when history is sparse. No optional live AI, offline synchronization or general notebook history restoration UI is claimed. PostgreSQL/Docker/SMTP, production load/security/accessibility and independent SME acceptance remain outstanding.

See [the full upgrade report](../INTELLIGENT_LEARNING_IMPLEMENTATION.md) for completed/partial/missing items, policy formulas, privacy, mapping work and rollback instructions. The original 600-question target remains outstanding.
