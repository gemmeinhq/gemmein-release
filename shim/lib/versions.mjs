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

export const ENGINE_VERSION = "0.6.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "d862ff130c6c376f4ebd83a3b6cd88701a7f2ba1403b7c7f889642107f788ed5",
  "llms.txt": "86bde47361f9e180b8db8caede26fc47db1727151b9f4b413387c890bc15be2b",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
