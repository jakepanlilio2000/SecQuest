// Phase 0 snapshot, not an activation schedule. Updates require source review;
// crossing a launch date must never silently enable a course or relabel history.
export const certifications = [
  { id: "security-plus", name: "CompTIA Security+" },
  { id: "network-plus", name: "CompTIA Network+" },
  { id: "a-plus", name: "CompTIA A+" },
] as const;

export const certificationGenerations = [
  {
    id: "security-plus-v7",
    certificationId: "security-plus",
    version: "V7",
    requiredExams: 1,
  },
  {
    id: "security-plus-v8",
    certificationId: "security-plus",
    version: "V8",
    requiredExams: 1,
  },
  {
    id: "network-plus-v9",
    certificationId: "network-plus",
    version: "V9",
    requiredExams: 1,
  },
  {
    id: "a-plus-v15",
    certificationId: "a-plus",
    version: "V15",
    requiredExams: 2,
  },
] as const;

export const certificationExams = [
  {
    code: "SY0-701",
    generationId: "security-plus-v7",
    name: "Security+ V7",
    position: 1,
    availability: "available",
    bankStatus: "unavailable",
    sourceUrl: "https://www.comptia.org/en-us/certifications/security/v7/",
  },
  {
    code: "SY0-801",
    generationId: "security-plus-v8",
    name: "Security+ V8",
    position: 1,
    availability: "upcoming",
    bankStatus: "legacy-starter",
    sourceUrl: "https://www.comptia.org/en-us/certifications/security/v8/",
  },
  {
    code: "N10-009",
    generationId: "network-plus-v9",
    name: "Network+ V9",
    position: 1,
    availability: "available",
    bankStatus: "unavailable",
    sourceUrl: "https://www.comptia.org/en-us/certifications/network/",
  },
  {
    code: "220-1201",
    generationId: "a-plus-v15",
    name: "A+ Core 1",
    position: 1,
    availability: "available",
    bankStatus: "unavailable",
    sourceUrl: "https://www.comptia.org/en-us/certifications/a/core-1-v15/",
  },
  {
    code: "220-1202",
    generationId: "a-plus-v15",
    name: "A+ Core 2",
    position: 2,
    availability: "available",
    bankStatus: "unavailable",
    sourceUrl: "https://www.comptia.org/en-us/certifications/a/core-2-v15/",
  },
] as const;

export const catalogCheckedOn = "2026-11-14";
