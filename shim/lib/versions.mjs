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

export const ENGINE_VERSION = "0.26.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "fd4863b0b36a0e9d36c90f3dfdd200ec532265d906145a2f497abf267ede0ba9",
  "llms.txt": "562d8db726e0f6db6ad00c681ff49bffb9990924d22da62257242c01c2521a95",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
