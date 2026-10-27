"use client";
import { useState } from "react";
import { Clock3, BookOpen, ArrowRight, Activity } from "lucide-react";
import { Badge, Button, Empty, PageTitle } from "./shared";
import { useIntelligence, useIntelligenceActions } from "./intelligence-shared";
export function RetentionForecast() {
  const { data, error, busy, run } = useIntelligence(),
    actions = useIntelligenceActions();
  const [concept, setConcept] = useState(""),
    [selected, setSelected] = useState(""),
    [horizon, setHorizon] = useState(14),
    [event, setEvent] = useState("");
  if (!data)
    return (
      <section className="panel">
        <p>
          {error || "Reading existing review schedules and retrieval history…"}
        </p>
      </section>
    );
  const rows = data.forecasts.filter(
    (f) => !concept || f.conceptIds.includes(concept),
  );
  const active =
    rows.find((f) => f.questionId === selected) ??
    rows.find((f) => f.lastAt) ??
    rows[0];
  const now = Date.parse(data.asOf),
    start = now - 14 * 86400000,
    end = now + horizon * 86400000;
  const x = (date: string) =>
    50 + ((Date.parse(date) - start) / (end - start)) * 710;
  const history =
      active?.history.filter(
        (e) => Date.parse(e.at) >= start && Date.parse(e.at) <= end,
      ) ?? [],
    projection =
      active?.projection.filter((p) => Date.parse(p.at) <= end) ?? [];
  const points = projection
    .map((p) => `${x(p.at)},${225 - p.probability * 155}`)
    .join(" ");
  const activeNotes = data.notes.filter(
    (n) =>
      n.question_id === active?.questionId ||
      active?.conceptIds.includes(n.concept_id ?? ""),
  );
  return (
    <>
      <PageTitle
        eyebrow="KNOWLEDGE INTELLIGENCE"
        title="Knowledge Retention Forecast"
        description="Your actual review dates, observed retrievals, and evidence-gated estimates. The existing scheduler remains in control."
      />
      <div className="content-status">
        <Activity size={18} />
        <p>
          Scheduled review status and estimated recall are different signals.
          Numerical curves are uncalibrated heuristics, shown only after{" "}
          {data.policy.minimumForecastReviews} delayed reviews and{" "}
          {data.policy.minimumForecastSuccesses} successful delayed retrievals.
          A shaded band is illustrative uncertainty, not a measured confidence
          interval.
        </p>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="intelligence-stat-grid">
        <article className="panel">
          <strong>
            {
              data.forecasts.filter((f) => f.scheduledState === "Overdue")
                .length
            }
          </strong>
          <span>overdue scheduled reviews</span>
        </article>
        <article className="panel">
          <strong>
            {
              data.forecasts.filter((f) => f.scheduledState === "Review Due")
                .length
            }
          </strong>
          <span>reviews due</span>
        </article>
        <article className="panel">
          <strong>
            {
              data.forecasts.filter((f) => f.scheduledState === "Review Soon")
                .length
            }
          </strong>
          <span>reviews approaching</span>
        </article>
        <article className="panel">
          <strong>
            {data.forecasts.filter((f) => f.probability !== null).length}
          </strong>
          <span>items with enough history for a heuristic curve</span>
        </article>
      </div>
      <section className="panel retention-chart-panel">
        <div className="section-heading">
          <div>
            <h2>Memory retention timeline</h2>
            <p>
              Last 14 days of actual events · next {horizon} days of scheduled
              reviews and eligible projections
            </p>
          </div>
          <Badge tone="muted">{data.policy.version}</Badge>
        </div>
        <div className="forecast-controls">
          <label>
            Concept
            <select
              value={concept}
              aria-label="Retention concept filter"
              onChange={(e) => {
                setConcept(e.target.value);
                setSelected("");
              }}
            >
              <option value="">All concepts</option>
              {data.graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Question
            <select
              aria-label="Retention question"
              value={active?.questionId ?? ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {rows.map((f) => (
                <option key={f.questionId} value={f.questionId}>
                  {f.concept} · {f.questionId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Forecast horizon
            <input
              type="range"
              min={1}
              max={14}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            />
          </label>
        </div>
        {active && active.history.length ? (
          <>
            <div className="timeline-selection">
              <Badge
                tone={
                  ["Overdue", "Review Due"].includes(active.scheduledState)
                    ? "orange"
                    : "blue"
                }
              >
                {active.scheduledState}
              </Badge>
              <Badge tone="muted">{active.retentionState}</Badge>
              <strong>
                {active.probability === null
                  ? "No recall probability assigned"
                  : `${Math.round(active.probability * 100)}% heuristic recall estimate`}
              </strong>
              <small>
                {active.independentReviews} delayed review observations
              </small>
            </div>
            <svg
              className="retention-timeline"
              viewBox="0 0 800 330"
              role="img"
              aria-label={`Actual review events and upcoming due date for ${active.concept}. ${active.uncertainty}`}
            >
              <rect
                x="50"
                y="35"
                width={x(data.asOf) - 50}
                height="260"
                className="timeline-history-bg"
              />
              <text x="65" y="25">
                OBSERVED HISTORY
              </text>
              <text x={x(data.asOf) + 12} y="25">
                FUTURE ESTIMATE / SCHEDULE
              </text>
              {[0, 0.5, 1].map((p) => (
                <g key={p}>
                  <line
                    x1={x(data.asOf)}
                    x2="760"
                    y1={225 - p * 155}
                    y2={225 - p * 155}
                    className="timeline-grid"
                  />
                  <text x="15" y={229 - p * 155}>
                    {Math.round(p * 100)}%
                  </text>
                </g>
              ))}
              <line
                x1={x(data.asOf)}
                x2={x(data.asOf)}
                y1="35"
                y2="295"
                className="timeline-now"
              />
              <text x={x(data.asOf) - 14} y="317">
                Today
              </text>
              {projection.length > 0 && (
                <>
                  <polygon
                    className="forecast-uncertainty"
                    points={[
                      ...projection.map(
                        (p) =>
                          `${x(p.at)},${225 - Math.min(1, p.probability + 0.2) * 155}`,
                      ),
                      ...projection
                        .slice()
                        .reverse()
                        .map(
                          (p) =>
                            `${x(p.at)},${225 - Math.max(0, p.probability - 0.2) * 155}`,
                        ),
                    ].join(" ")}
                  />
                  <polyline className="forecast-curve" points={points} />
                </>
              )}
              {history.map((h, i) => (
                <circle
                  key={h.at + ":" + i}
                  cx={x(h.at)}
                  cy={267}
                  r="6"
                  tabIndex={0}
                  role="button"
                  aria-label={`${h.kind}: ${h.correct ? "correct" : "incorrect"} on ${new Date(h.at).toLocaleString()}`}
                  className={h.correct ? "history-success" : "history-failure"}
                  onFocus={() =>
                    setEvent(
                      `${h.kind} · ${h.correct ? "correct" : "incorrect"} · ${new Date(h.at).toLocaleString()}`,
                    )
                  }
                  onClick={() =>
                    setEvent(
                      `${h.kind} · ${h.correct ? "correct" : "incorrect"} · ${new Date(h.at).toLocaleString()}`,
                    )
                  }
                >
                  <title>
                    {h.kind}: {h.correct ? "correct" : "incorrect"} ·{" "}
                    {new Date(h.at).toLocaleString()}
                  </title>
                </circle>
              ))}
              {active.dueAt &&
                Date.parse(active.dueAt) >= start &&
                Date.parse(active.dueAt) <= end && (
                  <g>
                    <line
                      x1={x(active.dueAt)}
                      x2={x(active.dueAt)}
                      y1="45"
                      y2="282"
                      className="timeline-due"
                    />
                    <text x={Math.min(650, x(active.dueAt) + 6)} y="55">
                      Review due {new Date(active.dueAt).toLocaleDateString()}
                    </text>
                  </g>
                )}
              <text x="55" y="290">
                Actual review events: green correct · orange incorrect
              </text>
            </svg>
            {event && (
              <p className="timeline-event" role="status">
                {event}
              </p>
            )}
            <p>{active.reason}</p>
            <p className="fine-print">
              {active.uncertainty} Existing due date:{" "}
              {active.dueAt ? new Date(active.dueAt).toLocaleString() : "None"}.
            </p>
          </>
        ) : (
          <Empty icon={Clock3} title="No retrieval history to forecast yet">
            A short practice session will establish real events. No historical
            data or recall percentage is invented.
          </Empty>
        )}
        {active && (
          <div className="button-row">
            {data.availableQuestions.some((q) => q.id === active.questionId) &&
              active.conceptIds[0] && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      actions.practice({ conceptId: active.conceptIds[0] }),
                    )
                  }
                >
                  Practice this concept <ArrowRight size={14} />
                </Button>
              )}
            {active.conceptIds[0] && (
              <Button
                variant="ghost"
                onClick={() =>
                  actions.go(
                    "knowledge-map",
                    "&concept=" + active.conceptIds[0],
                  )
                }
              >
                Inspect prerequisites
              </Button>
            )}
          </div>
        )}
        {activeNotes.length > 0 && (
          <div className="forecast-notes">
            <h3>Your linked notes</h3>
            {activeNotes.map((n) => (
              <button
                key={n.id}
                className="text-link"
                onClick={() => actions.go("notebook", "&entry=" + n.id)}
              >
                <BookOpen size={14} />
                {n.title}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Suggested review today</h2>
            <p>
              Stable ordering from existing due dates, lapse history, and
              observed difficulty.
            </p>
          </div>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await import("./shared").then((m) =>
                  m.api<{ id: string }>("sessions", "POST", {
                    mode: "daily",
                    count: 12,
                  }),
                );
                actions.go("session", "&session=" + r.id);
              })
            }
          >
            Start daily review <ArrowRight size={14} />
          </Button>
        </div>
        {rows
          .filter((f) => f.priority > 0)
          .slice(0, 12)
          .map((f) => (
            <button
              key={f.questionId}
              className="forecast-row"
              onClick={() => setSelected(f.questionId)}
            >
              <Clock3 size={17} />
              <span>
                <strong>{f.concept}</strong>
                <small>{f.reason}</small>
              </span>
              <Badge
                tone={
                  ["Overdue", "Review Due"].includes(f.scheduledState)
                    ? "orange"
                    : "blue"
                }
              >
                {f.scheduledState}
              </Badge>
              <small>
                {f.dueAt ? new Date(f.dueAt).toLocaleString() : "No schedule"}
              </small>
            </button>
          ))}
        {!rows.some((f) => f.priority > 0) && (
          <p>
            No due or difficulty-based recommendations are established yet. New
            practice can establish a baseline.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Concept-level coverage</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Concept</th>
                <th>Linked questions</th>
                <th>Reviewed</th>
                <th>Due</th>
                <th>Mean eligible item estimate</th>
              </tr>
            </thead>
            <tbody>
              {data.conceptForecasts
                .filter((c) => c.reviewed > 0 || c.due > 0)
                .map((c) => (
                  <tr key={c.conceptId}>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => {
                          setConcept(c.conceptId);
                          setSelected("");
                        }}
                      >
                        {
                          data.graph.nodes.find((n) => n.id === c.conceptId)
                            ?.name
                        }
                      </button>
                    </td>
                    <td>{c.questions}</td>
                    <td>{c.reviewed}</td>
                    <td>{c.due}</td>
                    <td>
                      {c.probability === null
                        ? "Insufficient data"
                        : `${Math.round(c.probability * 100)}% · heuristic mean`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="fine-print">
          A concept estimate requires at least two linked items, each with
          sufficient delayed reviews. It is an average of item estimates, not a
          measurement of your memory.
        </p>
      </section>
      <section className="panel">
        <h2>Forecast evaluation</h2>
        <p>
          Only outcomes observed after a stored forecast are eligible.
          Parameters are versioned and are never silently retrained.
        </p>
        {data.evaluation.map((e) => (
          <div className="forecast-evaluation" key={e.version}>
            <Badge tone="muted">{e.version}</Badge>
            <h3>{e.status}</h3>
            <p>
              {e.samples} evaluated predictions · at least {e.minimumSamples}{" "}
              are required before discussing calibration. Brier error:{" "}
              {e.brierScore === null
                ? "not available"
                : e.brierScore.toFixed(3)}
              .
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Probability band</th>
                    <th>Samples</th>
                    <th>Mean predicted</th>
                    <th>Observed correct</th>
                  </tr>
                </thead>
                <tbody>
                  {e.bands.map((b) => (
                    <tr key={b.lower}>
                      <td>
                        {Math.round(b.lower * 100)}–{Math.round(b.upper * 100)}%
                      </td>
                      <td>{b.samples}</td>
                      <td>
                        {b.predicted === null
                          ? "—"
                          : `${Math.round(b.predicted * 100)}%`}
                      </td>
                      <td>
                        {b.observed === null
                          ? "—"
                          : `${Math.round(b.observed * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
