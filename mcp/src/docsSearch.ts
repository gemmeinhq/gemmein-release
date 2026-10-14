// SECTION-LEVEL DOCS (13 Oct 2026). The docs site is one topic per page and
// every page has a markdown twin, so the doc tools answer with the ONE
// section that holds the answer — https://docs.gemmein.com/<page>.md#<id> —
// never a whole page. Offline: the index is the site's own search index,
// bundled at build (docsIndex.generated.ts, from ops/docs/mcp-docs-index.mjs).
// Shared by the stdio server and the hosted connector through tools.ts.
import { DOCS_PAGES, ERROR_PAGES, type DocsPage } from "./docsIndex.generated.ts";

export const DOCS_ORIGIN = "https://docs.gemmein.com";

/** A page's markdown twin, with the section's anchor when there is one. */
export function mdUrl(path: string, id?: string | null): string {
  return `${DOCS_ORIGIN}${path === "/" ? "/index" : path}.md${id ? `#${id}` : ""}`;
}

/** The code's own page, or null when the site has none. */
export function errorPageUrl(code: string): string | null {
  return ERROR_PAGES.has(code) ? `${DOCS_ORIGIN}/errors/${code}` : null;
}

export type SectionHit = { url: string; page: string; heading: string | null; snippet: string };

const STOP = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "in", "is", "it", "my", "of", "on", "or", "the", "to", "what", "when", "with", "you", "your"]);
const terms = (q: string): string[] => [...new Set(q.toLowerCase().split(/[^a-z0-9_.]+/).map((t) => t.replace(/^\.+|\.+$/g, "")).filter((t) => t.length > 1 && !STOP.has(t)))];

// Pages that touch everything rank below the page that teaches the thing:
// the changelog is history, the errors page is reached by code
// (explain_error), the SDK reference by method (reference).
const PAGE_WEIGHT: Record<string, number> = { "/changelog": 0.3, "/errors": 0.6, "/reference": 0.8 };

type Candidate = { page: DocsPage; id: string | null; heading: string | null; fields: Array<[string, number]>; snippet: string };

function candidates(filter?: (p: DocsPage) => boolean): Candidate[] {
  const out: Candidate[] = [];
  for (const page of DOCS_PAGES) {
    if (filter && !filter(page)) continue;
    const pageWords: Array<[string, number]> = [[page.t.toLowerCase(), 2], [`${page.d} ${page.w} ${page.g}`.toLowerCase(), 1]];
    out.push({ page, id: null, heading: null, fields: [[page.t.toLowerCase(), 5], [`${page.d} ${page.w}`.toLowerCase(), 2], [page.g.toLowerCase(), 1]], snippet: page.d });
    for (const [id, heading, , snippet, keys] of page.h) {
      out.push({ page, id, heading, fields: [[heading.toLowerCase(), 5], [keys.toLowerCase(), 3], [snippet.toLowerCase(), 2], ...pageWords], snippet });
    }
  }
  return out;
}

/** The sections that best answer `query`, best first. */
export function searchSections(query: string, options: { limit?: number; filter?: (p: DocsPage) => boolean } = {}): SectionHit[] {
  const ts = terms(query);
  if (ts.length === 0) return [];
  const phrase = query.toLowerCase().trim();
  const need = Math.max(1, Math.ceil(ts.length * 0.6));
  const scored: Array<{ c: Candidate; matched: number; score: number }> = [];
  for (const c of candidates(options.filter)) {
    let matched = 0;
    let score = 0;
    for (const t of ts) {
      let best = 0;
      for (const [hay, w] of c.fields) if (w > best && hay.includes(t)) best = w;
      if (best > 0) { matched++; score += best; }
    }
    if (matched < need) continue;
    if (phrase.length > 3 && (c.fields[0]![0].includes(phrase) || c.snippet.toLowerCase().includes(phrase))) score += 4;
    scored.push({ c, matched, score: score * (PAGE_WEIGHT[c.page.u] ?? (c.page.u.startsWith("/console/") ? 0.9 : 1)) });
  }
  scored.sort((a, b) => b.matched - a.matched || b.score - a.score || a.c.page.u.localeCompare(b.c.page.u));
  // One page's overview line never crowds out its own sections.
  const seen = new Set<string>();
  const hits: SectionHit[] = [];
  for (const { c } of scored) {
    const key = `${c.page.u}#${c.id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ url: mdUrl(c.page.u, c.id), page: c.page.t, heading: c.heading, snippet: c.snippet });
    if (hits.length >= (options.limit ?? 6)) break;
  }
  return hits;
}

export function formatHits(hits: SectionHit[]): string {
  return hits.map((h) => `- ${h.page}${h.heading ? ` › ${h.heading}` : ""} — ${h.url}\n  ${h.snippet}`).join("\n");
}

/** Every page's markdown twin, one line each, grouped as the site's sidebar. */
export function pageList(): string {
  const lines: string[] = [];
  let group = "";
  for (const p of DOCS_PAGES) {
    if (p.g !== group) { group = p.g; lines.push(`${group}:`); }
    lines.push(`- ${p.t} — ${mdUrl(p.u)}`);
  }
  return lines.join("\n");
}
