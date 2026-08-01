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

export const ENGINE_VERSION = "0.4.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "0ecb346f290c5305d15c95f3c74a63587b8c6145658010af11a4512a0e86b6f5",
  "llms.txt": "6ad4b1e69c2e58d50975babd3f7c13248025f7b1cbae9b98851b771d79b7d8ac",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
