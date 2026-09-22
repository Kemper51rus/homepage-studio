import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  isSafeComponentPath,
  validateComponentManifest,
} from "../scripts/validate-component-manifest.mjs";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(rootDirectory, "homepage-component.json"), "utf8"));

function validate(candidate) {
  return validateComponentManifest(candidate, { rootDirectory });
}

test("published component manifest is valid and declares all capabilities", () => {
  const result = validate(manifest);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(manifest.id, "homepage-studio");
  assert.deepEqual(manifest.capabilities, [
    "dashboard-studio",
    "card-backgrounds",
    "service-updates",
    "three-x-ui",
  ]);
});

test("component paths reject traversal, absolute paths, Windows paths and URL-like values", () => {
  for (const value of ["../secret", "a/../../secret", "/etc/passwd", "C:\\secret", "https://evil/x", "./file", "a//b", "~/.ssh"]) {
    assert.equal(isSafeComponentPath(value), false, value);
  }
  assert.equal(isSafeComponentPath("src/mods/browser-editor/component.jsx"), true);
});

test("manifest rejects unsafe overlay paths and API routes", () => {
  const candidate = structuredClone(manifest);
  candidate.overlay.files[0] = "../../etc/passwd";
  candidate.apiRoutes[0] = "https://evil.example/api";
  const result = validate(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /overlay\.files\[0\].*safe relative path/);
  assert.match(result.errors.join("\n"), /apiRoutes\[0\].*safe API route/);
});

test("manifest rejects duplicate ownership declarations and missing capabilities", () => {
  const candidate = structuredClone(manifest);
  candidate.overlay.files.push(candidate.overlay.files[0]);
  candidate.capabilities = candidate.capabilities.filter((value) => value !== "service-updates");
  const result = validate(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /overlay\.files contains duplicate/);
  assert.match(result.errors.join("\n"), /missing required capability service-updates/);
});

test("manifest refuses repository paths that do not exist", () => {
  const candidate = structuredClone(manifest);
  candidate.runtimeScripts[0] = "scripts/not-present.sh";
  const result = validate(candidate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /runtimeScripts\[0\].*does not resolve/);
});
