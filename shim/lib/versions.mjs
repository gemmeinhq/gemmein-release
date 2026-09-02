// THE COMPILE-TIME CONSTANTS (CARVE-BOUNDARY hash law).
//
// These hashes are baked into the published npm package and are the ONLY
// thing the downloaded engine is verified against. They are never fetched
// at runtime and never served from the CDN — the hash travels through npm,
// the artifact travels through downloads.gemmein.com, and compromising one
// channel is useless without the other.
//
// Updated ONLY by the promotion ritual (PROMOTION.md). The TBD placeholder
// fails closed: the shim refuses to download anything until a real release
// has been promoted.

export const ENGINE_VERSION = "0.5.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "c24bbeca84bf8ae4c2e62278aa877ba715d12ac357b38cd45f8065975cdb68b9",
  "llms.txt": "6503c3ff755b1f47f90e993fc95f8798dc88fdacece90e4de4a129e895779376",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
