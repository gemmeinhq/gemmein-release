#!/usr/bin/env node
// @gemmein/mcp — the Gemmein MCP server (phase 1: docs tools + one live check).
//
// Gives a coding agent the whole Gemmein contract as tools: the guide
// (llms.txt), the API reference (REFERENCE.md), targeted search over both,
// deterministic explainers for safety rules and error codes, the reaffirm
// harness template, and `check_integration` — the reaffirm boundary checks
// run live against the caller's own app.
//
// Eight tools are read-only and offline. The only writes anywhere are
// check_integration's Tier B, in the caller's own DEV environment: the two
// test people (get-or-create, kept), their sessions (earlier ones revoked),
// and a probe record it deletes — the same as reaffirm.mjs in CI.
// Provisioning (create app / mint keys) is phase 2, gated behind launch
// signup unlock.
//
// The guide/reference/template are read from the installed @gemmein/sdk
// package — one source of truth, no copies to drift.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { gemmein, gemmeinServer } from "@gemmein/sdk";
import { CLOUD_ONLY_NOTE, explainRelay } from "./relays.js";

const require = createRequire(import.meta.url);

function sdkFile(name: "llms.txt" | "REFERENCE.md" | "reaffirm.mjs"): string {
  try {
    return readFileSync(require.resolve(`@gemmein/sdk/${name}`), "utf8");
  } catch {
    // sdk 0.1.0 shipped the files in its tarball but without subpath
    // exports, so Node refuses the pretty specifier. Resolve the entry
    // point (dist/index.js) and read from the package root instead.
    return readFileSync(join(dirname(require.resolve("@gemmein/sdk")), "..", name), "utf8");
  }
}

// Same law as the SDK's assertCollectionName — kept in lockstep by test.
const COLLECTION_NAME_RE = /^[a-z][a-z0-9_]{1,62}$/;

// ── Safety rules (distilled from llms.txt; the guide stays the source of
//    truth for prose — these are the decision-shaped versions) ─────────────
const RULES: Record<string, { contract: string; rightFor: string; cautions: string }> = {
  private: {
    contract:
      "Each signed-in user sees and edits ONLY their own records. Anonymous access is refused (denied). The owner signing in to the app is an ordinary user too and sees only their own; everyone's records are in the owner's Gemmein dashboard (the admin view).",
    rightFor: "notes, tasks, saved games — anything personal to one user.",
    cautions:
      "No expand/links here — join in memory. Touching someone else's record returns 404 not_found (existence is never leaked).",
  },
  shared: {
    contract:
      "Every signed-in user can read AND write every record. Anonymous access is refused.",
    rightFor: "a team board every user edits together.",
    cautions:
      "WRONG for personal data — it leaks to every user. Render other users' content as text (never innerHTML). Use { ifVersion } on updates to avoid silently clobbering concurrent edits.",
  },
  admin_write: {
    contract:
      "Everyone signed in can read; ONLY the app owner writes, from the Gemmein dashboard, a relay or your server — no app session writes here. One record that all users read.",
    rightFor: "announcements, app settings, feature flags your human curates.",
    cautions:
      "App writes get 403 forbidden — never retry a forbidden. If each user should get their OWN copy, that is `addressed`, not admin_write.",
  },
  public_read: {
    contract:
      "Readable WITHOUT signing in; only the app owner writes, from the Gemmein dashboard, a relay or your server. Strangers can never inject records.",
    rightFor: "catalogs, menus, single-author blogs.",
    cautions:
      "Everything in it is public — no secrets, ever. Drafts: create with option { published: false }, publish with update(id, {}, { published: true }). No expand/links.",
  },
  community: {
    contract:
      "Readable without signing in; any signed-in user creates and edits their OWN records. The public multi-author surface.",
    rightFor: "multi-author blogs, public boards, user profiles.",
    cautions:
      "Everything is PUBLIC — keep record data minimal. Plain text only: HTML in string fields is refused (400 html_not_allowed). Links learn + expand here. One-record-per-user (profiles) = keyed create: create(data, { key: 'profile:' + user.userId }). Drafts supported.",
  },
  addressed: {
    contract:
      "The app sends to one user: the OWNER sends records naming a recipient from the Gemmein dashboard, a relay or your server (write_record, to: 'person') — no app session sends. Each user's .list() returns only records addressed to them (their inbox). Users never write.",
    rightFor: "notifications, order status, invoices, results, purchase receipts.",
    cautions:
      "Recipient is server-stamped (record.audienceUserId), never a data field. Same message for everyone = admin_write instead. Plain text only. 400 invalid_audience = the recipient isn't a user of this app.",
  },
  direct: {
    contract:
      "Users send to each other: any signed-in user creates records naming a recipient; only the author and that recipient can read them in the app. The owner's Gemmein dashboard can read every one.",
    rightFor: "messages, sharing, requests between users.",
    cautions:
      "NEVER present as private or encrypted chat (the owner's dashboard can read it). Plain text only. 403 reply_only = this collection only allows replying to someone who wrote first; 403 sends_disabled = the owner turned direct messages off for this collection.",
  },
};

