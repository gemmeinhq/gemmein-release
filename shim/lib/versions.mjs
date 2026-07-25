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

export const ENGINE_VERSION = "0.1.1";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "e47f4032b62df38016f62ae1c022628647ddc7cad9f4397abeec3a607eb8918b",
  "llms.txt": "1aa0989dd1624e93014122a451e22043659caa02e32a5b096da90d2b1cff6217",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
