// The shim's whole job is the trust boundary — so the tests are about
// exactly that: fail closed on unreleased pins, verify before caching,
// refuse tampered bytes, never touch the network once cached.

import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineCached, fetchEngine, engineDir } from "../lib/engine.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");

function serve(files) {
  const hits = [];
  const server = createServer((req, res) => {
    hits.push(req.url);
    const name = req.url.split("/").pop();
    if (files[name] === undefined) { res.statusCode = 404; res.end(); return; }
    res.end(files[name]);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () =>
    resolve({ base: `http://127.0.0.1:${server.address().port}/engine`, hits, close: () => server.close() })));
}

test("fails closed when no release is pinned (TBD hashes)", async () => {
  const cache = mkdtempSync(join(tmpdir(), "shim-"));
  await assert.rejects(
    () => fetchEngine("0.0.0-unreleased", { "gemmein.js": "TBD" }, "http://127.0.0.1:1/engine", cache),
    /no released engine pinned/
  );
  rmSync(cache, { recursive: true, force: true });
});

test("verifies before caching, refuses tampered bytes, runs offline once cached", async () => {
  const cache = mkdtempSync(join(tmpdir(), "shim-"));
  const good = "console.log('engine')";
  const llms = "# guide";
  const { base, hits, close } = await serve({ "gemmein.js": good, "llms.txt": llms });
  try {
    const pins = { "gemmein.js": sha(good), "llms.txt": sha(llms) };

    // tampered: server bytes don't match the npm-pinned hash → hard refusal, nothing cached
    const badPins = { "gemmein.js": sha("evil"), "llms.txt": sha(llms) };
    await assert.rejects(() => fetchEngine("1.0.0", badPins, base, cache), /SECURITY/);
    assert.equal(engineCached("1.0.0", badPins, cache), false, "nothing unverified lands in the cache");

    // clean fetch: verified, cached, executable
    await fetchEngine("1.0.0", pins, base, cache);
    assert.equal(engineCached("1.0.0", pins, cache), true);
    assert.equal(readFileSync(join(engineDir("1.0.0", cache), "gemmein.js"), "utf8"), good);

    // OFFLINE-LAW: once cached, the network is never consulted again
    const before = hits.length;
    assert.equal(engineCached("1.0.0", pins, cache), true);
    assert.equal(hits.length, before, "cache check makes zero network requests");

    // a corrupted cache is detected (hash re-checked, not trusted)
    const dir = engineDir("1.0.0", cache);
    const fs = await import("node:fs");
    fs.writeFileSync(join(dir, "gemmein.js"), "tampered-on-disk");
    assert.equal(engineCached("1.0.0", pins, cache), false, "on-disk tampering fails the cache check");
  } finally {
    close();
    rmSync(cache, { recursive: true, force: true });
  }
});

// OFFLINE (0.22): a first run with no network, or a download that stalls,
// ends with a sentence — never a hang, never a raw fetch error.
test("an unreachable or stalled download says so and stops, within its idle limit", { timeout: 20_000 }, async () => {
  const cache = mkdtempSync(join(tmpdir(), "shim-"));
  const pins = { "gemmein.js": sha("x") };
  const held = [];
  const stall = createServer((req, res) => {
    held.push(res);
    if (req.url.endsWith("/headers-then-silence/gemmein.js")) { res.writeHead(200, { "content-length": "1000" }); res.write("a"); }
    // otherwise: accept, never answer
  });
  await new Promise((r) => stall.listen(0, "127.0.0.1", r));
  const port = stall.address().port;
  try {
    for (const base of [`http://127.0.0.1:1/engine`, `http://127.0.0.1:${port}/silent`, `http://127.0.0.1:${port}/headers-then-silence`]) {
      const started = Date.now();
      await assert.rejects(() => fetchEngine("1.0.0", pins, base, cache, { idleMs: 300 }),
        (err) => { assert.equal(err.message, "couldn't download the Gemmein engine — check your connection and run again"); return true; });
      assert.ok(Date.now() - started < 3000, `${base}: abandoned at the idle limit`);
      assert.equal(engineCached("1.0.0", pins, cache), false);
    }
  } finally {
    for (const r of held) r.destroy();
    stall.close();
    rmSync(cache, { recursive: true, force: true });
  }
});
