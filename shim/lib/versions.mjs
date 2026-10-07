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

export const ENGINE_VERSION = "0.22.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "a879aa0134b26111b291ec3cd06190dabe43d54729eba993c8943a8f398cc23b",
  "llms.txt": "a50c1e81b3717cbb1c37a31ceec0ecc41441eb3548cda855091941558b65adfd",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
