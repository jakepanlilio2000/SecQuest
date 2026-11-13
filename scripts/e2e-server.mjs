import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each Playwright invocation owns a fresh database. Never reuse a listening app:
// a loopback address says nothing about which learner database it is using.
export function isolatedE2EServer(port, requestedOrigin) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Use an unprivileged local E2E port.");
  const origin = `http://127.0.0.1:${port}`;
  if (requestedOrigin !== undefined && requestedOrigin !== origin)
    throw Error(
      "E2E_BASE_URL cannot target an existing server. E2E starts its own isolated instance.",
    );
  const directory = mkdtempSync(join(tmpdir(), "secquest-e2e-"));
  return {
    origin,
    webServer: {
      command: `npm run dev -- --port ${port}`,
      url: origin,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: "",
        SQLITE_PATH: join(directory, "test.sqlite"),
        APP_ORIGIN: origin,
        COOKIE_SECURE: "false",
        SMTP_URL: "",
      },
    },
  };
}
