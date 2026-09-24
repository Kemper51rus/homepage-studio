import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const apiSource = readFileSync(
  new URL("../overlay/src/mods/browser-editor/api/editor.js", import.meta.url),
  "utf8",
);
const uiSource = readFileSync(
  new URL("../overlay/src/mods/browser-editor/components/editor.jsx", import.meta.url),
  "utf8",
);

function blockBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("component API uses the target core module and server-only target context", () => {
  assert.match(
    apiSource,
    /import \{ executeComponentOperation, getComponentStatusCatalog \} from "\.\.\/lib\/component-operations"/,
  );
  const catalogRoute = blockBetween(
    apiSource,
    'if (action === "get-component-catalog")',
    'if (action === "run-component-operation")',
  );
  assert.match(catalogRoute, /await requireHomepageTargetDir\(\)/);
  assert.match(
    catalogRoute,
    /getComponentStatusCatalog\(targetDir, \{ env: process\.env \}\)/,
  );
  assert.doesNotMatch(
    catalogRoute,
    /req\.body\.(?:path|target|targetDir|url)|healthcheckUrl/,
  );

  const operationRoute = blockBetween(
    apiSource,
    'if (action === "run-component-operation")',
    'if (action === "localize-icons")',
  );
  assert.match(
    operationRoute,
    /const input = getExactComponentOperationInput\(req\.body\)/,
  );
  assert.match(
    operationRoute,
    /executeComponentOperation\(targetDir, input, \{[\s\S]*?env: process\.env,[\s\S]*?healthcheckUrl: process\.env\.HOMEPAGE_COMPONENT_HEALTHCHECK_URL/,
  );
  assert.doesNotMatch(
    operationRoute,
    /autoRestart|req\.body\.(?:path|target|targetDir|url)|commands\s*:/,
  );
  assert.match(operationRoute, /restartScheduled: true/);
  assert.match(operationRoute, /restartRequired: false/);
  assert.match(operationRoute, /scheduleHomepageRestart\(\)/);
});

test("component API forwards only exact browser body keys", () => {
  assert.match(
    apiSource,
    /new Set\(\[\s*"action",\s*"componentId",\s*"sourceId",\s*"operation",\s*"autoRestart",\s*\]\)/,
  );
  const exactInput = blockBetween(
    apiSource,
    "function getExactComponentOperationInput(body)",
    "async function requireHomepageTargetDir()",
  );
  assert.match(
    exactInput,
    /Object\.keys\(body\)\.find\([\s\S]*componentOperationBodyKeys\.has\(key\)/,
  );
  assert.match(
    exactInput,
    /return \{\s*componentId: body\.componentId,\s*sourceId: body\.sourceId,\s*operation: body\.operation,\s*\}/,
  );
  assert.doesNotMatch(exactInput, /\.\.\.body|autoRestart|\bpath\b|\burl\b/i);
});

test("Studio update panel manages the exact Homepage Studio catalog entry", () => {
  const panel = blockBetween(
    uiSource,
    "function ConfiguratorUpdatePanel({ onSaved, studioMode = false })",
    "function ConfiguratorUpdateModal(",
  );
  assert.match(panel, /data-component-card="homepage-studio"/);
  assert.match(panel, /component\.componentId === "homepage-studio"/);
  assert.match(panel, /component\.sourceId === "github-stable"/);
  assert.match(panel, /installedVersion/);
  assert.match(panel, /availableVersion/);
  assert.match(panel, /availabilityReason/);
  assert.match(panel, /"Install"/);
  assert.match(panel, /"Update"/);
  assert.match(panel, /"Remove"/);
  assert.match(panel, /"Удаление…"/);
  assert.match(panel, /window\.confirm\(/);
  assert.match(panel, /componentBusy \|\| running \|\| updating/);
  assert.match(panel, /data-component-operation-progress/);
  assert.match(panel, /Автоматически перезапускаю Homepage/);
  assert.match(panel, /waitForHomepageRestart\(nextOperation\)/);
  assert.match(panel, /window\.location\.reload\(\)/);
});

test("component operation sends only the fixed browser payload", () => {
  const operation = blockBetween(
    uiSource,
    "async function runComponentOperation(nextOperation)",
    "async function startUpdate()",
  );
  const request = operation.match(/postEditorAction\(\{[\s\S]*?\}\)/)?.[0] ?? "";
  assert.match(
    request,
    /postEditorAction\(\{\s*action: "run-component-operation",\s*componentId: "homepage-studio",\s*sourceId: "github-stable",\s*operation: nextOperation,\s*\}\)/,
  );
  assert.doesNotMatch(
    request,
    /\b(?:url|path|target|targetDir|autoRestart|command|commands)\b/i,
  );
  assert.match(operation, /setComponentCatalog\(result\?\.catalog \?\? \[\]\)/);
  assert.match(
    operation,
    /setRestartRequired\(Boolean\(result\?\.restartRequired\)\)/,
  );
});
