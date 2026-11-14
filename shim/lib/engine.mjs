// Fetch-verify-cache-run. Small on purpose: this file is the entire trust
// surface of what executes on a user's machine, and it's shipped as
// readable source so anyone can audit it.
//
// OFFLINE-LAW: the network is touched ONLY when the pinned engine version
// isn't cached yet. Once cached, everything — including every future
// `gemmein dev` — runs fully offline.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

/** No byte of the engine arrived for this long (connecting included): the
 *  download is abandoned with a sentence instead of hanging a first run. */
export const DOWNLOAD_IDLE_MS = 30_000;
const UNREACHABLE = "couldn't download the Gemmein engine — check your connection and run again";

export function engineDir(version, base = join(homedir(), ".gemmein", "engine")) {
  return join(base, version);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** True when every pinned file exists in the cache with the pinned hash. */
export function engineCached(version, files, base) {
  const dir = engineDir(version, base);
  return Object.entries(files).every(([name, hash]) => {
    try { return sha256(readFileSync(join(dir, name))) === hash; } catch { return false; }
  });
}

/**
 * Download the pinned engine and verify BEFORE it lands in the cache.
 * A hash mismatch aborts everything — nothing unverified is ever written
 * to its final location, so nothing unverified can ever run.
 */
export async function fetchEngine(version, files, downloadBase, base, { idleMs = DOWNLOAD_IDLE_MS } = {}) {
  if (Object.values(files).some((h) => !/^[a-f0-9]{64}$/.test(h))) {
    throw new Error(
      "this shim build has no released engine pinned — update the gemmein package (npm i -g gemmein@latest)"
    );
  }
  const dir = engineDir(version, base);
  mkdirSync(dir, { recursive: true });
  // The engine is ESM; without a type marker Node reparses it every run and
  // prints a MODULE_TYPELESS warning at the stranger. Not part of the hash
  // set on purpose: it's cache furniture, not the artifact.
  writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }) + "\n");
  for (const [name, expected] of Object.entries(files)) {
    const url = `${downloadBase}/${version}/${name}`;
    // Every chunk that arrives restarts the clock; silence for idleMs aborts.
    const stop = new AbortController();
    let quiet;
    const moved = () => { clearTimeout(quiet); quiet = setTimeout(() => stop.abort(), idleMs); };
    let res;
    const chunks = [];
    try {
      moved();
      res = await fetch(url, { signal: stop.signal });
      if (res.ok) {
        const reader = res.body.getReader();
        for (;;) {
          moved();
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      }
    } catch {
      throw new Error(UNREACHABLE);
    } finally {
      clearTimeout(quiet);
    }
    if (!res.ok) throw new Error(`couldn't download the Gemmein engine (${res.status} for ${name}) — check your connection and try again`);
    const bytes = Buffer.concat(chunks);
    const actual = sha256(bytes);
    if (actual !== expected) {
      throw new Error(
        `SECURITY: ${name} from the download server does not match the hash pinned in this npm package ` +
        `(expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…). Refusing to run it. ` +
        `This should never happen — please report it: hello@gemmein.com`
      );
    }
    const tmp = join(dir, `${name}.tmp`);
    writeFileSync(tmp, bytes);
    renameSync(tmp, join(dir, name));
  }
  chmodSync(join(dir, "gemmein.js"), 0o755);
}

/** Hand over to the cached engine, argv passed through, cwd preserved. */
export function runEngine(version, args, base) {
  const entry = join(engineDir(version, base), "gemmein.js");
  if (!existsSync(entry)) throw new Error("engine missing after verification — report this: hello@gemmein.com");
  const child = spawn(process.execPath, [entry, ...args], { stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
  return child;
}
