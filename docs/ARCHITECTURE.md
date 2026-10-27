# Architecture

## Runtime boundaries

Next.js App Router serves a React/TypeScript client and Node route handlers. Question grading and progression rules live in server modules, never in presentation code. The browser receives an explicit public question projection without correct answers or teaching explanations. Detailed feedback is returned only after an accepted learning answer or after mock completion.

| Module | Responsibility |
|---|---|
| `src/lib/auth.ts` | Password KDF, opaque session creation, token hashing, user lookup, persistent throttles, user-row locking |
| `src/lib/content.ts` | Objective registry, typed validation, content revision persistence, starter seeding, public projection |
| `src/lib/engine.ts` | Session construction, selection, answer validation, grading, review writes, retry placement, expiry, reward events |
| `src/lib/scheduler.ts` | Pure grading and documented SM-2-inspired delayed-review transitions |
| `src/lib/analytics.ts` | Real attempt aggregates, coverage, evidence-adjusted objective estimates, readiness factors |
| `src/lib/api.ts` | Zod request boundaries, CSRF/origin checks, RBAC, cards, plans, simulations, administration, export/deletion |
| `src/lib/db.ts` | Typed parameterized SQL interface; SQLite dev and PostgreSQL deployment adapters; versioned SQL migrations |
| `content/` | Versioned V8 hierarchy, original seed batch, references, fictional simulation definitions |
| `src/components/` | Client interaction and presentation; no trusted grading or reward calculation |

## Storage

The migration-managed relational model stores users, authentication/reset tokens, rate limits, exam versions/domains/objectives, sources, question metadata/revisions/options/objective mappings/categories, editorial reviews, sessions/items, attempts, review schedules, XP events, achievements, flashcards/reviews, plans, simulations, and audit entries. Exam configuration revisions are snapshotted separately. Objective estimates are computed from attempts rather than duplicating an inconsistent mutable mastery counter.

JSON text stores immutable question explanation bundles, source metadata, nested objective taxonomy, preferences, selections, and plan notes. Queryable relationships remain foreign-key constrained tables. Parameters are bound in both adapters. PostgreSQL placeholder translation is restricted to developer-written queries; client input never supplies SQL.

PostgreSQL mutations lock the learner row before related progress writes. SQLite serializes application transactions and uses WAL, foreign keys, and a busy timeout. Attempt uniqueness on session item and reward uniqueness on `(user,event_key)` enforce retry-safe submission and bounded rewards. Migrations use a PostgreSQL advisory transaction lock. On PostgreSQL, perform a single migration/seed job before starting multiple replicas to avoid initial-seeding races.

## Learning sequence

1. Create a session from currently published revisions, after applying filters. Mock selection approximates blueprint weights subject to actual domain capacity; the small bank cannot meet every quota.
2. Persist the complete ordered item list and original exam configuration revision. Save each mock selection without grading feedback.
3. In learning modes, grade the server's immutable question revision, preserve the submitted selection, store one attempt, update the review schedule, and award only eligible unique events in one transaction.
4. On failure, insert a retry after a random gap of 3–8 other items if enough items remain. At most three occurrences of a question are allowed in one session; further practice is deferred. The durable review schedule is never removed because a retry cannot fit.
5. A recent correct retry schedules a next-day review. It does not increment independent repetitions or count as a first encounter.
6. Independent reviews at least 24 hours apart grow intervals 1 → 3 → 7 → 14 days → ease-based longer intervals. Failure restarts learning and preserves lapse counts. Low confidence limits the next interval to one day and prevents a proficient state from guessing alone.
7. Session completion is persisted. Reopening uses the same items, selections, feedback, deadline, and cursor.

## Measurement

First accuracy uses only the first stored attempt per learner/question ID, across revisions and sessions. Retry accuracy uses later attempts. Delayed recall includes both successful and failed attempts at least 24 hours after the previous presentation; recent in-session retries are excluded. Strong retention requires multiple delayed successful retrievals. Flashcard activity never becomes exam evidence.

Objective estimate = `(first-correct + 1) / (unique-first-evidence + 2)`. Unseen objectives remain zero. Domain estimates average all their objectives, so uncovered objectives lower the aggregate. Small samples are marked limited. These values are educational heuristics, not calibrated psychometric scores.

XP: 10 once per first-ever correct first encounter; 5 once per recovered question; 15 once per delayed-retention question; 20 once per UTC date with a completed nonempty session; 30 once per fully solved simulation. Unique event keys prevent farming. Ranks use a deterministic square-root XP curve. Daily buckets currently use UTC; local-time goal boundaries are a future improvement.

Response duration is bounded server elapsed time since first display, not a reliable measure of focused attention. Study minutes are estimates. Full attention/idle tracking and empirical item calibration are not implemented.

## Extension points

New content uses revisioned imports and editorial gates. The blueprint JSON import script preserves hierarchy levels and records a SHA-256 of the source PDF. Exam limits can be revised through administration; existing sessions remain unchanged. Full objective-taxonomy replacement across multiple certifications, per-objective revalidation flags, distributed background jobs, psychometric calibration, and optional AI retrieval integration remain later work.

## Shared concept intelligence

Migration 004 adds canonical concepts and revision-specific links without altering questions or progress. The answer transaction appends idempotent misconception evidence and any eligible forecast outcome; expensive joins/classification remain outside grading. Derived replay is bounded and versioned. `mastery.ts` shares the pre-existing formula with concept views. Graph prerequisite/builds-on edges are validated as a DAG; unrelated edges never become prerequisites. Global graph edits use an advisory lock on PostgreSQL and the existing serialized SQLite transaction path.

Forecasting reads the existing `review_schedules` and real attempts. It does not implement another scheduler. Daily/recovery ordering is deterministic; recall probabilities are gated, explicitly heuristic and evaluated only against future independent retrievals. Notebook operations are separate owner-scoped transactions with revision checks, request idempotency, private history, provenance and recoverable deletion. Reading/writing notes never changes learning evidence. API routes reuse authentication, origin checks and rate limits. See [the implementation report](../INTELLIGENT_LEARNING_IMPLEMENTATION.md) for formulas, table groups, security boundaries and remaining limitations.
