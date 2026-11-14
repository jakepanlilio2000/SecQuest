import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handle } from "../src/lib/api";
import { ready } from "../src/lib/content";
import { createUser, createAuthSession } from "../src/lib/auth";
import { db } from "../src/lib/db";

process.env.DATABASE_URL = "";
process.env.SQLITE_PATH = join(
  mkdtempSync(join(tmpdir(), "secquest-catalog-")),
  "synthetic.sqlite",
);

test("learner catalog requires auth, projects metadata only and cannot switch an account", async () => {
  await ready();
  const anon = await handle(
    new Request("http://localhost:3000/api/certifications"),
  );
  assert.equal(anon.status, 401);
  const user = await createUser(
    "catalog@example.test",
    "Synthetic catalog learner",
    "Synthetic catalog testing passphrase!",
  );
  const token = await createAuthSession(user.id);
  const request = (method = "GET") =>
    new Request("http://localhost:3000/api/certifications", {
      method,
      headers: {
        Cookie: `sq_session=${token}`,
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      ...(method === "GET"
        ? {}
        : { body: JSON.stringify({ exam: "N10-009" }) }),
    });
  const before = await db().all("SELECT * FROM users");
  const response = await handle(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const payload = await response.json();
  assert.equal(payload.switchingEnabled, false);
  assert.equal(payload.exams.length, 5);
  for (const exam of payload.exams) {
    assert.deepEqual(
      Object.keys(exam).sort(),
      [
        "code",
        "generationId",
        "certificationName",
        "version",
        "requiredExams",
        "name",
        "availability",
        "checkedOn",
        "bankStatus",
      ].sort(),
    );
  }
  assert.ok(!JSON.stringify(payload).includes(user.email));
  assert.ok(!JSON.stringify(payload).includes(token));
  assert.equal((await handle(request("POST"))).status, 404);
  assert.equal((await handle(request("PATCH"))).status, 404);
  assert.deepEqual(await db().all("SELECT * FROM users"), before);
  assert.equal((await db().all("SELECT * FROM attempts")).length, 0);
});
