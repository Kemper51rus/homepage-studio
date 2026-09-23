#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadAndValidateComponentManifest } from "./validate-component-manifest.mjs";

const thisFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(thisFile), "..");
const releaseTagPattern = /^[0-9A-Za-z](?:[0-9A-Za-z._-]{0,126}[0-9A-Za-z])?$/;

function isWithinRoot(rootDirectory, candidate) {
  const relative = path.relative(rootDirectory, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveReleaseFiles(manifest) {
  return [
    "homepage-component.json",
    ...manifest.overlay.files.map((file) => path.posix.join(manifest.overlay.root, file)),
    ...manifest.managedCss.map(({ source }) => source),
    ...manifest.runtimeScripts,
  ];
}

function validateReleaseFiles(rootDirectory, files) {
  const realRoot = realpathSync(rootDirectory);
  for (const file of files) {
    const candidate = path.resolve(rootDirectory, file);
    const realCandidate = realpathSync(candidate);
    if (!isWithinRoot(realRoot, realCandidate)) {
      throw new Error(`Release file resolves through a symlink outside the component root: ${file}`);
    }
    if (!statSync(realCandidate).isFile()) {
      throw new Error(`Release entry is not a regular file: ${file}`);
    }
  }
}

function normalizeTag(value) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !releaseTagPattern.test(value)) {
    throw new Error("COMPONENT_RELEASE_TAG must contain only safe alphanumeric, dot, underscore, and hyphen characters");
  }
  return value;
}

export function buildComponentRelease(options = {}) {
  const rootDirectory = path.resolve(options.rootDirectory ?? projectRoot);
  const manifestPath = path.resolve(options.manifestPath ?? path.join(rootDirectory, "homepage-component.json"));
  if (manifestPath !== path.join(rootDirectory, "homepage-component.json")) {
    throw new Error("The release manifest must be homepage-component.json at the component root");
  }

  const validation = loadAndValidateComponentManifest(manifestPath, { rootDirectory });
  if (!validation.valid) {
    throw new Error(`Invalid component manifest:\n- ${validation.errors.join("\n- ")}`);
  }

  const tag = normalizeTag(
    options.tag ?? process.env.COMPONENT_RELEASE_TAG ?? `${validation.manifest.id}-v${validation.manifest.version}`,
  );
  const artifactName = "homepage-studio-component.tar.gz";
  const metadataName = "homepage-component-release.json";
  const configuredOutput = options.outputDirectory ?? process.env.COMPONENT_RELEASE_DIR ?? "dist";
  const outputDirectory = path.isAbsolute(configuredOutput)
    ? path.normalize(configuredOutput)
    : path.resolve(rootDirectory, configuredOutput);

  const files = [...new Set(resolveReleaseFiles(validation.manifest))].sort();
  validateReleaseFiles(rootDirectory, files);
  mkdirSync(outputDirectory, { recursive: true });

  const artifactPath = path.join(outputDirectory, artifactName);
  const temporaryArtifactPath = path.join(outputDirectory, `.${artifactName}.${process.pid}.tmp`);
  try {
    execFileSync("tar", [
      "--create",
      "--gzip",
      `--file=${temporaryArtifactPath}`,
      "--sort=name",
      "--mtime=@0",
      "--owner=0",
      "--group=0",
      "--numeric-owner",
      "--format=posix",
      "--pax-option=delete=atime,delete=ctime",
      "--no-recursion",
      "--",
      ...files,
    ], {
      cwd: rootDirectory,
      stdio: "pipe",
    });
    renameSync(temporaryArtifactPath, artifactPath);
  } finally {
    rmSync(temporaryArtifactPath, { force: true });
  }

  const artifact = readFileSync(artifactPath);
  const metadata = {
    schema: 1,
    id: validation.manifest.id,
    version: validation.manifest.version,
    tag,
    artifactName,
    sha256: createHash("sha256").update(artifact).digest("hex"),
    size: artifact.length,
    createdAt: new Date().toISOString(),
  };
  const metadataPath = path.join(outputDirectory, metadataName);
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o644 });

  return { artifactPath, metadataPath, metadata, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  try {
    const result = buildComponentRelease();
    console.log(`Component artifact: ${result.artifactPath}`);
    console.log(`Release metadata: ${result.metadataPath}`);
    console.log(`SHA-256: ${result.metadata.sha256}`);
  } catch (error) {
    console.error(`Unable to build component release: ${error.message}`);
    process.exitCode = 1;
  }
}
