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

export const ENGINE_VERSION = "0.17.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "1b8a6bc62de9c16af6baf995b681680fae2bf46bbefb30905661253c169c6313",
  "llms.txt": "669f7db061636cb07b9116767d58ed5950c060210f9f93dcae911bc87b207408",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
