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

export const ENGINE_VERSION = "0.2.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "86d04f50f9d158832cba0e4022e34d905172f5878bb21445f780fb0af4ce739b",
  "llms.txt": "61ba69af983b90c0e5a61ad03574b333235d59f494d2c882e4fd49a8f4e83aeb",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
