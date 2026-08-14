#!/usr/bin/env node
// Build a muaz plugin registry index (format v3).
//
// Input:  dist/*.json          — one `muaz plugins pack --json` report per plugin
//         dist/*.zip.minisig   — detached signature, for newly published versions
//         index.json           — the previous index (all versions ever published)
//         yanked.json          — optional ["name@version", ...]
//
// Output: index.json on stdout.
//
// No dependencies, deliberately. This script runs in the same job that holds
// the signing key, so every package it could import is a package that could
// read that key. Plugin metadata comes from `muaz plugins pack --json` rather
// than a YAML parser here, so the index can never disagree with the manifest
// muaz validates at install time.
//
// The index is **append-only over versions**. A published version keeps its
// original url, sha256, and signature forever: pinned installs (`name@version`)
// and anyone re-verifying a recorded hash depend on those bytes staying exactly
// as they were. Withdrawing a version is a `yanked` flag, never a deletion.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const DIST = process.env.DIST_DIR ?? "dist";
const PREVIOUS = process.env.PREVIOUS_INDEX ?? "index.json";
const YANKED = process.env.YANKED_FILE ?? "yanked.json";

// Where a published archive is downloaded from. `{name}` and `{version}` are
// substituted per entry. With GitHub Releases this is the asset URL of the
// per-plugin tag the publish workflow creates.
const URL_TEMPLATE = process.env.URL_TEMPLATE;
if (!URL_TEMPLATE) {
  die(
    "URL_TEMPLATE is required, e.g.\n" +
      "  https://github.com/OWNER/REPO/releases/download/{id}-v{version}/{id}-{version}.zip",
  );
}

function die(message) {
  console.error(message);
  process.exit(1);
}

// A *missing* file legitimately means "first publish". A file that exists but
// does not parse must be fatal: falling back to an empty index would restart
// the serial at 1, and every client that has already recorded a higher one
// would refuse this registry from then on — a self-inflicted rollback.
function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  const text = readFileSync(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (e) {
    die(`${path} exists but is not valid JSON (${e.message}). Refusing to rebuild from scratch.`);
  }
}

// Every entry the index has ever carried, keyed the way a pin is written.
const ref = (name, version) => `${name}@${version}`;

const previous = readJson(PREVIOUS, {});
const published = new Map(
  (previous.plugins ?? []).map((entry) => [ref(entry.name, entry.version), entry]),
);

const reports = existsSync(DIST) ? readdirSync(DIST).sort().filter((f) => f.endsWith(".json")) : [];

for (const file of reports) {
  const meta = JSON.parse(readFileSync(join(DIST, file), "utf8"));
  const { id, name, version, description, sha256 } = meta;
  if (!id || !name || !version || !sha256) {
    die(`${file}: missing id, name, version, or sha256`);
  }

  const pin = ref(name, version);
  const existing = published.get(pin);
  if (existing) {
    // Packing is reproducible, so a differing hash means the source changed
    // without the version being bumped. Carrying the old entry forward would
    // silently publish nothing; overwriting it would rewrite bytes people have
    // already installed and verified. Neither is acceptable — stop and ask for
    // a version bump.
    if (existing.sha256 !== sha256) {
      die(
        `${pin} is already published with sha256 ${existing.sha256}, but the source now packs ` +
          `to ` +
          `${sha256}.\nA published version is immutable — bump the version in ` +
          `plugins/${name}/manifest.yaml.`,
      );
    }
    continue; // unchanged; keep the entry (and signature) exactly as published
  }

  const archive = basename(meta.output);
  const sigPath = join(DIST, `${archive}.minisig`);
  if (!existsSync(sigPath)) {
    // Emitting the entry unsigned would quietly turn a verified install into a
    // community-tier one, and nothing in the index would show that it happened.
    die(`${archive}: no ${archive}.minisig — refusing to index it unsigned`);
  }

  const entry = {
    name,
    version,
    url: URL_TEMPLATE.replaceAll("{id}", id)
      .replaceAll("{name}", name)
      .replaceAll("{version}", version),
    sha256,
    minisign_sig: readFileSync(sigPath, "utf8"),
  };
  if (description) entry.description = description;
  if (meta.muaz) entry.muaz = meta.muaz;
  if (process.env.PUBLISHER_KEY_ID) entry.publisher_key_id = process.env.PUBLISHER_KEY_ID;
  published.set(pin, entry);
}

// An empty index is legitimate — a registry that exists but has published
// nothing yet. Clients must still be able to fetch and verify it, because a
// 404 reads as "this registry is broken/unreachable" rather than "it is empty".
//
// Published entries can never be *dropped* here: `published` starts as the
// previous index and this build only adds to it. What an empty dist/ does mean,
// once anything has been published, is that the pack step produced nothing —
// a broken glob, a failed install, a wrong working directory. The index it
// would emit is harmless but the run that produced it is not, so stop.
if (reports.length === 0 && (previous.plugins ?? []).length > 0) {
  die(
    `${DIST}/ contains no pack reports, but ${PREVIOUS} lists ` +
      `${previous.plugins.length} published version(s). The pack step produced ` +
      `nothing — refusing to rebuild the index from an incomplete run.`,
  );
}

// Yanking is reversible and is applied fresh every build, so removing a line
// from yanked.json un-yanks the version.
const yanked = new Set(readJson(YANKED, []));
for (const [pin, entry] of published) {
  if (yanked.has(pin)) entry.yanked = true;
  else delete entry.yanked;
}

const plugins = [...published.values()].sort((a, b) =>
  a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name),
);

// The serial only ever goes up. Clients record the highest one they have
// accepted and refuse anything lower, which is what stops a captured old index
// from being replayed to hide a security update.
const serial = Number.isInteger(previous.serial) ? previous.serial + 1 : 1;

process.stdout.write(
  `${JSON.stringify(
    {
      serial,
      published_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      plugins,
    },
    null,
    2,
  )}\n`,
);
