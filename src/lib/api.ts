import { randomBytes, randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { NextResponse } from "next/server";
import { db, first } from "./db";
import {
  audit,
  blueprint,
  currentBlueprint,
  fingerprint,
  getQuestion,
  published,
  publicQuestion,
  ready,
  saveRevision,
  validateQuestion as validateContentQuestion,
} from "./content";
import {
  cookie,
  createAuthSession,
  createUser,
  getUser,
  hashPassword,
  hashToken,
  limit,
  lockUser,
  safeUser,
  verifyPassword,
} from "./auth";
import {
  answer,
  AppError,
  readSession,
  sessionAction,
  startSession,
} from "./engine";
import { overview } from "./analytics";
import { simulations } from "../../content/simulations";
import { sources } from "../../content/sources";
import type { Question, User } from "./types";
import { intelligenceRoutes } from "./intelligence-api";
import { exportNotebook } from "./notebook";
function validateQuestion(input: unknown) {
  try {
    return validateContentQuestion(input);
  } catch (e) {
    if (e instanceof ZodError) throw e;
    throw new AppError((e as Error).message);
  }
}
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  password: z.string().min(15, "Use at least 15 characters.").max(128),
});
const uuid = z.string().uuid();
const body = async (req: Request) => {
  const text = await req.text();
  if (text.length > 1_000_000) throw new AppError("Request too large", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("Invalid JSON");
  }
};
function role(user: User, allowed: string[]) {
  if (!allowed.includes(user.role))
    throw new AppError("This action requires a content role.", 403);
}
const editors = ["content_admin", "system_admin"];
const reviewers = ["reviewer", ...editors];
async function adminImport(user: User, input: unknown[]) {
  role(user, editors);
  if (!input.length || input.length > 200)
    throw new AppError("Import between 1 and 200 questions at a time.");
  const entries = input.map((v, i) => {
    try {
      return validateQuestion(v);
    } catch (e) {
      throw new AppError(`Row ${i + 1}: ${(e as Error).message}`);
    }
  });
  const fs = new Set<string>();
  for (const q of entries) {
    if (fs.has(fingerprint(q.prompt)))
      throw new AppError("Duplicate content in this import");
    fs.add(fingerprint(q.prompt));
  }
  await db().transaction(async (tx) => {
    await lockUser(tx, user.id);
    for (const q of entries) {
      if (
        await first(
          tx,
          "SELECT id FROM questions WHERE id=? OR fingerprint=?",
          [q.id, fingerprint(q.prompt)],
        )
      )
        throw new AppError(`Duplicate ID or content: ${q.id}`);
      if (q.revision !== 1)
        throw new AppError("New imports start at revision 1.");
      await tx.run(
        "INSERT INTO questions(id,current_revision,status,fingerprint,created_at) VALUES (?,?,?,?,?)",
        [q.id, 1, "draft", fingerprint(q.prompt), new Date().toISOString()],
      );
      await saveRevision(tx, q, user.id);
    }
    await audit(tx, user.id, "question.import", String(entries.length));
  });
  return { imported: entries.length, status: "draft" };
}
export async function handle(req: Request) {
  try {
    await ready();
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\//, "");
    const method = req.method;
    if (!["GET", "HEAD"].includes(method)) {
      const origin = req.headers.get("origin");
      const allowed = [process.env.APP_ORIGIN ?? url.origin];
      // Next may normalize a loopback listener to localhost in the internal Request.
      // Accept only the two explicit loopback names at the same port in development.
      if (
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
        allowed.push(
          `http://localhost:${url.port || "80"}`,
          `http://127.0.0.1:${url.port || "80"}`,
        );
      if (!origin || !allowed.includes(origin))
        throw new AppError("Request origin is not allowed.", 403);
      if (!req.headers.get("content-type")?.includes("application/json"))
        throw new AppError("Use application/json", 415);
    }
    if (path === "health")
      return json({
        ok: true,
        database: process.env.DATABASE_URL?.startsWith("postgres")
          ? "postgresql"
          : "sqlite",
        exam: blueprint.code,
      });
    if (path === "blueprint" && method === "GET")
      return json({ blueprint: await currentBlueprint(), sources });
    if (path === "auth/register" && method === "POST") {
      const data = credentials
        .extend({ name: z.string().trim().min(2).max(60) })
        .parse(await body(req));
      if (
        !(await limit("register:global", 50, 3600)) ||
        !(await limit(`register:${hashToken(data.email)}`, 3, 3600))
      )
        throw new AppError("Too many requests. Try again later.", 429);
      if (await first(db(), "SELECT id FROM users WHERE email=?", [data.email]))
        throw new AppError(
          "Unable to register with those details. Try signing in.",
        );
      const user = await createUser(data.email, data.name, data.password);
      const token = await createAuthSession(user.id);
      return NextResponse.json(
        { user: safeUser(user) },
        {
          status: 201,
          headers: { "Set-Cookie": cookie(token), "Cache-Control": "no-store" },
        },
      );
    }
    if (path === "auth/login" && method === "POST") {
      const data = credentials.parse(await body(req));
      if (
        !(await limit("login:global", 300, 900)) ||
        !(await limit(`login:${hashToken(data.email)}`, 10, 900))
      )
        throw new AppError("Too many sign-in attempts. Try again later.", 429);
      const user = await first<User>(
        db(),
        "SELECT * FROM users WHERE email=?",
        [data.email],
      );
      const dummy =
        "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
      if (
        !(await verifyPassword(data.password, user?.password_hash ?? dummy)) ||
        !user
      )
        throw new AppError("Email or password is incorrect.", 401);
      const token = await createAuthSession(user.id);
      return NextResponse.json(
        { user: safeUser(user) },
        {
          headers: { "Set-Cookie": cookie(token), "Cache-Control": "no-store" },
        },
      );
    }
    if (path === "auth/reset-request" && method === "POST") {
      const { email } = z.object({ email: z.email() }).parse(await body(req));
      if (!process.env.SMTP_URL)
        throw new AppError(
          "Email recovery is not configured on this installation. Contact its operator.",
          503,
        );
      if (!(await limit(`reset:${hashToken(email.toLowerCase())}`, 3, 3600)))
        throw new AppError("Try again later.", 429);
      const user = await first<User>(
        db(),
        "SELECT * FROM users WHERE email=?",
        [email.toLowerCase()],
      );
      if (user) {
        const token = randomBytes(32).toString("hex");
        await db().transaction(async (tx) => {
          await tx.run("DELETE FROM reset_tokens WHERE user_id=?", [user.id]);
          await tx.run(
            "INSERT INTO reset_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)",
            [
              hashToken(token),
              user.id,
              new Date(Date.now() + 30 * 60000).toISOString(),
            ],
          );
        });
        const { default: nodemailer } = await import("nodemailer");
        await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
          from: process.env.MAIL_FROM,
          to: email,
          subject: "Reset your SecQuest password",
          text: `Reset your password within 30 minutes: ${process.env.APP_ORIGIN ?? url.origin}/?reset=${token}`,
        });
      }
      return json({
        message: "If the account exists, a recovery link has been sent.",
      });
    }
    if (path === "auth/reset" && method === "POST") {
      const { token, password } = z
        .object({
          token: z.string().length(64),
          password: z.string().min(15).max(128),
        })
        .parse(await body(req));
      const hashed = await hashPassword(password);
      await db().transaction(async (tx) => {
        const row = await first<{ user_id: string }>(
          tx,
          "SELECT user_id FROM reset_tokens WHERE token_hash=? AND expires_at>?",
          [hashToken(token), new Date().toISOString()],
        );
        if (!row) throw new AppError("Reset link is invalid or expired.");
        await lockUser(tx, row.user_id);
        await tx.run("UPDATE users SET password_hash=? WHERE id=?", [
          hashed,
          row.user_id,
        ]);
        await tx.run("DELETE FROM reset_tokens WHERE user_id=?", [row.user_id]);
        await tx.run("DELETE FROM auth_sessions WHERE user_id=?", [
          row.user_id,
        ]);
      });
      return json({ message: "Password updated. Sign in to continue." });
    }
    const user = await getUser(req);
    if (!user) throw new AppError("Sign in to continue.", 401);
    if (path === "auth/me" && method === "GET")
      return json({ user: safeUser(user) });
    if (path === "auth/logout" && method === "POST") {
      const token = req.headers
        .get("cookie")
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("sq_session="))
        ?.slice(11);
      if (token)
        await db().transaction((tx) =>
          tx.run("DELETE FROM auth_sessions WHERE token_hash=?", [
            hashToken(token),
          ]),
        );
      return NextResponse.json(
        { ok: true },
        { headers: { "Set-Cookie": cookie("", 0) } },
      );
    }
    if (!(await limit(`api:${user.id}`, 600, 60)))
      throw new AppError("Too many requests. Please slow down.", 429);
    const intelligenceResponse = await intelligenceRoutes(
      req,
      url,
      path,
      user,
      body,
    );
    if (intelligenceResponse) return intelligenceResponse;
    if (path === "overview" && method === "GET")
      return json(await overview(user.id));
    if (path === "catalog" && method === "GET") {
      const page = Math.max(0, Number(url.searchParams.get("page") ?? 0) || 0),
        search = (url.searchParams.get("search") ?? "")
          .slice(0, 100)
          .toLowerCase(),
        domain = url.searchParams.get("domain") ?? "",
        difficulty = url.searchParams.get("difficulty") ?? "",
        type = url.searchParams.get("type") ?? "";
      const conditions = ["q.status='published'"],
        params: (string | number)[] = [];
      if (search) {
        conditions.push("LOWER(r.content) LIKE ?");
        params.push("%" + search.replace(/[%_]/g, "") + "%");
      }
      if (domain) {
        conditions.push(
          "EXISTS (SELECT 1 FROM question_objectives qo WHERE qo.question_id=q.id AND qo.revision=q.current_revision AND qo.objective_id LIKE ?)",
        );
        params.push(`${blueprint.code}:${domain}.%`);
      }
      if (difficulty) {
        conditions.push("r.content LIKE ?");
        params.push(`%"difficulty":"${difficulty.replace(/[^a-z]/g, "")}"%`);
      }
      if (type) {
        conditions.push("r.content LIKE ?");
        params.push(`%"type":"${type.replace(/[^a-z]/g, "")}"%`);
      }
      const from = `FROM questions q JOIN question_revisions r ON r.question_id=q.id AND r.revision=q.current_revision WHERE ${conditions.join(" AND ")}`;
      const rows = await db().all<{ content: string }>(
        `SELECT r.content ${from} ORDER BY q.id LIMIT 12 OFFSET ?`,
        [...params, page * 12],
      );
      const total = await first<{ n: number }>(
        db(),
        `SELECT COUNT(*) AS n ${from}`,
        params,
      );
      return json({
        questions: rows.map((r) => publicQuestion(JSON.parse(r.content))),
        total: Number(total?.n ?? 0),
        page,
      });
    }
    if (path === "sessions" && method === "POST") {
      const input = z
        .object({
          mode: z.enum([
            "learning",
            "practice",
            "recovery",
            "daily",
            "mock",
            "challenge",
          ]),
          count: z.number().int().min(1).max(90).default(12),
          domain: z
            .string()
            .regex(/^[1-5]?$/)
            .optional(),
          objective: z
            .string()
            .regex(/^([1-5]\.\d+)?$/)
            .optional(),
          difficulty: z
            .enum(["", "easy", "medium", "hard", "expert"])
            .optional(),
          type: z
            .enum([
              "",
              "single",
              "multiple",
              "scenario",
              "matching",
              "ordering",
              "log",
            ])
            .optional(),
          category: z.string().max(80).optional(),
          conceptId: z.string().max(100).optional(),
        })
        .parse(await body(req));
      return json(await startSession(user.id, input.mode, input), 201);
    }
    const sessionMatch = path.match(
      /^sessions\/([a-f0-9-]+)(?:\/(answer|action))?$/,
    );
    if (sessionMatch) {
      const id = uuid.parse(sessionMatch[1]);
      if (method === "GET")
        return json(
          await readSession(
            user.id,
            id,
            url.searchParams.has("index")
              ? Number(url.searchParams.get("index")) || 0
              : undefined,
          ),
        );
      if (method === "POST" && sessionMatch[2] === "answer") {
        const a = z
          .object({
            itemId: uuid,
            selected: z.array(z.string().max(40)).max(8),
            confidence: z
              .enum(["knew", "unsure", "guessed"])
              .nullable()
              .default(null),
          })
          .parse(await body(req));
        return json(
          await answer(user.id, id, a.itemId, a.selected, a.confidence),
        );
      }
      if (method === "POST" && sessionMatch[2] === "action") {
        const a = z
          .object({
            action: z.enum(["next", "finish", "flag"]),
            itemId: uuid.optional(),
          })
          .parse(await body(req));
        return json(await sessionAction(user.id, id, a.action, a.itemId));
      }
    }
    if (path === "knowledge" && method === "GET") {
      // Approved stored explanations provide deterministic offline concept retrieval.
      const bank = await published();
      const terms = Array.from(
        new Map(
          bank.map((q) => [
            q.concept,
            {
              term: q.concept,
              definition: q.definition,
              explanation: q.explanation,
              examples: q.examples,
              misconception: q.options.find((o) => !q.correct.includes(o.id))
                ?.explanation,
              objective: q.objective,
              sources: q.sources,
              questionId: q.id,
            },
          ]),
        ).values(),
      );
      return json({ terms, sources });
    }
    if (path === "tutor" && method === "POST") {
      const { query } = z
        .object({ query: z.string().min(2).max(500) })
        .parse(await body(req));
      const bank = await published();
      const words = query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2);
      const ranked = bank
        .map((q) => ({
          q,
          score: words.reduce(
            (n, w) =>
              n +
              (q.concept.toLowerCase().includes(w) ? 5 : 0) +
              (q.definition.toLowerCase().includes(w) ? 1 : 0),
            0,
          ),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return json({
        mode: "verified-content-search",
        message: ranked.length
          ? "Here are related concepts from the stored learning library."
          : "No reliable match in the current library. Try an exact term such as TLS, IDS, Zero Trust, or prompt injection.",
        concepts: ranked.map(({ q }) => ({
          term: q.concept,
          definition: q.definition,
          examples: q.examples,
          objective: q.objective,
          sources: q.sources,
        })),
      });
    }
    if (path === "flashcards" && method === "GET")
      return json({
        cards: await db().all(
          "SELECT * FROM flashcards WHERE user_id=? ORDER BY due_at",
          [user.id],
        ),
      });
    if (path === "flashcards" && method === "POST") {
      const input = z
        .object({
          questionId: z.string().max(90).optional(),
          front: z.string().min(2).max(500).optional(),
          back: z.string().min(2).max(3000).optional(),
          objective: z.string().max(20).optional(),
        })
        .parse(await body(req));
      let { front, back, objective } = input;
      if (input.questionId) {
        const row = await first<{ current_revision: number }>(
          db(),
          "SELECT current_revision FROM questions WHERE id=? AND status='published'",
          [input.questionId],
        );
        if (!row) throw new AppError("Published concept not found");
        const q = await getQuestion(
          db(),
          input.questionId,
          row.current_revision,
        );
        front = q.concept;
        back = q.definition;
        objective = q.objective;
      }
      if (!front || !back)
        throw new AppError("Both sides of a flashcard are required");
      await db().transaction((tx) =>
        tx.run(
          "INSERT INTO flashcards(id,user_id,question_id,front,back,objective,due_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,question_id) DO NOTHING",
          [
            randomUUID(),
            user.id,
            input.questionId ?? null,
            front!,
            back!,
            objective ?? "",
            new Date().toISOString(),
          ],
        ),
      );
      return json({ saved: true });
    }
    const cardMatch = path.match(/^flashcards\/([a-f0-9-]+)$/);
    if (cardMatch && method === "POST") {
      const input = z
        .object({ rating: z.number().int().min(0).max(3) })
        .parse(await body(req));
      await db().transaction(async (tx) => {
        await lockUser(tx, user.id);
        const card = await first<{ interval_days: number; due_at: string }>(
          tx,
          "SELECT * FROM flashcards WHERE id=? AND user_id=?",
          [cardMatch[1], user.id],
        );
        if (!card) throw new AppError("Card not found", 404);
        if (card.due_at > new Date().toISOString())
          throw new AppError(
            "This card is already scheduled. Review when due.",
            409,
          );
        const interval =
          input.rating === 0
            ? 0
            : input.rating === 1
              ? 1
              : Math.max(
                  1,
                  Math.round(
                    (card.interval_days || 1) *
                      (input.rating === 3 ? 2.5 : 1.5),
                  ),
                );
        await tx.run(
          "UPDATE flashcards SET interval_days=?,due_at=?,repetitions=repetitions+1 WHERE id=?",
          [
            interval,
            new Date(
              Date.now() + (interval ? interval * 86400000 : 10 * 60000),
            ).toISOString(),
            cardMatch[1],
          ],
        );
        await tx.run(
          "INSERT INTO flashcard_reviews(id,card_id,rating,created_at) VALUES (?,?,?,?)",
          [randomUUID(), cardMatch[1], input.rating, new Date().toISOString()],
        );
      });
      return json({ saved: true });
    }
    if (path === "plan" && method === "GET") {
      const row = await first<{ data: string }>(
        db(),
        "SELECT data FROM study_plans WHERE user_id=?",
        [user.id],
      );
      return json({ plan: row ? JSON.parse(row.data) : null });
    }
    if (path === "plan" && method === "POST") {
      const input = z
        .object({
          targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          minutes: z.number().int().min(5).max(240),
          days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          notes: z.record(z.string(), z.string().max(500)).default({}),
        })
        .parse(await body(req));
      if (
        !Number.isFinite(Date.parse(input.targetDate)) ||
        Date.parse(input.targetDate) < Date.now() - 86400000
      )
        throw new AppError("Choose a future target date");
      await db().transaction((tx) =>
        tx.run(
          "INSERT INTO study_plans(user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
          [user.id, JSON.stringify(input), new Date().toISOString()],
        ),
      );
      return json({ plan: input });
    }
    if (path === "simulations" && method === "GET")
      return json({
        simulations: simulations.map((s) => ({
          ...s,
          tasks: s.tasks.map(({ id, prompt }) => ({ id, prompt })),
        })),
        history: await db().all(
          "SELECT * FROM simulation_attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
          [user.id],
        ),
      });
    if (path === "simulations" && method === "POST") {
      const a = z
        .object({ id: z.string(), selected: z.record(z.string(), z.string()) })
        .parse(await body(req));
      const sim = simulations.find((s) => s.id === a.id);
      if (!sim) throw new AppError("Simulation not found");
      if (sim.tasks.some((t) => !sim.choices.includes(a.selected[t.id])))
        throw new AppError("Complete each decision first");
      const feedback = sim.tasks.map((t) => ({
        ...t,
        selected: a.selected[t.id],
        correct: t.answer === a.selected[t.id],
      }));
      const score = Math.round(
        (100 * feedback.filter((t) => t.correct).length) / feedback.length,
      );
      await db().transaction(async (tx) => {
        await lockUser(tx, user.id);
        await tx.run(
          "INSERT INTO simulation_attempts(id,user_id,simulation_id,selected,score,created_at) VALUES (?,?,?,?,?,?)",
          [
            randomUUID(),
            user.id,
            sim.id,
            JSON.stringify(a.selected),
            score,
            new Date().toISOString(),
          ],
        );
        if (score === 100) {
          await tx.run(
            "INSERT INTO xp_events(user_id,event_key,amount,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING",
            [user.id, `simulation:${sim.id}`, 30, new Date().toISOString()],
          );
          if (sim.id === "triage")
            await tx.run(
              "INSERT INTO user_achievements(user_id,achievement_id,awarded_at) VALUES (?,?,?) ON CONFLICT(user_id,achievement_id) DO NOTHING",
              [user.id, "incident-commander", new Date().toISOString()],
            );
        }
      });
      return json({ score, feedback });
    }
    if (path === "profile" && method === "PATCH") {
      const input = z
        .object({
          name: z.string().trim().min(2).max(60),
          settings: z.object({
            dailyGoal: z.number().int().min(5).max(240),
            theme: z.enum(["dark", "light"]),
            exam: z.literal("SY0-801"),
            onboarded: z.boolean(),
            reducedMotion: z.boolean().optional(),
            targetDate: z.string().max(10).optional(),
            avatar: z.string().max(8).optional(),
          }),
        })
        .parse(await body(req));
      await db().transaction((tx) =>
        tx.run("UPDATE users SET name=?,settings=? WHERE id=?", [
          input.name,
          JSON.stringify(input.settings),
          user.id,
        ]),
      );
      return json({
        user: safeUser({
          ...user,
          name: input.name,
          settings: JSON.stringify(input.settings),
        }),
      });
    }
    if (path === "profile/password" && method === "POST") {
      const a = z
        .object({
          current: z.string().max(128),
          password: z.string().min(15).max(128),
        })
        .parse(await body(req));
      if (!(await verifyPassword(a.current, user.password_hash)))
        throw new AppError("Current password is incorrect.");
      const hash = await hashPassword(a.password);
      await db().transaction(async (tx) => {
        await tx.run("UPDATE users SET password_hash=? WHERE id=?", [
          hash,
          user.id,
        ]);
        await tx.run("DELETE FROM auth_sessions WHERE user_id=?", [user.id]);
      });
      return NextResponse.json(
        { message: "Password changed. Sign in again." },
        { headers: { "Set-Cookie": cookie("", 0) } },
      );
    }
    if (path === "profile/export" && method === "GET") {
      const exportData: Record<string, unknown> = { profile: safeUser(user) };
      for (const table of [
        "attempts",
        "quiz_sessions",
        "review_schedules",
        "flashcards",
        "study_plans",
        "simulation_attempts",
        "xp_events",
        "user_achievements",
      ])
        exportData[table] = await db().all(
          `SELECT * FROM ${table} WHERE user_id=?`,
          [user.id],
        );
      exportData.session_items = await db().all(
        "SELECT i.* FROM session_items i JOIN quiz_sessions s ON s.id=i.session_id WHERE s.user_id=?",
        [user.id],
      );
      exportData.flashcard_reviews = await db().all(
        "SELECT r.* FROM flashcard_reviews r JOIN flashcards c ON c.id=r.card_id WHERE c.user_id=?",
        [user.id],
      );
      exportData.notebook = (await exportNotebook(user.id)).data;
      for (const table of [
        "misconception_evidence",
        "user_misconception_states",
        "forecast_snapshots",
        "forecast_evaluations",
      ])
        exportData[table] = await db().all(
          `SELECT * FROM ${table} WHERE user_id=?`,
          [user.id],
        );
      return json(exportData);
    }
    if (path === "profile" && method === "DELETE") {
      const { password } = z
        .object({ password: z.string().max(128) })
        .parse(await body(req));
      if (!(await verifyPassword(password, user.password_hash)))
        throw new AppError("Password is incorrect.");
      await db().transaction((tx) =>
        tx.run("DELETE FROM users WHERE id=?", [user.id]),
      );
      return NextResponse.json(
        { deleted: true },
        { headers: { "Set-Cookie": cookie("", 0) } },
      );
    }
    if (path === "admin" && method === "GET") {
      role(user, reviewers);
      const qs = await db().all<{
        id: string;
        status: string;
        content: string;
        created_by: string;
      }>(dbAdminQuery);
      return json({
        blueprint: await currentBlueprint(),
        questions: qs.map((q) => ({ ...q, content: JSON.parse(q.content) })),
        coverage: blueprint.objectives.map((o) => ({
          id: o.id,
          description: o.description,
          count: qs.filter(
            (q) =>
              q.status === "published" &&
              (JSON.parse(q.content) as Question).objective === o.id,
          ).length,
        })),
        sources,
        audit: await db().all(
          "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 30",
        ),
        seedReview:
          "Original starter content: automated consistency checks and source checks; independent SME sign-off remains outstanding.",
      });
    }
    if (path === "admin/import" && method === "POST") {
      const { questions } = z
        .object({ questions: z.array(z.unknown()).max(200) })
        .parse(await body(req));
      return json(await adminImport(user, questions));
    }
    if (path === "admin/question" && method === "POST") {
      role(user, editors);
      const q = validateQuestion(await body(req));
      await db().transaction(async (tx) => {
        await lockUser(tx, user.id);
        const old = await first<{ current_revision: number }>(
          tx,
          "SELECT current_revision FROM questions WHERE id=?",
          [q.id],
        );
        if (old) {
          if (q.revision !== old.current_revision + 1)
            throw new AppError(
              "Use the next revision number; another editor may have updated this question.",
              409,
            );
          await tx.run(
            "UPDATE questions SET current_revision=?,status='draft',fingerprint=? WHERE id=?",
            [q.revision, fingerprint(q.prompt), q.id],
          );
        } else {
          if (q.revision !== 1)
            throw new AppError("New questions start at revision 1");
          await tx.run(
            "INSERT INTO questions(id,current_revision,status,fingerprint,created_at) VALUES (?,?,?,?,?)",
            [q.id, 1, "draft", fingerprint(q.prompt), new Date().toISOString()],
          );
        }
        await saveRevision(tx, q, user.id);
        await audit(tx, user.id, "question.revision", q.id, {
          revision: q.revision,
        });
      });
      return json({ saved: true, status: "draft" });
    }
    if (path === "admin/status" && method === "POST") {
      role(user, reviewers);
      const input = z
        .object({
          id: z.string(),
          status: z.enum([
            "draft",
            "under_review",
            "approved",
            "published",
            "archived",
          ]),
          note: z.string().min(10).max(2000),
        })
        .parse(await body(req));
      await db().transaction(async (tx) => {
        await lockUser(tx, user.id);
        const row = await first<{
          status: string;
          current_revision: number;
          content: string;
          created_by: string;
        }>(tx, dbAdminQuery + " AND q.id=?", [input.id]);
        if (!row) throw new AppError("Question not found");
        const transitions: Record<string, string[]> = {
          draft: ["under_review", "archived"],
          under_review: ["approved", "draft"],
          approved: ["published", "draft", "archived"],
          published: ["archived"],
          archived: ["draft"],
        };
        if (!transitions[row.status]?.includes(input.status))
          throw new AppError(`Cannot move ${row.status} to ${input.status}`);
        if (input.status === "approved" && row.created_by === user.id)
          throw new AppError(
            "A different reviewer must approve this revision.",
            403,
          );
        if (["published", "archived"].includes(input.status))
          role(user, editors);
        validateQuestion(JSON.parse(row.content));
        await tx.run("UPDATE questions SET status=? WHERE id=?", [
          input.status,
          input.id,
        ]);
        await tx.run(
          "INSERT INTO content_reviews(id,question_id,revision,reviewer_id,decision,note,created_at) VALUES (?,?,?,?,?,?,?)",
          [
            randomUUID(),
            input.id,
            row.current_revision,
            user.id,
            input.status,
            input.note,
            new Date().toISOString(),
          ],
        );
        await audit(tx, user.id, "question.status", input.id, input);
      });
      return json({ saved: true });
    }
    if (path === "admin/blueprint" && method === "PATCH") {
      role(user, ["system_admin"]);
      const a = z
        .object({
          revision: z.string().min(1).max(50),
          maxQuestions: z.number().int().min(1).max(90),
          durationMinutes: z.number().int().min(1).max(180),
          note: z.string().min(10).max(1000),
        })
        .parse(await body(req));
      await db().transaction(async (tx) => {
        await lockUser(tx, user.id);
        const row = await first<{ data: string }>(
          tx,
          "SELECT data FROM exam_versions WHERE code=?",
          [blueprint.code],
        );
        const old = JSON.parse(row!.data);
        if (a.revision === old.revision)
          throw new AppError(
            "Choose a new revision identifier for an exam configuration change.",
          );
        const data = { ...old, ...a };
        await tx.run(
          "INSERT INTO blueprint_revisions(exam_code,revision,data,created_at) VALUES (?,?,?,?)",
          [
            blueprint.code,
            a.revision,
            JSON.stringify(data),
            new Date().toISOString(),
          ],
        );
        await tx.run(
          "UPDATE exam_versions SET revision=?,data=? WHERE code=?",
          [a.revision, JSON.stringify(data), blueprint.code],
        );
        await audit(tx, user.id, "blueprint.settings", blueprint.code, a);
      });
      return json({ saved: true });
    }
    throw new AppError("Endpoint not found", 404);
  } catch (e) {
    if (e instanceof ZodError)
      return json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    const message = (e as Error).message;
    if (/UNIQUE|duplicate key/i.test(message))
      return json(
        { error: "This record already exists. Refresh and try again." },
        409,
      );
    console.error(
      JSON.stringify({
        level: "error",
        event: "api.failure",
        path: new URL(req.url).pathname,
        message,
      }),
    );
    return json(
      { error: "The request could not be completed. Please try again." },
      500,
    );
  }
}
const dbAdminQuery =
  "SELECT q.*,r.content,r.created_by FROM questions q JOIN question_revisions r ON r.question_id=q.id AND r.revision=q.current_revision WHERE 1=1";
