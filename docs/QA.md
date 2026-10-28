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

## Completion release · October 28, 2026 (current)

**70 automated tests, zero failures/skips; 2 real HTTP E2E tests passed.** Typecheck, ESLint, content validation and optimized build pass. Added tests cover correct-only retention rewards, successful-retrieval readiness gating, concurrent reset/mission claims, real progression/insights, opt-in privacy, accent gates, note restoration/card deduplication/owner checks, verification expiry/replay, new-table deletion, immutable session policy snapshots, original due dates, duplicate review and five fictional labs.

Migration fixture starts with populated schema 004 (including Markdown/history, XP/settings), hashes every original table, applies 005 twice and finds no changed original row. Actual backup integrity/digest/FKs pass; original learning/content/account records match. Strict live-store row equality differs only for operational rate limits and cached evaluation timestamps; both strict and exception-audited reports are retained. The completion backup contains one account and no attempts/notes, whereas the earlier snapshot described above had no account.

HTTP E2E uses Playwright APIRequest only against isolated QA port 3001: sign-in/practice/resume, persisted note/card/history, stale 409, graph/forecast, mock answer protection/final report, RBAC and cross-account privacy. It does not launch or substitute a GUI browser. Existing GUI tests were collected only; policy requires GUI automation through connected CUA here. Run standalone GUI scenarios on permitted CI.

Connected-browser completion checks: desktop 1280×720, tablet 1024×768, mobile 390×844; existing progress retained, real missions and private board defaults; notebook tabs/history, revision 1 restored as new revision 5, recall card created and found in library; drawer focus/Escape; dialog centering/scroll/focus return; map/forecast/settings/admin readouts. Screenshots in `docs/screenshots/completion-*.png`; all synthetic data. Main page and mobile drawer had no horizontal overflow after fixes. No full WCAG claim.

Production dependency audit: zero vulnerabilities. Full audit: three low dev-tool advisories in latest shadcn/registry/deepmerge, no compatible fix. Runtime dependency tree valid. PostgreSQL/Docker/SMTP execution, independent SME/model/security/accessibility/load acceptance remain outstanding. See [final audit](../FINAL_IMPLEMENTATION_AUDIT.md).
