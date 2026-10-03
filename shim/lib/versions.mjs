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

export const ENGINE_VERSION = "0.20.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "de6a9ffaf495e30c09b2c903c447566f3622993f255260b4e363d5f3d94e912a",
  "llms.txt": "697b8db0fcfbb8f0dfed3d18f9858e6cb3b33315ac35aff2cda4abd41a5b8915",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
