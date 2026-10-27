import { test, expect } from "@playwright/test";
import { questions } from "../../content/questions";
test("account → learning → wrong-answer feedback → refresh → saved progress → mock", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  await page.goto("/");
  await page.getByRole("button", { name: "Start your quest" }).click();
  await page.getByLabel("Display name").fill("Browser Learner");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: false })
    .fill("Synthetic end to end test passphrase!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Open my command center" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back, Browser." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start learning", exact: true })
    .click();
  await expect(page.locator(".question-panel h1")).toBeVisible();
  const prompt = await page.locator(".question-panel h1").innerText();
  const q = questions.find((q) => q.prompt === prompt)!;
  if (q.type === "matching") {
    for (let i = 0; i < q.correct.length; i++)
      await page
        .getByLabel(`Match ${q.pairs![i]}`)
        .selectOption(q.correct[(i + 1) % q.correct.length]);
  } else if (q.type === "ordering") {
    for (const id of [...q.correct].reverse())
      await page
        .getByRole("button", {
          name: q.options.find((o) => o.id === id)!.text,
          exact: false,
        })
        .click();
  } else {
    const wrong = q.options.find((o) => !q.correct.includes(o.id))!;
    await page
      .getByRole("button", {
        name: new RegExp(wrong.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .click();
    for (const id of q.correct.slice(0, q.correct.length - 1))
      await page
        .getByRole("button", {
          name: new RegExp(
            q.options
              .find((o) => o.id === id)!
              .text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          ),
        })
        .click();
  }
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A useful mistake. Let’s unpack it." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Every option, explained" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A useful mistake. Let’s unpack it." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save as flashcard" }).click();
  await expect(page.getByRole("status")).toContainText("Concept saved");
  await page.getByRole("button", { name: "Save & exit" }).click();
  // Navigate through the responsive drawer where needed.
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Mock exams", exact: true }).click();
  await page.getByLabel("Questions", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: "Launch mock exam" }).click();
  await expect(page.locator(".exam-navigator")).toBeVisible();
  await expect(page.locator(".feedback-panel")).toHaveCount(0);
  await expect(
    page.getByText("Your answer is evaluated securely on the server."),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Submit exam", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Submit & see report" }).click();
  await expect(
    page.getByRole("heading", { name: "Every answer is a step forward." }),
  ).toBeVisible();
});
