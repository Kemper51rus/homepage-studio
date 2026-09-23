import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildComponentRelease } from "../scripts/build-component-release.mjs";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(rootDirectory, "homepage-component.json"), "utf8"));

function expectedReleaseFiles(candidate) {
  return [...new Set([
    "homepage-component.json",
    ...candidate.overlay.files.map((file) => path.posix.join(candidate.overlay.root, file)),
    ...candidate.managedCss.map(({ source }) => source),
    ...candidate.runtimeScripts,
  ])].sort();
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

test("component release is deterministic and contains only declared files", () => {
  const outputDirectory = mkdtempSync(path.join(tmpdir(), "homepage-component-release-"));
  const sensitiveName = `.component-release-sensitive-${process.pid}-${randomBytes(6).toString("hex")}`;
  const sensitivePath = path.join(rootDirectory, sensitiveName);
  writeFileSync(sensitivePath, "must not be published\n", { mode: 0o600 });

  try {
    const first = buildComponentRelease({ rootDirectory, outputDirectory, tag: "test-release" });
    const firstChecksum = sha256(first.artifactPath);
    const second = buildComponentRelease({ rootDirectory, outputDirectory, tag: "test-release" });
    const secondChecksum = sha256(second.artifactPath);

    assert.equal(secondChecksum, firstChecksum);
    assert.equal(second.metadata.sha256, secondChecksum);
    assert.equal(second.metadata.size, readFileSync(second.artifactPath).length);
    assert.deepEqual(Object.keys(second.metadata), [
      "schema",
      "id",
      "version",
      "tag",
      "artifactName",
      "sha256",
      "size",
      "createdAt",
    ]);
    assert.equal(second.metadata.schema, 1);
    assert.equal(second.metadata.id, manifest.id);
    assert.equal(second.metadata.version, manifest.version);
    assert.equal(second.metadata.tag, "test-release");
    assert.equal(second.metadata.artifactName, "homepage-studio-component.tar.gz");
    assert.equal(path.basename(second.artifactPath), "homepage-studio-component.tar.gz");
    assert.equal(path.basename(second.metadataPath), "homepage-component-release.json");
    assert.equal(Number.isNaN(Date.parse(second.metadata.createdAt)), false);

    const storedMetadata = JSON.parse(readFileSync(second.metadataPath, "utf8"));
    assert.deepEqual(storedMetadata, second.metadata);

    const archiveFiles = execFileSync("tar", ["-tzf", second.artifactPath], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();
    assert.deepEqual(archiveFiles, expectedReleaseFiles(manifest));
    assert.equal(archiveFiles.includes(sensitiveName), false);
    assert.equal(archiveFiles.includes("package.json"), false);
  } finally {
    rmSync(sensitivePath, { force: true });
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("component release rejects unsafe tags", () => {
  const outputDirectory = path.join(tmpdir(), `homepage-component-release-invalid-${process.pid}`);
  assert.throws(
    () => buildComponentRelease({ rootDirectory, outputDirectory, tag: "../latest" }),
    /COMPONENT_RELEASE_TAG/,
  );
  rmSync(outputDirectory, { recursive: true, force: true });
});

test("component release rejects a declared symlink escaping its root", () => {
  const workspace = mkdtempSync(path.join(tmpdir(), "homepage-component-symlink-"));
  const fixtureRoot = path.join(workspace, "component");
  mkdirSync(path.join(fixtureRoot, "overlay"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "styles"), { recursive: true });
  mkdirSync(path.join(fixtureRoot, "scripts"), { recursive: true });
  writeFileSync(path.join(workspace, "outside.js"), "secret\n");
  symlinkSync(path.join(workspace, "outside.js"), path.join(fixtureRoot, "overlay", "component.js"));
  writeFileSync(path.join(fixtureRoot, "styles", "component.css"), "body {}\n");
  writeFileSync(path.join(fixtureRoot, "scripts", "runtime.sh"), "#!/bin/sh\n");

  const fixtureManifest = {
    schema: 1,
    id: "fixture-component",
    name: "Fixture component",
    version: "1.0.0",
    requires: { homepageConfigurator: ">=1.0.0", homepage: ">=1.0.0" },
    capabilities: ["dashboard-studio", "card-backgrounds", "service-updates", "three-x-ui"],
    overlay: { root: "overlay", files: ["component.js"] },
    replacesCoreFiles: [],
    apiRoutes: ["/api/config/fixture"],
    managedCss: [{ id: "fixture-css", source: "styles/component.css" }],
    configFiles: [],
    dataDirs: [],
    persistentFiles: [],
    runtimeScripts: ["scripts/runtime.sh"],
    verification: ["node --version"],
  };
  writeFileSync(
    path.join(fixtureRoot, "homepage-component.json"),
    `${JSON.stringify(fixtureManifest, null, 2)}\n`,
  );

  try {
    assert.throws(
      () => buildComponentRelease({ rootDirectory: fixtureRoot, outputDirectory: path.join(workspace, "dist") }),
      /symlink outside the component root/,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
