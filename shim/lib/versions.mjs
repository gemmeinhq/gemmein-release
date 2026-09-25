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

export const ENGINE_VERSION = "0.14.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "4af6bf46eba69c7f6f623faa62f44d75fb0306fa0489eb2bd5d2a3fd58193840",
  "llms.txt": "289168dbee26ce0c89164fd80c2159608af09460a692fb4b358da4e460921a37",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
