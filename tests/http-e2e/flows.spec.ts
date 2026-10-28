import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { questions } from "../../content/questions";
const password = "Synthetic real HTTP test passphrase!";
test("real HTTP account, practice, durable notebook, private graph, forecast and mock workflow", async ({
  request,
}) => {
  const email = `http-${randomUUID()}@example.test`;
  const registered = await request.post("/api/auth/register", {
    data: { email, name: "HTTP Learner", password },
  });
  expect(registered.status()).toBe(201);
  const { user } = await registered.json();
  expect(user.role).toBe("learner");
  expect(
    (
      await request.patch("/api/profile", {
        data: {
          name: user.name,
          settings: { ...user.settings, onboarded: true },
        },
      })
    ).ok(),
  ).toBeTruthy();
  const sessionResponse = await request.post("/api/sessions", {
    data: { mode: "practice", count: 1, objective: "1.3" },
  });
  expect(sessionResponse.status()).toBe(201);
  const session = await sessionResponse.json();
  const state = await (await request.get(`/api/sessions/${session.id}`)).json();
  const q = questions.find((q) => q.id === state.item.question.id)!;
  expect(q).toBeTruthy();
  const wrong = [
    q.options.find((o) => !q.correct.includes(o.id))!.id,
    ...q.correct.slice(1),
  ];
  const feedback = await (
    await request.post(`/api/sessions/${session.id}/answer`, {
      data: { itemId: state.item.id, selected: wrong, confidence: "knew" },
    })
  ).json();
  expect(feedback.correct).toBe(false);
  expect(feedback.attemptId).toBeTruthy();
  expect(feedback.reviewDue).toBeTruthy();
  const resumed = await (
    await request.get(`/api/sessions/${session.id}`)
  ).json();
  expect(resumed.item.feedback.selected).toEqual(wrong);
  const saved = await request.post("/api/notebook/context", {
    data: { kind: "explanation", questionId: q.id, revision: q.revision },
  });
  expect(saved.ok()).toBeTruthy();
  const note = (await saved.json()).entry;
  const update = {
    id: note.id,
    mutationId: randomUUID(),
    expectedRevision: note.revision,
    title: "My HTTP durable note",
    body: "## Personal explanation\n\nMy own reasoning survives sign-out.",
    conceptId: note.concept_id,
    questionId: q.id,
    questionRevision: q.revision,
  };
  expect(
    (await request.post("/api/notebook/entries", { data: update })).ok(),
  ).toBeTruthy();
  expect(
    (await request.post("/api/notebook/entries", { data: update })).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post("/api/notebook/entries", {
        data: { ...update, mutationId: randomUUID(), body: "Stale draft" },
      })
    ).status(),
  ).toBe(409);
  const card = {
    front: "Explain the control",
    back: "My personal explanation",
  };
  const c1 = await (
    await request.post(`/api/notebook/entries/${note.id}/flashcard`, {
      data: card,
    })
  ).json();
  const c2 = await (
    await request.post(`/api/notebook/entries/${note.id}/flashcard`, {
      data: card,
    })
  ).json();
  expect(c1.card.id).toBe(c2.card.id);
  const intelligence = await (
    await request.get("/api/intelligence?concept=pki")
  ).json();
  expect(intelligence.graph.nodes.length).toBe(58);
  expect(intelligence.path.at(-1).concept.id).toBe("pki");
  expect(
    intelligence.forecasts.find(
      (f: { questionId: string }) => f.questionId === q.id,
    ).dueAt,
  ).toBe(feedback.reviewDue);
  const mock = await (
    await request.post("/api/sessions", {
      data: { mode: "mock", count: 2, objective: "2.6" },
    })
  ).json();
  const draft = await (await request.get(`/api/sessions/${mock.id}`)).json();
  expect(draft.item.question.correct).toBeUndefined();
  expect(draft.item.question.explanation).toBeUndefined();
  const mq = questions.find((q) => q.id === draft.item.question.id)!;
  const draftSave = await (
    await request.post(`/api/sessions/${mock.id}/answer`, {
      data: { itemId: draft.item.id, selected: mq.correct, confidence: null },
    })
  ).json();
  expect(draftSave).toEqual({ saved: true });
  expect(
    (
      await request.post("/api/notebook/context", {
        data: { kind: "explanation", questionId: mq.id, revision: mq.revision },
      })
    ).status(),
  ).toBe(403);
  await request.post(`/api/sessions/${mock.id}/action`, {
    data: { action: "finish" },
  });
  const report = await (await request.get(`/api/sessions/${mock.id}`)).json();
  expect(report.completed).toBe(true);
  expect(report.items.some((i: { feedback: unknown }) => i.feedback)).toBe(
    true,
  );
  expect((await request.get("/api/admin")).status()).toBe(403);
  await request.post("/api/auth/logout", { data: {} });
  expect((await request.get(`/api/notebook/entries/${note.id}`)).status()).toBe(
    401,
  );
  const login = await request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  const durable = await (
    await request.get(`/api/notebook/entries/${note.id}`)
  ).json();
  expect(durable.entry.body).toBe(update.body);
  const history = await (
    await request.get(`/api/notebook/entries/${note.id}/history`)
  ).json();
  expect(history.history.length).toBe(2);
  const restored = await request.post(
    `/api/notebook/entries/${note.id}/restore-revision`,
    { data: { revision: 1, expectedRevision: 2, mutationId: randomUUID() } },
  );
  expect(restored.ok()).toBeTruthy();
  expect((await restored.json()).entry.revision).toBe(3);
  const overview = await (await request.get("/api/overview")).json();
  expect(overview.firstCount).toBeGreaterThanOrEqual(2);
  expect(overview.insights.weeks).toHaveLength(4);
});
test("real HTTP cross-account notebook reads, history and mutations remain private", async ({
  request,
}) => {
  const firstEmail = `http-owner-${randomUUID()}@example.test`;
  await request.post("/api/auth/register", {
    data: { email: firstEmail, name: "Note owner", password },
  });
  const input = {
    id: randomUUID(),
    mutationId: randomUUID(),
    expectedRevision: 0,
    title: "HTTP private sentinel",
    body: "This body belongs only to its owner",
  };
  expect(
    (await request.post("/api/notebook/entries", { data: input })).ok(),
  ).toBeTruthy();
  await request.post("/api/auth/logout", { data: {} });
  await request.post("/api/auth/register", {
    data: {
      email: `http-other-${randomUUID()}@example.test`,
      name: "Other learner",
      password,
    },
  });
  expect(
    (await request.get(`/api/notebook/entries/${input.id}`)).status(),
  ).toBe(404);
  expect(
    (await request.get(`/api/notebook/entries/${input.id}/history`)).status(),
  ).toBe(404);
  expect(
    (
      await request.delete(`/api/notebook/entries/${input.id}`, { data: {} })
    ).status(),
  ).toBe(404);
  const list = await (
    await request.get("/api/notebook?search=HTTP%20private%20sentinel")
  ).json();
  expect(list.total).toBe(0);
  const board = await (
    await request.get("/api/progression/leaderboard")
  ).json();
  expect(JSON.stringify(board)).not.toContain(firstEmail);
});
