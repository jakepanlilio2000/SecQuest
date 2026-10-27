"use client";
import { useEffect, useState } from "react";

import { ArrowRight, CalendarDays } from "lucide-react";

import type { Mode } from "@/lib/types";
import { Overview, Plan, api, Button, Badge, Empty, PageTitle } from "./shared";

export function Planner({
  data,
  start,
  notify,
}: {
  data: Overview | null;
  start: (m: Mode, o?: Record<string, unknown>) => Promise<void>;
  notify: (m: string) => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ plan: Plan | null }>("plan")
      .then((r) => setPlan(r.plan))
      .catch((e) => setError(e.message));
  }, []);
  const weak = [...(data?.objectives ?? [])].sort(
    (a, b) => a.evidence - b.evidence || a.mastery - b.mastery,
  );
  const dates = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  })
    .filter(
      (d) =>
        plan?.days.includes(d.getDay()) &&
        d.toISOString().slice(0, 10) <= plan.targetDate,
    )
    .slice(0, 9);
  async function save(p: Plan) {
    setBusy(true);
    try {
      const r = await api<{ plan: Plan }>("plan", "POST", p);
      setPlan(r.plan);
      notify("Study plan saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR STUDY PLANNER"
        title="A plan that grows with you."
        description="Activities adapt to objective coverage, current mastery, and due reviews. Your target date and notes stay editable."
      />
      {error && <div className="alert error">{error}</div>}
      <section className="panel">
        <form
          key={plan?.targetDate ?? "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({
              targetDate: String(f.get("target")),
              minutes: Number(f.get("minutes")),
              days: f.getAll("days").map(Number),
              notes: plan?.notes ?? {},
            });
          }}
        >
          <div className="form-grid">
            <label>
              Target exam date
              <input
                name="target"
                type="date"
                required
                defaultValue={plan?.targetDate ?? ""}
                min={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Minutes per study day
              <input
                name="minutes"
                type="number"
                min={5}
                max={240}
                required
                defaultValue={plan?.minutes ?? 20}
              />
            </label>
            <fieldset className="days-field full-width">
              <legend>Study days</legend>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    name="days"
                    value={i}
                    defaultChecked={
                      plan ? plan.days.includes(i) : [1, 2, 3, 4, 5].includes(i)
                    }
                  />
                  {d}
                </label>
              ))}
            </fieldset>
          </div>
          <Button type="submit" disabled={busy}>
            {plan ? "Update plan" : "Build my plan"}
            <CalendarDays size={16} />
          </Button>
        </form>
      </section>
      {plan ? (
        <>
          <div className="section-heading quick-heading">
            <h2>Your next study days</h2>
            <Badge>{plan.minutes} minutes per session</Badge>
          </div>
          <div className="calendar-grid">
            {dates.map((date, i) => {
              const key = date.toISOString().slice(0, 10),
                o = weak[i % Math.max(1, weak.length)];
              return (
                <article className="panel day-card" key={key}>
                  <div className="calendar-date">
                    <strong>{date.getDate()}</strong>
                    <span>
                      {date.toLocaleDateString("en", {
                        weekday: "long",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <Badge tone="blue">OBJECTIVE {o?.id ?? "1.1"}</Badge>
                  <h3>{o?.description}</h3>
                  <ul>
                    <li>
                      {Math.max(2, Math.floor(plan.minutes / 3))} focused
                      questions
                    </li>
                    <li>{data?.due ?? 0} due reviews available</li>
                    <li>Summarize one new concept</li>
                    {plan.minutes >= 30 && <li>Optional cyber lab</li>}
                  </ul>
                  <label>
                    Personal note
                    <textarea
                      aria-label={`Note for ${key}`}
                      defaultValue={plan.notes[key] ?? ""}
                      maxLength={500}
                      onBlur={(e) => {
                        if (e.target.value !== (plan.notes[key] ?? ""))
                          save({
                            ...plan,
                            notes: { ...plan.notes, [key]: e.target.value },
                          });
                      }}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      start("daily", {
                        objective: o?.id,
                        count: Math.max(
                          2,
                          Math.min(20, Math.floor(plan.minutes / 3)),
                        ),
                      })
                    }
                  >
                    Start study session
                    <ArrowRight size={15} />
                  </Button>
                </article>
              );
            })}
          </div>
          {!dates.length && (
            <Empty
              icon={CalendarDays}
              title="No study days in the next three weeks"
            >
              Adjust your target date or available weekdays to create the next
              activities.
            </Empty>
          )}
        </>
      ) : (
        <Empty icon={CalendarDays} title="Give your goal a little structure">
          Choose a target date and the days that work for you.
        </Empty>
      )}
    </>
  );
}
