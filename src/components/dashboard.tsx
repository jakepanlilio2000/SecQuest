"use client";

import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  Clock3,
  Code2,
  Flame,
  Layers3,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IntelligenceSummary } from "./intelligence-shared";

import type { Mode } from "@/lib/types";
import {
  Overview,
  Profile,
  Icon,
  Button,
  Badge,
  PageTitle,
  domainIcons,
  fmt,
} from "./shared";
export function Dashboard({
  user,
  data,
  start,
  go,
  busy,
}: {
  user: Profile;
  data: Overview;
  start: (m: Mode, o?: Record<string, unknown>) => Promise<void>;
  go: (v: string, e?: string) => void;
  busy: boolean;
}) {
  const active = data.sessions.filter((s) => s.status === "active");
  const studied = data.activity.filter((a) => a.count > 0).length;
  return (
    <>
      <PageTitle
        eyebrow="YOUR COMMAND CENTER"
        title={`Welcome back, ${user.name.split(" ")[0]}.`}
        description="Every concept understood is another layer of defense."
        action={
          <div className="today">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString("en", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        }
      />
      <div className="dashboard-hero">
        <div className="hero-copy">
          <Badge tone="blue">
            <Sparkles size={13} /> YOUR NEXT MOVE
          </Badge>
          <h2>
            Knowledge is your
            <br />
            <span>strongest defense.</span>
          </h2>
          <p>
            {data.uniqueAttempted
              ? `${data.due} reviews are due. Keep your knowledge active with a focused learning session.`
              : "Your security journey starts here. Build a foundation, one well-understood concept at a time."}
          </p>
          <div className="hero-actions">
            <Button disabled={busy} onClick={() => start("learning")}>
              <Play size={16} fill="currentColor" />
              Start learning <ArrowRight size={16} />
            </Button>
            <span>
              <Clock3 size={14} /> At your own pace
            </span>
          </div>
        </div>
        <div className="hero-graphic" aria-hidden="true">
          <div className="radar-grid" />
          <div className="hero-shield">
            <ShieldCheck size={93} strokeWidth={1} />
          </div>
          <span className="float-label fl-one">
            <span className="status-dot" />
            ADAPT · PRACTICE · RETAIN
          </span>
          <span className="float-label fl-two">
            <LockKeyhole size={13} /> SECURITY MINDSET
          </span>
          <div className="corner-mark cm-one" />
          <div className="corner-mark cm-two" />
        </div>
      </div>
      <div className="stats-grid">
        <Metric
          label="FIRST-ATTEMPT ACCURACY"
          value={fmt(data.firstAccuracy)}
          icon={Target}
          detail={
            data.firstCount
              ? `${data.firstCount} independent first encounters`
              : "Your baseline starts with your first question"
          }
          tone="blue"
        />
        <Metric
          label="QUESTIONS EXPLORED"
          value={String(data.uniqueAttempted)}
          icon={Layers3}
          detail={`${data.totalQuestions} original starter questions available`}
          tone="purple"
        />
        <Metric
          label="REVIEWS DUE"
          value={String(data.due)}
          icon={Clock3}
          detail={
            data.due
              ? "Ready for another retrieval"
              : "Your next review will appear here"
          }
          tone="orange"
        />
        <Metric
          label="EXPERIENCE EARNED"
          value={data.xp.toLocaleString()}
          icon={Zap}
          detail={data.rank}
          tone="green"
        />
      </div>
      <IntelligenceSummary key={`${data.firstCount}:${data.retryCount}`} />
      <div className="dashboard-columns">
        <section className="panel domains-panel">
          <div className="section-heading">
            <div>
              <h2>Your security landscape</h2>
              <p>Five domains. One connected skillset.</p>
            </div>
            <button className="text-link" onClick={() => go("skills")}>
              Explore skill tree <ArrowRight size={15} />
            </button>
          </div>
          <div className="domain-list">
            {data.domains.map((d, i) => (
              <button
                className="domain-row"
                key={d.number}
                onClick={() =>
                  start("practice", { domain: String(d.number), count: 10 })
                }
              >
                <span className={`domain-icon color-${i}`}>
                  <Icon icon={domainIcons[i]} />
                </span>
                <div className="domain-info">
                  <div>
                    <span className="domain-number">0{d.number}</span>
                    <strong>{d.name}</strong>
                    <small>{d.weight}% of blueprint</small>
                  </div>
                  <div className="progress-track">
                    <span
                      style={{ width: `${d.mastery}%` }}
                      className={`color-bg-${i}`}
                    />
                  </div>
                  <small>
                    {d.coverage} of {d.totalObjectives} objectives explored
                  </small>
                </div>
                <span className="domain-score">
                  {d.attempts ? `${d.mastery}%` : "—"}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <p className="panel-note">
            Mastery is an evidence-adjusted first-encounter estimate. Unseen
            objectives contribute zero.
          </p>
        </section>
        <aside className="dashboard-right">
          <section className="panel activity-panel">
            <div className="section-heading">
              <h2>Keep showing up</h2>
              <Icon icon={Flame} size={20} />
            </div>
            <p>
              <strong>
                {studied} study {studied === 1 ? "day" : "days"}
              </strong>{" "}
              in the last 7 days
            </p>
            <div className="week-bars">
              {data.activity.map((a) => (
                <div key={a.date} title={`${a.date}: ${a.count} answers`}>
                  <div className="bar-track">
                    <span
                      style={{
                        height: a.count
                          ? `${Math.max(8, (a.count / Math.max(...data.activity.map((b) => b.count), 1)) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <small>{a.label[0]}</small>
                </div>
              ))}
            </div>
            <div className="activity-footer">
              <span>
                <span className="status-dot" />
                Your pace. Your progress.
              </span>
              <small>{data.studyMinutes} min studied</small>
            </div>
          </section>
          <section className="review-callout">
            <span className="callout-icon">
              <BrainCircuit size={22} />
            </span>
            <Badge tone="purple">BUILT TO STICK</Badge>
            <h3>
              Turn mistakes into
              <br />
              your next breakthrough.
            </h3>
            <p>Revisit the concepts that need a little more attention.</p>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => start("recovery")}
            >
              Start weakness recovery <ArrowRight size={15} />
            </button>
          </section>
        </aside>
      </div>
      {active.length > 0 && (
        <section className="panel saved-sessions">
          <div className="section-heading">
            <h2>Pick up where you left off</h2>
            <Badge>{active.length} saved</Badge>
          </div>
          {active.slice(0, 3).map((s) => (
            <button
              className="saved-row"
              key={s.id}
              onClick={() => go("session", `&session=${s.id}`)}
            >
              <Clock3 size={18} />
              <span>
                <strong>
                  {s.mode === "mock"
                    ? "Mock exam"
                    : s.mode.charAt(0).toUpperCase() +
                      s.mode.slice(1) +
                      " session"}
                </strong>
                <small>
                  Started {new Date(s.created_at).toLocaleDateString()}
                </small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </section>
      )}
      <div className="section-heading quick-heading">
        <div>
          <h2>Choose your next mission</h2>
          <p>A different way to put your knowledge to work.</p>
        </div>
        <Badge tone="muted">LEARN BY DOING</Badge>
      </div>
      <div className="mission-grid">
        {[
          {
            icon: Code2,
            title: "Enter the cyber lab",
            desc: "Make decisions in safe, fictional security scenarios.",
            tag: "HANDS-ON",
            view: "simulations",
          },
          {
            icon: Clock3,
            title: "Test your readiness",
            desc: "A timed practice exam. Feedback after submission.",
            tag: "MOCK EXAM",
            view: "mock",
          },
          {
            icon: BookOpen,
            title: "Make it memorable",
            desc: "Build active recall with your personal flashcards.",
            tag: "ACTIVE RECALL",
            view: "flashcards",
          },
        ].map((m) => (
          <button
            className="mission-card"
            key={m.view}
            onClick={() => go(m.view)}
          >
            <span className="mission-icon">
              <Icon icon={m.icon} size={23} />
            </span>
            <span className="eyebrow">{m.tag}</span>
            <h3>{m.title}</h3>
            <p>{m.desc}</p>
            <span className="mission-arrow">
              <ArrowRight size={18} />
            </span>
          </button>
        ))}
      </div>
      <div className="content-status">
        <ShieldCheck size={17} />
        <p>
          <strong>Built on verified objectives.</strong> {data.totalQuestions}{" "}
          original starter questions across 27 objectives. Independent SME
          review and the 600-question target are still in progress.
        </p>
      </div>
    </>
  );
}

export function Metric({
  label,
  value,
  icon,
  detail,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  detail: string;
  tone: string;
}) {
  return (
    <article className="metric">
      <div>
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}>
          <Icon icon={icon} size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
