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

export const ENGINE_VERSION = "0.30.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "f269171f2c09fc53e51838b2ee642757fd8d6a5a6c070120856e1da2aec0eacf",
  "llms.txt": "b62b4f408aba7fc1a69b01d8f824200810f3f8a2cb245ffd9bb779f4fb05b631",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
