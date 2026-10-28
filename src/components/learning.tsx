"use client";
import { useCallback, useEffect, useState } from "react";

import { useModalFocus } from "./use-modal-focus";
import { studySound } from "./study-sound";
import {
  LearningIntelligence,
  useIntelligenceActions,
} from "./intelligence-shared";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Flag,
  LockKeyhole,
  Plus,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

import type { Feedback, Mode } from "@/lib/types";
import {
  Overview,
  SessionView,
  api,
  Icon,
  Button,
  Badge,
  PageTitle,
  modes,
} from "./shared";

export function SessionSetup({
  view,
  data,
  start,
  busy,
  initialObjective,
}: {
  view: string;
  data: Overview | null;
  start: (m: Mode, o?: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  initialObjective: string;
}) {
  const [mode, setMode] = useState<Mode>(
    view === "mock" ? "mock" : view === "recovery" ? "recovery" : "learning",
  );
  const [examSettings, setExamSettings] = useState({
    maxQuestions: 90,
    durationMinutes: 90,
  });
  useEffect(() => {
    api<{ blueprint: { maxQuestions: number; durationMinutes: number } }>(
      "blueprint",
    )
      .then((r) => setExamSettings(r.blueprint))
      .catch(() => {});
  }, []);
  useEffect(
    () =>
      setMode(
        view === "mock"
          ? "mock"
          : view === "recovery"
            ? "recovery"
            : "learning",
      ),
    [view],
  );
  return (
    <>
      <PageTitle
        eyebrow={
          view === "mock"
            ? "THE READINESS ROOM"
            : view === "recovery"
              ? "MAKE IT STICK"
              : "LEARNING PATHS"
        }
        title={
          view === "mock"
            ? "Practice under pressure."
            : view === "recovery"
              ? "Every mistake is a way forward."
              : "Build your next layer of defense."
        }
        description={
          view === "mock"
            ? "A focused, timed environment. Answers stay hidden until you submit."
            : view === "recovery"
              ? "Due reviews and previously difficult concepts take priority."
              : "Choose how you want to learn today."
        }
      />
      {view === "learn" && (
        <div className="mode-grid">
          {modes.map((m) => (
            <button
              className={`mode-card ${mode === m.id ? "selected" : ""}`}
              onClick={() => setMode(m.id)}
              key={m.id}
            >
              <Icon icon={m.icon} size={25} />
              <h3>{m.name}</h3>
              <p>{m.description}</p>
              {mode === m.id && <CheckCircle2 size={17} />}
            </button>
          ))}
        </div>
      )}
      <section className="panel setup-panel">
        <div className="section-heading">
          <div>
            <h2>
              {mode === "mock"
                ? "Configure your mock exam"
                : mode === "recovery"
                  ? "Your recovery session"
                  : "Make this session yours"}
            </h2>
            <p>
              {mode === "mock"
                ? `Up to ${Math.min(examSettings.maxQuestions, data?.totalQuestions ?? 0)} distinct starter questions are currently available. The bank remains below the 600-question target.`
                : "Choose a broad session or focus on a specific objective."}
            </p>
          </div>
          <Badge tone="blue">SY0-801</Badge>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(mode, {
              count: Number(f.get("count")),
              domain: f.get("domain") || "",
              objective: f.get("objective") || "",
              difficulty: f.get("difficulty") || "",
              type: f.get("type") || "",
            });
          }}
        >
          <div className="form-grid">
            <label>
              Domain
              <select name="domain" key={view}>
                <option value="">All security domains</option>
                {data?.domains.map((d) => (
                  <option key={d.number} value={d.number}>
                    {d.number}. {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Objective
              <select
                name="objective"
                defaultValue={initialObjective}
                key={initialObjective}
              >
                <option value="">Any objective</option>
                {data?.objectives.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.description}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Difficulty
              <select name="difficulty">
                <option value="">Mix of difficulties</option>
                {["easy", "medium", "hard", "expert"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Question format
              <select name="type">
                <option value="">All supported formats</option>
                {[
                  "scenario",
                  "single",
                  "multiple",
                  "matching",
                  "ordering",
                  "log",
                ].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Questions
              <select
                name="count"
                aria-label="Questions"
                defaultValue={mode === "mock" ? "90" : "12"}
                key={mode}
              >
                {[5, 10, 12, 20, 30, 90].map((n) => (
                  <option key={n} value={n}>
                    {n === 90 ? `Up to ${examSettings.maxQuestions}` : n}{" "}
                    questions
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="setup-bottom">
            <p>
              <ShieldCheck size={18} />
              {mode === "mock"
                ? `${examSettings.durationMinutes}-minute timer · autosaved answers · feedback after submission`
                : mode === "challenge"
                  ? "10-minute timer · server-graded answers"
                  : "Immediate explanations · automatic reinforcement · saved progress"}
            </p>
            <Button type="submit" disabled={busy}>
              Launch {mode === "mock" ? "mock exam" : "session"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </form>
      </section>
      {view === "mock" && (
        <div className="content-status">
          <BookOpen size={18} />
          <p>
            This is unofficial practice. Results show raw accuracy, never an
            invented CompTIA scaled score. The current small bank limits exam
            representativeness.
          </p>
        </div>
      )}
    </>
  );
}

export function LearningSession({
  id,
  onRefresh,
  notify,
  onExit,
}: {
  id: string;
  onRefresh: () => Promise<void>;
  notify: (m: string) => void;
  onExit: () => void;
}) {
  const [state, setState] = useState<SessionView | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [confidence, setConfidence] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [now, setNow] = useState(Date.now()),
    [showConcept, setShowConcept] = useState(false);
  const intelligenceActions = useIntelligenceActions();
  useModalFocus(confirm, () => setConfirm(false));
  const load = useCallback(
    async (index?: number) => {
      const r = await api<SessionView>(
        `sessions/${id}${index === undefined ? "" : `?index=${index}`}`,
      );
      setState(r);
      setSelected(r.item?.selected ?? []);
      setConfidence(null);
      setShowConcept(false);
    },
    [id],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      state?.session.expires_at &&
      Date.parse(state.session.expires_at) <= now &&
      !state.completed
    )
      load()
        .then(onRefresh)
        .catch((e) => setError(e.message));
  }, [now, state, load, onRefresh]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!state)
    return (
      <div className="panel">
        <p>{error || "Loading your saved session…"}</p>
      </div>
    );
  if (state.completed) {
    const answered = state.items?.filter((i) => i.feedback) ?? [],
      correct = answered.filter((i) => i.feedback?.correct).length;
    return (
      <>
        <PageTitle
          eyebrow="MISSION DEBRIEF"
          title="Every answer is a step forward."
          description="Your report reflects the attempts stored for this session."
          action={
            <Button variant="ghost" onClick={onExit}>
              Back to command center <ArrowRight size={16} />
            </Button>
          }
        />
        <div className="result-summary panel">
          <span className="result-ring">
            {answered.length
              ? Math.round((correct / answered.length) * 100)
              : 0}
            <small>%</small>
          </span>
          <div>
            <Badge tone="green">SESSION COMPLETE</Badge>
            <h2>
              {correct} correct out of {answered.length}{" "}
              {state.session.mode === "mock" ? "questions" : "attempts"}
            </h2>
            <p>
              {state.session.mode === "mock"
                ? "Raw practice accuracy. This is not an official scaled score or a pass prediction."
                : "In-session retries are included here; your dashboard separates first encounters and retries."}
            </p>
            <small>
              Answered mistakes remain scheduled. Unanswered mock items do not
              create mastery evidence.
            </small>
          </div>
        </div>
        <div className="result-list">
          {state.items?.map((item, i) => (
            <details className="panel result-item" key={item.id}>
              <summary>
                <span
                  className={
                    item.feedback?.correct ? "text-green" : "text-orange"
                  }
                >
                  {item.feedback?.correct ? (
                    <CheckCircle2 size={19} />
                  ) : (
                    <XCircle size={19} />
                  )}
                </span>
                <span>
                  <small>
                    QUESTION {i + 1} · OBJECTIVE {item.question.objective}
                    {item.retry ? " · RETRY" : ""}
                  </small>
                  <strong>{item.question.prompt}</strong>
                </span>
                <ChevronDown size={17} />
              </summary>
              {item.feedback ? (
                <FeedbackPanel feedback={item.feedback} notify={notify} />
              ) : (
                <p>Unanswered.</p>
              )}
            </details>
          ))}
        </div>
      </>
    );
  }
  const item = state.item!,
    q = item.question,
    mock = state.session.mode === "mock";
  const feedback = item.feedback;
  const remaining = state.session.expires_at
    ? Math.max(
        0,
        Math.ceil((Date.parse(state.session.expires_at) - now) / 1000),
      )
    : null;
  async function choose(next: string[]) {
    setSelected(next);
    if (mock)
      await act(async () => {
        await api(`sessions/${id}/answer`, "POST", {
          itemId: item.id,
          selected: next,
          confidence: null,
        });
        setState((previous) =>
          previous
            ? {
                ...previous,
                item: previous.item
                  ? { ...previous.item, selected: next }
                  : undefined,
                navigator: previous.navigator?.map((n) =>
                  n.id === item.id ? { ...n, answered: next.some(Boolean) } : n,
                ),
              }
            : previous,
        );
      });
  }
  const completeSelection =
    selected.length === q.required &&
    (q.type !== "matching" || new Set(selected).size === q.required) &&
    !selected.includes("");
  return (
    <>
      <div className="learning-top">
        <button className="text-link" onClick={onExit}>
          <ArrowLeft size={16} /> Save & exit
        </button>
        <span>
          {mock ? "MOCK EXAM" : state.session.mode.toUpperCase() + " SESSION"} ·
          SY0-801
        </span>
        {remaining !== null ? (
          <Badge tone={remaining < 120 ? "orange" : "blue"}>
            <Clock3 size={14} />
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </Badge>
        ) : (
          <span className="learning-pacing">
            <Clock3 size={14} /> Learn at your pace
          </span>
        )}
      </div>
      <div className="learning-progress">
        <span
          style={{
            width: `${(((state.index ?? 0) + 1) / (state.total ?? 1)) * 100}%`,
          }}
        />
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className={`learning-layout ${mock ? "with-navigator" : ""}`}>
        <section className="panel question-panel">
          <div className="question-meta">
            <Badge tone="blue">OBJECTIVE {q.objective}</Badge>
            <Badge
              tone={
                q.difficulty === "expert"
                  ? "purple"
                  : q.difficulty === "hard"
                    ? "orange"
                    : "muted"
              }
            >
              {q.difficulty}
            </Badge>
            {item.retry && <Badge tone="purple">REINFORCEMENT</Badge>}
            <span>
              QUESTION {(state.index ?? 0) + 1} OF {state.total}
            </span>
          </div>
          <h1>{q.prompt}</h1>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              act(() =>
                intelligenceActions.save({
                  questionId: q.id,
                  revision: q.revision,
                  kind: "reference",
                }),
              )
            }
          >
            <BookOpen size={14} />
            Add to My Notebook
          </Button>
          {q.artifact && (
            <pre className="log-artifact">
              <code>{q.artifact}</code>
            </pre>
          )}
          {q.type === "multiple" && (
            <p className="selection-help">
              Select exactly {q.required} answers.
            </p>
          )}
          {q.type === "matching" ? (
            <div className="matching-list">
              {q.pairs?.map((pair, i) => (
                <label key={pair}>
                  <span>{pair}</span>
                  <select
                    aria-label={`Match ${pair}`}
                    disabled={!!feedback || busy}
                    value={selected[i] ?? ""}
                    onChange={(e) => {
                      const n = Array.from(
                        { length: q.required },
                        (_, j) => selected[j] ?? "",
                      );
                      n[i] = e.target.value;
                      choose(n);
                    }}
                  >
                    <option value="">Choose a description</option>
                    {q.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.text}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : q.type === "ordering" ? (
            <div className="ordering-list">
              <p>Choose items in order. Click a chosen item to remove it.</p>
              {selected.map((v, i) => (
                <button
                  disabled={!!feedback || busy}
                  key={v}
                  onClick={() => choose(selected.filter((s) => s !== v))}
                >
                  <b>{i + 1}</b>
                  {q.options.find((o) => o.id === v)?.text}
                  <X size={15} />
                </button>
              ))}
              {q.options
                .filter((o) => !selected.includes(o.id))
                .map((o) => (
                  <button
                    disabled={!!feedback || busy}
                    key={o.id}
                    onClick={() => choose([...selected, o.id])}
                  >
                    <Plus size={17} />
                    {o.text}
                  </button>
                ))}
            </div>
          ) : (
            <div
              className="answer-options"
              role="group"
              aria-label="Answer choices"
            >
              {q.options.map((o, i) => {
                const chosen = selected.includes(o.id),
                  right = feedback?.answer.includes(o.id);
                return (
                  <button
                    key={o.id}
                    aria-pressed={chosen}
                    disabled={!!feedback || busy}
                    className={`answer-option ${chosen ? "chosen" : ""} ${feedback && right ? "correct" : ""} ${feedback && chosen && !right ? "incorrect" : ""}`}
                    onClick={() =>
                      choose(
                        q.type === "multiple"
                          ? chosen
                            ? selected.filter((s) => s !== o.id)
                            : selected.length < q.required
                              ? [...selected, o.id]
                              : selected
                          : [o.id],
                      )
                    }
                  >
                    <span className="option-letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{o.text}</span>
                    {chosen || right ? (
                      <span className="option-check">
                        {feedback && !right ? (
                          <X size={16} />
                        ) : (
                          <Check size={16} />
                        )}
                      </span>
                    ) : (
                      <span
                        className={`option-radio ${q.type === "multiple" ? "square" : ""}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {!mock && !feedback && (
            <div className="confidence">
              <span>
                How confident are you? <small>Optional</small>
              </span>
              <div>
                {[
                  ["knew", "I knew this"],
                  ["unsure", "I was unsure"],
                  ["guessed", "I guessed"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={confidence === id ? "selected" : ""}
                    onClick={() => setConfidence(confidence === id ? null : id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="question-bottom">
            <span>
              <LockKeyhole size={14} />
              {mock
                ? "Selections are saved automatically. Feedback after submission."
                : "Your answer is evaluated securely on the server."}
            </span>
            {!mock && !feedback && (
              <Button
                disabled={!completeSelection || busy}
                onClick={() =>
                  act(async () => {
                    const result = await api<{ correct?: boolean }>(
                      `sessions/${id}/answer`,
                      "POST",
                      {
                        itemId: item.id,
                        selected,
                        confidence,
                      },
                    );
                    if (typeof result.correct === "boolean")
                      studySound(result.correct);
                    await load();
                    await onRefresh();
                  })
                }
              >
                {busy ? "Evaluating…" : "Check answer"}
                <ArrowRight size={16} />
              </Button>
            )}
            {!mock && feedback && (
              <Button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api(`sessions/${id}/action`, "POST", {
                      action: "next",
                    });
                    await load();
                    await onRefresh();
                  })
                }
              >
                Continue learning <ArrowRight size={16} />
              </Button>
            )}
          </div>
          {mock && (
            <div className="exam-controls">
              <Button
                variant="ghost"
                disabled={busy || (state.index ?? 0) === 0}
                onClick={() => act(() => load((state.index ?? 0) - 1))}
              >
                <ArrowLeft size={16} />
                Previous
              </Button>
              <Button
                variant={item.flagged ? "selected" : "ghost"}
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api(`sessions/${id}/action`, "POST", {
                      action: "flag",
                      itemId: item.id,
                    });
                    await load(state.index);
                  })
                }
              >
                <Flag size={16} />
                {item.flagged ? "Flagged" : "Flag for review"}
              </Button>
              {(state.index ?? 0) < (state.total ?? 1) - 1 ? (
                <Button
                  disabled={busy}
                  onClick={() => act(() => load((state.index ?? 0) + 1))}
                >
                  Next <ArrowRight size={16} />
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => setConfirm(true)}>
                  Submit exam <Check size={16} />
                </Button>
              )}
            </div>
          )}
        </section>
        {mock && (
          <aside className="panel exam-navigator">
            <h3>Question navigator</h3>
            <p>
              {state.navigator?.filter((n) => n.answered).length} answered ·{" "}
              {state.navigator?.filter((n) => n.flagged).length} flagged
            </p>
            <div>
              {state.navigator?.map((n, i) => (
                <button
                  key={n.id}
                  disabled={busy}
                  aria-label={`Question ${i + 1}${n.answered ? ", answered" : ""}${n.flagged ? ", flagged" : ""}`}
                  className={`${n.answered ? "answered" : ""} ${i === state.index ? "current" : ""} ${n.flagged ? "flagged" : ""}`}
                  onClick={() => act(() => load(i))}
                >
                  {i + 1}
                  {n.flagged && <Flag size={9} />}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setConfirm(true)}>
              Submit exam
            </Button>
            <p className="fine-print">
              The server enforces the timer. Refreshing does not reset it.
            </p>
          </aside>
        )}
      </div>
      {feedback && (
        <FeedbackPanel feedback={feedback} notify={notify} withIntelligence />
      )}
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Submit mock exam"
          >
            <h2>Ready to submit?</h2>
            <p>
              {state.navigator?.filter((n) => !n.answered).length} questions are
              unanswered. Once submitted, answers cannot be changed.
            </p>
            <div className="button-row">
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Keep reviewing
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api(`sessions/${id}/action`, "POST", {
                      action: "finish",
                    });
                    setConfirm(false);
                    await load();
                    await onRefresh();
                  })
                }
              >
                Submit & see report
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function FeedbackPanel({
  feedback: f,
  notify,
  withIntelligence = false,
}: {
  feedback: Feedback;
  notify: (m: string) => void;
  withIntelligence?: boolean;
}) {
  const [concept, setConcept] = useState(false),
    [example, setExample] = useState(false),
    [saving, setSaving] = useState(false);
  const notebookActions = useIntelligenceActions();
  return (
    <section
      className={`feedback-panel ${f.correct ? "positive" : "negative"}`}
      aria-live="polite"
    >
      <div className="feedback-heading">
        {f.correct ? <CheckCircle2 size={25} /> : <BrainCircuit size={25} />}
        <div>
          <h2>
            {f.correct
              ? "Correct. Keep building."
              : f.skipped
                ? "Unanswered. Explore the explanation."
                : "A useful mistake. Let’s unpack it."}
          </h2>
          <p>
            {f.correct
              ? "You identified the right approach."
              : "Correct answer: " +
                f.question.options
                  .filter((o) => f.answer.includes(o.id))
                  .map((o) => o.text)
                  .join(" · ")}
            {f.xp > 0 && <Badge tone="green">+{f.xp} XP</Badge>}
          </p>
        </div>
        <Badge tone="muted">OBJECTIVE {f.question.objective}</Badge>
      </div>
      <div className="feedback-body">
        {withIntelligence && !f.skipped && (
          <LearningIntelligence
            attemptId={f.attemptId}
            questionId={f.question.id}
            revision={f.question.revision}
            incorrect={!f.correct}
          />
        )}
        <div className="concept-definition">
          <p className="eyebrow">
            THE CONCEPT · {f.question.concept.toUpperCase()}
          </p>
          <p>{f.question.definition}</p>
        </div>
        <h3>Why this is the right approach</h3>
        <p>{f.question.explanation}</p>
        <h3>Every option, explained</h3>
        <div className="option-explanations">
          {f.question.options.map((o) => (
            <div
              key={o.id}
              className={f.answer.includes(o.id) ? "explanation-correct" : ""}
            >
              <span>
                {f.answer.includes(o.id) ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <XCircle size={17} />
                )}
              </span>
              <div>
                <strong>
                  {o.text}
                  {f.selected.includes(o.id) && <Badge>Your selection</Badge>}
                </strong>
                <p>{o.explanation}</p>
              </div>
            </div>
          ))}
        </div>
        <h3>See it in the real world</h3>
        <div className="example-grid">
          {f.question.examples
            .slice(0, example ? undefined : 2)
            .map((ex, i) => (
              <article key={ex}>
                <small>EXAMPLE {i + 1}</small>
                <p>{ex}</p>
              </article>
            ))}
        </div>
        {concept && (
          <div className="learning-card">
            <BookOpen size={20} />
            <div>
              <strong>Active recall · {f.question.concept}</strong>
              <p>
                Without looking above, explain the security goal and name one
                situation where a different control would be needed.
              </p>
              <small>{f.question.mnemonic}</small>
            </div>
          </div>
        )}
        <div className="feedback-tools">
          {!withIntelligence && !f.skipped && (
            <Button
              variant="ghost"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await notebookActions.save({
                    questionId: f.question.id,
                    revision: f.question.revision,
                    kind: "explanation",
                  });
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <BookOpen size={15} />
              Save Explanation
            </Button>
          )}
          <Button variant="ghost" onClick={() => setConcept(!concept)}>
            <BookOpen size={15} />
            {concept ? "Hide learning card" : "Review the concept"}
          </Button>
          <Button
            variant="ghost"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await api("flashcards", "POST", { questionId: f.question.id });
                notify("Concept saved to your flashcards.");
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Plus size={15} />
            Save as flashcard
          </Button>
          {f.reviewDue && (
            <span>
              <Clock3 size={14} />
              Review {new Date(f.reviewDue).toLocaleDateString()} ·{" "}
              {new Date(f.reviewDue).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <p className="fine-print">
          {f.skipped
            ? "No answer was submitted. This question did not change your mastery or review schedule."
            : f.correct
              ? "Successful recent retries support learning; mastery requires later independent recall."
              : "Automatically scheduled for reinforcement. If enough questions remain, this concept will return after 3–8 other questions."}
        </p>
      </div>
    </section>
  );
}
