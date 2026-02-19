#!/usr/bin/env bun

import fs from "fs";
import path from "path";

const indexPath = process.argv[2] || path.join(process.cwd(), "index.json");

function fail(message: string) {
  console.error(message);
  process.exitCode = 1;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpsUrl(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSha256(value: unknown): boolean {
  return isNonEmptyString(value) && /^[a-fA-F0-9]{64}$/.test(value);
}

function isIsoDate(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function assertArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((v) => isNonEmptyString(v));
}

let data: unknown;
try {
  data = JSON.parse(fs.readFileSync(indexPath, "utf8"));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Failed to read ${indexPath}: ${message}`);
  process.exit(1);
}

if (!Array.isArray(data)) {
  fail("index.json must be an array of entries");
  process.exit(1);
}

const seen = new Set<string>();
const allowedSources = new Set(["vendor", "community", "internal"]);

for (const [i, entry] of data.entries()) {
  const prefix = `index.json[${i}]`;
  if (!entry || typeof entry !== "object") {
    fail(`${prefix} must be an object`);
    continue;
  }

  const record = entry as Record<string, unknown>;
  const requiredStrings = ["id", "tool", "version", "description", "signer"];
  for (const key of requiredStrings) {
    if (!isNonEmptyString(record[key])) {
      fail(`${prefix}.${key} must be a non-empty string`);
    }
  }

  if (!assertArrayOfStrings(record.frameworks)) {
    fail(`${prefix}.frameworks must be a non-empty string array`);
  }

  if (!assertArrayOfStrings(record.mappingIds)) {
    fail(`${prefix}.mappingIds must be a non-empty string array`);
  }

  if (!isHttpsUrl(record.packUrl)) {
    fail(`${prefix}.packUrl must be an https URL`);
  }

  if (!isHttpsUrl(record.publicKeyUrl)) {
    fail(`${prefix}.publicKeyUrl must be an https URL`);
  }

  if (!isSha256(record.sha256)) {
    fail(`${prefix}.sha256 must be a 64-char hex string`);
  }

  if (!allowedSources.has(String(record.source))) {
    fail(`${prefix}.source must be one of: vendor, community, internal`);
  }

  if (!isIsoDate(record.createdAt)) {
    fail(`${prefix}.createdAt must be ISO date YYYY-MM-DD`);
  }

  const key = `${record.id}@${record.version}`;
  if (seen.has(key)) {
    fail(`${prefix} duplicates id+version ${key}`);
  }
  seen.add(key);
}

if (process.exitCode && process.exitCode !== 0) {
  console.error("Index validation failed.");
  process.exit(process.exitCode);
}

console.log("Index validation passed.");
