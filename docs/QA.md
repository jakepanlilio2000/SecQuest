# Verification evidence

Local development verification on October 27, 2026:

- 35 passing unit/integration checks, strict TypeScript check, and Next.js optimized production build.
- Original content schema, option mapping, example count, source IDs, duplicate fingerprints, all 27 objective mappings, and blueprint weights.
- Automated unit/integration suite: scheduler intervals, confidence, delayed recall including failures, retry gap boundaries, exact multi-answer/ordered grading; authentication and origin checks; real session writes and random retries; refresh reconstruction; idempotent concurrent answers; XP farming protection; active mock response redaction; draft revisions and final locking; server expiry; ownership/RBAC; flashcard persistence and evidence separation; plans; simulations; atomic imports and author-review separation; first-attempt aggregates; account export/deletion; versioned exam settings applied to new sessions; server evaluation of multiple/matching/ordering.
- Browser: actual account registration and onboarding, real empty dashboard, intentional incorrect answer with every option explained and two examples, review insertion, refresh retaining feedback, flashcard save and library, mobile viewport 390 × 844, responsive drawer, timed mock entry with hidden feedback, final mock submission/report, and the restricted content dashboard/coverage register.

Use `npm test` for the current test count. All tests run against isolated synthetic SQLite data; they do not establish PostgreSQL compatibility by execution.

The `tests/e2e/learning.spec.ts` Playwright test and desktop/mobile configuration are supplied for a browser-enabled CI host. The standalone runner was not executed here; connected-browser checks were used instead. Docker/PostgreSQL, SMTP mail delivery, independent SME review, statistical calibration, full WCAG conformance, and public HTTPS/backup recovery remain unverified.

Known measurement limit: response time is bounded elapsed time from server display, including possible user idle time. Do not interpret displayed study minutes as validated focused attention. Small-bank readiness is explicitly gated and unofficial.

## Intelligent learning upgrade · October 28, 2026

52 automated tests pass, including all 35 baseline tests. New suites `intelligence-models.test.ts` and `intelligence-integration.test.ts` cover distinct-question thresholds and recurrence, corrective/delayed evidence, dependency cycles/direction and unknown mastery, real-history forecast gating and stable ordering, safe GFM rendering, populated schema-003 preservation, private notebook authorization/search/export/history, idempotent concurrent mutations, 409 stale revisions, contextual deduplication, licensed explanation copies and mock protection, gap/due filters, Trash/restore, immutable policies and roles, versioned mapping replay without rewriting attempts, strictly future forecast evaluation and deletion cascades. The tests construct old schema tables before migration and compare every original row hash.

Connected browser QA used only `data/upgrade-browser-qa.sqlite` and synthetic accounts. Verified real sign-in/onboarding, dashboard intelligence summary, detection/prevention evidence details and remediation, prerequisite map zoom/fit and accessible list, notebook autosave and GFM preview, desktop and 390×844 mobile layout without page overflow, retention insufficient-data states with real due dates, and administrator coverage/edit controls. Two tabs verified that a newer server revision rejects an older draft; leaving and reopening recovered the local draft while retaining the conflict and disabled save until review. The unload/navigation guards were observed. A regression found during this check was fixed by retaining the recovery draft's original base revision.

Screenshots: [desktop notebook](screenshots/intelligence-notebook-desktop.png), [mobile notebook](screenshots/intelligence-notebook-mobile.png), [conflict recovery](screenshots/intelligence-conflict-recovery.png). These contain synthetic QA information, not real learner data. Standalone Playwright and production infrastructure acceptance remain unexecuted as described above.

The local backup digest and all original row hashes passed verification. SQLite integrity is OK and foreign-key violations are zero. The original local database contained zero user/attempt records; populated preservation was established by the separate migration fixture, not invented historical activity. Verification manifests remain with the local backup under `data/backups/`.
