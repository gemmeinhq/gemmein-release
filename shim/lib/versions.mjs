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

export const ENGINE_VERSION = "0.4.5";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "6469fdef2a61ba85a9eafc746e6c4ac925a0dfd72a12a05ad767c018183339b3",
  "llms.txt": "1a1acbafacf5c5ea0eb5fd8aeaee93e92f597554574ef6b3651ef37510619ff3",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
