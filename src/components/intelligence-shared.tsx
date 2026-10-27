"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  BrainCircuit,
  Network,
  Clock3,
  ArrowRight,
} from "lucide-react";
import { api, Button, Badge } from "./shared";
import type { intelligenceFor } from "@/lib/intelligence";
export type IntelligenceData = Awaited<ReturnType<typeof intelligenceFor>>;
export function useIntelligence(conceptId = "") {
  const [data, setData] = useState<IntelligenceData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const result = await api<IntelligenceData>(
        `intelligence${conceptId ? "?concept=" + encodeURIComponent(conceptId) : ""}`,
      );
      if (sequence !== requestSequence.current) return;
      setData(result);
      setError("");
    } catch (e) {
      if (sequence === requestSequence.current) setError((e as Error).message);
    }
  }, [conceptId]);
  useEffect(() => {
    void refresh();
    return () => {
      requestSequence.current++;
    };
  }, [refresh]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { data, error, setError, busy, run, refresh };
}
export function useIntelligenceActions() {
  const router = useRouter();
  return {
    go: (view: string, extra = "") => router.push(`/?view=${view}${extra}`),
    practice: async (input: {
      conceptId?: string;
      misconceptionId?: string;
    }) => {
      const r = await api<{ id: string }>(
        "intelligence/practice",
        "POST",
        input,
      );
      router.push(`/?view=session&session=${r.id}`);
    },
    save: async (input: {
      questionId?: string;
      revision?: number;
      conceptId?: string;
      misconceptionId?: string;
      kind: "explanation" | "reference" | "comparison";
    }) => {
      const r = await api<{ entry: { id: string; deleted_at: string | null } }>(
        "notebook/context",
        "POST",
        input,
      );
      if (r.entry.deleted_at) router.push("/?view=notebook");
      else router.push(`/?view=notebook&entry=${r.entry.id}`);
    },
  };
}
export function ReferenceLinks({
  data,
  ids,
}: {
  data: { sources: { id: string; name: string; url: string }[] };
  ids: string[];
}) {
  return (
    <div className="intelligence-references">
      {ids.map((id) => {
        const s = data.sources.find((s) => s.id === id);
        return s ? (
          <a key={id} href={s.url} target="_blank" rel="noreferrer">
            {s.name} ↗
          </a>
        ) : null;
      })}
    </div>
  );
}
export function IntelligenceSummary() {
  const { data, error } = useIntelligence();
  const { go } = useIntelligenceActions();
  if (!data)
    return error ? (
      <div className="content-status">
        <p>
          Knowledge intelligence is temporarily unavailable. Your learning
          history is preserved.
        </p>
      </div>
    ) : null;
  return (
    <section className="panel intelligence-summary">
      <div className="section-heading">
        <div>
          <h2>Connect the next piece</h2>
          <p>Evidence, foundations, and your personal knowledge.</p>
        </div>
        <Badge tone="blue">KNOWLEDGE INTELLIGENCE</Badge>
      </div>
      <div className="intelligence-summary-grid">
        <button onClick={() => go("misconceptions")}>
          <BrainCircuit size={21} />
          <span>
            <strong>
              {data.summary.currentGap?.definition.title ??
                "No supported misconception finding yet"}
            </strong>
            <small>
              {data.summary.currentGap?.status ??
                "Distinct-question evidence is required."}
            </small>
          </span>
          <ArrowRight size={15} />
        </button>
        <button
          onClick={() =>
            go(
              "knowledge-map",
              data.summary.prerequisite
                ? "&concept=" + data.summary.prerequisite.concept.id
                : "",
            )
          }
        >
          <Network size={21} />
          <span>
            <strong>
              {data.summary.prerequisite?.concept.name ??
                "Explore the knowledge map"}
            </strong>
            <small>
              {data.summary.prerequisite
                ? "Recommended foundation; unknown is not weak."
                : "Validated learning relationships and concept lessons."}
            </small>
          </span>
          <ArrowRight size={15} />
        </button>
        <button onClick={() => go("retention")}>
          <Clock3 size={21} />
          <span>
            <strong>{data.summary.due} reviews due</strong>
            <small>{data.summary.retentionTrend}</small>
          </span>
          <ArrowRight size={15} />
        </button>
        <button
          onClick={() =>
            go(
              "notebook",
              data.summary.recentNotes[0]
                ? "&entry=" + data.summary.recentNotes[0].id
                : "",
            )
          }
        >
          <BookOpen size={21} />
          <span>
            <strong>
              {data.summary.recentNotes[0]?.title ??
                "Start your cybersecurity notebook"}
            </strong>
            <small>
              {data.summary.recentNotes.length
                ? "Recent private note; opening it earns no mastery."
                : "Save an explanation or write your own understanding."}
            </small>
          </span>
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
export function LearningIntelligence({
  attemptId,
  questionId,
  revision,
  incorrect,
}: {
  attemptId?: string;
  questionId: string;
  revision: number;
  incorrect: boolean;
}) {
  const { data, error, busy, run } = useIntelligence();
  const actions = useIntelligenceActions();
  const [message, setMessage] = useState("");
  if (!data)
    return error ? (
      <p className="fine-print">
        Contextual intelligence is temporarily unavailable.
      </p>
    ) : null;
  const available = data.availableQuestions.find(
    (q) => q.id === questionId && q.revision === revision,
  );
  const conceptId =
    available?.conceptIds[0] ??
    data.graph.mappings.find(
      (m) => m.question_id === questionId && m.revision === revision,
    )?.concept_id;
  const mapped = data.findings.filter((f) =>
    f.evidence.some((e) => e.attempt_id === attemptId && e.polarity > 0),
  );
  return (
    <section className="learning-intelligence">
      <div>
        <BrainCircuit size={20} />
        <h3>
          {incorrect
            ? "Understand the gap. Build the foundation."
            : "Keep this understanding connected."}
        </h3>
      </div>
      {incorrect && !attemptId ? (
        <p>
          This saved explanation predates attempt-linked intelligence. Open
          Knowledge gaps to inspect supported answer history.
        </p>
      ) : incorrect && mapped.length > 0 ? (
        <p>
          {mapped[0].status === "Insufficient evidence"
            ? mapped[0].reason
            : `${mapped[0].status}: ${mapped[0].definition.title}. ${mapped[0].reason}`}
        </p>
      ) : incorrect ? (
        <p>
          This choice has no supported misconception mapping. It remains an
          unmapped mistake.
        </p>
      ) : (
        <p>
          Notebook actions organize your learning; they do not change your
          mastery evidence.
        </p>
      )}
      <div className="button-row">
        {incorrect &&
          mapped.some((f) => f.status !== "Insufficient evidence") && (
            <Button
              variant="ghost"
              onClick={() =>
                actions.go(
                  "misconceptions",
                  "&misconception=" + mapped[0].definition.id,
                )
              }
            >
              Understand my mistake
            </Button>
          )}
        {conceptId && (
          <Button
            variant="ghost"
            onClick={() => actions.go("knowledge-map", "&concept=" + conceptId)}
          >
            <Network size={14} />
            Explore prerequisites
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(() => actions.save({ questionId, revision, kind: "reference" }))
          }
        >
          <BookOpen size={14} />
          Save to Notebook
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(() =>
              actions.save({ questionId, revision, kind: "explanation" }),
            )
          }
        >
          Save Explanation
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await api<{ message: string }>(
                "intelligence/review",
                "POST",
                { questionId },
              );
              setMessage(r.message);
            })
          }
        >
          <Clock3 size={14} />
          Schedule Review
        </Button>
      </div>
      {message && (
        <p className="fine-print" role="status">
          {message}
        </p>
      )}
      {error && <div className="alert error">{error}</div>}
    </section>
  );
}
