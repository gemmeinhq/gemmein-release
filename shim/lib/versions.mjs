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

export const ENGINE_VERSION = "0.3.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "bd58ca3a82bce5d06ac3c1321d83bf522a92a116780e017daa7348c0e8f26429",
  "llms.txt": "a6c6cb07ecca71a8ac60be961e933725a621dcd53aee3170a41cc65fc099de04",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
