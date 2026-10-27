import { questions } from "./questions";
import type {
  SecurityConcept,
  ConceptRelationship,
  MisconceptionDefinition,
  MisconceptionMapping,
  IntelligencePolicy,
} from "../src/lib/intelligence-types";
export const conceptId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const lesson = (
  id: string,
  name: string,
  definition: string,
  objectives: string[],
  examples: string[],
  references = ["comptia-v8"],
): SecurityConcept => ({
  id,
  name,
  definition,
  explanation: definition,
  objectives,
  difficulty: "easy",
  examples,
  references,
  validationStatus: "editorial-reviewed",
  glossaryTerm: name,
});
export const concepts: SecurityConcept[] = [
  ...new Map(
    questions.map((q) => [
      conceptId(q.concept),
      {
        id: conceptId(q.concept),
        name: q.concept,
        definition: q.definition,
        explanation: q.explanation,
        objectives: [q.objective],
        difficulty: q.difficulty,
        examples: q.examples,
        references: q.sources,
        validationStatus: "editorial-reviewed" as const,
        glossaryTerm: q.concept,
      },
    ]),
  ).values(),
  lesson(
    "security-principles",
    "Security principles",
    "Security decisions connect confidentiality, integrity, and availability to threats, business needs, and appropriate controls. A control should address the stated goal rather than merely transform data.",
    ["1.1"],
    [
      "Encrypt a confidential message; verify its integrity using an authenticated mechanism.",
      "Keep a critical service available using tested redundant infrastructure.",
    ],
  ),
  lesson(
    "cryptography-fundamentals",
    "Cryptography fundamentals",
    "Cryptography uses mathematical constructions and keys to support goals such as confidentiality, integrity, and authentication. Encryption, hashing, and digital signatures provide different security properties.",
    ["1.3"],
    [
      "TLS combines key establishment, authenticated encryption, and certificate validation.",
      "A signed update allows signature verification without revealing the signing private key.",
    ],
  ),
  lesson(
    "hashing",
    "Cryptographic hashing",
    "A cryptographic hash produces a digest and is designed to resist preimage and collision attacks. Hashing alone does not encrypt the input or provide confidentiality.",
    ["1.3"],
    [
      "A trusted digest helps detect an accidentally modified downloaded file.",
      "Password verification uses a salted password-specific KDF rather than reversible encoding.",
    ],
    ["comptia-v8", "nist-hash"],
  ),
  lesson(
    "encryption",
    "Encryption",
    "Encryption transforms plaintext into ciphertext under a key so authorized recipients can recover plaintext through decryption. Key management and appropriate authentication are essential.",
    ["1.3"],
    [
      "Authenticated encryption protects a confidential database backup.",
      "An HTTPS connection protects application data on an untrusted network.",
    ],
  ),
  lesson(
    "symmetric-cryptography",
    "Symmetric cryptography",
    "Symmetric encryption uses a shared secret key for encryption and decryption. Secure distribution and protection of that key are part of the design.",
    ["1.3"],
    [
      "A storage system protects a volume with a secret symmetric data key.",
      "A TLS connection uses negotiated symmetric keys for bulk traffic protection.",
    ],
  ),
  lesson(
    "asymmetric-cryptography",
    "Asymmetric cryptography",
    "Asymmetric cryptography uses a mathematically related public/private key pair. Appropriate schemes support signatures, key establishment, or encryption; these operations are not interchangeable.",
    ["1.3"],
    [
      "A software publisher signs a release using its protected private key.",
      "A recipient publishes a public encryption key while protecting the private decryption key.",
    ],
  ),
  lesson(
    "public-private-keys",
    "Public and private keys",
    "A public key may be distributed while its corresponding private key is protected. The permitted operation depends on the scheme; signing is not simply described as encrypting data with a private key.",
    ["1.3"],
    [
      "A verifier uses a trusted public key to check a signature.",
      "A server restricts access to the private key associated with its TLS certificate.",
    ],
  ),
  lesson(
    "digital-certificates",
    "Digital certificates",
    "A digital certificate binds a subject or identifier to a public key through an issuer signature. Validation checks the trust chain, identity, validity period, and applicable revocation information.",
    ["1.3"],
    [
      "A browser checks that a server certificate covers the requested hostname.",
      "A client rejects a chain ending at an untrusted root.",
    ],
  ),
  lesson(
    "certificate-authorities",
    "Certificate authorities",
    "A certificate authority issues and signs certificates under a defined policy. A certificate is an issued credential; a CA is an issuing authority, and trust depends on validation of the chain.",
    ["1.3"],
    [
      "A subordinate CA issues an approved server certificate.",
      "An organization distributes an enterprise trust anchor through managed devices.",
    ],
  ),
  lesson(
    "authentication",
    "Authentication",
    "Authentication verifies a claimed identity. Successful authentication does not by itself authorize every action or resource.",
    ["1.1", "4.5"],
    [
      "A VPN verifies an employee credential before applying access policy.",
      "A service authenticates an API client but rejects an unauthorized write.",
    ],
    ["comptia-v8", "nist-zt"],
  ),
  lesson(
    "authorization",
    "Authorization",
    "Authorization decides which actions an identified subject is permitted to perform on a resource. It remains necessary after authentication.",
    ["1.1", "4.5"],
    [
      "A signed-in user can read a report but cannot change payroll.",
      "An authenticated service account is denied access to an unrelated storage bucket.",
    ],
    ["comptia-v8", "nist-zt"],
  ),
  lesson(
    "continuous-verification",
    "Continuous verification",
    "Access decisions can be reevaluated as identity, device, session, or risk context changes. Continuous verification does not mean assuming every previously authenticated request is permanently trusted.",
    ["1.1", "3.2"],
    [
      "A sensitive application requires fresh verification after a risk signal.",
      "A device that loses compliance no longer satisfies application access policy.",
    ],
    ["comptia-v8", "nist-zt"],
  ),
  lesson(
    "detection",
    "Detection",
    "A detective control identifies relevant activity or evidence. Observing or alerting on an event does not necessarily stop the event.",
    ["1.1", "4.1"],
    [
      "A mirrored-traffic sensor alerts without dropping the original packet.",
      "An audit log records a change that an analyst investigates later.",
    ],
  ),
  lesson(
    "prevention",
    "Prevention",
    "A preventive control is designed to stop or restrict an unwanted action. A detector needs an enforcement mechanism or response process to produce preventive effects.",
    ["1.1", "4.1"],
    [
      "A firewall denies an unapproved connection.",
      "An inline IPS can drop traffic that matches an enforced prevention rule.",
    ],
  ),
];
const edge = (
  sourceId: string,
  targetId: string,
  kind: ConceptRelationship["kind"] = "prerequisite",
): ConceptRelationship => ({
  id: `${sourceId}:${kind}:${targetId}`,
  sourceId,
  targetId,
  kind,
  status: "validated",
  rationale:
    "Editorial learning recommendation: understand the source concept before applying the target. This is pedagogical guidance, not an official exam prerequisite.",
  references: ["comptia-v8"],
});
export const relationships: ConceptRelationship[] = [
  edge("security-principles", "cryptography-fundamentals"),
  edge("cryptography-fundamentals", "hashing"),
  edge("cryptography-fundamentals", "encryption"),
  edge("encryption", "symmetric-cryptography"),
  edge("cryptography-fundamentals", "asymmetric-cryptography"),
  edge("asymmetric-cryptography", "public-private-keys"),
  edge("public-private-keys", "digital-signatures"),
  edge("digital-signatures", "digital-certificates"),
  edge("digital-certificates", "certificate-authorities"),
  edge("digital-certificates", "pki"),
  edge("certificate-authorities", "pki"),
  edge("encryption", "tls"),
  edge("digital-certificates", "tls"),
  edge("hashing", "password-hashing"),
  edge("security-principles", "authentication"),
  edge("security-principles", "authorization"),
  edge("authentication", "aaa"),
  edge("authorization", "aaa"),
  edge("authorization", "least-privilege"),
  edge("authentication", "identity-lifecycle"),
  edge("authorization", "identity-lifecycle"),
  edge("authentication", "mfa"),
  edge("public-private-keys", "passkeys"),
  edge("authentication", "continuous-verification"),
  edge("authorization", "continuous-verification"),
  edge("least-privilege", "zero-trust"),
  edge("network-segmentation", "zero-trust"),
  edge("continuous-verification", "zero-trust"),
  edge("security-principles", "network-segmentation"),
  edge("security-principles", "security-controls"),
  edge("security-controls", "detection"),
  edge("security-controls", "prevention"),
  edge("detection", "ids-and-ips"),
  edge("prevention", "ids-and-ips"),
  edge("detection", "siem"),
  edge("siem", "alert-tuning"),
  edge("incident-response", "response-playbooks"),
  edge("incident-response", "chain-of-custody"),
  edge("siem", "investigation-timelines"),
  edge("recovery-objectives", "backup-resilience"),
  edge("risk-calculations", "residual-risk"),
  edge("cve-and-cvss", "vulnerability-prioritization"),
  edge("hashing", "encryption", "confused_with"),
  edge("authentication", "authorization", "confused_with"),
  edge("detection", "prevention", "confused_with"),
  edge("digital-certificates", "certificate-authorities", "related"),
  edge("pki", "tls", "next"),
];
const mc = (
  id: string,
  title: string,
  incorrectBelief: string,
  correctExplanation: string,
  conceptIds: string[],
  objectives: string[],
  comparison: MisconceptionDefinition["comparison"],
  questionIds: string[],
  prerequisiteIds: string[],
  examples: string[],
  references = ["comptia-v8"],
): MisconceptionDefinition => ({
  id,
  title,
  description: `Evidence may suggest confusion about ${title.toLowerCase()}. A wrong choice is a hypothesis signal, not a cognitive diagnosis.`,
  incorrectBelief,
  correctExplanation,
  conceptIds,
  objectives,
  comparison,
  questionIds,
  prerequisiteIds,
  examples,
  references,
  assumptions: [incorrectBelief],
  validationStatus: "editorial-reviewed",
});
export const misconceptions: MisconceptionDefinition[] = [
  mc(
    "hash-confidentiality",
    "Hashing versus encryption",
    "A hash hides data in transit and can be decrypted later.",
    "A hash is a digest, not a confidential communication channel. Encryption supports authorized plaintext recovery with the right keys.",
    ["hashing", "encryption", "tls"],
    ["1.3"],
    [
      {
        label: "Hashing",
        meaning:
          "Digest used in integrity-related constructions; not reversible encryption.",
      },
      {
        label: "Encryption",
        meaning: "Key-controlled confidentiality with authorized decryption.",
      },
    ],
    ["tls-confidentiality"],
    ["cryptography-fundamentals"],
    [
      "HTTPS encrypts application traffic; a standalone request hash does not hide its content.",
    ],
    ["comptia-v8", "nist-hash"],
  ),
  mc(
    "authentication-authority",
    "Authentication versus authorization",
    "Proving identity automatically permits unrestricted actions.",
    "Authentication establishes identity; authorization independently limits permitted resources and operations.",
    ["authentication", "authorization", "aaa", "passkeys"],
    ["1.1", "4.5"],
    [
      { label: "Authentication", meaning: "Who is requesting access?" },
      {
        label: "Authorization",
        meaning: "Which actions are permitted on this resource?",
      },
    ],
    ["aaa-matching", "passkeys"],
    ["security-principles"],
    [
      "A passkey signs in a user, but a server still denies payroll modification.",
    ],
    ["comptia-v8", "nist-zt"],
  ),
  mc(
    "detect-prevent",
    "Detection versus prevention",
    "A sensor or camera that observes an attack must also block it.",
    "Detective controls identify activity. Preventive actions require enforcement, such as a lock, traffic drop, or access denial.",
    ["security-controls", "detection", "prevention", "ids-and-ips"],
    ["1.1", "4.1"],
    [
      { label: "Detective", meaning: "Observe, record, or alert." },
      { label: "Preventive", meaning: "Stop or restrict an action." },
    ],
    ["control-detective", "ids-ips"],
    ["security-controls"],
    [
      "A mirrored IDS alerts while an inline IPS can drop the original traffic.",
    ],
  ),
  mc(
    "transform-security",
    "Transformation versus cryptographic protection",
    "Encoding or compressing a value makes it confidential or suitable for password storage.",
    "Encoding and compression change representation. Use appropriate encryption for confidentiality and a salted password KDF for stored password verifiers.",
    ["encryption", "tls", "password-hashing"],
    ["1.3"],
    [
      {
        label: "Encoding / compression",
        meaning:
          "Changes representation or size without a confidentiality guarantee.",
      },
      {
        label: "Cryptographic protection",
        meaning:
          "Uses appropriate constructions and protected keys or costly one-way password derivation.",
      },
    ],
    ["tls-confidentiality", "password-salting"],
    ["cryptography-fundamentals"],
    [
      "Base64 can be decoded without a secret; compression can be reversed by an observer.",
    ],
  ),
  mc(
    "symmetric-asymmetric",
    "Symmetric versus asymmetric cryptography",
    "All cryptography uses the same shared key arrangement.",
    "Symmetric encryption shares a secret key; asymmetric constructions use a public/private pair with scheme-specific operations.",
    [
      "symmetric-cryptography",
      "asymmetric-cryptography",
      "public-private-keys",
    ],
    ["1.3"],
    [
      {
        label: "Symmetric",
        meaning: "Shared secret for appropriate encrypt/decrypt operations.",
      },
      {
        label: "Asymmetric",
        meaning:
          "Public/private pair; supports scheme-specific signatures, encryption, or key establishment.",
      },
    ],
    [],
    ["cryptography-fundamentals"],
    [
      "TLS typically uses asymmetric authentication/key establishment and symmetric traffic keys.",
    ],
  ),
  mc(
    "rto-rpo",
    "RTO versus RPO",
    "The acceptable data-loss window is the service restoration time.",
    "RPO describes acceptable data loss measured in time; RTO describes the targeted service recovery duration.",
    ["recovery-objectives", "backup-resilience"],
    ["3.4"],
    [
      { label: "RPO", meaning: "How much recent data can be lost?" },
      { label: "RTO", meaning: "How long can service restoration take?" },
    ],
    ["rpo"],
    ["security-principles"],
    ["A 15-minute RPO and two-hour RTO are separate recovery requirements."],
  ),
  mc(
    "severity-exploitation",
    "Vulnerability severity versus threat evidence",
    "A high technical severity score proves active exploitation and determines every local priority.",
    "Severity describes technical impact conditions; exploit activity, exposure, business criticality and controls shape local risk.",
    ["cve-and-cvss", "vulnerability-prioritization", "threat-actors"],
    ["2.1", "4.3"],
    [
      {
        label: "Severity",
        meaning: "Technical vulnerability characteristics.",
      },
      {
        label: "Threat / local risk",
        meaning:
          "Exploit activity, exposure, consequences, and controls in context.",
      },
    ],
    ["cve-cvss", "vulnerability-priority"],
    ["cve-and-cvss"],
    [
      "An actively exploited public gateway may take priority over a higher-scoring isolated lab device.",
    ],
  ),
  mc(
    "false-positive-negative",
    "False positives versus false negatives",
    "An alert on benign activity is a missed malicious event.",
    "A false positive flags benign activity; a false negative misses malicious activity. Both require measured detection evaluation.",
    ["alert-tuning", "detection"],
    ["4.4"],
    [
      {
        label: "False positive",
        meaning: "Benign activity incorrectly flagged.",
      },
      {
        label: "False negative",
        meaning: "Malicious activity incorrectly missed.",
      },
    ],
    [],
    ["detection"],
    ["A backup job incorrectly triggering an alert is a false positive."],
  ),
  mc(
    "certificate-authority",
    "Certificates versus certificate authorities",
    "A certificate and the authority issuing it are the same component.",
    "A certificate is a signed identity-to-key binding; a certificate authority issues and signs certificates under its policy.",
    ["digital-certificates", "certificate-authorities", "pki"],
    ["1.3"],
    [
      {
        label: "Certificate",
        meaning: "An issued signed identity-to-key credential.",
      },
      {
        label: "Certificate authority",
        meaning:
          "The issuer that signs credentials and participates in the trust chain.",
      },
    ],
    [],
    ["digital-signatures", "public-private-keys"],
    [
      "A server presents its certificate; the client validates its issuer chain.",
    ],
  ),
];
const mapping = (
  questionId: string,
  optionId: string,
  misconceptionId: string,
  slot = -1,
): MisconceptionMapping => ({
  questionId,
  revision: questions.find((q) => q.id === questionId)!.revision,
  optionId,
  slot,
  misconceptionId,
  weight: 1,
  status: "validated",
});
export const distractorMappings = [
  mapping("tls-confidentiality", "A", "hash-confidentiality"),
  mapping("tls-confidentiality", "C", "transform-security"),
  mapping("password-salting", "C", "transform-security"),
  mapping("password-salting", "D", "transform-security"),
  mapping("aaa-matching", "B", "authentication-authority", 0),
  mapping("aaa-matching", "A", "authentication-authority", 1),
  mapping("passkeys", "D", "authentication-authority"),
  mapping("control-detective", "A", "detect-prevent"),
  mapping("ids-ips", "B", "detect-prevent"),
  mapping("rpo", "B", "rto-rpo"),
  mapping("cve-cvss", "C", "severity-exploitation"),
  mapping("cve-cvss", "D", "severity-exploitation"),
  mapping("vulnerability-priority", "B", "severity-exploitation"),
];
export const policy: IntelligencePolicy = {
  version: "intelligence-v1",
  possibleDistinct: 2,
  likelyDistinct: 3,
  recurringDistinct: 4,
  resolutionDistinct: 2,
  halfLifeDays: 45,
  minimumIndependentHours: 24,
  minimumForecastReviews: 3,
  minimumForecastSuccesses: 2,
  forecastAnchor: 0.9,
  reviewSoonDays: 2,
  minimumCalibrationSamples: 30,
};
