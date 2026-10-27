"use client";
import { useState } from "react";
import {
  BrainCircuit,
  Search,
  ArrowRight,
  BookOpen,
  Clock3,
  Network,
} from "lucide-react";
import { api, Badge, Button, Empty, PageTitle } from "./shared";
import {
  useIntelligence,
  useIntelligenceActions,
  ReferenceLinks,
} from "./intelligence-shared";
export function MisconceptionDashboard({
  initialId,
}: {
  initialId: string | null;
}) {
  const { data, error, busy, run, refresh } = useIntelligence(),
    actions = useIntelligenceActions();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState(initialId ? "all" : "active"),
    [message, setMessage] = useState("");
  if (!data)
    return (
      <section className="panel">
        <p>{error || "Reading your actual question evidence…"}</p>
      </section>
    );
  const rows = data.findings
    .filter(
      (f) =>
        (!search ||
          `${f.definition.title} ${f.definition.conceptIds.join(" ") ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (filter === "all" ||
          (filter === "active" &&
            !["Insufficient evidence", "Currently controlled"].includes(
              f.status,
            )) ||
          (filter === "controlled" && f.status === "Currently controlled")),
    )
    .sort(
      (a, b) =>
        Number(b.definition.id === initialId) -
          Number(a.definition.id === initialId) ||
        b.distinctMistakes - a.distinctMistakes,
    );
  const flagged = data.findings.filter((f) =>
    [
      "Possible misconception",
      "Likely misconception",
      "Recurring misconception",
    ].includes(f.status),
  );
  return (
    <>
      <PageTitle
        eyebrow="KNOWLEDGE INTELLIGENCE"
        title="Knowledge Gaps & Misconceptions"
        description="Explainable hypotheses from your choices. A finding is learning guidance, never a cognitive diagnosis."
      />
      <div className="intelligence-stat-grid">
        <article className="panel">
          <strong>{flagged.length}</strong>
          <span>suspected patterns</span>
        </article>
        <article className="panel">
          <strong>
            {
              data.findings.filter(
                (f) => f.status === "Recurring misconception",
              ).length
            }
          </strong>
          <span>recurring patterns</span>
        </article>
        <article className="panel">
          <strong>
            {
              data.findings.filter((f) => f.status === "Currently controlled")
                .length
            }
          </strong>
          <span>currently controlled</span>
        </article>
        <article className="panel">
          <strong>{data.unmappedMistakes}</strong>
          <span>unmapped mistakes · no invented explanation</span>
        </article>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search misconception catalog"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a concept confusion…"
          />
        </label>
        <select
          aria-label="Misconception status filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="active">Active findings</option>
          <option value="controlled">Currently controlled</option>
          <option value="all">Full editorial catalog</option>
        </select>
      </div>
      {error && <div className="alert error">{error}</div>}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
      {data.pendingBackfill > 0 && (
        <div className="content-status">
          <p>
            {data.pendingBackfill} historical attempts remain for the next safe
            backfill batch.
          </p>
          <Button variant="ghost" onClick={refresh}>
            Continue historical analysis
          </Button>
        </div>
      )}
      {!rows.length && (
        <section className="panel">
          <Empty icon={BrainCircuit} title="No supported finding in this view">
            One incorrect answer is insufficient. Practice different linked
            questions, or inspect the catalog to learn the distinctions.
          </Empty>
          <Button variant="ghost" onClick={() => setFilter("all")}>
            Explore the concept comparisons <ArrowRight size={14} />
          </Button>
        </section>
      )}
      <div className="misconception-grid">
        {rows.map((f) => {
          const count = data.availableQuestions.filter((q) =>
            f.definition.questionIds.includes(q.id),
          ).length;
          return (
            <article
              className="panel misconception-card"
              key={f.definition.id}
              id={`misconception-${f.definition.id}`}
            >
              <div className="section-heading">
                <Badge
                  tone={
                    f.status === "Currently controlled"
                      ? "green"
                      : f.status === "Insufficient evidence"
                        ? "muted"
                        : "orange"
                  }
                >
                  {f.status}
                </Badge>
                <small>{f.confidence} evidence confidence</small>
              </div>
              <h2>{f.definition.title}</h2>
              <p>{f.reason}</p>
              <div className="evidence-meter">
                <span style={{ width: f.support + "%" }} />
              </div>
              <small>
                {f.support}% heuristic evidence support · not a diagnostic
                probability
              </small>
              <details open={f.definition.id === initialId}>
                <summary>Why this was flagged & how to repair it</summary>
                <div className="mental-model incorrect-model">
                  <small>COMMON INCORRECT MODEL</small>
                  <p>{f.definition.incorrectBelief}</p>
                </div>
                <div className="mental-model correct-model">
                  <small>CORRECT PRINCIPLE</small>
                  <p>{f.definition.correctExplanation}</p>
                </div>
                <div className="comparison-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Concept</th>
                        <th>Key distinction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.definition.comparison.map((r) => (
                        <tr key={r.label}>
                          <th>{r.label}</th>
                          <td>{r.meaning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3>Practical example</h3>
                {f.definition.examples.map((e) => (
                  <p key={e}>{e}</p>
                ))}
                <p className="fine-print">{f.trend}</p>
                <div className="button-row">
                  {f.definition.prerequisiteIds.map((id) => (
                    <Button
                      key={id}
                      variant="ghost"
                      onClick={() =>
                        actions.go("knowledge-map", "&concept=" + id)
                      }
                    >
                      <Network size={14} />
                      {data.graph.nodes.find((n) => n.id === id)?.name ?? id}
                    </Button>
                  ))}
                </div>
                <h3>Supporting answer evidence</h3>
                {f.evidence.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Question</th>
                          <th>Signal</th>
                          <th>Evidence kind</th>
                          <th>Observed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.evidence.map((e) => (
                          <tr key={e.attempt_id}>
                            <td>{e.question_id}</td>
                            <td>
                              {e.polarity > 0
                                ? "Mapped mistake"
                                : "Correct retrieval"}
                            </td>
                            <td>
                              {e.independent
                                ? "Independent encounter / delayed review"
                                : "Recent retry; reduced weight"}
                            </td>
                            <td>{new Date(e.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No mapped question evidence exists for this learner.</p>
                )}
                <p className="fine-print">
                  Related objectives: {f.definition.objectives.join(", ")}.
                  Distinct questions prevent repetition from inflating evidence.
                </p>
                <ReferenceLinks data={data} ids={f.definition.references} />
              </details>
              <div className="button-row misconception-actions">
                <Button
                  variant="ghost"
                  onClick={() =>
                    actions.go(
                      "knowledge-map",
                      "&concept=" + f.definition.conceptIds[0],
                    )
                  }
                >
                  Study & compare
                </Button>
                {count > 0 && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        actions.practice({ misconceptionId: f.definition.id }),
                      )
                    }
                  >
                    Practice related questions <ArrowRight size={14} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      actions.save({
                        kind: "comparison",
                        misconceptionId: f.definition.id,
                      }),
                    )
                  }
                >
                  <BookOpen size={14} />
                  Add to Notebook
                </Button>
                {f.distinctMistakes > 0 && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const r = await api<{ message: string }>(
                          "intelligence/review",
                          "POST",
                          { misconceptionId: f.definition.id },
                        );
                        setMessage(r.message);
                      })
                    }
                  >
                    <Clock3 size={14} />
                    Review later
                  </Button>
                )}
              </div>
              {!count && (
                <p className="fine-print">
                  A lesson is available. Additional validated distractor
                  mappings and practice formulations are still needed.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="fine-print">
        Policy {data.policy.version}: possible after{" "}
        {data.policy.possibleDistinct} distinct mapped questions; likely after{" "}
        {data.policy.likelyDistinct}; recurring after{" "}
        {data.policy.recurringDistinct}. A correction remains provisional until
        delayed checks on different questions support it.
      </p>
    </>
  );
}
