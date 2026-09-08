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

export const ENGINE_VERSION = "0.11.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "0bb749d4fbedee13a5b46c4421b638d54b986d688e0419e3ed6f001aa04cf02b",
  "llms.txt": "3d2fa60d6b2766523969aa8ca69466fcb69919dd7cc48dd022464aefb71e4745",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
