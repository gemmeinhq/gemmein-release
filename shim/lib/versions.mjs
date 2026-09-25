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

export const ENGINE_VERSION = "0.16.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "4cd2e9e09605646c78ce4b0773693844d655ff735fec6d8877ab14c8ea307d3d",
  "llms.txt": "a68f4998321e53ebbe8a62b76421d657ea3eccea38b6392f6897a0f3efdc492b",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