const RULES_FOOTER =
  "Cross-cutting law: collections are created by the app owner in their dashboard, never by the SDK. " +
  "There is NO team/group/workspace scope and no per-user visibility inside a rule — if the app needs that shape, stop and tell your human it isn't supported yet (never approximate it by client-side filtering a shared collection). " +
  "Record fields always live under record.data; ownerUserId/version/published are server-derived and top-level.";

// invalid_collection_name is thrown client-side by the SDK, so it is not in
// the REFERENCE server-error table — appended here.
const EXTRA_ERRORS: Record<string, { meaning: string; fix: string }> = {
  invalid_collection_name: {
    meaning:
      "the collection name breaks the naming law (lowercase letters, numbers, underscores; must start with a letter; 2-63 chars). Thrown synchronously by g.collection(name), before any network call.",
    fix: "rename the collection (e.g. saved_games, never savedGames) — validate with the validate_collection_name tool",
  },
};

function parseErrorTable(): Record<string, { meaning: string; fix: string }> {
  // Only the "## Errors" section holds the code table — parsing the whole
  // document also swallowed the method tables, and the old row regex missed
  // every code with a parenthetical status (`unsupported_file_type` (415)).
  const out: Record<string, { meaning: string; fix: string }> = {};
  const doc = sdkFile("REFERENCE.md");
  const start = doc.indexOf("\n## Errors");
  const next = start === -1 ? -1 : doc.indexOf("\n## ", start + 10);
  const section = start === -1 ? doc : doc.slice(start, next === -1 ? undefined : next);
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 4) continue;
    // cells[1] = code cell (may carry a status note), cells[2] = meaning, cells[3] = do
    const codes = (cells[1].match(/`([a-z_]+)`/g) ?? []).map((c) => c.slice(1, -1));
    for (const code of codes) {
      out[code] = { meaning: cells[2], fix: cells[3].replace(/\*\*/g, "") };
    }
  }
  return { ...out, ...EXTRA_ERRORS };
}

// ── search over the two docs ───────────────────────────────────────────────
function searchDocs(query: string): string {
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/).filter(Boolean);
  if (!terms.length) return "Empty query.";
  const files: Array<[string, string]> = [
    ["llms.txt (the guide)", sdkFile("llms.txt")],
    ["REFERENCE.md (the API reference)", sdkFile("REFERENCE.md")],
  ];
  const blocks: string[] = [];
  for (const [label, text] of files) {
    const lines = text.split("\n");
    const hits: number[] = [];
    lines.forEach((line, i) => {
      const l = line.toLowerCase();
      if (l.includes(q) || terms.every((t) => l.includes(t))) hits.push(i);
    });
    // merge hits into windows of ±3 lines
    let win: [number, number] | null = null;
    const windows: Array<[number, number]> = [];
    for (const h of hits) {
      const lo = Math.max(0, h - 3);
      const hi = Math.min(lines.length - 1, h + 3);
      if (win && lo <= win[1] + 1) win[1] = hi;
      else windows.push((win = [lo, hi]));
    }
    for (const [lo, hi] of windows.slice(0, 6)) {
      blocks.push(`── ${label}, lines ${lo + 1}-${hi + 1} ──\n` + lines.slice(lo, hi + 1).join("\n"));
    }
    if (windows.length > 6) blocks.push(`… ${windows.length - 6} more match block(s) in ${label} — narrow the query.`);
  }
  return blocks.length
    ? blocks.join("\n\n")
    : `No matches for "${query}". Try a term from the contract vocabulary (rule names, error codes, method names) — or read the full guide/reference tools.`;
}

// ── check_integration — the reaffirm boundary checks as a tool ─────────────
type Check = { label: string; pass: boolean; detail?: string };

type IntegrationInput = {
  publicKey: string;
  privateCollection: string;
  publicCollection?: string;
  secretKey?: string;
  apiUrl?: string;
  testUsers?: string[];
  timeoutMs?: number;
};

