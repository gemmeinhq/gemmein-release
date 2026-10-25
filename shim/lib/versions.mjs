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

export const ENGINE_VERSION = "0.29.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "0fc85a9a237518049ca098cc27671680f7426e870347039f27752967b5d585bc",
  "llms.txt": "860d38e449586c2cf91f3574270d2ecc9d6bd81a431b48f19b1825fb2f6781d3",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
