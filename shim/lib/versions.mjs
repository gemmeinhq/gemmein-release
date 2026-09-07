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

export const ENGINE_VERSION = "0.10.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "be7333b4f11c7a15140d6fd4d1fe7681c9574f4a0f57de0251d21b0745fb9ec0",
  "llms.txt": "ad8bbfe4c98f4cff51a6e3bff17bbd2d7473c47797301d484b05d0731d6ee3f1",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