async function runIntegrationChecks(input: IntegrationInput) {
  const checks: Check[] = [];
  const notes: string[] = [];
  const opts = input.apiUrl ? { apiUrl: input.apiUrl } : {};
  const push = (label: string, pass: boolean, detail?: string) =>
    checks.push({ label, pass, ...(detail ? { detail } : {}) });

  const refuse = async (label: string, code: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      push(label, false, `expected error "${code}" but the call succeeded — the boundary is OPEN`);
    } catch (e: unknown) {
      const got = (e as { code?: string }).code ?? (e as Error).message;
      push(label, got === code, got === code ? undefined : `expected "${code}", got "${got}"`);
    }
  };

  const g = gemmein(input.publicKey, opts);

  // ── Tier A — anonymous + shape. Safe against any environment, live included.
  try {
    g.collection(input.privateCollection);
    push(`collection name "${input.privateCollection}" is valid`, true);
  } catch (e: unknown) {
    push(`collection name "${input.privateCollection}" is valid`, false, (e as Error).message);
    return { checks, notes }; // nothing downstream can run
  }
  await refuse(`anonymous CANNOT read the "${input.privateCollection}" collection`, "denied", () =>
    g.collection(input.privateCollection).list());
  await refuse(`anonymous CANNOT write the "${input.privateCollection}" collection`, "denied", () =>
    g.collection(input.privateCollection).create({ probe: "x" }));

  if (input.publicCollection) {
    try {
      const open = await g.collection(input.publicCollection).list();
      push(`"${input.publicCollection}" is anonymously readable (as its rule intends)`, true);
      notes.push(
        `"${input.publicCollection}" is public by rule — ${open.records.length} record(s) visible to ANYONE. Never put secrets or personal data in it.`,
      );
    } catch (e: unknown) {
      push(`"${input.publicCollection}" is anonymously readable (as its rule intends)`, false,
        `got "${(e as { code?: string }).code ?? (e as Error).message}" — is its rule really community/public_read?`);
    }
  }

  // ── Tier B — cross-user isolation. Dev environments only, by design.
  const sk = input.secretKey;
  if (!sk) {
    notes.push("Tier B (cross-user isolation) skipped — pass secretKey (sk_dev) to prove one user can't read another's private records. Dev and live enforce the same rules, so isolation proven in dev holds in live.");
    return { checks, notes };
  }
  if (sk.startsWith("sk_live")) {
    notes.push("Tier B skipped — sk_live can never mint test sessions (by design; never point test tooling at live user data). Use the sk_dev key.");
    return { checks, notes };
  }

  const users = input.testUsers?.length === 2 ? input.testUsers : ["reaffirm-a@test.dev", "reaffirm-b@test.dev"];
  const srv = gemmeinServer(sk, opts);
  const [a, b] = await Promise.all(users.map((e) => srv.testSession(e)));
  const asUser = (token: string) =>
    gemmein(input.publicKey, {
      ...opts,
      tokenStore: { get: async () => token, set: async () => {}, clear: async () => {} },
    });
  const A = asUser(a.token);
  const B = asUser(b.token);

  const note = await A.collection(input.privateCollection).create({ probe: "a-secret" });
  try {
    await refuse(`user B CANNOT read user A's private record (404-shaped, existence not leaked)`, "not_found", () =>
      B.collection(input.privateCollection).get(note.id));
    const bSees = await B.collection(input.privateCollection).list();
    push("user B's private list contains none of user A's records",
      !bSees.records.some((r) => r.id === note.id),
      bSees.records.some((r) => r.id === note.id) ? "ISOLATION BREACH — B's list contains A's record" : undefined);
    const who = await A.auth.currentUser();
    push("currentUser() exposes userId (not id) — the shape your UI must read", !!(who as { userId?: string }).userId);
    push("record fields live under .data", (note.data as { probe?: string })?.probe === "a-secret");
  } finally {
    try { await A.collection(input.privateCollection).delete(note.id); } catch { /* leave nothing behind on a best-effort basis */ }
  }
  return { checks, notes };
}

