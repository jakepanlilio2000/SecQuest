import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmdirSync } from "node:fs";
import { dirname } from "node:path";
import { isolatedE2EServer } from "../scripts/e2e-server.mjs";

test("E2E owns a fresh SQLite destination and overrides inherited deployment settings", () => {
  const runs = [
    isolatedE2EServer(3100),
    isolatedE2EServer(3100, "http://127.0.0.1:3100"),
    isolatedE2EServer(3001),
  ];
  try {
    assert.equal(new Set(runs.map((run) => run.webServer.env.SQLITE_PATH)).size, 3);
    for (const run of runs) {
      const { webServer, origin } = run;
      const effective = {
        DATABASE_URL: "postgresql://invalid.example/test",
        SMTP_URL: "smtp://invalid.example",
        ...webServer.env,
      };
      assert.equal(effective.DATABASE_URL, "");
      assert.equal(effective.SMTP_URL, "");
      assert.equal(effective.APP_ORIGIN, origin);
      assert.equal(effective.COOKIE_SECURE, "false");
      assert.equal(webServer.reuseExistingServer, false);
      assert.equal(webServer.url, origin);
      assert.ok(existsSync(dirname(effective.SQLITE_PATH)));
      assert.equal(existsSync(effective.SQLITE_PATH), false);
    }
  } finally {
    // Only remove the empty directories returned by this test's own factory.
    for (const run of runs) rmdirSync(dirname(run.webServer.env.SQLITE_PATH));
  }
});

test("E2E rejects existing target overrides and invalid command ports", () => {
  for (const origin of [
    "http://localhost:3100",
    "http://127.0.0.1:3000",
    "https://example.test",
    "",
    "invalid",
  ])
    assert.throws(() => isolatedE2EServer(3100, origin), /E2E_BASE_URL/);
  for (const port of [0, 80, 65536, 3100.5, "3100 --hostname example.test"])
    assert.throws(() => isolatedE2EServer(port), /E2E port/);
});
