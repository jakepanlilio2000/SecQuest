import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("certifications disclose readiness and retain the current workspace across states", async ({
  page,
  baseURL,
}, testInfo) => {
  const headers = { Origin: baseURL! };
  const registration = await page.request.post("/api/auth/register", {
    headers,
    data: {
      email: `catalog-${randomUUID()}@example.test`,
      name: "Catalog Learner",
      password: "Synthetic browser catalog passphrase!",
    },
  });
  expect(registration.status()).toBe(201);
  const { user } = await registration.json();
  const settings = { ...user.settings, onboarded: true };
  expect(
    (
      await page.request.patch("/api/profile", {
        headers,
        data: { name: user.name, settings },
      })
    ).ok(),
  ).toBeTruthy();

  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/certifications", async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/?view=certifications");
    await expect(page.getByRole("status")).toContainText(
      "Loading certifications",
    );
  } finally {
    release();
  }
  await expect(page.locator(".cert-card")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Study not available yet" }),
  ).toHaveCount(3);
  for (const button of await page
    .getByRole("button", { name: "Study not available yet" })
    .all())
    await expect(button).toBeDisabled();
  await expect(
    page.getByText(
      "Requires both Core 1 and Core 2 from the same V15 generation.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Upcoming exam", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("certifications.png"),
    fullPage: true,
  });
  const continueButton = page.getByRole("button", {
    name: "Continue current study",
  });
  await continueButton.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/view=learn/);

  await page.unroute("**/api/certifications");
  let scenario: "error" | "empty" = "error";
  await page.route("**/api/certifications", (route) =>
    scenario === "error"
      ? route.fulfill({
          status: 503,
          json: { error: "Temporary catalog interruption" },
        })
      : route.fulfill({ json: { switchingEnabled: false, exams: [] } }),
  );
  await page.goto("/?view=certifications");
  await expect(
    page.getByRole("alert", { name: "Certification catalog error" }),
  ).toContainText("Certifications could not be loaded");
  scenario = "empty";
  await page.getByRole("button", { name: "Try again" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "No certifications listed yet" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue current study" }),
  ).toBeVisible();
  const profile = await (await page.request.get("/api/auth/me")).json();
  expect(profile.user.settings).toEqual(settings);
});
