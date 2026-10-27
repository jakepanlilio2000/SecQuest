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
];
