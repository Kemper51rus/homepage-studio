#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COMPONENT_MANIFEST_SCHEMA = 1;
const idPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const semverRangePattern = /^[0-9A-Za-z.*+<>=~^| -]+$/;
const apiRoutePattern = /^\/api\/[A-Za-z0-9_./\[\]-]+$/;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSafeComponentPath(value) {
  if (typeof value !== "string" || !value || value.trim() !== value) return false;
  if (value.includes("\0") || value.includes("\\") || value.includes(":")) return false;
  if (value.startsWith("/") || value.startsWith("~") || path.posix.isAbsolute(value)) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment && segment !== "." && segment !== "..") && path.posix.normalize(value) === value;
}

function pushUniqueStrings(value, location, errors, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(`${location} must be ${allowEmpty ? "an" : "a non-empty"} array`);
    return [];
  }
  const seen = new Set();
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || !entry.trim()) {
      errors.push(`${location}[${index}] must be a non-empty string`);
      continue;
    }
    if (seen.has(entry)) errors.push(`${location} contains duplicate ${JSON.stringify(entry)}`);
    seen.add(entry);
  }
  return [...seen];
}

function validateRepositoryPath(value, location, rootDirectory, errors) {
  if (!isSafeComponentPath(value)) {
    errors.push(`${location} is not a safe repository-relative path`);
    return;
  }
  const candidate = path.resolve(rootDirectory, value);
  const relative = path.relative(rootDirectory, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !existsSync(candidate)) {
    errors.push(`${location} does not resolve to a component file`);
    return;
  }
  const realRoot = realpathSync(rootDirectory);
  const realCandidate = realpathSync(candidate);
  const realRelative = path.relative(realRoot, realCandidate);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    errors.push(`${location} resolves through a symlink outside the component root`);
  }
}

export function validateComponentManifest(manifest, options = {}) {
  const rootDirectory = path.resolve(options.rootDirectory ?? process.cwd());
  const errors = [];
  if (!isRecord(manifest)) return { valid: false, errors: ["manifest must be an object"] };

  if (manifest.schema !== COMPONENT_MANIFEST_SCHEMA) errors.push(`schema must equal ${COMPONENT_MANIFEST_SCHEMA}`);
  if (!idPattern.test(manifest.id ?? "")) errors.push("id must be a lowercase component identifier");
  if (typeof manifest.name !== "string" || !manifest.name.trim()) errors.push("name must be a non-empty string");
  if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    errors.push("version must be semver-like");
  }

  if (!isRecord(manifest.requires)) {
    errors.push("requires section is required");
  } else {
    for (const key of ["homepageConfigurator", "homepage"]) {
      const value = manifest.requires[key];
      if (typeof value !== "string" || !value.trim() || !semverRangePattern.test(value)) {
        errors.push(`requires.${key} must be a safe semver range`);
      }
    }
  }

  const capabilities = pushUniqueStrings(manifest.capabilities, "capabilities", errors);
  for (const required of ["dashboard-studio", "card-backgrounds", "service-updates", "three-x-ui"]) {
    if (!capabilities.includes(required)) errors.push(`missing required capability ${required}`);
  }

  if (!isRecord(manifest.overlay) || !isSafeComponentPath(manifest.overlay.root)) {
    errors.push("overlay.root must be a safe relative path");
  } else {
    validateRepositoryPath(manifest.overlay.root, "overlay.root", rootDirectory, errors);
    const files = pushUniqueStrings(manifest.overlay.files, "overlay.files", errors);
    for (const [index, file] of files.entries()) {
      if (!isSafeComponentPath(file)) errors.push(`overlay.files[${index}] is not a safe relative path`);
      else validateRepositoryPath(path.posix.join(manifest.overlay.root, file), `overlay.files[${index}]`, rootDirectory, errors);
    }
  }

  const routes = pushUniqueStrings(manifest.apiRoutes, "apiRoutes", errors);
  routes.forEach((route, index) => {
    if (!apiRoutePattern.test(route) || route.includes("..")) errors.push(`apiRoutes[${index}] is not a safe API route`);
  });

  if (!Array.isArray(manifest.managedCss) || manifest.managedCss.length === 0) {
    errors.push("managedCss must be a non-empty array");
  } else {
    const ids = new Set();
    manifest.managedCss.forEach((fragment, index) => {
      if (!isRecord(fragment) || !idPattern.test(fragment.id ?? "")) errors.push(`managedCss[${index}].id is invalid`);
      else if (ids.has(fragment.id)) errors.push(`managedCss contains duplicate id ${fragment.id}`);
      else ids.add(fragment.id);
      if (isRecord(fragment)) validateRepositoryPath(fragment.source, `managedCss[${index}].source`, rootDirectory, errors);
    });
  }

  for (const key of ["configFiles", "dataDirs"]) {
    const values = pushUniqueStrings(manifest[key], key, errors);
    values.forEach((value, index) => {
      if (!isSafeComponentPath(value)) errors.push(`${key}[${index}] is not a safe relative path`);
    });
  }
  const scripts = pushUniqueStrings(manifest.runtimeScripts, "runtimeScripts", errors);
  scripts.forEach((value, index) => validateRepositoryPath(value, `runtimeScripts[${index}]`, rootDirectory, errors));
  pushUniqueStrings(manifest.verification, "verification", errors);

  return { valid: errors.length === 0, errors };
}

export function loadAndValidateComponentManifest(manifestPath, options = {}) {
  const absolutePath = path.resolve(manifestPath);
  try {
    const manifest = JSON.parse(readFileSync(absolutePath, "utf8"));
    return { ...validateComponentManifest(manifest, { rootDirectory: options.rootDirectory ?? path.dirname(absolutePath) }), manifest };
  } catch (error) {
    return { valid: false, errors: [`unable to read manifest: ${error.message}`], manifest: null };
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(thisFile), "..", "homepage-component.json");
  const result = loadAndValidateComponentManifest(manifestPath);
  if (!result.valid) {
    console.error(`Invalid component manifest: ${manifestPath}`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`Component manifest is valid: ${manifestPath}`);
  }
}
