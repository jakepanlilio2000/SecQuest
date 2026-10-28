"use client";

import {
  ArrowRight,
  BrainCircuit,
  Flag,
  ShieldCheck,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import type { Mode } from "@/lib/types";
import {
  Overview,
  Icon,
  Badge,
  Empty,
  PageTitle,
  domainIcons,
  fmt,
} from "./shared";
import { Metric } from "./dashboard";
import { ProgressionCenter } from "./completion";
export function Analytics({
  data,
  start,
}: {
  data: Overview;
  start: (m: Mode, o?: Record<string, unknown>) => Promise<void>;
}) {
  const weak = data.objectives
    .filter((o) => o.evidence > 0)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 5);
  return (
    <>
      <PageTitle
        eyebrow="PERFORMANCE INTELLIGENCE"
        title="See the evidence behind your progress."
        description="Independent first encounters, recent retries, and delayed retrieval each tell a different story."
      />
      <div className="stats-grid">
        <Metric
          label="FIRST ENCOUNTERS"
          value={fmt(data.firstAccuracy)}
          detail={`${data.firstCount} first-attempt answers`}
          icon={Target}
          tone="blue"
        />
        <Metric
          label="RETRY ACCURACY"
          value={fmt(data.retryAccuracy)}
          detail={`${data.retryCount} repeated-question answers`}
          icon={TrendingUp}
          tone="purple"
        />
        <Metric
          label="DELAYED RECALL"
          value={fmt(data.retentionAccuracy)}
          detail={`${data.retentionCount} reviews after ≥24 hours`}
          icon={BrainCircuit}
          tone="green"
        />
        <Metric
          label="STRONGLY RETAINED"
          value={String(data.mastered)}
          detail="Multiple independent delayed successes"
          icon={ShieldCheck}
          tone="orange"
        />
      </div>
      <div className="analytics-grid">
        <section className="panel full-span">
          <div className="section-heading">
            <h2>Four weeks of observed learning</h2>
            <Badge>UTC dates</Badge>
          </div>
          <p>
            First encounters and delayed reviews remain separate. Empty weeks
            contain no inferred scores.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Week starting</th>
                  <th>Answers</th>
                  <th>First encounters</th>
                  <th>First accuracy</th>
                  <th>Delayed reviews</th>
                  <th>Delayed accuracy</th>
                </tr>
              </thead>
              <tbody>
                {data.insights.weeks.map((w) => (
                  <tr key={w.start}>
                    <td>{w.start.slice(0, 10)}</td>
                    <td>{w.attempts}</td>
                    <td>{w.firsts}</td>
                    <td>{fmt(w.firstAccuracy)}</td>
                    <td>{w.delayed}</td>
                    <td>{fmt(w.delayedAccuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fine-print">
            {data.firstAccuracyInterval
              ? `Observed first-answer accuracy: 95% Wilson interval ${data.firstAccuracyInterval.lower}–${data.firstAccuracyInterval.upper}% over ${data.firstAccuracyInterval.samples} answers.`
              : "No first-answer sample exists yet."}{" "}
            Questions are not a random exam sample; this interval is descriptive
            and does not predict a pass.
          </p>
        </section>
        <section className="panel full-span">
          <h2>Response time by objective</h2>
          <p>
            Median server-measured elapsed time for first encounters. It can
            include idle time and is not a measure of focused study.
          </p>
          {data.insights.objectives.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Objective</th>
                    <th>Timed samples</th>
                    <th>Median elapsed</th>
                    <th>Observed accuracy interval</th>
                  </tr>
                </thead>
                <tbody>
                  {data.insights.objectives.map((o) => (
                    <tr key={o.objective}>
                      <td>{o.objective}</td>
                      <td>{o.samples}</td>
                      <td>
                        {o.samples >= 3
                          ? `${o.medianSeconds}s`
                          : "Insufficient timed evidence"}
                      </td>
                      <td>
                        {o.interval
                          ? `${o.interval.lower}–${o.interval.upper}% (n=${o.interval.samples})`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No timed evidence yet">
              Answer questions to establish a baseline.
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Readiness, with context</h2>
            <Badge tone="muted">UNOFFICIAL ESTIMATE</Badge>
          </div>
          <h3 className="readiness-number">
            {data.readiness.score === null
              ? "Building evidence"
              : `${data.readiness.score}%`}
          </h3>
          <p>{data.readiness.criteria}</p>
          {data.readiness.factors.map((f) => (
            <div className="factor-row" key={f.name}>
              <div>
                <span>{f.name}</span>
                <small>{f.weight}% weight</small>
              </div>
              <div className="progress-track">
                <span style={{ width: `${f.value}%` }} />
              </div>
              <strong>{f.value}%</strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Where to focus next</h2>
            <Icon icon={Target} />
          </div>
          {weak.length ? (
            weak.map((o) => (
              <button
                className="weak-row"
                key={o.id}
                onClick={() => start("recovery", { objective: o.id, count: 5 })}
              >
                <Badge tone="orange">{o.id}</Badge>
                <span>
                  <strong>{o.description}</strong>
                  <small>
                    {o.evidence} independent questions ·{" "}
                    {o.evidence < 3
                      ? "limited evidence"
                      : "developing evidence"}{" "}
                    · {o.misses} mistakes
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))
          ) : (
            <Empty icon={Target} title="Your baseline is still taking shape">
              Complete a learning session to reveal useful focus areas.
            </Empty>
          )}
        </section>
        <section className="panel">
          <h2>First accuracy by difficulty</h2>
          {data.byDifficulty.map((d) => (
            <div className="difficulty-row" key={d.difficulty}>
              <span>{d.difficulty}</span>
              <div className="progress-track">
                <span style={{ width: `${d.accuracy ?? 0}%` }} />
              </div>
              <strong>{fmt(d.accuracy)}</strong>
              <small>{d.count} questions</small>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Last seven study days</h2>
          <div className="analytics-bars">
            {data.activity.map((a) => (
              <div key={a.date}>
                <strong>{a.count}</strong>
                <span
                  style={{
                    height: `${Math.max(2, (a.count / Math.max(...data.activity.map((x) => x.count), 1)) * 120)}px`,
                  }}
                />
                <small>{a.label}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Recent answer history</h2>
          <Badge>{data.attempts.length} most recent</Badge>
        </div>
        {data.attempts.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Concept</th>
                  <th>Objective</th>
                  <th>Evidence</th>
                  <th>Result</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {data.attempts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.concept}</td>
                    <td>{a.objective}</td>
                    <td>
                      {a.first_attempt
                        ? "First encounter"
                        : a.retention
                          ? "Delayed review"
                          : "Retry"}
                    </td>
                    <td>
                      <Badge tone={a.correct ? "green" : "orange"}>
                        {a.correct ? "Correct" : "Needs review"}
                      </Badge>
                    </td>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Your history starts with one question">
            Each submitted answer will be recorded here.
          </Empty>
        )}
      </section>
      <section className="panel">
        <h2>Mock examination history</h2>
        {data.sessions
          .filter((s) => s.mode === "mock" && s.status === "completed")
          .map((s) => (
            <div className="library-card-row" key={s.id}>
              <strong>{new Date(s.created_at).toLocaleString()}</strong>
              <Badge tone="green">
                {data.mockHistory.find((h) => h.id === s.id)?.accuracy ?? 0}%
                raw accuracy
              </Badge>
            </div>
          ))}
        {!data.sessions.some(
          (s) => s.mode === "mock" && s.status === "completed",
        ) && <p>No submitted mock exams yet.</p>}
      </section>
    </>
  );
}

export function SkillTree({
  data,
  start,
}: {
  data: Overview;
  start: (m: Mode, o?: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <>
      <PageTitle
        eyebrow="YOUR CONNECTED SKILLSET"
        title="Watch your knowledge take shape."
        description="Every node is an official objective. States reflect actual first-encounter evidence and due reviews."
      />
      <div className="skill-legend">
        <Badge>Not started</Badge>
        <Badge tone="blue">Learning</Badge>
        <Badge tone="orange">Needs review</Badge>
        <Badge tone="green">Developing</Badge>
      </div>
      <div className="skill-tree">
        {data.domains.map((d, i) => (
          <section className="skill-branch" key={d.number}>
            <div className={`skill-domain color-${i}`}>
              <Icon icon={domainIcons[i]} size={26} />
              <strong>{d.name}</strong>
              <small>
                {d.coverage} / {d.totalObjectives} objectives explored
              </small>
            </div>
            <div className="skill-nodes">
              {data.objectives
                .filter((o) => o.id[0] === String(d.number))
                .map((o) => (
                  <button
                    key={o.id}
                    className={`skill-node ${o.evidence ? "explored" : ""}`}
                    onClick={() =>
                      start("practice", { objective: o.id, count: 5 })
                    }
                  >
                    <span>{o.id}</span>
                    <strong>{o.description}</strong>
                    <Badge
                      tone={
                        o.state === "Needs review"
                          ? "orange"
                          : o.evidence
                            ? "blue"
                            : "muted"
                      }
                    >
                      {o.state}
                    </Badge>
                    <small>
                      {o.evidence
                        ? `${o.mastery}% evidence-adjusted estimate · ${o.evidence} first encounters`
                        : "No evidence yet"}
                    </small>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export function Achievements({
  data,
  onRefresh,
}: {
  data: Overview;
  onRefresh?: () => Promise<void>;
}) {
  return (
    <>
      <PageTitle
        eyebrow="MARK THE MILESTONES"
        title="Earned through understanding."
        description="Progress celebrates meaningful learning. Essential content is always available, regardless of rank."
        action={
          <Badge tone="green">
            {data.achievements.filter((a) => a.earnedAt).length} /{" "}
            {data.achievements.length} earned
          </Badge>
        }
      />
      <div className="rank-banner panel">
        <ShieldCheck size={53} />
        <div>
          <p className="eyebrow">YOUR CURRENT RANK</p>
          <h2>{data.rank}</h2>
          <p>{data.xp} XP · a record of your learning effort</p>
        </div>
      </div>
      <div className="achievement-grid">
        <div className="full-span">
          <ProgressionCenter onRefresh={onRefresh} />
        </div>
        {data.achievements.map((a, i) => (
          <article
            className={`panel achievement ${a.earnedAt ? "earned" : ""}`}
            key={a.id}
          >
            <div className="achievement-emblem">
              <Icon icon={[ShieldCheck, Zap, Target, Flag][i % 4]} size={30} />
            </div>
            <Badge tone={a.earnedAt ? "green" : "muted"}>
              {a.earnedAt ? "EARNED" : "IN PROGRESS"}
            </Badge>
            <h2>{a.name}</h2>
            <p>{a.description}</p>
            <small>
              {a.earnedAt
                ? new Date(a.earnedAt).toLocaleDateString()
                : "Your next milestone is waiting."}
            </small>
          </article>
        ))}
      </div>
    </>
  );
}
