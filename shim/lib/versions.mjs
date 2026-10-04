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

export const ENGINE_VERSION = "0.21.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "ac85761c598e6257db70d50becf7e756ac5813cee98294baa395df1bae5c68d8",
  "llms.txt": "fd2defdc2fd879d147b5c198aac57e8983a06d2b70549a174dc6c4057b785b23",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
