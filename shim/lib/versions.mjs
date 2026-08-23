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

export const ENGINE_VERSION = "0.4.3";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "9bdba431ca038e2afe18a990ee55a47d5a890f1a23711d512c839d355b4d98e2",
  "llms.txt": "c2327295821276ccd18b98f566147af3ebccdcaabaf8f85312e79d8fa9c9c8bb",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
