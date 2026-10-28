"use client";
import { useEffect, useState } from "react";
import { api, Button, Badge, type Profile } from "./shared";
import type { ReviewPolicy } from "@/lib/scheduler";
import type { duplicateCandidates } from "@/lib/content-similarity";
export function CompletionAdmin({ user }: { user: Profile }) {
  const [policy, setPolicy] = useState<ReviewPolicy | null>(null),
    [candidates, setCandidates] = useState<
      ReturnType<typeof duplicateCandidates>
    >([]),
    [editor, setEditor] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const [r, d] = await Promise.all([
      api<{ policy: ReviewPolicy }>("admin/review-policy"),
      api<{ candidates: typeof candidates }>("admin/duplicates"),
    ]);
    setPolicy(r.policy);
    setCandidates(d.candidates);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>Versioned review policy</h2>
          {policy && <Badge>{policy.version}</Badge>}
        </div>
        <p>
          New sessions snapshot this policy. Existing sessions and due dates
          keep their original policy. The single review engine and the
          3–8-question reinforcement gap remain in place.
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <p className="alert success" role="status">
            {message}
          </p>
        )}
        {user.role === "system_admin" && policy ? (
          <>
            <Button
              variant="ghost"
              onClick={() =>
                setEditor(
                  JSON.stringify(
                    { ...policy, version: policy.version + "-revision" },
                    null,
                    2,
                  ),
                )
              }
            >
              Edit next policy version
            </Button>
            <label>
              Review policy JSON
              <textarea
                aria-label="Review policy JSON"
                className="code-editor"
                value={editor}
                onChange={(e) => setEditor(e.target.value)}
              />
            </label>
            <Button
              disabled={busy || !editor}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api("admin/review-policy", "POST", JSON.parse(editor));
                  await load();
                  setEditor("");
                  setMessage(
                    "Policy version saved. Existing review dates and session policies were preserved.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Validate and save policy version
            </Button>
          </>
        ) : (
          <p>Only a system administrator may create a new review policy.</p>
        )}
      </section>
      <section className="panel">
        <h2>Near-duplicate review assistance</h2>
        <p>
          Token overlap within one objective is a review signal, not proof of
          semantic equivalence. These candidates are never automatically removed
          or published.
        </p>
        {candidates.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>First item</th>
                  <th>Compare with</th>
                  <th>Objective</th>
                  <th>Token overlap</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.left.id + ":" + c.right.id}>
                    <td>
                      <strong>{c.left.id}</strong>
                      <p>{c.left.prompt}</p>
                    </td>
                    <td>
                      <strong>{c.right.id}</strong>
                      <p>{c.right.prompt}</p>
                    </td>
                    <td>{c.objective}</td>
                    <td>{c.similarity}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No current item pairs meet the review threshold.</p>
        )}
      </section>
    </>
  );
}
