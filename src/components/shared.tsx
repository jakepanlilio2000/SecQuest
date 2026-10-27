"use client";
import { type ReactNode } from "react";

import {
  Activity,
  BookOpen,
  BrainCircuit,
  Flame,
  Layers3,
  Network,
  Shield,
  Target,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { overview } from "@/lib/analytics";
import type {
  Feedback,
  Mode,
  PublicQuestion,
  Question,
  Session,
} from "@/lib/types";
export type Overview = Awaited<ReturnType<typeof overview>>;

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  settings: {
    theme: "dark" | "light";
    dailyGoal: number;
    exam: "SY0-801";
    onboarded: boolean;
    targetDate?: string;
    reducedMotion?: boolean;
    avatar?: string;
  };
}

export interface SessionView {
  session: Session;
  completed: boolean;
  index?: number;
  total?: number;
  item?: {
    id: string;
    question: PublicQuestion;
    selected: string[];
    flagged: boolean;
    feedback: Feedback | null;
    retry: boolean;
  };
  navigator?: { id: string; answered: boolean; flagged: boolean }[];
  items?: {
    id: string;
    question: Question;
    selected: string[];
    feedback: Feedback | null;
    flagged: boolean;
    retry: boolean;
  }[];
}

export interface Term {
  term: string;
  definition: string;
  explanation: string;
  examples: string[];
  misconception: string;
  objective: string;
  sources: string[];
  questionId: string;
}

export interface Source {
  id: string;
  name: string;
  publisher: string;
  url: string;
  verifiedAt: string;
  status: string;
  usage: string;
}

export interface Card {
  id: string;
  front: string;
  back: string;
  objective: string;
  due_at: string;
  repetitions: number;
}

export interface Plan {
  targetDate: string;
  minutes: number;
  days: number[];
  notes: Record<string, string>;
}

export interface Sim {
  id: string;
  name: string;
  objective: string;
  description: string;
  brief: string;
  tasks: { id: string; prompt: string }[];
  choices: string[];
}

export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error ?? "Unable to complete request");
  return value;
}

export function Icon({
  icon: I,
  size = 20,
  ...p
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  return <I size={size} strokeWidth={1.8} aria-hidden="true" {...p} />;
}

export function Button({
  children,
  variant = "",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Empty({
  icon = Layers3,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon icon={icon} size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export const modes: {
  id: Mode;
  name: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "learning",
    name: "Adaptive learning",
    description: "Learn a concept. Apply it. Revisit what needs work.",
    icon: BrainCircuit,
  },
  {
    id: "practice",
    name: "Focused practice",
    description: "Build a session around your goals and objectives.",
    icon: Target,
  },
  {
    id: "daily",
    name: "Daily review",
    description: "Due reviews, weak concepts, and a few new challenges.",
    icon: Flame,
  },
  {
    id: "challenge",
    name: "10-minute challenge",
    description: "A timed round to test your security instincts.",
    icon: Zap,
  },
];

export const domainIcons = [Shield, Target, Network, Activity, BookOpen];

export const fmt = (n: number | null | undefined, suffix = "%") =>
  n === null || n === undefined ? "—" : `${n}${suffix}`;

export function fuzzyMatch(query: string, text: string) {
  const q = query.toLowerCase().trim(),
    t = text.toLowerCase();
  if (t.includes(q)) return true;
  if (q.length < 4) return false;
  return t.split(/[^a-z]+/).some((w) => {
    if (Math.abs(w.length - q.length) > 1) return false;
    const row = Array.from({ length: w.length + 1 }, (_, i) => i);
    for (let i = 1; i <= q.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= w.length; j++) {
        const old = row[j];
        row[j] = Math.min(
          row[j] + 1,
          row[j - 1] + 1,
          prev + (q[i - 1] === w[j - 1] ? 0 : 1),
        );
        prev = old;
      }
    }
    return row[w.length] <= 1;
  });
}

export function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseContentCsv(text: string): unknown[] {
  const rows: string[] = [];
  let cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (cell.trim()) rows.push(cell);
      cell = "";
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else cell += c;
  }
  if (quoted) throw Error("CSV has an unterminated quoted field.");
  if (cell.trim()) rows.push(cell);
  if (rows.shift()?.replace(/^\uFEFF/, "") !== "content")
    throw Error(
      "CSV must have the single header content and a quoted JSON question in each row.",
    );
  return rows.map((r, i) => {
    try {
      return JSON.parse(r);
    } catch {
      throw Error(`CSV row ${i + 2} contains invalid JSON.`);
    }
  });
}
