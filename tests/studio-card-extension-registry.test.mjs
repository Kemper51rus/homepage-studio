import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../overlay/src/mods/browser-editor/components/installed-card-extensions.js", import.meta.url),
  "utf8",
);

test("Studio card registry enables backgrounds and service update badges", () => {
  assert.match(source, /cardBackgroundStyle/);
  assert.match(source, /ServiceUpdateBadge/);
  assert.match(source, /homepage-studio-card-backgrounds/);
  assert.match(source, /homepage-studio-service-updates/);
  assert.match(source, /cardTypes: Object\.freeze\(\["bookmark", "service"\]\)/);
});
