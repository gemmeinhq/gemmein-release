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

export const ENGINE_VERSION = "0.12.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "b39277a634627a2ba7ba5be3abdff8c17e590dbcd9b43ed1bb5ada43eecfdde7",
  "llms.txt": "297d855f1ed891ee799d022242d275df0519b113290868aea6f5e14cac6ace39",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
