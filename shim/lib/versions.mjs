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

export const ENGINE_VERSION = "0.8.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "33fec411999a2ed8174f0c31deb2cfe1591b52284d4a83f3ee5fd7b45fda4ac1",
  "llms.txt": "f4cb6738f7a10f7b841e4e5760353ed0c5af99bb9a28c4c55877ce004e7af9dc",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
