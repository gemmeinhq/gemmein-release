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

export const ENGINE_VERSION = "0.4.8";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "edad025b6462a0ef2f4f608354844ea09c41453c7e85801127997f76c4d00628",
  "llms.txt": "c7b6063bc6b9fa8f7ca5db85917f8e1188b4560ac5e731fc86ea4144892e140d",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
