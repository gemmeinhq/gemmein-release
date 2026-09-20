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

export const ENGINE_VERSION = "0.13.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "8e8dcbb16148ca5e777ea3c7175debe5a8bd5698184c54e93940a71f44cda8d5",
  "llms.txt": "9c6bb89e20f8639e9ea8ebf81c74b745ff8fce5d62baf78fb660f6ca3715ca88",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
