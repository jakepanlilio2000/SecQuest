"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, History, Layers3, MailCheck, Trophy } from "lucide-react";
import { api, Button, Badge, Empty } from "./shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";
import { SafeMarkdown } from "./safe-markdown";
import type { NotebookEntry } from "@/lib/intelligence-types";
import type { progressionFor, leaderboard } from "@/lib/progression";

export function EmailStatus() {
  const [state, setState] = useState<{
      verifiedAt: string | null;
      deliveryConfigured: boolean;
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ verifiedAt: string | null; deliveryConfigured: boolean }>(
      "verification",
    )
      .then(setState)
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <section className="panel email-status">
      <MailCheck size={20} />
      <div>
        <h2>Email verification</h2>
        <p>
          {state?.verifiedAt
            ? `Verified ${new Date(state.verifiedAt).toLocaleDateString()}`
            : state?.deliveryConfigured
              ? "Verify your address with a single-use link. Existing learning access is preserved."
              : state
                ? "Delivery is unavailable until the operator configures SMTP. Your account remains usable."
                : "Checking verification status…"}
        </p>
        {message && <p role="status">{message}</p>}
        {state && !state.verifiedAt && state.deliveryConfigured && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ message: string }>(
                  "verification",
                  "POST",
                  {},
                );
                setMessage(r.message);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Sending…" : "Send verification link"}
          </Button>
        )}
      </div>
    </section>
  );
}
export function VerifyEmail({
  token,
  onClose,
}: {
  token: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(
      "This confirms the address associated with this single-use link.",
    ),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <main className="verification-page">
      <section className="panel">
        <MailCheck size={28} />
        <h1>Verify your email</h1>
        <p role="status">{message}</p>
        <div className="button-row">
          {!done && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("auth/verify-email", "POST", { token });
                  setDone(true);
                  setMessage(
                    "Email verified. You can return to your learning workspace.",
                  );
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Verifying…" : "Verify this email"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Return to SecQuest
          </Button>
        </div>
      </section>
    </main>
  );
}

export function NotebookRevisionTools({
  entry,
  dirty,
  selectedText,
  onRestore,
  onMessage,
}: {
  entry: NotebookEntry;
  dirty: boolean;
  selectedText: () => string;
  onRestore: (entry: NotebookEntry) => void;
  onMessage: (message: string) => void;
}) {
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const [mode, setMode] = useState<"history" | "card" | null>(null),
    [history, setHistory] = useState<
      { revision: number; data: string; saved_at: string }[]
    >([]),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [front, setFront] = useState(""),
    [back, setBack] = useState("");
  const old = history.find((h) => h.revision === revision);
  const preview = old ? (JSON.parse(old.data) as NotebookEntry) : null;
  async function openHistory() {
    setMode("history");
    setLoading(true);
    setError("");
    try {
      const r = await api<{ history: typeof history }>(
        `notebook/entries/${entry.id}/history`,
      );
      setHistory(r.history);
      setRevision(r.history[0]?.revision ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="notebook-revision-tools">
        <Button
          variant="ghost"
          onClick={(event) => {
            dialogTrigger.current = event.currentTarget;
            void openHistory();
          }}
        >
          <History size={14} />
          Version history
        </Button>
        <Button
          variant="ghost"
          disabled={!!entry.deleted_at}
          onClick={(event) => {
            dialogTrigger.current = event.currentTarget;
            setError("");
            setFront(`Explain ${entry.title} from memory`.slice(0, 500));
            setBack(selectedText().slice(0, 3000));
            setMode("card");
          }}
        >
          <Layers3 size={14} />
          Create recall card
        </Button>
      </div>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setMode(null);
        }}
      >
        <DialogContent
          className="study-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            dialogTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {mode === "history"
                ? "Notebook version history"
                : "Review your recall card"}
            </DialogTitle>
            <DialogDescription>
              {mode === "history"
                ? "Restore an earlier version as a new revision. The current saved version stays in history."
                : "Edit both sides before saving. Cards use your selected text or saved note and never change exam mastery."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {mode === "history" ? (
            <>
              {dirty && (
                <p className="alert">
                  Save or resolve your local draft before restoring a version.
                </p>
              )}
              {loading ? (
                <Skeleton className="history-skeleton" />
              ) : (
                <>
                  <label>
                    Saved revision
                    <select
                      aria-label="Saved note revision"
                      value={revision}
                      onChange={(e) => setRevision(Number(e.target.value))}
                    >
                      {history.map((h) => (
                        <option key={h.revision} value={h.revision}>
                          Revision {h.revision} ·{" "}
                          {new Date(h.saved_at).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </label>
                  {preview && (
                    <div className="revision-preview">
                      <h3>{preview.title}</h3>
                      <SafeMarkdown>
                        {preview.body || "*Empty note*"}
                      </SafeMarkdown>
                    </div>
                  )}
                  <Button
                    disabled={
                      busy ||
                      dirty ||
                      !!entry.deleted_at ||
                      !revision ||
                      revision === entry.revision
                    }
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const r = await api<{ entry: NotebookEntry }>(
                          `notebook/entries/${entry.id}/restore-revision`,
                          "POST",
                          {
                            revision,
                            expectedRevision: entry.revision,
                            mutationId: crypto.randomUUID(),
                          },
                        );
                        onRestore(r.entry);
                        setMode(null);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Restore selected revision
                  </Button>
                </>
              )}
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api(`notebook/entries/${entry.id}/flashcard`, "POST", {
                    front,
                    back,
                  });
                  onMessage(
                    "Recall card saved in Flashcards. Repeating this save cannot duplicate the same card.",
                  );
                  setMode(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Recall prompt
                <input
                  aria-label="Recall prompt"
                  minLength={2}
                  maxLength={500}
                  required
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                />
              </label>
              <label>
                Personal explanation
                <textarea
                  aria-label="Recall card explanation"
                  minLength={2}
                  maxLength={3000}
                  required
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save recall card"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProgressionCenter({
  onRefresh,
}: {
  onRefresh?: () => Promise<void>;
}) {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof progressionFor>
    > | null>(null),
    [entries, setEntries] = useState<Awaited<ReturnType<typeof leaderboard>>>(
      [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState(false),
    [alias, setAlias] = useState("Learning analyst");
  async function load() {
    const [state, board] = await Promise.all([
      api<NonNullable<typeof data>>("progression"),
      api<{ entries: typeof entries }>("progression/leaderboard"),
    ]);
    setData(state);
    setEntries(board.entries);
    setEnabled(state.preference.enabled);
    setAlias(state.preference.alias || "Learning analyst");
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  if (!data)
    return (
      <section className="panel">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <Skeleton className="history-skeleton" />
        )}
      </section>
    );
  return (
    <>
      <section className="panel missions-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Trophy size={18} />
              This week’s missions
            </h2>
            <p>
              {data.weekStart.slice(0, 10)} to {data.weekEnd.slice(0, 10)} · UTC
              boundaries · rewards require observed activity
            </p>
          </div>
          <Badge>{data.xp} XP</Badge>
        </div>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <div className="mission-list">
          {data.missions.map((m) => (
            <article key={m.id}>
              <div>
                <h3>{m.title}</h3>
                <p>{m.description}</p>
                <Progress
                  value={Math.min(100, (100 * m.value) / m.target)}
                  aria-label={`${m.title}: ${Math.min(m.value, m.target)} of ${m.target}`}
                />
                <small>
                  {Math.min(m.value, m.target)} / {m.target} · {m.xp} XP
                </small>
              </div>
              <Button
                variant="ghost"
                disabled={busy || m.claimed || m.value < m.target}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api("progression/claim", "POST", { mission: m.id });
                    await load();
                    await onRefresh?.();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {m.claimed
                  ? "Claimed"
                  : m.value >= m.target
                    ? "Claim reward"
                    : "In progress"}
              </Button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Your personal bests</h2>
        <p>
          Completed sessions with at least five items. Raw session accuracy
          includes retries and is separate from first-encounter mastery.
        </p>
        <div className="personal-best-grid">
          {data.personalBests.map((b) => (
            <div key={b.mode}>
              <span>{b.mode}</span>
              <strong>
                {b.bestAccuracy === null ? "—" : `${b.bestAccuracy}%`}
              </strong>
              <small>{b.sessions} qualifying sessions</small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel leaderboard-panel">
        <h2>Optional learner board</h2>
        <p>
          Off by default. Opting in shares only your chosen alias, XP and rank
          with signed-in learners. Email, answers and notebook contents stay
          private.
        </p>
        <form
          className="sharing-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("progression/leaderboard", "POST", { enabled, alias });
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Share my alias and XP
          </label>
          <label>
            Public alias
            <input
              aria-label="Public learner alias"
              minLength={2}
              maxLength={40}
              value={alias}
              required
              onChange={(e) => setAlias(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy}>
            Save sharing preference
          </Button>
        </form>
        {entries.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Place</th>
                  <th>Alias</th>
                  <th>XP</th>
                  <th>Rank</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.place}</td>
                    <td>{e.alias}</td>
                    <td>{e.xp}</td>
                    <td>{e.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={BookOpen} title="No learners have opted in">
            Your private progress works without joining.
          </Empty>
        )}
      </section>
    </>
  );
}
