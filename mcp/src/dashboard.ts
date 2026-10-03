// The `guide` tool's text: the packaged guide plus the dashboard section,
// read live.
//
// The packaged guide (@gemmein/sdk's llms.txt) is the contract — what code
// calls — and it changes only with an SDK release. The dashboard how-to
// (connecting Stripe, the console rooms, health checks) changes whenever the
// dashboard does, so it is not in the package: it is served at ONE fixed
// address on docs.gemmein.com and read at call time. Offline, or on any
// answer that is not that section, the guide ends with one line naming the
// address instead.
//
// The request is a single GET to the constant below: no other host, no
// query string, no headers, no credentials, redirects refused. Nothing runs
// at import; the network is touched only when guideText() is called.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export const DASHBOARD_URL = "https://docs.gemmein.com/llms-dashboard.txt";
export const DASHBOARD_HEADING = "## The dashboard";
export const DASHBOARD_FALLBACK_LINE =
  `Dashboard steps (not in this package; they change with the dashboard): ${DASHBOARD_URL}`;

export const DASHBOARD_TIMEOUT_MS = 3_000;
export const DASHBOARD_MAX_BYTES = 512 * 1024;
const CACHE_MS = 10 * 60_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const require = createRequire(import.meta.url);

export function sdkFile(name: "llms.txt" | "REFERENCE.md" | "reaffirm.mjs"): string {
  try {
    return readFileSync(require.resolve(`@gemmein/sdk/${name}`), "utf8");
  } catch {
    // sdk 0.1.0 shipped the files in its tarball but without subpath
    // exports, so Node refuses the pretty specifier. Resolve the entry
    // point (dist/index.js) and read from the package root instead.
    return readFileSync(join(dirname(require.resolve("@gemmein/sdk")), "..", name), "utf8");
  }
}

// Successful reads only, per fetch implementation (the real one in the
// server; each test stub gets its own entry). A failed read is not cached,
// so the next call tries again.
const cache = new WeakMap<FetchLike, { text: string; at: number }>();

async function readCapped(res: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!res.body) {
    const t = await res.text();
    return new TextEncoder().encode(t).byteLength > maxBytes ? null : t;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  return new TextDecoder("utf-8").decode(all);
}

/**
 * The live dashboard section, or null when it cannot be read or the answer
 * is not that section (not ok, not plain text, too large, wrong opening).
 */
export async function fetchDashboard(
  fetchImpl: FetchLike = globalThis.fetch,
  timeoutMs: number = DASHBOARD_TIMEOUT_MS,
): Promise<string | null> {
  const hit = cache.get(fetchImpl);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text;
  if (typeof fetchImpl !== "function") return null;

  const signal = AbortSignal.timeout(timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A fetch that ignores its signal still cannot hold the guide past the
  // budget. Deliberately not unref'd: AbortSignal.timeout's own timer is,
  // so this one keeps the loop alive until the answer is settled; it is
  // cleared the moment the read finishes.
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs + 50);
  });

  const attempt = (async (): Promise<string | null> => {
    const res = await fetchImpl(DASHBOARD_URL, {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      signal,
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").trim().toLowerCase();
    if (type && (!type.startsWith("text/") || type.startsWith("text/html"))) return null;
    const body = await readCapped(res, DASHBOARD_MAX_BYTES);
    if (body === null) return null;
    const section = body.replace(/^﻿/, "");
    if (!section.startsWith(DASHBOARD_HEADING)) return null;
    return section;
  })().catch(() => null);

  try {
    const section = await Promise.race([attempt, deadline]);
    if (section !== null) cache.set(fetchImpl, { text: section, at: Date.now() });
    return section;
  } finally {
    clearTimeout(timer);
  }
}

/** What the `guide` tool returns: the packaged guide, then the dashboard section or the one fallback line. */
export async function guideText(
  fetchImpl: FetchLike = globalThis.fetch,
  timeoutMs: number = DASHBOARD_TIMEOUT_MS,
): Promise<string> {
  const guide = sdkFile("llms.txt").trimEnd();
  const section = await fetchDashboard(fetchImpl, timeoutMs);
  return section === null
    ? `${guide}\n\n${DASHBOARD_FALLBACK_LINE}\n`
    : `${guide}\n\n${section.trim()}\n`;
}
