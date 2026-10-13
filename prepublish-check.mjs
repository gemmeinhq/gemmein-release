#!/usr/bin/env node
// prepublish-check.mjs — the check every npm publish from this repository runs
// first (each package's prepublishOnly: `node ../prepublish-check.mjs release`).
//
// It runs the release gate of the engine checkout this machine releases from.
// That checkout is named in THIS clone's local git config, never in a
// committed or published file:
//
//   git config gemmein.engine <path to the engine checkout>
//
// No setting, a path without the gate, or a failing gate: the publish stops.

import { spawnSync, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let engine = "";
try {
  engine = execFileSync("git", ["config", "--get", "gemmein.engine"], { cwd: here, encoding: "utf8" }).trim();
} catch {
  engine = "";
}
if (!engine) {
  console.error("REFUSED: no engine checkout is set for this clone. Run `git config gemmein.engine <path to the engine checkout>` here, then publish again.");
  process.exit(1);
}
const root = resolve(here, engine);
const gate = join(root, "ops", "process", "gate.mjs");
if (!existsSync(gate)) {
  console.error(`REFUSED: ${root} has no release gate (ops/process/gate.mjs). Point gemmein.engine at the engine checkout, then publish again.`);
  process.exit(1);
}
const run = spawnSync(process.execPath, [gate, ...process.argv.slice(2)], { cwd: root, stdio: "inherit" });
process.exit(run.status ?? 1);
