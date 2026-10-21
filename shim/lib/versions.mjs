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

export const ENGINE_VERSION = "0.27.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "7e0af96c1c19e6f3f8e7aaebc5c96a594eb2556a8190da92629893a857fed374",
  "llms.txt": "1c1642948228f9b62c3a85197a0cff1d4cd8ed85db15ab5575a807036c3644db",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
