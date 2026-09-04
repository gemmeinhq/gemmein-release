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

export const ENGINE_VERSION = "0.7.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "25fc57dc094c18863f6cad4c858cae48b2d03380a05ab965964d603ec413aa23",
  "llms.txt": "049e2a8b6ac081b08b461c75d42f7228dd11f9497b48c35eddc4f5d3d94f06b6",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
