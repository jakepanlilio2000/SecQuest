"use client";
import { useState, type FormEvent } from "react";

import { useModalFocus } from "./use-modal-focus";
import {
  ArrowDownToLine,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  LogOut,
  Network,
  ShieldCheck,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Profile,
  api,
  Icon,
  Button,
  Badge,
  PageTitle,
  download,
} from "./shared";

export function Landing({
  onAuth,
}: {
  onAuth: (m: "login" | "register") => void;
}) {
  return (
    <div className="landing">
      <header className="landing-header">
        <a className="brand" href="/">
          <span className="brand-icon">
            <ShieldCheck size={26} />
          </span>
          <span>
            sec<span className="brand-accent">quest</span>
          </span>
        </a>
        <span className="landing-nav">
          Learn with purpose. Practice with context.
        </span>
        <Button variant="ghost" onClick={() => onAuth("login")}>
          Sign in <ArrowRight size={16} />
        </Button>
      </header>
      <main>
        <div className="landing-copy">
          <Badge tone="blue">
            <span className="status-dot" /> SECURITY+ SY0-801 · V8 OBJECTIVES
          </Badge>
          <h1>
            Build knowledge.
            <br />
            Develop your
            <br />
            <span>security instinct.</span>
          </h1>
          <p>
            Your next step into cybersecurity starts with understanding. Learn
            from every answer, revisit what matters, and see your skills take
            shape.
          </p>
          <div className="landing-ctas">
            <Button onClick={() => onAuth("register")}>
              Start your quest <ArrowRight size={18} />
            </Button>
            <Button variant="ghost" onClick={() => onAuth("login")}>
              Continue learning
            </Button>
          </div>
          <div className="landing-proof">
            <span>
              <CheckCircle2 size={16} /> Original practice material
            </span>
            <span>
              <CheckCircle2 size={16} /> Progress that persists
            </span>
          </div>
        </div>
        <div className="landing-visual" aria-label="Learning cycle">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="shield-core">
            <ShieldCheck size={100} strokeWidth={1} />
          </div>
          <div className="orbit-card oc-1">
            <BrainCircuit />
            <div>
              <strong>Understand the why</strong>
              <small>Explanations for every answer</small>
            </div>
          </div>
          <div className="orbit-card oc-2">
            <Network />
            <div>
              <strong>Connect your knowledge</strong>
              <small>27 official objectives</small>
            </div>
          </div>
          <div className="orbit-card oc-3">
            <TrendingUp />
            <div>
              <strong>Make it stick</strong>
              <small>Adaptive, spaced review</small>
            </div>
          </div>
        </div>
        <div className="landing-features">
          {[
            [
              BrainCircuit,
              "A wrong answer is a beginning",
              "Get a clear explanation, real examples, and a chance to try again.",
            ],
            [
              Target,
              "Practice with intention",
              "Focus on an objective, recover a weak area, or take a timed mock.",
            ],
            [
              ShieldCheck,
              "Progress backed by evidence",
              "First encounters, retries, and later recall are measured separately.",
            ],
          ].map(([I, title, text]) => (
            <article key={String(title)}>
              <Icon icon={I as LucideIcon} size={24} />
              <h3>{String(title)}</h3>
              <p>{String(text)}</p>
            </article>
          ))}
        </div>
      </main>
      <footer>
        Independent educational platform. Not affiliated with or endorsed by
        CompTIA. Starter content awaits independent SME review.
      </footer>
    </div>
  );
}

export function Auth({
  mode,
  setMode,
  onClose,
  onSuccess,
}: {
  mode: "login" | "register" | "forgot" | "reset";
  setMode: (m: "login" | "register" | "forgot" | "reset") => void;
  onClose: () => void;
  onSuccess: (u: Profile) => Promise<void>;
}) {
  useModalFocus(true, onClose);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (mode === "forgot") {
        const r = await api<{ message: string }>("auth/reset-request", "POST", {
          email: f.get("email"),
        });
        setMessage(r.message);
      } else if (mode === "reset") {
        const r = await api<{ message: string }>("auth/reset", "POST", {
          token: new URLSearchParams(location.search).get("reset"),
          password: f.get("password"),
        });
        setMessage(r.message);
        setMode("login");
        history.replaceState({}, "", "/");
      } else {
        const r = await api<{ user: Profile }>(`auth/${mode}`, "POST", {
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
        });
        await onSuccess(r.user);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Account access"
      >
        <button
          className="modal-close icon-button"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="auth-emblem">
          <ShieldCheck size={32} />
        </span>
        <p className="eyebrow">YOUR SECURITY JOURNEY</p>
        <h2>
          {mode === "register"
            ? "Create your workspace"
            : mode === "forgot"
              ? "Recover your account"
              : mode === "reset"
                ? "Set a new password"
                : "Welcome back, analyst."}
        </h2>
        <p>
          {mode === "register"
            ? "A little practice. A stronger security instinct."
            : "Pick up where your last session left off."}
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {message && <div className="alert success">{message}</div>}
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Display name
              <input
                name="name"
                autoComplete="nickname"
                required
                minLength={2}
                maxLength={60}
                autoFocus
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={15}
                maxLength={128}
                required
              />
              <small>Use a passphrase of at least 15 characters.</small>
            </label>
          )}
          <Button disabled={busy} type="submit">
            {busy
              ? "Working…"
              : mode === "register"
                ? "Create account"
                : mode === "forgot"
                  ? "Send recovery link"
                  : mode === "reset"
                    ? "Update password"
                    : "Sign in"}
            <ArrowRight size={17} />
          </Button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? (
            <>
              <button onClick={() => setMode("forgot")}>
                Forgot password?
              </button>
              <button onClick={() => setMode("register")}>
                Create an account
              </button>
            </>
          ) : (
            <button onClick={() => setMode("login")}>Back to sign in</button>
          )}
        </div>
      </section>
    </div>
  );
}

