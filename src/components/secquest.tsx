"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Activity,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  GraduationCap,
  LayoutDashboard,
  Layers3,
  Menu,
  Network,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Target,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Mode } from "@/lib/types";
import { Overview, Profile, api, Icon, Badge } from "./shared";
import { Dashboard } from "./dashboard";
import { SessionSetup, LearningSession } from "./learning";
import { QuestionBank, Knowledge, Flashcards } from "./library";
import { Planner } from "./planner";
import { Simulations } from "./simulations";
import { Analytics, SkillTree, Achievements } from "./progression";
import { Landing, Auth, Onboarding, Settings } from "./account";
import { Admin } from "./administration";
import { MisconceptionDashboard } from "./misconceptions";
import { KnowledgeMap } from "./knowledge-map";
import { RetentionForecast } from "./retention";
import { Notebook } from "./notebook";
const nav: { section: string; items: [string, string, LucideIcon][] }[] = [
  {
    section: "WORKSPACE",
    items: [
      ["dashboard", "Command center", LayoutDashboard],
      ["learn", "Learning paths", BrainCircuit],
      ["bank", "Question bank", Layers3],
      ["recovery", "Weakness recovery", Target],
      ["mock", "Mock exams", Clock3],
    ],
  },
  {
    section: "YOUR TOOLKIT",
    items: [
      ["flashcards", "Flashcards", BookOpen],
      ["knowledge", "Knowledge base", GraduationCap],
      ["simulations", "Cyber labs", Code2],
      ["planner", "Study planner", CalendarDays],
    ],
  },
  {
    section: "PROGRESSION",
    items: [
      ["analytics", "Performance", Activity],
      ["skills", "Skill tree", Network],
      ["achievements", "Achievements", Trophy],
    ],
  },
  {
    section: "KNOWLEDGE INTELLIGENCE",
    items: [
      ["misconceptions", "Knowledge gaps", BrainCircuit],
      ["knowledge-map", "Knowledge map", Network],
      ["retention", "Retention forecast", Activity],
    ],
  },
  {
    section: "PERSONAL LEARNING",
    items: [["notebook", "My Notebook", BookOpen]],
  },
];
export default function SecQuest() {
  const router = useRouter(),
    params = useSearchParams(),
    view = params.get("view") ?? "dashboard",
    sessionId = params.get("session");
  const [user, setUser] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [data, setData] = useState<Overview | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [auth, setAuth] = useState<
      "login" | "register" | "forgot" | "reset" | null
    >(null),
    [search, setSearch] = useState(""),
    [notebookDirty, setNotebookDirty] = useState(false);
  useEffect(() => {
    const changed = (event: Event) =>
      setNotebookDirty(!!(event as CustomEvent).detail);
    window.addEventListener("secquest:notebook-dirty", changed);
    return () => window.removeEventListener("secquest:notebook-dirty", changed);
  }, []);
  const go = useCallback(
    (v: string, extra = "") => {
      if (
        notebookDirty &&
        !window.confirm(
          "Your notebook has unsaved changes. A local recovery draft is retained. Leave this editor?",
        )
      )
        return;
      router.push(`/?view=${v}${extra}`);
      setMobile(false);
      setError("");
    },
    [router, notebookDirty],
  );
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 4500);
  };
  const refresh = useCallback(async () => {
    setData(await api<Overview>("overview"));
  }, []);
  useEffect(() => {
    api<{ user: Profile }>("auth/me")
      .then(({ user }) => {
        setUser(user);
        return refresh();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    if (new URLSearchParams(window.location.search).has("reset"))
      setAuth("reset");
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = user?.settings.theme ?? "dark";
    document.documentElement.dataset.motion = user?.settings.reducedMotion
      ? "reduced"
      : "full";
  }, [user]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start(mode: Mode, options: Record<string, unknown> = {}) {
    await run(async () => {
      const s = await api<{ id: string }>("sessions", "POST", {
        mode,
        count: mode === "mock" ? 90 : 12,
        ...options,
      });
      go("session", `&session=${s.id}`);
    });
  }
  async function logout() {
    await run(async () => {
      await api("auth/logout", "POST", {});
      setUser(null);
      setData(null);
      go("dashboard");
    });
  }
  if (loading)
    return (
      <main className="boot">
        <ShieldCheck size={40} />
        <span>Opening your command center…</span>
      </main>
    );
  if (!user)
    return (
      <>
        <Landing onAuth={setAuth} />
        {auth && (
          <Auth
            mode={auth}
            setMode={setAuth}
            onClose={() => setAuth(null)}
            onSuccess={async (u) => {
              setUser(u);
              setAuth(null);
              await refresh();
            }}
          />
        )}
      </>
    );
  if (!user.settings.onboarded)
    return (
      <Onboarding
        user={user}
        onSave={(u) => {
          setUser(u);
          go("dashboard");
        }}
      />
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "visible" : ""}`}>
        <a
          className="brand"
          href="/?view=dashboard"
          onClick={(e) => {
            e.preventDefault();
            go("dashboard");
          }}
        >
          <span className="brand-icon">
            <ShieldCheck size={25} />
          </span>
          <span>
            sec<span className="brand-accent">quest</span>
            <small>BUILD YOUR SECURITY INSTINCT</small>
          </span>
        </a>
        <div className="certification">
          <span className="cert-icon">
            <Shield size={19} />
          </span>
          <span>
            <strong>CompTIA Security+</strong>
            <small>SY0-801 · V8 objectives</small>
          </span>
          <Badge tone="blue">V8</Badge>
        </div>
        <nav aria-label="Main navigation">
          {nav.map((group) => (
            <div className="nav-group" key={group.section}>
              <p>{group.section}</p>
              {group.items.map(([id, label, I]) => (
                <button
                  key={id}
                  className={`nav-link ${view === id || (id === "learn" && view === "session") ? "active" : ""}`}
                  onClick={() => go(id)}
                >
                  <Icon icon={I} size={18} />
                  <span>{label}</span>
                  {id === "recovery" && !!data?.due && <b>{data.due}</b>}
                  {view === id && <span className="nav-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="rank-mini">
            <span>
              <Icon icon={ShieldCheck} />
            </span>
            <div>
              <strong>{data?.rank ?? "Security Recruit"}</strong>
              <small>{data?.xp ?? 0} XP earned</small>
            </div>
          </div>
          <button className="profile-mini" onClick={() => go("settings")}>
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>Personal workspace</small>
            </span>
            <Icon icon={Settings2} size={17} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {view === "session"
                ? "Active session"
                : (nav
                    .flatMap((n) => n.items)
                    .find((n) => n[0] === view)?.[1] ??
                  (view === "admin" ? "Content administration" : "Settings"))}
            </strong>
          </div>
          <div className="topbar-actions">
            <form
              className="top-search"
              onSubmit={(e) => {
                e.preventDefault();
                go("knowledge");
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search concepts"
                placeholder="Search a concept…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <span className="status-dot" />
            <small className="workspace-status">LEARNING WORKSPACE</small>
            <button
              className="icon-button"
              aria-label="Account settings"
              onClick={() => go("settings")}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {error && (
            <div className="alert error" role="alert">
              <XCircle size={18} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {view === "dashboard" && data && (
            <Dashboard
              user={user}
              data={data}
              start={start}
              go={go}
              busy={busy}
            />
          )}
          {(view === "learn" || view === "mock" || view === "recovery") && (
            <SessionSetup
              view={view}
              data={data}
              start={start}
              busy={busy}
              initialObjective={params.get("objective") ?? ""}
            />
          )}
          {view === "session" && sessionId && (
            <LearningSession
              id={sessionId}
              onRefresh={refresh}
              notify={notify}
              onExit={() => go("dashboard")}
            />
          )}
          {view === "bank" && (
            <QuestionBank
              onStart={(q) =>
                start("practice", { count: 10, objective: q.objective })
              }
            />
          )}
          {view === "knowledge" && (
            <Knowledge search={search} setSearch={setSearch} start={start} />
          )}
          {view === "flashcards" && <Flashcards notify={notify} />}
          {view === "planner" && (
            <Planner data={data} start={start} notify={notify} />
          )}
          {view === "simulations" && <Simulations onRefresh={refresh} />}
          {view === "analytics" && data && (
            <Analytics data={data} start={start} />
          )}
          {view === "skills" && data && <SkillTree data={data} start={start} />}
          {view === "achievements" && data && <Achievements data={data} />}
          {view === "settings" && (
            <Settings
              user={user}
              setUser={setUser}
              logout={logout}
              go={go}
              notify={notify}
            />
          )}
          {view === "admin" && <Admin user={user} />}
          {view === "misconceptions" && (
            <MisconceptionDashboard initialId={params.get("misconception")} />
          )}
          {view === "knowledge-map" && (
            <KnowledgeMap
              key={params.get("concept") ?? "pki"}
              initialConcept={params.get("concept")}
            />
          )}
          {view === "retention" && <RetentionForecast />}
          {view === "notebook" && (
            <Notebook
              user={user}
              entryId={params.get("entry")}
              conceptId={params.get("concept")}
            />
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={13} /> Independent learning. Real progress.
            </span>
            <span>Aligned to SY0-801 V8 · Unofficial practice material</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
