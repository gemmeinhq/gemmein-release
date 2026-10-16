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

export const ENGINE_VERSION = "0.25.0";

/** file name -> hex sha256 */
export const ENGINE_FILES = {
  "gemmein.js": "314ee6ee2e5e3adfab89aa49c58cdf32e6cb3bc3a3888276c82d28cce2e993f3",
  "llms.txt": "ecf8fae7abcf19486ba0bbe9cfa5af129e45deaa92edd0a328f860bc1f6fdf38",
};

export const DOWNLOAD_BASE = "https://downloads.gemmein.com/engine";
