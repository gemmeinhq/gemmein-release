// THE CLOUD LINK — how the stdio server (`npx -y @gemmein/mcp`, run in a
// project's own directory) reaches the SAME manage-plane door the CLI uses
// for create_app and the Views family (packages/cli/src/index.ts's
// cloudCall/cloudLink): `npx gemmein login` writes gemmein/.data/cloud.json
// (a browser approval, sk_cli_… — acts in Development as the founder who
// approved, until approvalExpiresAt) once per project; this server reads
// that SAME file rather than asking the model to carry a key in a chat
// (NO KEY IN A CHAT, 21 Oct 2026) or inventing a second login flow. A
// project with no link, or an ended one, is told exactly what the CLI
// itself says: run `npx gemmein login`.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CloudLink = { apiUrl: string; secretKey: string; owner?: string; approvalExpiresAt?: string };

/** gemmein/.data/cloud.json, resolved from the server's own working
 *  directory — the same file `npx gemmein login` writes and every other
 *  `npx gemmein` command reads, in the SAME project. */
function cloudLinkPath(): string {
  return join(process.cwd(), "gemmein", ".data", "cloud.json");
}

function approvalLive(link: CloudLink): boolean {
  return typeof link.secretKey === "string" && link.secretKey.startsWith("sk_cli_") && typeof link.approvalExpiresAt === "string" && Date.parse(link.approvalExpiresAt) > Date.now();
}

export const LOGIN_LINE = "Run `npx gemmein login` in this project (you approve it in the browser) — it lasts 7 days, and this server (and `npx gemmein`) then both use it.";

/** The project's cloud link, or null when there is none, it is unreadable,
 *  or its approval has ended. */
export function readCloudLink(): CloudLink | null {
  let raw: string;
  try {
    raw = readFileSync(cloudLinkPath(), "utf8");
  } catch {
    return null;
  }
  let link: CloudLink;
  try {
    link = JSON.parse(raw) as CloudLink;
  } catch {
    return null;
  }
  if (typeof link.apiUrl !== "string" || typeof link.secretKey !== "string" || !approvalLive(link)) return null;
  return link;
}

export type ManageResult = { status: number; body: any };

/** POST/PATCH/GET/DELETE <apiUrl><path> with this project's Development
 *  key — the exact door packages/cli/src/index.ts's cloudCall calls (same
 *  header, same JSON body convention), so the server's answer reads the
 *  same whichever client sent the request. */
export async function manage(link: CloudLink, path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<ManageResult> {
  let status: number;
  let text: string;
  try {
    const res = await fetch(`${link.apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: { "x-app-key": link.secretKey, "content-type": "application/json" },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
    status = res.status;
    text = await res.text();
  } catch (e) {
    return { status: 0, body: { message: `couldn't reach ${link.apiUrl} — ${(e as Error)?.message ?? "check your connection and try again"}` } };
  }
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = { code: "bad_response", message: text.slice(0, 200) };
  }
  return { status, body };
}

/** The one line every refusal shows the message a /manage/* answer gave. */
export function said(r: ManageResult): string {
  return String((r.body as { message?: unknown } | undefined)?.message ?? `status ${r.status}`);
}
