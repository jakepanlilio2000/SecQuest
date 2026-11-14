"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import type {
  LearnerCatalogExam,
  LearnerCertificationCatalog,
} from "@/lib/certifications";
import { api, Badge, Button, Empty, PageTitle } from "./shared";
import { Skeleton } from "./ui/skeleton";

const availability: Record<LearnerCatalogExam["availability"], string> = {
  available: "Exam listed available",
  upcoming: "Upcoming exam",
  retiring: "Retiring exam",
  retired: "Retired exam",
  unverified: "Availability unverified",
};

export function Certifications({
  currentExam,
  go,
}: {
  currentExam: string;
  go: (view: string) => void;
}) {
  const [catalog, setCatalog] = useState<LearnerCertificationCatalog | null>(
    null,
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api<LearnerCertificationCatalog>("certifications")
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const groups = new Map<string, LearnerCatalogExam[]>();
  for (const exam of catalog?.exams ?? []) {
    const group = groups.get(exam.generationId) ?? [];
    group.push(exam);
    groups.set(exam.generationId, group);
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR STUDY TRACKS"
        title="Certifications"
        description="Explore the first tracks planned for SecQuest and check which study material is available."
      />
      <section
        className="cert-current"
        aria-labelledby="current-workspace-title"
      >
        <div>
          <Badge tone="blue">Current workspace</Badge>
          <h2 id="current-workspace-title">Security+ · {currentExam}</h2>
          <p>
            Continue your existing starter bank, saved sessions and review
            schedule. Other study tracks are not available in this installation
            yet.
          </p>
        </div>
        <Button onClick={() => go("learn")}>Continue current study</Button>
      </section>
      {error ? (
        <div
          className="alert error"
          role="alert"
          aria-label="Certification catalog error"
        >
          <div>
            <strong>Certifications could not be loaded.</strong>
            <p>{error}</p>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setError("");
              setCatalog(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : !catalog ? (
        <div className="cert-loading" role="status" aria-live="polite">
          <p>Loading certifications…</p>
          <Skeleton className="cert-skeleton" aria-hidden="true" />
        </div>
      ) : catalog.exams.length === 0 ? (
        <Empty icon={GraduationCap} title="No certifications listed yet">
          Your current study workspace is still available. Check back for
          additional tracks.
        </Empty>
      ) : (
        <div className="cert-grid">
          {[...groups].map(([id, exams]) => {
            const first = exams[0];
            const current = exams.some((exam) => exam.code === currentExam);
            return (
              <section
                className="cert-card"
                key={id}
                aria-labelledby={`cert-${id}`}
              >
                <div className="cert-card-heading">
                  <h2 id={`cert-${id}`}>
                    {first.certificationName} <span>{first.version}</span>
                  </h2>
                  <Badge tone={current ? "blue" : "muted"}>
                    {current ? "Your starter bank" : "In preparation"}
                  </Badge>
                </div>
                {first.requiredExams > 1 && (
                  <p>
                    Requires both Core 1 and Core 2 from the same{" "}
                    {first.version} generation.
                  </p>
                )}
                <ul className="cert-exams">
                  {exams.map((exam) => (
                    <li key={exam.code}>
                      <strong>
                        {exam.name} · {exam.code}
                      </strong>
                      <span>
                        {availability[exam.availability]} · checked{" "}
                        <time dateTime={exam.checkedOn}>{exam.checkedOn}</time>
                      </span>
                      <span>
                        {exam.bankStatus === "legacy-starter"
                          ? "Original starter material; independent subject-matter approval is pending."
                          : "Study material is not enabled in SecQuest."}
                      </span>
                    </li>
                  ))}
                </ul>
                {!current && (
                  <Button disabled aria-describedby={`cert-reason-${id}`}>
                    Study not available yet
                  </Button>
                )}
                <p id={`cert-reason-${id}`} className="cert-note">
                  {current
                    ? "Your existing work stays with this exam version."
                    : "This track needs verified objectives, reviewed content and support for separate study records before you can start."}
                </p>
              </section>
            );
          })}
        </div>
      )}
      <p className="cert-note">
        Exam availability is a dated reference, not a live booking check.{" "}
        <a
          href="https://www.comptia.org/en-us/certifications/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Check CompTIA’s current exam information
        </a>{" "}
        before booking. No results are transferred or combined by this page.
      </p>
    </>
  );
}
