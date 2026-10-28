import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Progress } from "../src/components/ui/progress";
test("registry progress exposes its actual value to assistive technology", () => {
  const html = renderToStaticMarkup(
    createElement(Progress, { value: 40, "aria-label": "Weekly mission" }),
  );
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuenow="40"/);
  assert.match(html, /aria-label="Weekly mission"/);
});
