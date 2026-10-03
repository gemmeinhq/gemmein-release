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

export const ENGINE_VERSION = "0.19.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "a4a846146b0b306669f8db27f315ccd63b531d82fd6cd2cba02f853c977b41f6",
  "llms.txt": "1a8960e0939bde0bad201187c1b97066753e77d43fd31547efc17d61a25f4963",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
