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

export const ENGINE_VERSION = "0.15.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "641aa102417b9412641eb9bd5cf3de3f3562d09ae9602ac1f65640e6d92c8bfc",
  "llms.txt": "78f22e5475f69d17b37994cc9c4ccb388f51e32cb14de40f72b56e4516bd78a2",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
