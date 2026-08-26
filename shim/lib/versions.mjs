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

export const ENGINE_VERSION = "0.4.7";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "d3c6d496c7a45f6ef026c3ca97a3d2961884c482225dd21d48c1ab8232f4b0b2",
  "llms.txt": "ac87d3d87d1126e27ec3fb00f47b7d09031304e472838eb64955f05b726fe37a",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
