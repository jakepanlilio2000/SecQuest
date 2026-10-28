"use client";
import { useEffect, useState } from "react";

import {
  ArrowRight,
  CheckCircle2,
  Network,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Sim, api, Icon, Button, Badge, PageTitle } from "./shared";

export function Simulations({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [sims, setSims] = useState<Sim[]>([]),
    [active, setActive] = useState<Sim | null>(null),
    [selected, setSelected] = useState<Record<string, string>>({}),
    [result, setResult] = useState<{
      score: number;
      feedback: {
        id: string;
        prompt: string;
        answer: string;
        why: string;
        correct: boolean;
        selected: string;
      }[];
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ simulations: Sim[] }>("simulations")
      .then((r) => setSims(r.simulations))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="THE CYBER LAB"
        title="Think it through. Defend the system."
        description="Unofficial PBQ-style exercises using fictional, sandboxed data. No connection to real targets."
      />
      {error && <div className="alert error">{error}</div>}
      <div className="lab-grid">
        {sims.map((s, index) => (
          <button
            key={s.id}
            className={`panel lab-card ${active?.id === s.id ? "selected" : ""}`}
            onClick={() => {
              setActive(s);
              setSelected({});
              setResult(null);
            }}
          >
            <span className="lab-art">
              <Icon
                icon={s.id === "firewall" ? Network : ShieldCheck}
                size={49}
              />
              <span>SIMULATION {String(index + 1).padStart(2, "0")}</span>
            </span>
            <Badge tone="blue">OBJECTIVE {s.objective}</Badge>
            <h2>{s.name}</h2>
            <p>{s.description}</p>
            <span className="text-link">
              Enter simulation <ArrowRight size={16} />
            </span>
          </button>
        ))}
      </div>
      {active && (
        <section className="panel simulation-workspace">
          <div className="section-heading">
            <h2>{active.name}</h2>
            <Badge tone="purple">FICTIONAL LAB</Badge>
          </div>
          <p className="lab-brief">{active.brief}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                setResult(
                  await api("simulations", "POST", { id: active.id, selected }),
                );
                await onRefresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {active.tasks.map((t, i) => (
              <label className="simulation-task" key={t.id}>
                <span>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  {t.prompt}
                </span>
                <select
                  required
                  disabled={!!result}
                  value={selected[t.id] ?? ""}
                  onChange={(e) =>
                    setSelected({ ...selected, [t.id]: e.target.value })
                  }
                >
                  <option value="">Choose your decision</option>
                  {active.choices.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            ))}
            {!result && (
              <Button type="submit" disabled={busy}>
                Evaluate decisions <ShieldCheck size={17} />
              </Button>
            )}
          </form>
          {result && (
            <div className="simulation-feedback">
              <h2>{result.score}% · Lab debrief</h2>
              {result.feedback.map((f) => (
                <article key={f.id}>
                  <span className={f.correct ? "text-green" : "text-orange"}>
                    {f.correct ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <XCircle size={18} />
                    )}
                  </span>
                  <div>
                    <strong>{f.prompt}</strong>
                    <p>Your decision: {f.selected}</p>
                    <p>
                      Best decision: {f.answer}. {f.why}
                    </p>
                  </div>
                </article>
              ))}
              <Button
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setSelected({});
                }}
              >
                Try the lab again
              </Button>
              <p className="fine-print">
                XP is awarded once per successfully completed simulation.
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
