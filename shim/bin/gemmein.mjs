#!/usr/bin/env node
// gemmein — thin launcher. Downloads the Gemmein local engine once,
// verifies it against hashes baked into this package, caches it, runs it.
// Everything real happens in the engine, locally, offline.

import { ENGINE_VERSION, ENGINE_FILES, DOWNLOAD_BASE } from "../lib/versions.mjs";
import { engineCached, fetchEngine, runEngine } from "../lib/engine.mjs";

const major = Number(process.versions.node.split(".")[0]);
if (major < 18) {
  console.error(`\ngemmein needs Node 18 or newer (you're on ${process.versions.node}).`);
  console.error(`Upgrade at nodejs.org, then run this again.\n`);
  process.exit(1);
}

const args = process.argv.slice(2);

try {
  if (!engineCached(ENGINE_VERSION, ENGINE_FILES)) {
    console.log(`Fetching the Gemmein engine (v${ENGINE_VERSION}, one time — everything runs locally after this)…`);
    await fetchEngine(ENGINE_VERSION, ENGINE_FILES, DOWNLOAD_BASE);
    console.log("Verified and cached. You're set — this never needs the network again.\n");
  }
  runEngine(ENGINE_VERSION, args);
} catch (error) {
  console.error(`\n${error.message}\n`);
  process.exit(1);
}