export function Onboarding({
  user,
  onSave,
}: {
  user: Profile;
  onSave: (u: Profile) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="onboarding">
      <div className="panel">
        <span className="auth-emblem">
          <BrainCircuit size={35} />
        </span>
        <p className="eyebrow">LET’S SET YOUR DIRECTION</p>
        <h1>Your quest, your pace.</h1>
        <p>Start small. Your study plan can change as you learn.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const r = await api<{ user: Profile }>("profile", "PATCH", {
                name: user.name,
                settings: {
                  ...user.settings,
                  exam: "SY0-801",
                  dailyGoal: Number(f.get("goal")),
                  targetDate: f.get("date") || "",
                  onboarded: true,
                },
              });
              onSave(r.user);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Certification
            <select name="exam">
              <option>CompTIA Security+ SY0-801 (V8)</option>
            </select>
          </label>
          <label>
            Daily study goal
            <select name="goal">
              <option value="10">10 minutes · a quick check-in</option>
              <option value="20">20 minutes · a steady habit</option>
              <option value="40">40 minutes · a deeper dive</option>
            </select>
          </label>
          <label>
            Target exam date <small>Optional</small>
            <input
              name="date"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <Button type="submit" disabled={busy}>
            Open my command center <ArrowRight size={18} />
          </Button>
        </form>
        <p className="fine-print">
          V8 objectives verified October 27, 2026. Check CompTIA for exam
          availability before booking.
        </p>
      </div>
    </div>
  );
}

export function Settings({
  user,
  setUser,
  logout,
  go,
  notify,
}: {
  user: Profile;
  setUser: (u: Profile | null) => void;
  logout: () => Promise<void>;
  go: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  useModalFocus(deleting, () => setDeleting(false));
  return (
    <>
      <PageTitle
        eyebrow="MAKE IT YOURS"
        title="Your workspace, your preferences."
        description="Update your profile, study goals, and accessibility preferences."
      />
      {error && <div className="alert error">{error}</div>}
      <section className="panel settings-panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const r = await api<{ user: Profile }>("profile", "PATCH", {
                name: f.get("name"),
                settings: {
                  ...user.settings,
                  dailyGoal: Number(f.get("goal")),
                  theme: f.get("theme"),
                  targetDate: f.get("date") || "",
                  reducedMotion: f.get("motion") === "on",
                },
              });
              setUser(r.user);
              notify("Preferences saved.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="section-heading">
            <h2>Profile & study preferences</h2>
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="form-grid">
            <label>
              Display name
              <input
                name="name"
                defaultValue={user.name}
                required
                minLength={2}
                maxLength={60}
              />
            </label>
            <label>
              Email address
              <input disabled value={user.email} />
            </label>
            <label>
              Daily goal (minutes)
              <input
                name="goal"
                type="number"
                min={5}
                max={240}
                defaultValue={user.settings.dailyGoal}
              />
            </label>
            <label>
              Theme
              <select name="theme" defaultValue={user.settings.theme}>
                <option value="dark">Midnight operations</option>
                <option value="light">Daylight workspace</option>
              </select>
            </label>
            <label>
              Target exam date
              <input
                name="date"
                type="date"
                defaultValue={user.settings.targetDate ?? ""}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="motion"
                defaultChecked={user.settings.reducedMotion}
              />
              Reduce animations
            </label>
          </div>
          <Button type="submit" disabled={busy}>
            Save preferences <Check size={16} />
          </Button>
        </form>
      </section>
      <section className="panel settings-panel">
        <h2>Account security</h2>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await api("profile/password", "POST", {
                current: f.get("current"),
                password: f.get("password"),
              });
              setUser(null);
              notify("Password updated. Sign in again.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Current password
            <input
              type="password"
              name="current"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New passphrase
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={15}
              maxLength={128}
            />
          </label>
          <Button type="submit" variant="ghost" disabled={busy}>
            Change password
          </Button>
        </form>
      </section>
      <section className="panel settings-panel">
        <h2>Your learning data</h2>
        <p>
          Export your profile and learning history as JSON, or permanently
          delete your account.
        </p>
        <div className="button-row">
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                download(
                  "secquest-export.json",
                  JSON.stringify(await api("profile/export"), null, 2),
                  "application/json",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <ArrowDownToLine size={16} />
            Export my data
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            Delete account
          </Button>
          <Button variant="ghost" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </Button>
          {user.role !== "learner" && (
            <Button variant="ghost" onClick={() => go("admin")}>
              Content administration <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </section>
      {deleting && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Delete account"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api("profile", "DELETE", { password: f.get("password") });
                setUser(null);
              } catch (e) {
                setError((e as Error).message);
                setDeleting(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Permanently delete this account?</h2>
            <p>
              Your attempts, schedules, cards, plans, and progression will be
              removed. This cannot be undone.
            </p>
            <label>
              Confirm your password
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </label>
            <div className="button-row">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleting(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={busy}>
                Delete my account
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
