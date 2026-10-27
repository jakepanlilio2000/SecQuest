# Content provenance and review

Verified on **2026-10-27**. This was a focused source consultation, not an exhaustive internet search.

The source register is `content/sources.ts`, also shown in content administration. It records publishers, original URLs, verification dates, revision availability, status, applicable version/objectives, and use restrictions.

## Blueprint

The supplied [CompTIA objectives PDF](https://lecbyo.files.cmp.optimizely.com/download/77f3bd3223ac11f180820e495f189928) was directly retrieved. It identifies **Security+ SY0-801 V8, objectives document v2.0**, copyright 2025; it specifies weights **16/24/19/27/14**, a maximum of 90 questions, and 90 minutes. Its 27 objectives and 849 bullet nodes, including nested subtopics, are represented in `content/blueprint.json` with page provenance and hierarchy depth.

The original PDF is not distributed. The original URL and file SHA-256 are retained. CompTIA retains copyright in its objective taxonomy. Its use here is alignment and attribution, not a claim of ownership or endorsement. Commercial redistribution should receive a licensing review of this taxonomy. Starter question prose and fictional examples were independently written for this project.

The official [V8 product page](https://www.comptia.org/en-us/certifications/security/v8/) and the direct unauthorized-training-materials policy page could not be fetched by the research tool. Exam launch/booking availability is therefore not presented as independently verified. The objectives PDF contains the unauthorized-materials warning; the [Pearson VUE CompTIA page](https://www.pearsonvue.com/us/en/comptia.html) also corroborated it.

The [Wiley SY0-801 Study Guide, tenth edition product page](https://www.wiley.com/en-jp/comptia-security-study-guide-exam-sy0-801-10th-edition-p-9781394434305) was found in publisher search results. It lists December 2026 and pre-order status. **The book was not consulted and its test bank was not used.** No currently released Wiley SY0-801 book contents were assumed available.

## Technical grounding

- [NIST SP 800-207](https://www.nist.gov/publications/zero-trust-architecture), published 2020-08-10: explicit resource access and absence of implicit network trust.
- [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final), April 2025: incident response integrated with CSF 2.0; supersedes Rev. 2. The ordering exercise is explicitly a fictional prescribed playbook, not a claim that Rev. 3 requires one universal sequence.
- [OWASP Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html): data/syntax separation and parameterized interfaces.
- [OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html): untrusted content and permissions enforced outside the model.
- [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): credentials, passphrases, and public-key authentication context.
- The CISA Known Exploited Vulnerabilities catalog returned 403. No catalog contents or current vulnerability claims were imported.

NIST concepts are paraphrased. OWASP is linked with attribution, with its CC BY-SA licensing noted in the register; no source prose or commercial questions were copied. No exam dumps were opened or imported.

## Actual starter coverage

There are **44 original, structurally validated starter items**. Their mappings cover all 27 objectives at least once; **this does not constitute full subtopic coverage**. Domain counts are 8, 8, 6, 14, and 8. Every item includes a concept definition, rationale for each option, and two real-world examples. Supported seed formats include scenarios, multiple response, matching, ordering, and fictional logs; the engine also supports single-answer format.

These items underwent automated consistency checks and source-informed editorial checks during authoring. **Zero items have a documented independent human SME sign-off in this release.** Starter publication is an explicitly documented bootstrap exception, labeled in the UI; it is not equivalent to the separate-reviewer approval required for new administrator content. For a strict content launch, archive the starter batch and publish only after qualified independent review.

The target remains 600 reviewed items, then 1,200 according to domain weights. Remaining work includes distinct questions across the entire subtopic hierarchy, plausible competing distractors, varied correct positions, difficulty calibration, ambiguity checks, technical SME validation, and pilot performance review. Generated paraphrases and shuffled choices must not increase the item count.

## Pipeline

1. Re-verify official source revision and licensing constraints.
2. Re-import with `node scripts/import-blueprint.mjs <local-pdf>` or omit the file argument for the configured official URL. Inspect the output before replacing a deployed blueprint.
3. Author distinct items and record objective, sources, editorial difficulty, type, options, rationale, examples, and original ID.
4. Run `npm run content:validate` for bundled items, or use atomic administrative import for new content. New items are Draft.
5. Submit for review. A different account must approve the revision. A content administrator can publish after approval. All transitions require a note and are audited.
6. Editing creates an immutable new revision and returns the current version to Draft. Existing sessions and attempts retain the old revision. Archiving prevents new session selection without deleting history.

Exact normalized-prompt duplicate detection is implemented. Semantic paraphrase detection and automated logical correctness verification are not. Structural validation cannot establish educational truth; the independent review gate is essential.
