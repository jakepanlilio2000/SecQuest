# CompTIA catalog research — Phase 0

Checked **November 14, 2026 (Australia/Perth)** against public CompTIA English/US product pages. Repository baseline: `b3b5172b055f287b444f375ba50276cbd7d44b35`. This is a research snapshot and a Phase 1 input, not a runtime catalog, content import or announcement that SecQuest supports these exams.

## Method and limits

The [official catalog](https://www.comptia.org/en-us/certifications/) combines exam certifications with courses and other learning products. Version-specific pages were followed where a landing page listed multiple generations. Direct HTTPS retrieval succeeded after the browsing service failed; no sign-in, purchase or booking was performed. Availability below means the official page lists the exam as available, with a past launch date and learning/purchase offerings; it does not guarantee a seat or a particular country's booking availability.

The [source manifest](research/comptia-source-manifest.json) records URLs, titles, HTTP results and local capture hashes. HTML captures remain in ignored research storage and are not redistributed. Dates and domain weights below are paraphrased factual metadata, not copied questions or full objectives. Product-page objective summaries were checked; the full objective PDFs and their revision identifiers have not been independently downloaded/verified for every exam. Complete subtopic ingestion and licensing review remain prerequisites for publishing a new bank.

Use exact dates only when stated. An estimated retirement year is not a deadline, and credential expiration is not exam retirement. Resolve conflicts before activation. Recheck official availability at each release; passing an announced launch date alone must never activate an exam automatically.

## Latest available exam generations

These are research candidates only. None is newly enabled in SecQuest by this phase. Estimated years in the last column are the publisher's estimates, not computed dates.

| Certification | Latest listed available version/code | Launch date | Retirement information | Official evidence |
| --- | --- | --- | --- | --- |
| A+ Core 1 | V15 / **220-1201** | 2025-03-25 | Estimated 2028; no exact date established | [Core 1](https://www.comptia.org/en-us/certifications/a/core-1-v15/) |
| A+ Core 2 | V15 / **220-1202** | 2025-03-25 | Estimated 2028; no exact date established | [Core 2](https://www.comptia.org/en-us/certifications/a/core-2-v15/) |
| Network+ | V9 / **N10-009** | 2024-06-20 | Estimated 2027; no exact date established | [Network+](https://www.comptia.org/en-us/certifications/network/) |
| Security+ | V7 / **SY0-701** | 2023-11-07 | English 2027-06-11; Japanese, Portuguese, Spanish and Thai 2027-08-13 | [V7](https://www.comptia.org/en-us/certifications/security/v7/), [version selector](https://www.comptia.org/en-us/certifications/security/) |
| CySA+ | V4 / **CS0-004** | 2026-06-23 | No exact date established | [V4](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/v4/) |
| PenTest+ | V3 / **PT0-003** | 2024-12-17 | Estimated 2027; preceding exam retired 2025-06-17 | [PenTest+](https://www.comptia.org/en-us/certifications/pentest/) |
| SecurityX | V5 / **CAS-005** | 2024-12-17 | Estimated 2027; no exact date established | [SecurityX](https://www.comptia.org/en-us/certifications/securityx/) |
| SecAI+ | V1 / **CY0-001** | 2026-02-17 | Estimated three years after launch; no exact date established | [SecAI+](https://www.comptia.org/en-us/certifications/secai/) |
| AutoOps+ | V1 / **AT0-001** | 2026-06-02 | Estimated three years after launch; no exact date established | [AutoOps+](https://www.comptia.org/en-us/certifications/autoops/) |
| Linux+ | V8 / **XK0-006** | 2025-07-15 | Estimated 2028; no exact date established | [Linux+](https://www.comptia.org/en-us/certifications/linux/) |
| Cloud+ | V4 / **CV0-004** | 2024-09-24 | Estimated 2027; no exact date established | [Cloud+](https://www.comptia.org/en-us/certifications/cloud/) |
| Server+ | V5 / **SK0-005** | 2021-05-18 | No exact date established; do not infer retirement from age | [Server+](https://www.comptia.org/en-us/certifications/server/) |
| CloudNetX | V1 / **CNX-001** | 2025-02-18 | Usually three years after launch; no exact date established | [CloudNetX](https://www.comptia.org/en-us/certifications/cloudnetx/) |
| Tech+ | V6 / **FC0-U71**, **FC0-U71-CE** | 2024-07-16 | Page distinguishes non-expiring and five-year credential variants; no exact exam retirement date established | [Tech+](https://www.comptia.org/en-us/certifications/tech/) |
| Data+ | V2 / **DA0-002** | 2025-10-14 | Estimated 2028; no exact date established | [Data+](https://www.comptia.org/en-us/certifications/data/) |
| DataSys+ | V2 / **DS0-002** | 2026-10-13 | Estimated three years after launch; no exact date established | [V2](https://www.comptia.org/en-us/certifications/datasys/v2/) |
| DataAI (formerly DataX) | V1 / **DY0-001** | 2024-07-25 | Estimated 2027; name change must not create a duplicate exam | [DataAI](https://www.comptia.org/en-us/certifications/dataai/) |
| Project+ | V5 / **PK0-005** | 2022-11-08 | No exact date established; do not infer retirement from age | [Project+](https://www.comptia.org/en-us/certifications/project/) |

A+ is one certification requiring **two exams from the same generation**, not two separate certifications or a freely mixed pair. [Official combined page](https://www.comptia.org/en-us/certifications/a/core-1-and-2-v15/).

## Announced and overlapping versions

| Version | Status as of check date | Decision |
| --- | --- | --- |
| Security+ V8 / SY0-801 | [V8 page](https://www.comptia.org/en-us/certifications/security/v8/) specifies 2026-11-17. The [selector](https://www.comptia.org/en-us/certifications/security/) describes V7 as available and V8 as expected around that date. | Upcoming on November 14. Preserve the existing V8 bank and its history; do not describe it as the currently available exam or relabel it V7. Recheck after launch. |
| CySA+ V3 / CS0-003 | [Selector](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/) and [V3 notice](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/v3/) specify English exam retirement 2026-12-22 and translations 2027-03-23. English learning products retire 2026-11-22. | Retiring, not the default for new content; preserve any historical records. Product retirement and exam retirement are separate dates. |
| DataSys+ V1 / DS0-001 | [Selector](https://www.comptia.org/en-us/certifications/datasys/) specifies English exam retirement 2027-04-16 and translated exams/products 2027-06-11; English learning products retire March 2027. The [V1 detail table](https://www.comptia.org/en-us/certifications/datasys/v1/) still has a generic estimated 2026 retirement. | Prefer the specific dated notice over the generic estimate. V2 is latest; retain the disagreement in source evidence. |
| SecOT+ V1 / SOT-001 | [Official page](https://www.comptia.org/en-us/certifications/secot/) is pre-order: overview says around 2026-12-08, detail table says 2026-12-01. | Upcoming with **conflicting launch dates**. No selectable active exam and no invented single launch date until reconciled. |

## Objective-weight baseline

The weights are in each source page's domain order and sum to 100. Links in the catalog table identify the exact source. These summaries are not a substitute for checking complete objective identifiers and PDF revisions before authoring.

| Exam | Domain weights (%) | Domains |
| --- | --- | --- |
| 220-1201 | 13 / 23 / 25 / 11 / 28 | Mobile devices; networking; hardware; virtualization/cloud; hardware/network troubleshooting |
| 220-1202 | 28 / 28 / 23 / 21 | Operating systems; security; software troubleshooting; operational procedures |
| N10-009 | 23 / 20 / 19 / 14 / 24 | Concepts; implementation; operations; security; troubleshooting |
| SY0-701 | 12 / 22 / 18 / 28 / 20 | General concepts; threats/vulnerabilities/mitigations; architecture; operations; program management/oversight |
| SY0-801 (upcoming) | 16 / 24 / 19 / 27 / 14 | General concepts; threats/vulnerabilities/attacks; architecture; operations; program management/oversight |
| CS0-004 | 34 / 26 / 24 / 16 | Security operations; vulnerability management; incident response/management; reporting/communication |
| PT0-003 | 13 / 21 / 17 / 35 / 14 | Engagement management; reconnaissance/enumeration; vulnerability discovery/analysis; attacks/exploits; post-exploitation/lateral movement |
| CAS-005 | 20 / 27 / 31 / 22 | Governance/risk/compliance; architecture; engineering; operations |
| XK0-006 | 23 / 20 / 18 / 17 / 22 | System management; services/users; security; automation/orchestration/scripting; troubleshooting |
| CV0-004 | 23 / 19 / 17 / 19 / 10 / 12 | Architecture; deployment; operations; security; DevOps; troubleshooting |
| SK0-005 | 18 / 30 / 24 / 28 | Hardware; administration; security/disaster recovery; troubleshooting |
| CNX-001 | 31 / 28 / 16 / 25 | Architecture; security; operations/monitoring/performance; troubleshooting |
| FC0-U71 | 13 / 24 / 18 / 13 / 13 / 19 | Concepts; infrastructure; applications/software; development; data/databases; security |
| DA0-002 | 20 / 22 / 24 / 20 / 14 | Concepts/environments; acquisition/preparation; analysis; visualization/reporting; governance |
| DS0-002 | 19 / 17 / 18 / 19 / 14 / 13 | Fundamentals; deployment; management/maintenance; security; continuity; integration |
| DY0-001 | 17 / 24 / 24 / 22 / 13 | Mathematics/statistics; modeling/analysis/outcomes; machine learning; operations/processes; specialized applications |
| PK0-005 | 33 / 30 / 19 / 18 | Management concepts; life cycle; tools/documentation; IT/governance |
| CY0-001 | 17 / 40 / 24 / 19 | AI concepts; securing AI; AI-assisted security; governance/risk/compliance |
| AT0-001 | 31 / 25 / 24 / 20 | Automation coding; system configuration; continuous integration; continuous delivery |

SecOT+ domain weights were not established from its product-page summary and it remains held pending its date conflict. Full PDF revisions/subtopic trees remain unverified for every new bank. An omitted field is unknown, never permission to fill it from memory.

## Courses and other products are a separate catalog type

The current [Cloud Essentials](https://www.comptia.org/en-us/certifications/cloud-essentials/) page describes a course and competency assessment; do not manufacture a currently available Cloud Essentials+ exam from that URL. The [a+ Cyber](https://www.comptia.org/en-us/certifications/a-cyber/) and [a+ Network](https://www.comptia.org/en-us/certifications/a-network/) pages describe introductory courses preparing learners for Security+/Network+, not replacements for those exam certifications.

Essentials and Pro learning products, bundles, continuing education and certification kits appear in the same catalog. They are not automatically independent CompTIA exam certifications. Keep them out of the exam selector unless separately verified; this inventory does not establish their full credential or assessment requirements. No retired ITF+, CASP+ or legacy exam is newly enabled merely because it appears in an older roadmap or source.

## Repository findings and Phase 1 decisions

1. `content/blueprint.json` identifies SY0-801 and already says launch was unverified. Its 16/24/19/27/14 weights match the current official V8 page; it is **not SY0-701**. Keep its ID, objective links, question revisions, attempts and schedules unchanged.
2. `src/lib/content.ts` imports one blueprint; `currentBlueprint()` selects only its code and validation checks only its objectives. `src/lib/auth.ts`, profile validation in `src/lib/api.ts`, onboarding, notebook objective links and intelligence links hard-code SY0-801. Analytics uses that single blueprint. All must become exam-aware through small slices before enabling more content.
3. `src/lib/types.ts` limits objectives to domains 1–5. Cloud+, Tech+ and DataSys+ V2 have six domains. Replace that assumption with validation against the selected exam's verified objective tree, not just a broader regex.
4. Initial SQL already models exam versions and exam-linked domains/objectives. Questions use global IDs; session settings snapshot exam and blueprint revision, while several learning tables use bare objective strings. Add explicit, stable certification/generation/exam identities and ownership joins; do not infer an exam from an objective such as `1.1`.
5. First rollout: Security+, Network+, A+ (both cores). Then Linux+/Cloud+/Server+, followed by the other verified families. Activation needs verified current availability **and** reviewed content. The 1,000-distinct-question-per-exam target is a coverage goal, not a publication shortcut. Draft in bounded batches, with sources, rationales, varied formats and separate-author qualified review; no dumps, paraphrase padding or copied official sample questions.
6. Default selection is the latest verified available supported generation per certification/language. Announced and draft banks remain clearly labeled and non-default; older versions remain reachable when needed for saved sessions and history. No silent upgrade, content relabeling, schedule rewrite, deletion or progress transfer between exams.
7. Pages remains a static project guide. Shared accounts, isolated per-exam study records and any executable lab infrastructure belong on the server. Early labs should remain fictional simulations; real executable sandboxes need a later isolation/resource/cleanup review.

## Phase 0 acceptance and next gate

- Completed: official catalog inventory, first-wave available/upcoming distinction, version-specific references, English/translation retirement separation, current source conflicts, product-versus-exam separation, source capture manifest, source-code constraints and preservation decisions.
- Pending: complete objective PDFs/revisions/subtopic trees for new banks, SecOT+ weights, rights review of taxonomy reuse, qualified content reviewers, and reconciliation/recheck of future launch dates.
- Phase 1 may implement the registry and additive preservation-tested schema with synthetic records. No new exam becomes learner-selectable until its source and editorial gates pass. Do not modify the existing learner database during research.
