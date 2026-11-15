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

export const ENGINE_VERSION = "0.30.1";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "064de5607caea0038fcc23c15c66401845d11c5670e9eef8c82a30779dbe8901",
  "llms.txt": "65f58315ad86b7cdf2b9c3342ac78230350b5f3db7b3303068c1e7e68cccd727",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
