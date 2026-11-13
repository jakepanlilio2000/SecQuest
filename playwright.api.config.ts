import { defineConfig } from "@playwright/test";
import { isolatedE2EServer } from "./scripts/e2e-server.mjs";
const server = isolatedE2EServer(3001, process.env.E2E_BASE_URL);
const origin = server.origin;
export default defineConfig({
  testDir: "./tests/http-e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  reporter: "list",
  use: { baseURL: origin, extraHTTPHeaders: { Origin: origin } },
  webServer: server.webServer,
  outputDir: "test-results/http",
});