// ── the MCP server ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "guide",
    description:
      "Call this FIRST — before any install, account, or code — when your human asks to build an app on Gemmein, to move an existing app onto it, or whether their app can use it at all. The guide (llms.txt) opens with two doors — starting from an idea with nothing built yet, or already holding an app — and both lead to the same fit assessment: the in-scope map, the out-of-scope list (each item downgrades the verdict; none may be approximated), and the three verdicts you deliver to your human before installing anything — FITS, FITS EXCEPT <named gaps>, or DOESN'T FIT. After the verdict it is the full build contract: auth flow, the seven collection safety rules, record shapes, links/expand, uploads, contention patterns, payments (g.subscriptions.checkout / g.payments.buy), drafts, error philosophy, pricing. It also teaches the keys (server · CLI · sync), `gemmein sync` and `sync --live`, go-live and promotion, relays, AI tools defined on the server and run with `g.ai.run`, and credits.",
    title: "Guide",
    annotations: { title: "Guide", readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "reference",
    description:
      "Reach for this while WRITING code against @gemmein/sdk: every method, exact signature, return shape, and the stable error-code table (REFERENCE.md). Use `guide` for how the model works and whether the app fits at all; use `search_docs` when you need one fact from either document.",
    title: "Reference",
    annotations: { title: "Reference", readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_docs",
    description:
      "Use when one question comes up mid-build ('keyed create', 'ifVersion', 'addressed', 'expand') and reading a full document would waste context. Searches the guide and the API reference; returns matching passages with 3 lines of context either side, at most 6 match blocks per document. Not the tool for the fit verdict — search finds what the docs say, not what Gemmein refuses to support; call `guide` for that.",
    title: "Search docs",
    annotations: { title: "Search docs", readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "term or phrase to find" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "explain_rule",
    description:
      "Call while DESIGNING a collection — which rule fits this data? — or when a rule refuses something at runtime. One of the seven rules (private, shared, admin_write, public_read, community, addressed, direct) returns its exact access contract, what it is right for, and the mistakes that leak data. Call with no rule for the all-seven cheat-sheet plus the cross-cutting law, including what NO rule supports (team/group/workspace scope, per-user visibility inside a rule) — if the app needs those shapes, that is a fit gap to report to your human, never something to approximate with client-side filtering.",
    title: "Explain rule",
    annotations: { title: "Explain rule", readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        rule: {
          type: "string",
          enum: Object.keys(RULES),
          description: "the rule to explain; omit for the all-rules cheat-sheet",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "explain_error",
    description:
      "Call the moment a GemmeinError reaches you (err.code: conflict, forbidden, unknown_collection, invalid_shape, html_not_allowed, …): what the code means and the exact next step — including whether the refusal is final (a forbidden repeats on retry; fix the approach, not the request). Parsed from the installed API reference, so codes match the SDK version the app runs. Call with no code to list every stable code.",
    title: "Explain error",
    annotations: { title: "Explain error", readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { code: { type: "string", description: "the err.code to explain; omit to list all" } },
      additionalProperties: false,
    },
  },
  {
    name: "validate_collection_name",
    description:
      "Run at PLANNING time on every collection name you intend to use, before any g.collection(name) call is written. The naming law: lowercase letters, numbers, underscores; starts with a letter; 2-63 characters. A bad name throws from g.collection(name) before any network call — at module load that blanks the whole app with no console error. An invalid name comes back with a suggested fix.",
    title: "Validate collection name",
    annotations: { title: "Validate collection name", readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "reaffirm_template",
    description:
      "Fetch this when you wire up the app's CI, or when you hand the finished app to your human: reaffirm.mjs, the ready-to-edit harness that re-proves the app's boundaries against live Gemmein on every deploy (also shipped inside the @gemmein/sdk package). Copy it next to the app, set the CONFIG block, run it in CI. For a one-off check right now, call check_integration — the same checks with no file to install.",
    title: "Reaffirm template",
    annotations: { title: "Reaffirm template", readOnlyHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "explain_relay",
    description:
      "Call while WRITING or FIXING gemmein/relays/<name>.json — before `gemmein sync` carries it to the cloud. A relay is one trigger (receiver: a provider's webhook; schedule: a clock; data_change: a record changing) and up to ten actions in Gemmein's own verbs (write_record, grant_access, revoke_access, grant_credits, email_person, call_url, fulfil_product, refund_product, grant_plan, revoke_plan) — Gemmein runs it: receives the event, maps the fields, authorises, carries out the action. Pass the definition JSON; the answer is the English sentence the dashboard shows (\"When gocardless-paid receives an event where event_type is confirmed → grant Pro, email the person, call https://…\") or the ONE refusal sentence the cloud would answer, naming the field and the fix. Offline and read-only: nothing is created. Two checks run only in the cloud and are stated in the answer (the API's own hosts; the address's resolved network at call time).",
    title: "Explain relay (validate offline)",
    annotations: { title: "Explain relay (validate offline)", readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        definition: { type: "object", description: "the relay definition — the contents of gemmein/relays/<name>.json ({ name, trigger, actions })" },
      },
      required: ["definition"],
      additionalProperties: false,
    },
  },
  {
    name: "check_integration",
    description:
      "Call after wiring the app to Gemmein and before telling your human it is done — and again before go-live. Runs the reaffirm boundary checks live against the caller's own app; returns structured pass/fail (structuredContent: checks, notes, failedCount, passed). Tier A (public pk_ key only): the collection name is valid, anonymous reads and writes of a private collection are refused, an optional public collection reads as its rule intends — safe against any environment, live included. Tier B (add the sk_dev secret key): proves one user cannot read another's private records, using two throwaway test sessions in the DEV environment. sk_live is refused by design — never pass a live secret to any tool; dev and live enforce the same rules, so isolation proven in dev holds in live. Tier A writes nothing while the boundaries hold — but if a private collection is open to strangers, its anonymous test write succeeds and the record stays, in whatever environment the key names (live included), and the check fails, naming the collection. Tier B writes only in the caller's dev environment: it signs in two test people (created on first use and kept; any earlier sessions of theirs are signed out), creates one probe record as the first and deletes it at the end of the check. Signing a person in signs them out of their earlier sessions: pass your own testUsers only for throwaway addresses, because real development people you name are signed out. A failed check means the app's assumptions drifted from its rules — fix before shipping.",
    title: "Check integration (live boundary check)",
    // Honest hints (directory review reads these): it calls the live
    // Gemmein API (open world). Tier B writes in the caller's dev
    // environment: it gets-or-creates the two test people, revokes their
    // earlier sessions and mints new ones, creates a probe record and
    // deletes it, and each call adds audit rows — so not read-only, may
    // delete/revoke (destructive), and a repeat call has new effects
    // (not idempotent). Tier A alone writes nothing unless a boundary is
    // OPEN, in which case the anonymous probe create succeeds.
    annotations: { title: "Check integration (live boundary check)", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        publicKey: { type: "string", description: "the app's public pk_ key" },
        privateCollection: { type: "string", description: "a collection with the `private` rule" },
        publicCollection: { type: "string", description: "optional: a community/public_read collection to confirm anonymous readability" },
        secretKey: { type: "string", description: "optional: the sk_dev secret key — enables Tier B isolation proof (sk_live is refused)" },
        apiUrl: { type: "string", description: "optional: API base URL override (local/dev API); omit for production Gemmein" },
        testUsers: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2, description: "optional: the two Tier-B test emails (default reaffirm-a/b@test.dev). Each is signed out of its earlier sessions, so name real development people only if signing them out is fine" },
        timeoutMs: { type: "number", description: "overall time budget, default 30000" },
      },
      required: ["publicKey", "privateCollection"],
      additionalProperties: false,
    },
  },
] as const;

const server = new Server(
  // The one version, read from package.json — a literal here drifted once
  // (announced 0.1.0 while the package said 0.2.1; review 26 Aug).
  { name: "gemmein", version: (require("../package.json") as { version: string }).version },
  {
    capabilities: { tools: {} },
    // Stated ONCE, server-wide, in the initialize result every client
    // hands to its model: what Gemmein is, what the tools write, and the
    // fit protocol (the verdicts live in `guide`).
    instructions:
      "Gemmein is the go-live system for AI-built web apps: passwordless auth, records " +
      "under seven safety rules, Stripe-run subscriptions and one-off digital products. " +
      "Eight tools are read-only. check_integration runs live checks against the app; " +
      "with a development secret key it also writes in the development environment: it " +
      "creates two test people and a probe record, deletes the record, and signs the test " +
      "people out of earlier sessions. sk_live keys are refused. Protocol: when the question is whether an app can use " +
      "Gemmein, call guide first — it opens with two doors, an idea with nothing built " +
      "yet and an app that already exists, and both reach the same fit assessment: you " +
      "deliver one of three verdicts to your human before installing anything: FITS, FITS EXCEPT " +
      "<named gaps>, or DOESN'T FIT. Then: reference and search_docs while writing code, " +
      "explain_rule while choosing a collection's rule, explain_error when a call is " +
      "refused, explain_relay while writing gemmein/relays/<name>.json, " +
      "check_integration before declaring the app done.",
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS as unknown as typeof TOOLS[number][] }));

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const errText = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case "guide":
        return text(sdkFile("llms.txt"));
      case "reference":
        return text(sdkFile("REFERENCE.md"));
      case "search_docs":
        return text(searchDocs(String((args as { query?: string }).query ?? "")));
      case "explain_rule": {
        const rule = (args as { rule?: string }).rule;
        if (!rule) {
          const sheet = Object.entries(RULES)
            .map(([r, d]) => `- \`${r}\` — ${d.contract.split(".")[0]}. Right for: ${d.rightFor}`)
            .join("\n");
          return text(`Gemmein's seven collection safety rules (each collection has exactly one):\n\n${sheet}\n\n${RULES_FOOTER}`);
        }
        const d = RULES[rule];
        if (!d) return errText(`Unknown rule "${rule}". The seven rules: ${Object.keys(RULES).join(", ")}.`);
        return text(`## \`${rule}\`\n\n**Contract:** ${d.contract}\n\n**Right for:** ${d.rightFor}\n\n**Cautions:** ${d.cautions}\n\n${RULES_FOOTER}`);
      }
      case "explain_error": {
        const table = parseErrorTable();
        const code = (args as { code?: string }).code;
        if (!code) {
          return text(
            "Stable GemmeinError codes (branch on err.code, render err.message):\n\n" +
            Object.entries(table).map(([c, e]) => `- \`${c}\` — ${e.meaning}`).join("\n"),
          );
        }
        const e = table[code];
        if (!e) return errText(`"${code}" is not a stable Gemmein error code. Known codes: ${Object.keys(table).join(", ")}.`);
        return text(`## \`${code}\`\n\n**Meaning:** ${e.meaning}\n\n**What to do:** ${e.fix}`);
      }
      case "validate_collection_name": {
        const n = String((args as { name?: string }).name ?? "");
        if (COLLECTION_NAME_RE.test(n)) return text(`"${n}" is a valid collection name.`);
        const suggestion = n.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "").slice(0, 63);
        return text(
          `"${n}" is INVALID — collection names are lowercase letters, numbers, and underscores, starting with a letter (2-63 chars). ` +
          (suggestion && COLLECTION_NAME_RE.test(suggestion) ? `Suggested: "${suggestion}". ` : "") +
          "A bad name throws synchronously from g.collection(name) — at module load it can blank the whole app with no console error.",
        );
      }
      case "reaffirm_template":
        return text(sdkFile("reaffirm.mjs"));
      case "explain_relay": {
        const definition = (args as { definition?: unknown }).definition;
        const answer = explainRelay(definition);
        if (!answer.ok) {
          return {
            content: [{ type: "text" as const, text: `REFUSED — ${answer.refusal}\n\nFix that field and call again. ${CLOUD_ONLY_NOTE}` }],
            structuredContent: { ok: false, refusal: answer.refusal },
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `${answer.sentence}\n\nValid. ${CLOUD_ONLY_NOTE}` }],
          structuredContent: { ok: true, sentence: answer.sentence, definition: answer.definition },
        };
      }
      case "check_integration": {
        const input = args as IntegrationInput;
        if (typeof input.publicKey !== "string" || !input.publicKey.startsWith("pk_")) {
          return errText("publicKey must be the app's public pk_ key (never an sk_ secret).");
        }
        const timeoutMs = input.timeoutMs ?? 30_000;
        const run = runIntegrationChecks(input);
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`check_integration timed out after ${timeoutMs}ms — is the API reachable?`)), timeoutMs).unref?.());
        const { checks, notes } = await Promise.race([run, timeout]);
        const failed = checks.filter((c) => !c.pass);
        const lines = checks.map((c) => `${c.pass ? "✓" : "✗"} ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
        const verdict = failed.length
          ? `${failed.length} boundary check(s) FAILED — treat this as drift between the app's assumptions and its rules; fix before shipping.`
          : "All boundaries reaffirmed.";
        return {
          content: [{
            type: "text" as const,
            text: [lines.join("\n"), notes.map((n) => `ℹ ${n}`).join("\n"), verdict].filter(Boolean).join("\n\n"),
          }],
          structuredContent: { checks, notes, failedCount: failed.length, passed: failed.length === 0 },
          ...(failed.length ? { isError: true } : {}),
        };
      }
      default:
        return errText(`Unknown tool "${name}".`);
    }
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    return errText(`${name} failed: ${err.code ? `[${err.code}] ` : ""}${err.message ?? String(e)}`);
  }
});

await server.connect(new StdioServerTransport());
