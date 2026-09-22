import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const componentUrl = (fileName) =>
  new URL(
    `../overlay/src/mods/browser-editor/components/${fileName}`,
    import.meta.url,
  );

const dashboardStudioSource = readFileSync(
  componentUrl("dashboard-studio.jsx"),
  "utf8",
);
const editorSource = readFileSync(componentUrl("editor.jsx"), "utf8");

test("Studio and editor import the shared CodeEditor primitive directly", () => {
  assert.doesNotMatch(
    dashboardStudioSource,
    /from\s+["']\.\/editor["']/,
  );
  assert.match(
    dashboardStudioSource,
    /import\s+\{\s*CodeEditor\s*\}\s+from\s+["']\.\/code-editor["']/,
  );
  assert.match(
    editorSource,
    /import\s+\{[^}]*\bCodeEditor\b[^}]*\}\s+from\s+["']\.\/code-editor["']/,
  );
});
