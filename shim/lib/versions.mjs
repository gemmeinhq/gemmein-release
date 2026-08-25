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

export const ENGINE_VERSION = "0.4.6";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "ce9c3c3cc1527dcaec8c07a37d36ccf5569623142060fa1689b3984cab79f205",
  "llms.txt": "ea87514a1a6adc3d416f2810146268f11a81cb2388051cf9d97d2d4b6d421dd0",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
