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

export const ENGINE_VERSION = "0.4.4";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "3fcb05377b1d2bb82c51b3fd4fd8a087b0d57e457b0d9233a3e7515003d55a75",
  "llms.txt": "74a68e4e04b89e5af8628378a850d182868617e5b5ab73a5b45c3a4a83fd6922",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
