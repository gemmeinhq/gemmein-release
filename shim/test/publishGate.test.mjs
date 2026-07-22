// THE SHIM PUBLISH GATE — the hash law, enforced, not documented.
//
// Packs the REAL tarball npm would serve and statically proves, on the
// shipped bytes:
//   1. the engine hashes are COMPILE-TIME LITERALS (versions.mjs contains
//      only literal pins — no fetch, no import, no computation), and
//   2. the ONLY network call in the entire package is fetchEngine's, whose
//      bytes are hash-verified before they ever reach the cache.
// A future change that lets a hash arrive via any runtime path fails here.

import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SHIM = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("the packed shim enforces the compile-time hash law", () => {
  const work = mkdtempSync(join(tmpdir(), "shim-gate-"));
  try {
    const tgz = join(work, execFileSync("npm", ["pack", "--pack-destination", work], { cwd: SHIM, encoding: "utf8" }).trim().split("\n").pop());
    execFileSync("tar", ["xzf", tgz, "-C", work]);
    const pkg = join(work, "package");
    const files = walk(pkg);
    const sources = files.filter((f) => /\.(mjs|js|cjs)$/.test(f));
    const read = (f) => readFileSync(f, "utf8");

    // versions.mjs ships, and is PURE LITERALS: no imports, no fetch, no
    // template strings, no function calls — the pins cannot be computed or
    // fetched, only written by the promotion ritual.
    const versionsPath = files.find((f) => f.endsWith("lib/versions.mjs"));
    assert.ok(versionsPath, "versions.mjs must ship in the package");
    // Scan CODE only — comments can't grant powers, so they can't trip laws.
    const versions = read(versionsPath).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    for (const forbidden of ["import", "fetch", "require", "process", "`", "(", "await"]) {
      assert.ok(!versions.includes(forbidden), `versions.mjs must be pure literals — found "${forbidden}"`);
    }
    assert.match(versions, /ENGINE_FILES\s*=\s*\{/, "versions.mjs pins ENGINE_FILES");
    for (const [, value] of versions.matchAll(/"[^"]+":\s*"([^"]+)"/g)) {
      assert.match(value, /^([a-f0-9]{64}|TBD)$/, `pin values are 64-hex literals (or the fail-closed TBD): got "${value}"`);
    }

    // Exactly ONE fetch call site in the whole shipped package, and it
    // lives in fetchEngine (the verify-before-cache path).
    const fetchSites = sources.flatMap((f) =>
      [...read(f).matchAll(/fetch\(/g)].map(() => f.replace(pkg + "/", ""))
    );
    assert.deepEqual(fetchSites, ["lib/engine.mjs"], `the only network call is fetchEngine's (found: ${fetchSites.join(", ") || "none"})`);
    const engine = read(files.find((f) => f.endsWith("lib/engine.mjs")));
    const fetchAt = engine.indexOf("await fetch(");
    const verifyAt = engine.indexOf("sha256(bytes)", fetchAt);
    const cacheAt = engine.indexOf("renameSync(", verifyAt); // the call, not the import
    assert.ok(fetchAt < verifyAt && verifyAt < cacheAt, "structure holds: fetch → verify → only then cache");

    // No alternate hash sources or download bases sneak into the package.
    for (const f of sources) {
      const text = read(f);
      for (const marker of ["releases.json", "manifest", "http://"]) {
        assert.ok(!text.includes(marker), `forbidden marker "${marker}" in shipped ${f.replace(pkg + "/", "")}`);
      }
    }
    const urls = sources.flatMap((f) => [...read(f).matchAll(/https:\/\/[^"'`\s]+/g)].map((m) => m[0]));
    assert.deepEqual([...new Set(urls)], ["https://downloads.gemmein.com/engine"], `the only URL in the package is the download base (found: ${urls.join(", ")})`);

    // Tests never ship (they contain http:// fixtures).
    assert.ok(!files.some((f) => f.includes("/test/")), "test files must not be packed");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
