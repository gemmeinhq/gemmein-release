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

export const ENGINE_VERSION = "0.24.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "568d6c16c694a57c0b9e3fd25d8116a6ecb6fb5804cf2cc268bbdf075e77e13c",
  "llms.txt": "87da719f44c581c973188a9c7abe155ed0eb554cd4299757f92719f0dbd0d0d5",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
