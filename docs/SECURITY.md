# Security and privacy implementation

Implemented: 15–128-character passphrases, unique salts and scrypt (`N=32768,r=8,p=1`, 64-byte derived key), constant-time comparison, random 256-bit opaque session/reset tokens stored hashed, HttpOnly/SameSite cookies, optional Secure cookies for HTTPS, session invalidation on password change, origin checks and JSON-only mutations, Zod request validation, parameterized SQL, React text escaping, ownership checks, content-role authorization, persistent throttles, audit trails for editorial changes, revision and attempt foreign keys, reward idempotency, server-authoritative grading/deadlines, personal export and password-confirmed deletion.

Correct answers and rationales are not present in active mock question projections. Learning feedback and completed reports intentionally reveal educational content. Learners can learn answers through other sessions, so this is a learning platform, not a secure high-stakes proctoring product.

Roles are learner, reviewer, content_admin, and system_admin. New accounts always receive learner. Account promotion is an operator CLI action; no public endpoint lets a client choose an administrative role. A question author cannot approve their own revision. Content editors can submit and publish; reviewers can approve; only system administrators change exam configuration.

Limits: registration and login use global and normalized-account throttles; learner API throttles are persistent per user. This is a baseline, not a comprehensive abuse defense. Add an edge rate limiter/WAF and verified email before a public multi-tenant launch. No MFA or breached-password corpus is configured. SMTP reset delivery must be tested. Mail-provider authentication and database TLS depend on deployment configuration.

Content security policy denies framing, object origins via default-src, external connections, and foreign scripts/assets. Inline scripts/styles remain allowed for Next/React runtime compatibility; development additionally allows unsafe-eval for React diagnostics. Production should adopt nonce-based CSP as part of a dedicated hardening pass if required by its threat model. Serve production over HTTPS; transport encryption and HSTS are reverse-proxy responsibilities.

Store only email, display name, preferences, and learning records. No real security target data is collected. Simulation addresses use documentation ranges and all scenarios are fictional. Tutor retrieval uses stored content and transmits no queries to an external AI provider. Database backups may contain personal data and require restricted, encrypted storage and a defined deletion/retention policy.

The starter content publication exception is documented in CONTENT.md. Import/schema validation is not a proof of technical correctness. This project has not received an independent penetration test, external accessibility audit, or production load test.
