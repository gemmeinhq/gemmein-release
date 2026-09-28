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

export const ENGINE_VERSION = "0.18.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "6e1c2e348b18eab87a48538b875aa34d7f3135ba29108fe6b526e4b1db04407a",
  "llms.txt": "be2dbd2dd26f80cfd88d3a1c9e18abe384350ffdcfc8ad16616e53537e84f7b6",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
