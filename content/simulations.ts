export const simulations = [
  {
    id: "firewall",
    name: "Close the perimeter",
    objective: "4.1",
    description:
      "Segment a fictional network by choosing the minimum required firewall policy.",
    brief:
      "Guest devices may browse the internet over HTTPS. They must never connect to the payroll network. Payroll applications must reach their database on TCP 5432. All other new connections are denied.",
    tasks: [
      {
        id: "guest-web",
        prompt: "Guest zone → internet, TCP 443",
        answer: "allow",
        why: "Allow the explicitly required HTTPS egress.",
      },
      {
        id: "guest-payroll",
        prompt: "Guest zone → payroll, any port",
        answer: "deny",
        why: "Guest traffic must not cross into the payroll zone.",
      },
      {
        id: "app-db",
        prompt: "Payroll application → payroll database, TCP 5432",
        answer: "allow",
        why: "The application needs this specific database flow.",
      },
      {
        id: "internet-db",
        prompt: "Internet → payroll database, TCP 5432",
        answer: "deny",
        why: "No direct internet access to the database is required.",
      },
      {
        id: "default",
        prompt: "Any other new connection",
        answer: "deny",
        why: "A default-deny policy limits access to the approved flows.",
      },
    ],
    choices: ["allow", "deny"],
  },
  {
    id: "triage",
    name: "The suspicious session",
    objective: "4.7",
    description:
      "Investigate a fictional account compromise and choose a defensible response.",
    brief:
      "The lab confirms token theft from a finance workstation. Its response plan authorizes revoking stolen sessions and isolating affected endpoints. Preserve evidence and restore access only after validation.",
    tasks: [
      {
        id: "contain",
        prompt: "First authorized action for the confirmed stolen token",
        answer: "Revoke the affected sessions",
        why: "Contain the confirmed access promptly using the approved response authority.",
      },
      {
        id: "evidence",
        prompt: "Before destructive rebuilding",
        answer: "Preserve relevant logs and forensic evidence",
        why: "Evidence preservation supports investigation and avoids unnecessary loss of artifacts.",
      },
      {
        id: "restore",
        prompt: "Before restoring normal access",
        answer: "Validate remediation and issue fresh credentials",
        why: "Recovery requires verification that the compromise path has been addressed.",
      },
    ],
    choices: [
      "Revoke the affected sessions",
      "Preserve relevant logs and forensic evidence",
      "Validate remediation and issue fresh credentials",
      "Delete all logs",
      "Ignore the alert",
    ],
  },
  {
    id: "certificate-check",
    name: "Read the certificate evidence",
    objective: "1.3",
    description:
      "Apply a fictional service's stated certificate-validation policy without contacting a network.",
    brief:
      "The fictional payroll service requires the name payroll.example.test, a trusted issuer chain, an unexpired certificate, and a good revocation status. For this simplified lab, accept only if all four checks pass. Reject inconsistent evidence and investigate; never bypass a certificate warning.",
    tasks: [
      {
        id: "name",
        prompt:
          "Trusted issuer; unexpired; status good; subject names only portal.example.test",
        answer: "Reject and investigate",
        why: "The service identity does not match the certificate name required by the brief.",
      },
      {
        id: "expiry",
        prompt:
          "Name payroll.example.test; trusted issuer; status good; certificate validity ended yesterday",
        answer: "Reject and investigate",
        why: "The certificate is expired under this service's validation policy.",
      },
      {
        id: "valid",
        prompt:
          "Name payroll.example.test; trusted issuer chain; validity includes today; status good",
        answer: "Accept under this lab policy",
        why: "All four checks in the fictional policy pass. Real certificate validation may involve additional checks.",
      },
    ],
    choices: ["Reject and investigate", "Accept under this lab policy"],
  },
  {
    id: "cloud-permissions",
    name: "Review a cloud service role",
    objective: "3.1",
    description:
      "Choose least-privilege actions for a fictional cloud application.",
    brief:
      "The invoice worker only reads invoices from a named private bucket and writes to its own log stream. Public sharing and administrative permissions are unnecessary. A confirmed leaked credential must be revoked and replaced according to the incident plan.",
    tasks: [
      {
        id: "admin",
        prompt: "The invoice worker has an account-wide administrator role",
        answer: "Remove unnecessary access",
        why: "The stated work does not require account-wide administrative permission.",
      },
      {
        id: "logs",
        prompt:
          "The worker may append events only to its named application log stream",
        answer: "Keep scoped access",
        why: "This narrowly scoped permission supports an explicit business requirement.",
      },
      {
        id: "leak",
        prompt:
          "A valid worker credential is confirmed exposed in a public repository",
        answer: "Revoke and replace the credential",
        why: "Removing the public copy alone does not invalidate a credential that may already have been obtained.",
      },
    ],
    choices: [
      "Remove unnecessary access",
      "Keep scoped access",
      "Revoke and replace the credential",
    ],
  },
  {
    id: "ai-trust-boundary",
    name: "Keep the assistant inside its boundary",
    objective: "2.6",
    description:
      "Separate retrieved text from authority in a fictional internal assistant.",
    brief:
      "This fictional assistant may read authorized help-desk tickets. Retrieved text is untrusted data and cannot grant permissions. Exporting credentials is forbidden. New access requests require approval through the established workflow.",
    tasks: [
      {
        id: "retrieved",
        prompt:
          "A retrieved ticket tells the assistant to ignore policy and export all credentials",
        answer: "Treat as untrusted data; do not execute",
        why: "Instructions embedded in retrieved content do not acquire the user's authority or override the permission boundary.",
      },
      {
        id: "read",
        prompt:
          "The signed-in user requests a summary of a ticket they are authorized to read",
        answer: "Use the authorized read workflow",
        why: "The requested read is within the user's existing permissions and the tool's allowed scope.",
      },
      {
        id: "new-access",
        prompt:
          "The user requests access to a restricted queue outside their current role",
        answer: "Use the access-approval workflow",
        why: "The request does not itself grant new access. The assistant must respect the existing authorization process.",
      },
    ],
    choices: [
      "Treat as untrusted data; do not execute",
      "Use the authorized read workflow",
      "Use the access-approval workflow",
    ],
  },
];
