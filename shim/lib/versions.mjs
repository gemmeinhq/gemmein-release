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

export const ENGINE_VERSION = "0.22.1";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "cf015214b36468cf047c0810a6d69dfd6c425c3e478699d69bfb95e2e0993609",
  "llms.txt": "c10af7f35c60c88c931c4745be22d018880648fc5a3971fc644ee4cb17d58d8d",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
