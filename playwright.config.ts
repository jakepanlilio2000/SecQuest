import { defineConfig, devices } from "@playwright/test";
import { isolatedE2EServer } from "./scripts/e2e-server.mjs";
const server = isolatedE2EServer(3100, process.env.E2E_BASE_URL);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 40000,
  use: {
    baseURL: server.origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: server.webServer,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
