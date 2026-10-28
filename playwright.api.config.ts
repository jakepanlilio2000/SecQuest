import { defineConfig } from "@playwright/test";
const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw Error("HTTP E2E fixtures may only target a local test server.");
export default defineConfig({
  testDir: "./tests/http-e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: origin, extraHTTPHeaders: { Origin: origin } },
  outputDir: "test-results/http",
});
