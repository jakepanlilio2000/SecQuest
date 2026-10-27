"use client";
import { useCallback, useEffect, useState } from "react";

import { Check, ShieldCheck } from "lucide-react";

import type { Question } from "@/lib/types";
import { IntelligenceAdmin } from "./intelligence-admin";
import {
  Profile,
  Source,
  api,
  Button,
  Badge,
  PageTitle,
  download,
  parseContentCsv,
} from "./shared";

export interface AdminData {
  blueprint: {
    revision: string;
    maxQuestions: number;
    durationMinutes: number;
  };
  questions: {
    id: string;
    status: string;
    content: Question;
    created_by: string;
  }[];
  coverage: { id: string; description: string; count: number }[];
  sources: Source[];
  seedReview: string;
  audit: {
    id: string;
    action: string;
    entity_id: string;
    created_at: string;
  }[];
}

export function Admin({ user }: { user: Profile }) {
  const canEdit = ["content_admin", "system_admin"].includes(user.role);
  const [data, setData] = useState<AdminData | null>(null),
    [editor, setEditor] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  const load = useCallback(
    async () => setData(await api<AdminData>("admin")),
    [],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CONTENT OPERATIONS"
        title="Quality before volume."
        description="Versioned questions, source provenance, and a review gate before publication."
        action={<Badge tone="purple">{user.role.replaceAll("_", " ")}</Badge>}
      />
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}
      {data && (
        <>
          <div className="content-status">
            <ShieldCheck size={18} />
            <p>{data.seedReview}</p>
          </div>
          <IntelligenceAdmin user={user} />
          {user.role === "system_admin" && (
            <section className="panel">
              <h2>Versioned exam configuration</h2>
              <p>
                Changes apply to new sessions. Existing sessions keep their
                original timer and blueprint revision.
              </p>
              <form
                key={data.blueprint.revision}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  action(async () => {
                    await api("admin/blueprint", "PATCH", {
                      revision: f.get("revision"),
                      maxQuestions: Number(f.get("maxQuestions")),
                      durationMinutes: Number(f.get("minutes")),
                      note: f.get("note"),
                    });
                    setMessage("Exam configuration revision saved.");
                  });
                }}
              >
                <div className="form-grid">
                  <label>
                    New revision identifier
                    <input
                      name="revision"
                      required
                      defaultValue={data.blueprint.revision + "-local-1"}
                      maxLength={50}
                    />
                  </label>
                  <label>
                    Maximum questions
                    <input
                      type="number"
                      name="maxQuestions"
                      min={1}
                      max={90}
                      required
                      defaultValue={data.blueprint.maxQuestions}
                    />
                  </label>
                  <label>
                    Duration (minutes)
                    <input
                      type="number"
                      name="minutes"
                      min={1}
                      max={180}
                      required
                      defaultValue={data.blueprint.durationMinutes}
                    />
                  </label>
                  <label>
                    Change note
                    <input
                      name="note"
                      minLength={10}
                      maxLength={1000}
                      required
                    />
                  </label>
                </div>
                <Button type="submit" disabled={busy}>
                  Save configuration revision
                </Button>
              </form>
            </section>
          )}
          <section className="panel">
            <div className="section-heading">
              <h2>Objective coverage</h2>
              <Badge>
                {data.questions.filter((q) => q.status === "published").length}{" "}
                published
              </Badge>
            </div>
            <div className="coverage-matrix">
              {data.coverage.map((o) => (
                <div key={o.id} title={o.description}>
                  <strong>{o.id}</strong>
                  <span>{o.count}</span>
                  <small>published</small>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <h2>Question library</h2>
              <div className="button-row">
                <Button
                  variant="ghost"
                  onClick={() =>
                    download(
                      "secquest-questions.json",
                      JSON.stringify(
                        data.questions.map((q) => q.content),
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  Export JSON
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    download(
                      "secquest-questions.csv",
                      "content\r\n" +
                        data.questions
                          .map(
                            (q) =>
                              '"' +
                              JSON.stringify(q.content).replaceAll('"', '""') +
                              '"',
                          )
                          .join("\r\n"),
                      "text/csv",
                    )
                  }
                >
                  Export CSV
                </Button>
              </div>
            </div>
            <label>
              Import JSON array or exported CSV
              <input
                type="file"
                accept=".json,.csv"
                disabled={busy || !canEdit}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await action(async () => {
                    if (file.size > 1_000_000)
                      throw Error("File exceeds 1 MB.");
                    const text = await file.text();
                    const questions = file.name.endsWith(".csv")
                      ? parseContentCsv(text)
                      : JSON.parse(text);
                    const r = await api<{ imported: number }>(
                      "admin/import",
                      "POST",
                      { questions },
                    );
                    setMessage(`${r.imported} questions imported as drafts.`);
                  });
                  e.target.value = "";
                }}
              />
            </label>
            <label>
              Review note{" "}
              <small>
                Required for status transitions, at least 10 characters.
              </small>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder="Describe the editorial review or reason for this change…"
              />
            </label>
            <div className="table-scroll admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Objective</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.questions.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <strong>{q.content.concept}</strong>
                        <small>
                          {q.id} · r{q.content.revision}
                        </small>
                      </td>
                      <td>{q.content.objective}</td>
                      <td>
                        <Badge
                          tone={q.status === "published" ? "green" : "muted"}
                        >
                          {q.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td>
                        <div className="button-row">
                          <button
                            className="text-link"
                            disabled={!canEdit}
                            onClick={() => {
                              setEditor(
                                JSON.stringify(
                                  {
                                    ...q.content,
                                    revision: q.content.revision + 1,
                                  },
                                  null,
                                  2,
                                ),
                              );
                              document
                                .getElementById("question-editor")
                                ?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            Edit
                          </button>
                          {(q.status === "draft"
                            ? ["under_review", "archived"]
                            : q.status === "under_review"
                              ? ["approved", "draft"]
                              : q.status === "approved"
                                ? ["published", "draft"]
                                : q.status === "published"
                                  ? ["archived"]
                                  : ["draft"]
                          )
                            .filter(
                              (s) =>
                                canEdit ||
                                !["published", "archived"].includes(s),
                            )
                            .map((s) => (
                              <button
                                key={s}
                                className="text-link"
                                disabled={busy || note.length < 10}
                                onClick={() =>
                                  action(async () => {
                                    await api("admin/status", "POST", {
                                      id: q.id,
                                      status: s,
                                      note,
                                    });
                                    setMessage(`${q.id} moved to ${s}.`);
                                  })
                                }
                              >
                                {s.replaceAll("_", " ")}
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel" id="question-editor">
            <h2>Versioned question editor</h2>
            <p>
              Edit a complete question object. Existing questions require the
              next revision number; edits return to draft. Previous learner
              attempts keep their original revision.
            </p>
            <textarea
              className="code-editor"
              aria-label="Question JSON editor"
              disabled={!canEdit}
              spellCheck={false}
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
              placeholder="Paste a new question object, or choose Edit above…"
            />
            <Button
              disabled={busy || !editor.trim() || !canEdit}
              onClick={() =>
                action(async () => {
                  await api("admin/question", "POST", JSON.parse(editor));
                  setMessage("Revision saved as draft.");
                  setEditor("");
                })
              }
            >
              Validate & save draft <Check size={16} />
            </Button>
          </section>
          <section className="panel">
            <h2>Source register</h2>
            {data.sources.map((s) => (
              <div className="source-register" key={s.id}>
                <div>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.name} ↗
                  </a>
                  <Badge
                    tone={
                      s.status.startsWith("unverified") ? "orange" : "green"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                <small>
                  {s.publisher} · checked {s.verifiedAt}
                </small>
                <p>{s.usage}</p>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Recent content audit</h2>
            {data.audit.map((a) => (
              <div className="library-card-row" key={a.id}>
                <strong>
                  {a.action} · {a.entity_id}
                </strong>
                <small>{new Date(a.created_at).toLocaleString()}</small>
              </div>
            ))}
            {!data.audit.length && <p>No content-management changes yet.</p>}
          </section>
        </>
      )}
    </>
  );
}
