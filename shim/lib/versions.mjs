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

export const ENGINE_VERSION = "0.9.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "74e0546918f4c58a30a009b02b4b8f9e09a79c6b0c0c92d6231543b403bd416b",
  "llms.txt": "62f30ef73d74eb2fac3538b263901fe6f0a7dea841266b6422d15554c8fe88eb",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
