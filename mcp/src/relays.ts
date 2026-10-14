// @gemmein/mcp — `explain_relay`: validate a gemmein/relays/<name>.json
// definition OFFLINE and answer the English sentence the console shows, or
// the one refusal sentence the cloud would answer.
//
// This is a PORT of the engine's validator (apps/api/src/relays/schema.ts)
// and its describer, kept in lockstep by test
// (tests/security/relays/mcpLockstep.test.ts runs both over one fixture
// set and asserts identical outcomes) — the published server depends only
// on @gemmein/sdk and cannot import the API. Two cloud-only checks are not
// reproducible offline and are said in the answer instead: the API's own
// host list (gemmein.com is refused here; the API host and the file CDN are
// refused by the cloud) and DNS-time egress rules (private addresses,
// redirects) that run when the call is made, never at definition time.

import { isIP } from "node:net";
import type { WhereOperators } from "@gemmein/sdk";

export type ReceiverScheme = "signature" | "stripe" | "svix" | "shared_token";
export type ReceiverVerify =
  | { scheme: "signature"; algorithm?: "hmac-sha1" | "hmac-sha256" | "hmac-sha512" | "ed25519" | "ecdsa-p256-sha256"; header?: string; signatureField?: string; timestampHeader?: string; timestampKey?: string; timestampField?: string; tokenField?: string; signatureKey?: string; separator?: "," | ";"; signedPayload?: string; toleranceSeconds?: number; encoding?: "hex" | "base64" | "base64url" }
  | { scheme: "stripe" }
  | { scheme: "svix" }
  | { scheme: "shared_token"; header?: string; query?: string };
export type ScheduleEvery = "15m" | "30m" | "1h" | "6h" | "12h" | "1d" | "1w";
export type ScheduleWeekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type RecordChangeKind = "created" | "updated" | "deleted";
export type RelayTrigger =
  | { kind: "receiver"; verify: ReceiverVerify; map?: Record<string, string>; when?: Record<string, string | number | boolean | WhereOperators>; trustUnsignedEvents?: true }
  | { kind: "schedule"; every: ScheduleEvery; at?: string; on?: ScheduleWeekday }
  | { kind: "data_change"; collection: string; on: RecordChangeKind[]; where?: Record<string, string | number | boolean | WhereOperators>; published?: boolean; openField?: string; direction?: "added" | "taken back" | "set" }
  | { kind: "credits_low"; below: number }
  | { kind: "run_started"; tool?: string };
export type RelayAction =
  | { type: "write_record"; collection: string; data: Record<string, unknown>; to?: "person" }
  | { type: "grant_access"; entitlement: string; expiresAt?: string; reason?: string }
  | { type: "grant_credits"; amount: number; reason?: string; expiresInDays?: number; ref?: string }
  | { type: "fulfil_product"; product: string; ref?: string }
  | { type: "refund_product"; product: string; ref?: string }
  | { type: "grant_plan"; plan: string; ref?: string }
  | { type: "revoke_plan"; plan: string; ref?: string }
  | { type: "revoke_access"; entitlement: string }
  | { type: "email_person"; subject: string; text: string; kind?: "event" | "account" }
  | { type: "call_url"; url: string }
  | { type: "start_run"; tool: string; inputs?: Record<string, string> };
export type RelayDefinition = { name: string; trigger: RelayTrigger; actions: RelayAction[] };

export class RelayDefinitionError extends Error {
  readonly code = "invalid_definition" as const;
  constructor(message: string) {
    super(message);
    this.name = "RelayDefinitionError";
  }
}

// ── the vocabulary (packages/core/src/relays.ts, mirrored) ──────────
const RELAY_NAME_RE = /^[a-z][a-z0-9-]{1,62}$/;
const ACTIONS_PER_RELAY = 10;
const MAX_RECORD_BYTES = 32 * 1024;
const SCHEDULE_EVERY: readonly ScheduleEvery[] = ["15m", "30m", "1h", "6h", "12h", "1d", "1w"];
const SCHEDULE_WEEKDAYS: readonly ScheduleWeekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const HEADER_NAME_RE = /^[a-z0-9-]{1,64}$/i;
const QUERY_NAME_RE = /^[a-z0-9_-]{1,64}$/i;
/** A part name inside a signature header — the `ts` of ts=…, the `h1` of h1=…. */
const PART_KEY_RE = /^[A-Za-z0-9_-]{1,32}$/;
const SIGNED_PAYLOAD_MAX = 40;
/** THE RECIPE: the signed text's placeholders, the algorithms, and a body field's bounds. */
const SIGNED_PLACEHOLDERS = ["timestamp", "url", "body", "params", "token"];
const RECIPE_ALGORITHMS = ["hmac-sha1", "hmac-sha256", "hmac-sha512", "ed25519", "ecdsa-p256-sha256"] as const;
type RecipeAlgorithm = (typeof RECIPE_ALGORITHMS)[number];
const BODY_FIELD_MAX = 100;
const BODY_FIELD_DEPTH = 6;
const MAP_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;
const PATH_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;
const COLLECTION_RE = /^[a-z][a-z0-9_]{1,62}$/;
const AT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DURATION_RE = /^(\d{1,4})([hdw])$/;
const MAX_MAP_ENTRIES = 20;
const MAX_WHEN_ENTRIES = 20;
const RECORD_KINDS: readonly RecordChangeKind[] = ["created", "updated", "deleted"];
const ACTION_TYPES = ["write_record", "grant_access", "revoke_access", "email_person", "call_url", "grant_credits", "fulfil_product", "refund_product", "grant_plan", "revoke_plan", "start_run"] as const;
/** W9.5 — mirrors apps/api/src/relays/schema.ts. */
const PRODUCT_NAME_RE = /^[a-z0-9][a-z0-9 _.-]{0,39}$/i;
// W9.3: a relay may grant a person up to 10,000 credits per action.
const MAX_RELAY_CREDITS = 10_000;
// RUNTIME phase 1: a promotional grant's life, in days, and a credits_low threshold.
const MAX_GRANT_EXPIRES_DAYS = 3650;
const CREDITS_LOW_MAX = 1_000_000_000;
const SCHEMES = ["signature", "stripe", "svix", "shared_token"] as const;
const PERSON_ACTIONS: ReadonlySet<string> = new Set(["grant_access", "grant_credits", "revoke_access", "email_person", "fulfil_product", "refund_product", "grant_plan", "revoke_plan", "start_run"]);
/** W10 §1 E — mirrors apps/api/src/relays/schema.ts. */
const PERSON_MAP_KEYS = ["person_email", "person_id", "person_token"] as const;
const PERSON_KEYS_SENTENCE = "person_email (their address, which invites someone who has never signed in), person_id (a gemmein person id) or person_token (the store account token their app filed with a store)";
const ENTITLEMENT_KEY = /^access:[a-z0-9][a-z0-9._-]{0,63}$/;
const RESERVED_FIELD_NAMES = new Set([
  "id", "appId", "app_id", "environmentId", "environment_id", "userId", "user_id", "ownerId", "ownerUserId", "owner_user_id",
  "audienceUserId", "audience_user_id", "audienceId", "tenantId", "tenant_id", "role", "isAdmin", "is_admin",
  "createdAt", "created_at", "updatedAt", "updated_at", "deletedAt", "deleted_at", "published",
]);
const UNSAFE_KEY_NAMES: ReadonlySet<string> = new Set([...Object.getOwnPropertyNames(Object.prototype), "prototype"]);

function isUnsafeName(name: string): boolean { return UNSAFE_KEY_NAMES.has(name); }
function findUnsafeKeys(input: Record<string, unknown>): string[] { return Object.keys(input).filter((k) => UNSAFE_KEY_NAMES.has(k)); }
function findReservedFields(input: Record<string, unknown>): string[] { return Object.keys(input).filter((k) => RESERVED_FIELD_NAMES.has(k)); }
function isOwnHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return h === "gemmein.com" || h.endsWith(".gemmein.com");
}

function refuse(message: string): never { throw new RelayDefinitionError(message); }
function isPlainObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function requireObject(value: unknown, what: string): Record<string, unknown> {
  if (!isPlainObject(value)) refuse(`${what} must be a JSON object`);
  return value;
}
function optionalString(obj: Record<string, unknown>, key: string, what: string, max = 200): string | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") refuse(`${what}.${key} must be text`);
  if (v.length > max) refuse(`${what}.${key} is too long (max ${max} characters)`);
  return v;
}
function requireString(obj: Record<string, unknown>, key: string, what: string, max = 200): string {
  const v = optionalString(obj, key, what, max);
  if (v === undefined || v.trim() === "") refuse(`${what}.${key} is required`);
  return v;
}
function rejectUnknownKeys(obj: Record<string, unknown>, allowed: readonly string[], what: string): void {
  const unknown = Object.keys(obj).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) refuse(`${what} has a field the engine does not know: ${unknown.join(", ")} — the fields it knows are ${allowed.join(", ")}`);
}
function hasTemplate(value: string): boolean { return value.includes("{{"); }

// ── RUNTIME phase 5: the where grammar — a PORT of packages/core
// validateWhere. The published server cannot import the engine (MCP-
// BOUNDARY-1), so the grammar lives here too and the lockstep test holds
// the two equal on every operator, cap and sentence.
type WhereLiteral = string | number | boolean;
const WHERE_OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "contains", "startsWith", "exists"] as const;
const WHERE_FIELDS_MAX = 5;
const WHERE_OPERATORS_PER_FIELD_MAX = 3;
const WHERE_SET_MAX = 50;
const WHERE_TEXT_MAX = 200;
function isWhereOperators(value: unknown): value is WhereOperators {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateWhere(raw: unknown, what = "where"): { ok: true; where: Record<string, WhereLiteral | WhereOperators> } | { ok: false; message: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, message: `${what} must be a JSON object` };
  const keys = Object.keys(raw as Record<string, unknown>);
  if (keys.length > WHERE_FIELDS_MAX) return { ok: false, message: `${what} supports up to ${WHERE_FIELDS_MAX} fields` };
  const out: Record<string, WhereLiteral | WhereOperators> = Object.create(null) as Record<string, WhereLiteral | WhereOperators>;
  const literalProblem = (arg: unknown, path: string): string | null => {
    if (typeof arg === "number" && !Number.isFinite(arg)) return `${path} must be a finite number`;
    if (typeof arg === "string" && arg.length > WHERE_TEXT_MAX) return `${path} is over ${WHERE_TEXT_MAX} characters`;
    return null;
  };
  for (const key of keys) {
    if (key === "__proto__") return { ok: false, message: `${what}.${key} is not a field name` };
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      const problem = literalProblem(v, `${what}.${key}`);
      if (problem) return { ok: false, message: problem };
      out[key] = v; continue;
    }
    if (!isWhereOperators(v)) return { ok: false, message: `${what}.${key} must be a string, number or boolean, or an object of operators (${WHERE_OPERATORS.join(", ")})` };
    const ops = Object.keys(v);
    if (ops.length === 0 || ops.length > WHERE_OPERATORS_PER_FIELD_MAX) return { ok: false, message: `${what}.${key} takes 1 to ${WHERE_OPERATORS_PER_FIELD_MAX} operators` };
    const clean: WhereOperators = {};
    for (const op of ops) {
      const arg = (v as Record<string, unknown>)[op];
      switch (op) {
        case "eq": case "ne":
          if (arg !== null && typeof arg !== "string" && typeof arg !== "number" && typeof arg !== "boolean") return { ok: false, message: `${what}.${key}.${op} must be a string, number, boolean or null` };
          { const problem = literalProblem(arg, `${what}.${key}.${op}`); if (problem) return { ok: false, message: problem }; }
          clean[op] = arg as WhereLiteral | null;
          break;
        case "gt": case "gte": case "lt": case "lte":
          if (typeof arg !== "number" && typeof arg !== "string") return { ok: false, message: `${what}.${key}.${op} must be a number, or a string (compared as text — an ISO date orders correctly)` };
          if (typeof arg === "number" && !Number.isFinite(arg)) return { ok: false, message: `${what}.${key}.${op} must be a finite number` };
          if (typeof arg === "string" && arg.length > WHERE_TEXT_MAX) return { ok: false, message: `${what}.${key}.${op} is over ${WHERE_TEXT_MAX} characters` };
          clean[op] = arg;
          break;
        case "in": case "nin":
          if (!Array.isArray(arg) || arg.length === 0 || arg.length > WHERE_SET_MAX || arg.some((x) => typeof x !== "string" && typeof x !== "number" && typeof x !== "boolean")) return { ok: false, message: `${what}.${key}.${op} must be a list of 1 to ${WHERE_SET_MAX} strings, numbers or booleans` };
          for (const x of arg) { const problem = literalProblem(x, `${what}.${key}.${op}`); if (problem) return { ok: false, message: problem }; }
          clean[op] = arg as WhereLiteral[];
          break;
        case "contains": case "startsWith":
          if (typeof arg !== "string" || arg.length === 0 || arg.length > WHERE_TEXT_MAX) return { ok: false, message: `${what}.${key}.${op} must be text of 1 to ${WHERE_TEXT_MAX} characters` };
          clean[op] = arg;
          break;
        case "exists":
          if (typeof arg !== "boolean") return { ok: false, message: `${what}.${key}.exists must be true or false` };
          clean.exists = arg;
          break;
        default:
          return { ok: false, message: `${what}.${key}.${op} is not an operator — the operators are ${WHERE_OPERATORS.join(", ")}` };
      }
    }
    out[key] = clean;
  }
  return { ok: true, where: out };
}

function validateScalarFilter(raw: unknown, what: string): Record<string, string | number | boolean | WhereOperators> {
  const obj = requireObject(raw, what);
  const keys = Object.keys(obj);
  if (keys.length === 0) refuse(`${what} must name at least one field, or be left out`);
  if (keys.length > MAX_WHEN_ENTRIES) refuse(`${what} names ${keys.length} fields — at most ${MAX_WHEN_ENTRIES}`);
  const unsafe = findUnsafeKeys(obj);
  if (unsafe.length > 0) refuse(`${what} names "${unsafe[0]}", which collides with a JavaScript built-in — pick another field name`);
  // RUNTIME phase 5: a literal (exact match) or an object of operators —
  // the ONE where grammar (the port of packages/core validateWhere above), so a relay's filter
  // and a list's filter never drift. The relay keeps its own field cap.
  const out: Record<string, string | number | boolean | WhereOperators> = {};
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") { out[key] = v; continue; }
    const checked = validateWhere({ [key]: v }, what);
    if (!checked.ok) refuse(checked.message.replace(/^where\./, `${what}.`));
    out[key] = (checked as { where: Record<string, WhereOperators> }).where[key]!;
  }
  return out;
}

/** THE SIGNATURE RECIPE (13 Oct 2026): the text a signature
 *  sender signs, as a template. Placeholders: {timestamp}, {url} (the
 *  relay's public URL — fixed for the relay), and ONE tail that ends the
 *  text: {body} (the raw body), {params} (a form post's fields sorted by
 *  name, name+value) or {token} (tokenField). Each once; a short literal of
 *  letters, digits and . : _ - around them. No boundary may shift: right
 *  after {timestamp} (digits) comes a non-digit literal, {url}, {body} (the
 *  verifier checks the body opens with no digit) or {token} (single use).
 *  {timestamp} is required when a timestamp is named and refused when none
 *  is; {token} likewise with tokenField. A signature inside the body cannot
 *  sign the body. Answers the template to store, or undefined for the
 *  default ({timestamp}.{body} with a timestamp, {body} without). Mirrors apps/api/src/relays/schema.ts. */
function validateSignedPayload(raw: unknown, ctx: { hasTimestamp: boolean; hasToken: boolean; signatureInBody: boolean }): string | undefined {
  const { hasTimestamp } = ctx;
  if (raw === undefined || raw === null) {
    if (ctx.signatureInBody) refuse("trigger.verify.signatureField puts the signature inside the body, so the body cannot be what is signed — set signedPayload to the text the sender's docs say is signed, e.g. {timestamp}{token}");
    if (ctx.hasToken) refuse("trigger.verify.tokenField names a value the signed text leaves out — put {token} in signedPayload where the sender's docs put it, or drop tokenField");
    return undefined;
  }
  if (typeof raw !== "string" || raw.length === 0 || raw.length > SIGNED_PAYLOAD_MAX) refuse(`trigger.verify.signedPayload must be text of 1 to ${SIGNED_PAYLOAD_MAX} characters, like {timestamp}.{body}, v0:{timestamp}:{body} or {url}{params}`);
  const named = [...raw.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]!);
  const unknown = named.find((p) => !SIGNED_PLACEHOLDERS.includes(p));
  if (unknown !== undefined) refuse(`trigger.verify.signedPayload names {${unknown}} — it knows {timestamp} and {url}, and one of {body}, {params} or {token} to end the text`);
  const stray = raw.replace(/\{(?:body|timestamp|url|params|token)\}/g, "").match(/[^A-Za-z0-9._:-]/);
  if (stray) refuse(`trigger.verify.signedPayload holds ${JSON.stringify(stray[0])} — around the placeholders it takes letters, digits and . : _ - only`);
  const tails = named.filter((p) => p === "body" || p === "params" || p === "token");
  if (tails.length === 0) refuse("trigger.verify.signedPayload must end with the event's part of what the sender signs — {body} (the raw body), {params} (a form post's fields) or {token} (tokenField); a signature that covers none of them proves nothing about the event");
  if (tails.every((p) => p === "body") && (tails.length !== 1 || !raw.endsWith("{body}"))) refuse("trigger.verify.signedPayload must end with {body}, once — the raw body is the last part of what a sender signs (e.g. {timestamp}.{body}, v0:{timestamp}:{body})");
  if (tails.length !== 1 || !raw.endsWith(`{${tails[0]}}`)) refuse("trigger.verify.signedPayload must end with ONE of {body}, {params} or {token}, once — the event's part comes last (e.g. {timestamp}.{body}, {url}{params}, {timestamp}{token})");
  const twice = SIGNED_PLACEHOLDERS.find((p) => named.filter((n) => n === p).length > 1);
  if (twice) refuse(`trigger.verify.signedPayload names {${twice}} twice — a sender signs it once`);
  // RSF-R1/R5: a timestamp is digits (recipe.ts), so what follows
  // {timestamp} must not lend it one — else "T" + "1" + "23145" and "T123" +
  // "1" + "45" are one text. A non-digit literal, {url} ("http…"), {body}
  // (the verifier refuses a body opening with a digit) or {token} (a
  // single-use recipe) — never a digit or {params} (a field name may start
  // with one).
  const afterStamp = raw.includes("{timestamp}") ? raw.slice(raw.indexOf("{timestamp}") + "{timestamp}".length) : null;
  if (afterStamp !== null && !/^(?:\{body\}|\{token\}|\{url\}|[^0-9{])/.test(afterStamp)) refuse("trigger.verify.signedPayload must put a character that is not a digit right after {timestamp} — a timestamp is digits, so a digit (or {params}, whose first field name may start with one) straight after it lets digits move between the time and what follows; use what the sender's docs put there, e.g. {timestamp}.{body}, {timestamp}:{body} or {timestamp}{body}");
  const stamps = named.filter((p) => p === "timestamp").length;
  if (stamps === 1 && !hasTimestamp) refuse("trigger.verify.signedPayload names {timestamp}, but nothing says where the timestamp comes from — add timestampHeader (a header of its own), timestampKey (a part of the signature header, like ts) or timestampField (a path into the body)");
  if (stamps === 0 && hasTimestamp) refuse("trigger.verify.signedPayload leaves out {timestamp}, but a timestamp is named — a timestamp the signature does not cover proves nothing; put {timestamp} where the sender's docs put it, or drop the timestamp");
  if (named.includes("token") && !ctx.hasToken) refuse("trigger.verify.signedPayload names {token}, but nothing says where it comes from — add tokenField (a path into the body, like signature.token)");
  if (!named.includes("token") && ctx.hasToken) refuse("trigger.verify.tokenField names a value the signed text leaves out — put {token} in signedPayload where the sender's docs put it, or drop tokenField");
  if (ctx.signatureInBody && (named.includes("body") || named.includes("params"))) refuse("trigger.verify.signatureField puts the signature inside the body, so the signed text cannot hold {body} or {params} (they would hold the signature itself) — use what the sender's docs say is signed, e.g. {timestamp}{token}");
  return raw === (hasTimestamp ? "{timestamp}.{body}" : "{body}") ? undefined : raw;
}

/** A path to a value inside the body (JSON, or a form post's field). */
function validateBodyField(v: Record<string, unknown>, key: string): string | undefined {
  const raw = optionalString(v, key, "trigger.verify", BODY_FIELD_MAX);
  if (raw === undefined) return undefined;
  const segments = raw.split(".");
  if (!PATH_RE.test(raw) || segments.length > BODY_FIELD_DEPTH || segments.some((seg) => isUnsafeName(seg))) refuse(`trigger.verify.${key} "${raw}" is not a path into the body — dotted names like signature.timestamp (letters, digits, _ or -, at most ${BODY_FIELD_DEPTH} parts)`);
  return raw;
}

function validateVerify(raw: unknown): ReceiverVerify {
  const v = requireObject(raw, "trigger.verify");
  const scheme = requireString(v, "scheme", "trigger.verify", 40);
  // THE RENAME (Adil, 13 Oct 2026): the recipe carries any algorithm, so it
  // is `signature`; the old name is refused with the new one, never mapped.
  if (scheme === "hmac_sha256_header") refuse('trigger.verify.scheme "hmac_sha256_header" is now "signature" — the same recipe (header, timestamp, signedPayload, encoding …) under a name that fits every algorithm it checks; change the scheme to "signature"');
  if (!(SCHEMES as readonly string[]).includes(scheme)) {
    refuse(`trigger.verify.scheme "${scheme}" is not one the engine knows — use signature (the signature recipe: an HMAC or a public-key signature over the text the sender signs), stripe (t=/v1=), svix (svix-id/svix-timestamp/svix-signature) or shared_token (a token in a header or ?token=)`);
  }
  switch (scheme as ReceiverScheme) {
    case "signature": {
      rejectUnknownKeys(v, ["scheme", "algorithm", "header", "signatureField", "timestampHeader", "timestampKey", "timestampField", "tokenField", "signatureKey", "separator", "signedPayload", "toleranceSeconds", "encoding"], "trigger.verify");
      // THE SIGNATURE RECIPE (13 Oct 2026): which algorithm, where the
      // signature sits (a header, or a path inside the body), where the
      // timestamp sits, the signed text, the spelling — each optional,
      // each validated; left out, the plain HMAC-SHA256 header holds.
      const algorithm = optionalString(v, "algorithm", "trigger.verify", 24);
      if (algorithm !== undefined && !(RECIPE_ALGORITHMS as readonly string[]).includes(algorithm)) refuse(`trigger.verify.algorithm "${algorithm}" is not one the engine knows — use hmac-sha256 (default), hmac-sha1, hmac-sha512, ed25519 or ecdsa-p256-sha256, whichever the sender's webhook docs name`);
      const header = optionalString(v, "header", "trigger.verify", 64);
      const signatureField = validateBodyField(v, "signatureField");
      if (header === undefined && signatureField === undefined) refuse("trigger.verify.header is required — the header the signature arrives in (or signatureField, a path to it inside the body)");
      if (header !== undefined && signatureField !== undefined) refuse("trigger.verify names the signature's place twice — header (a header of its own) or signatureField (a path inside the body), not both");
      if (header !== undefined && !HEADER_NAME_RE.test(header)) refuse(`trigger.verify.header "${header}" is not a header name (letters, digits, hyphens)`);
      const timestampHeader = optionalString(v, "timestampHeader", "trigger.verify", 64);
      if (timestampHeader !== undefined && !HEADER_NAME_RE.test(timestampHeader)) refuse(`trigger.verify.timestampHeader "${timestampHeader}" is not a header name (letters, digits, hyphens)`);
      const timestampKey = optionalString(v, "timestampKey", "trigger.verify", 32);
      if (timestampKey !== undefined && !PART_KEY_RE.test(timestampKey)) refuse(`trigger.verify.timestampKey "${timestampKey}" is not a part name — the name before "=" in the signature header, like ts or t (letters, digits, _ or -, up to 32)`);
      if (timestampHeader !== undefined && timestampKey !== undefined) refuse("trigger.verify names the timestamp twice — use timestampHeader when the sender puts it in a header of its own, or timestampKey when it sits inside the signature header (like ts=…), not both");
      const timestampField = validateBodyField(v, "timestampField");
      if (timestampField !== undefined && (timestampHeader !== undefined || timestampKey !== undefined)) refuse("trigger.verify names the timestamp twice — timestampField reads it from the body; drop timestampHeader / timestampKey, or timestampField");
      const signatureKey = optionalString(v, "signatureKey", "trigger.verify", 32);
      if (signatureKey !== undefined && !PART_KEY_RE.test(signatureKey)) refuse(`trigger.verify.signatureKey "${signatureKey}" is not a part name — the name before "=" in front of the signature, like h1, v1, v0 or sha256 (letters, digits, _ or -, up to 32)`);
      if (signatureKey !== undefined && signatureKey === timestampKey) refuse(`trigger.verify.signatureKey and trigger.verify.timestampKey are both "${signatureKey}" — one part carries the time and another the signature; the sender's docs name each`);
      let separator: "," | ";" | undefined;
      if (v.separator !== undefined) {
        if (v.separator !== "," && v.separator !== ";") refuse('trigger.verify.separator must be "," (default) or ";" — the character between the parts of the signature header (ts=…;h1=… uses ";")');
        separator = v.separator as "," | ";";
      }
      if (signatureField !== undefined && (timestampKey !== undefined || signatureKey !== undefined || separator !== undefined)) refuse("trigger.verify.timestampKey, signatureKey and separator read the parts of a signature HEADER — with signatureField the body field holds the signature itself (use timestampField for a timestamp in the body)");
      const tokenField = validateBodyField(v, "tokenField");
      if (tokenField !== undefined && signatureField === undefined) refuse("trigger.verify.tokenField is a value the sender signs from the body beside a signature that sits in the body too (like signature.token) — add signatureField, or drop tokenField");
      const fields = [signatureField, timestampField, tokenField].filter((f): f is string => f !== undefined);
      if (new Set(fields).size !== fields.length) refuse("trigger.verify reads two things from one body field — signatureField, timestampField and tokenField each name their own path");
      const hasTimestamp = timestampHeader !== undefined || timestampKey !== undefined || timestampField !== undefined;
      let toleranceSeconds: number | undefined;
      if (v.toleranceSeconds !== undefined) {
        if (!hasTimestamp) refuse("trigger.verify.toleranceSeconds needs trigger.verify.timestampHeader or trigger.verify.timestampKey (or timestampField) — without a timestamp there is no window to tolerate");
        if (typeof v.toleranceSeconds !== "number" || !Number.isInteger(v.toleranceSeconds) || v.toleranceSeconds < 1 || v.toleranceSeconds > 300) {
          refuse("trigger.verify.toleranceSeconds must be a whole number of seconds between 1 and 300 — five minutes is the most the engine tolerates");
        }
        toleranceSeconds = v.toleranceSeconds;
      }
      const signedPayload = validateSignedPayload(v.signedPayload, { hasTimestamp, hasToken: tokenField !== undefined, signatureInBody: signatureField !== undefined });
      const encoding = optionalString(v, "encoding", "trigger.verify", 10);
      if (encoding !== undefined && encoding !== "hex" && encoding !== "base64" && encoding !== "base64url") refuse('trigger.verify.encoding must be "hex" (default), "base64" or "base64url" — how the sender spells the signature');
      // Defaults are left out of the stored definition, so a file written
      // before these fields existed reads back byte for byte.
      return {
        scheme: "signature",
        ...(algorithm !== undefined && algorithm !== "hmac-sha256" ? { algorithm: algorithm as RecipeAlgorithm } : {}),
        ...(header !== undefined ? { header: header.toLowerCase() } : {}),
        ...(signatureField !== undefined ? { signatureField } : {}),
        ...(timestampHeader !== undefined ? { timestampHeader: timestampHeader.toLowerCase(), toleranceSeconds: toleranceSeconds ?? 300 } : {}),
        ...(timestampKey !== undefined ? { timestampKey, toleranceSeconds: toleranceSeconds ?? 300 } : {}),
        ...(timestampField !== undefined ? { timestampField, toleranceSeconds: toleranceSeconds ?? 300 } : {}),
        ...(tokenField !== undefined ? { tokenField } : {}),
        ...(signatureKey !== undefined ? { signatureKey } : {}),
        ...(separator === ";" ? { separator } : {}),
        ...(signedPayload !== undefined ? { signedPayload } : {}),
        encoding: encoding === "base64" || encoding === "base64url" ? encoding : "hex",
      };
    }
    case "stripe":
      rejectUnknownKeys(v, ["scheme"], "trigger.verify");
      return { scheme: "stripe" };
    case "svix":
      rejectUnknownKeys(v, ["scheme"], "trigger.verify");
      return { scheme: "svix" };
    case "shared_token": {
      rejectUnknownKeys(v, ["scheme", "header", "query"], "trigger.verify");
      const header = optionalString(v, "header", "trigger.verify", 64);
      if (header !== undefined && !HEADER_NAME_RE.test(header)) refuse(`trigger.verify.header "${header}" is not a header name (letters, digits, hyphens)`);
      const query = optionalString(v, "query", "trigger.verify", 64);
      if (query !== undefined && !QUERY_NAME_RE.test(query)) refuse(`trigger.verify.query "${query}" is not a query parameter name`);
      return { scheme: "shared_token", header: (header ?? "x-webhook-token").toLowerCase(), query: query ?? "token" };
    }
  }
}

function validateReceiver(t: Record<string, unknown>): RelayTrigger {
  rejectUnknownKeys(t, ["kind", "verify", "map", "when", "trustUnsignedEvents"], "trigger");
  if (t.verify === undefined) refuse("trigger.verify is required on a receiver — say how the provider signs its calls (signature, stripe, svix or shared_token)");
  const verify = validateVerify(t.verify);
  const trustUnsignedEvents = validateUnsignedEventsFlag(t.trustUnsignedEvents, verify);
  let map: Record<string, string> | undefined;
  if (t.map !== undefined) {
    const m = requireObject(t.map, "trigger.map");
    const keys = Object.keys(m);
    if (keys.length > MAX_MAP_ENTRIES) refuse(`trigger.map names ${keys.length} fields — at most ${MAX_MAP_ENTRIES}`);
    map = {};
    for (const key of keys) {
      if (isUnsafeName(key) || !MAP_NAME_RE.test(key)) refuse(`trigger.map field "${key}" must be a simple name (letters, digits, underscores, starting with a letter)`);
      const path = m[key];
      if (typeof path !== "string" || path.length === 0 || path.length > 200 || !PATH_RE.test(path)) {
        refuse(`trigger.map.${key} must be a dotted path into the provider's payload, like events.0.details.customer_email`);
      }
      if (path.split(".").some((seg) => isUnsafeName(seg))) refuse(`trigger.map.${key} walks through "${path.split(".").find((seg) => isUnsafeName(seg))}", which is never a field`);
      map[key] = path;
    }
    const named = PERSON_MAP_KEYS.filter((k) => k in map!);
    if (named.length > 1) {
      refuse(`trigger.map names ${named.join(" and ")} — a map names the person ONE way: ${PERSON_KEYS_SENTENCE}. Keep the one your provider actually sends and delete the others.`);
    }
  }
  let when: Record<string, string | number | boolean | WhereOperators> | undefined;
  if (t.when !== undefined) {
    when = validateScalarFilter(t.when, "trigger.when");
    for (const key of Object.keys(when)) {
      if (!map || !(key in map)) refuse(`trigger.when names "${key}", which trigger.map does not define — when filters the MAPPED fields; add "${key}" to the map first`);
    }
  }
  return { kind: "receiver", verify, ...(map ? { map } : {}), ...(when ? { when } : {}), ...(trustUnsignedEvents ? { trustUnsignedEvents: true as const } : {}) };
}

// ── UNSIGNED EVENTS (packages/contracts/src/relayUnsignedEvents.ts, mirrored) ──
/** The only actions an unsigned-event relay runs without the opt-in. Every
 *  other action (today's and any added later) needs it. */
export const UNSIGNED_EVENT_SAFE_ACTIONS: readonly string[] = ["write_record", "call_url"];

type VerifyLike = { scheme: string; signedPayload?: string; toleranceSeconds?: number; timestampHeader?: string; timestampKey?: string; timestampField?: string };

/** A receiver whose sender does not sign the event's content: a token-only
 *  signature recipe, or a shared token. ({params} — Twilio — signs every field.) */
export function isUnsignedEventRecipe(verify: VerifyLike | undefined): boolean {
  if (verify?.scheme === "shared_token") return true;
  return verify?.scheme === "signature" && typeof verify.signedPayload === "string" && verify.signedPayload.endsWith("{token}");
}

const stamped = (verify: VerifyLike) => verify.scheme === "signature" && (verify.timestampHeader !== undefined || verify.timestampKey !== undefined || verify.timestampField !== undefined);

/** How long a captured call can be reused for a fake event, in seconds — Infinity when ever. */
export function unsignedEventWindowSeconds(verify: VerifyLike): number {
  return stamped(verify) ? (verify.toleranceSeconds ?? 300) : Number.POSITIVE_INFINITY;
}

/** The same window in words. */
export function unsignedEventWindow(verify: VerifyLike): string {
  if (!stamped(verify)) return "at any time";
  const s = verify.toleranceSeconds ?? 300;
  if (s % 60 === 0) return `within ${s / 60} ${s === 60 ? "minute" : "minutes"}`;
  return `within ${s} seconds`;
}

/** What a captured call buys, in words ("fake one event within 5 minutes") —
 *  the Logs row records it before → after when a save moves it. */
export function unsignedEventExposure(verify: VerifyLike): string {
  return exposure(verify).fake;
}

/** How much a captured call buys, comparable: a shared token (any number,
 *  any time) is wider than any token recipe; a longer window is wider. */
export function unsignedEventExposureRank(verify: VerifyLike): number {
  return verify.scheme === "shared_token" ? Number.MAX_VALUE : unsignedEventWindowSeconds(verify);
}

/** What the sender signs, and what a captured call buys, in plain words. */
function exposure(verify: VerifyLike): { what: string; fake: string } {
  if (verify.scheme === "shared_token") return { what: "it sends the same token on every call, not a signature", fake: "fake any number of events at any time" };
  return { what: "it signs only a token", fake: `fake one event ${unsignedEventWindow(verify)}` };
}

/** The save-time refusal: an action that needs the opt-in. */
export function unsignedEventRefusal(index: number, type: string, verify: VerifyLike): string {
  const e = exposure(verify);
  return `actions[${index}] ${type}: this sender doesn't sign the event itself — ${e.what}. Anyone who captures one call can ${e.fake}. To let this relay act on it anyway, set trigger.trustUnsignedEvents: true; or keep this relay to write_record and call_url, have your function check the event with the sender's API, and act from a data_change.`;
}

/** The save-time refusal: a map that creates people (person_email) without the opt-in. */
export function unsignedEventPersonRefusal(verify: VerifyLike): string {
  const e = exposure(verify);
  return `trigger.map.person_email creates a person who has never signed in, and this sender doesn't sign the event itself — ${e.what}. Anyone who captures one call can ${e.fake}. Name the person by person_id or person_token (they never create anyone), or set trigger.trustUnsignedEvents: true to create people from it anyway.`;
}

/** The one-line warning shown wherever the opt-in is on (dashboard, CLI, sync, Promote). */
export function unsignedEventWarning(verify: VerifyLike): string {
  const e = exposure(verify);
  return `This sender doesn't sign the event itself (${e.what}): anyone who captures one call can ${e.fake}, and this relay acts on it (trigger.trustUnsignedEvents is on).`;
}

function validateUnsignedEventsFlag(raw: unknown, verify: ReceiverVerify): boolean {
  if (raw === undefined || raw === false) return false;
  if (raw !== true) refuse("trigger.trustUnsignedEvents is true or false — true lets this relay act on events its sender doesn't sign");
  if (!isUnsignedEventRecipe(verify)) refuse("trigger.trustUnsignedEvents is only for a sender that doesn't sign the event itself (a shared_token, or a signature recipe whose signedPayload ends in {token}) — this relay's sender signs the event, so it needs no opt-in; remove it");
  return true;
}
function unsignedEventProblem(def: { trigger: RelayTrigger; actions: RelayAction[] }): string | null {
  const t = def.trigger;
  if (t.kind !== "receiver" || !isUnsignedEventRecipe(t.verify) || t.trustUnsignedEvents === true) return null;
  if (t.map && "person_email" in t.map) return unsignedEventPersonRefusal(t.verify);
  const i = def.actions.findIndex((a) => !UNSIGNED_EVENT_SAFE_ACTIONS.includes(a.type));
  return i === -1 ? null : unsignedEventRefusal(i, def.actions[i]!.type, t.verify);
}

function validateSchedule(t: Record<string, unknown>): RelayTrigger {
  rejectUnknownKeys(t, ["kind", "every", "at", "on"], "trigger");
  const every = requireString(t, "every", "trigger", 10);
  if (!(SCHEDULE_EVERY as readonly string[]).includes(every)) refuse(`trigger.every "${every}" is not a period the engine runs — use one of ${SCHEDULE_EVERY.join(", ")} (nothing under 15 minutes)`);
  const at = optionalString(t, "at", "trigger", 5);
  if (at !== undefined) {
    if (every !== "1d" && every !== "1w") refuse('trigger.at is only for every: "1d" or "1w" — a shorter period runs on the clock boundary');
    if (!AT_RE.test(at)) refuse('trigger.at must be "HH:MM" in UTC, like "09:00"');
  }
  const on = optionalString(t, "on", "trigger", 10);
  if (every === "1w" && on === undefined) refuse('a weekly schedule needs trigger.on — the day it runs: "monday" … "sunday" (and optionally trigger.at, "HH:MM" UTC; 00:00 when unset)');
  if (on !== undefined) {
    if (every !== "1w") refuse('trigger.on is only for every: "1w" — the day a weekly schedule runs');
    if (!(SCHEDULE_WEEKDAYS as readonly string[]).includes(on)) refuse(`trigger.on "${on}" is not a weekday — use monday, tuesday, wednesday, thursday, friday, saturday or sunday (lowercase)`);
  }
  return { kind: "schedule", every: every as ScheduleEvery, ...(at !== undefined ? { at } : {}), ...(on !== undefined ? { on: on as ScheduleWeekday } : {}) };
}

function validateDataChange(t: Record<string, unknown>): RelayTrigger {
  rejectUnknownKeys(t, ["kind", "collection", "on", "where", "published", "openField", "direction"], "trigger");
  const collection = requireString(t, "collection", "trigger", 64);
  if (!COLLECTION_RE.test(collection)) refuse(`trigger.collection "${collection}" is not a collection name (lowercase letters, digits, underscores)`);
  if (!Array.isArray(t.on) || t.on.length === 0) refuse('trigger.on must be a non-empty list from "created", "updated", "deleted"');
  const on: RecordChangeKind[] = [];
  for (const item of t.on) {
    if (typeof item !== "string" || !(RECORD_KINDS as readonly string[]).includes(item)) refuse(`trigger.on contains "${String(item)}" — only created, updated and deleted exist`);
    if (!on.includes(item as RecordChangeKind)) on.push(item as RecordChangeKind);
  }
  let where: Record<string, string | number | boolean | WhereOperators> | undefined;
  if (t.where !== undefined) {
    where = validateScalarFilter(t.where, "trigger.where");
    const reserved = findReservedFields(where);
    if (reserved.length > 0) refuse(`trigger.where names "${reserved[0]}", a server-managed field — filter on the record's own data`);
  }
  if (t.published !== undefined && typeof t.published !== "boolean") {
    refuse("trigger.published is true (the record is public after the write) or false (it is a draft — on a moderated collection, waiting for your approval)");
  }
  const published = t.published as boolean | undefined;
  if (t.openField !== undefined && (typeof t.openField !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(t.openField))) {
    refuse("trigger.openField names one of the collection's open fields (from \"openFields\" in gemmein/collections/<name>.json)");
  }
  if (t.openField !== undefined && !on.includes("updated")) {
    refuse('trigger.openField fires when a reader changes that open field — put "updated" in trigger.on; it never fires on content edits, and a plain "updated" trigger never fires on open fields');
  }
  const openField = t.openField as string | undefined;
  if (t.direction !== undefined && (t.openField === undefined || !["added", "taken back", "set"].includes(t.direction as string))) {
    refuse('trigger.direction goes with trigger.openField and is "added" (someone liked / flagged), "taken back" (they undid it) or "set" (a choice was made)');
  }
  const direction = t.direction as "added" | "taken back" | "set" | undefined;

  return { kind: "data_change", collection, on, ...(where ? { where } : {}), ...(published !== undefined ? { published } : {}), ...(openField !== undefined ? { openField } : {}), ...(direction !== undefined ? { direction } : {}) };
}

/** RUNTIME phase 1: `below` is a whole number of credits, 1..1,000,000,000. */
function validateCreditsLow(t: Record<string, unknown>): RelayTrigger {
  rejectUnknownKeys(t, ["kind", "below"], "trigger");
  const below = t.below;
  if (typeof below !== "number" || !Number.isInteger(below) || below < 1 || below > CREDITS_LOW_MAX) {
    refuse(`trigger.below must be a whole number from 1 to ${CREDITS_LOW_MAX.toLocaleString("en-GB")} credits — the relay fires when a person's spendable credits fall under it`);
  }
  return { kind: "credits_low", below: below as number };
}

function validateTrigger(raw: unknown): RelayTrigger {
  const t = requireObject(raw, "trigger");
  const kind = requireString(t, "kind", "trigger", 40);
  switch (kind) {
    case "receiver": return validateReceiver(t);
    case "schedule": return validateSchedule(t);
    case "data_change": return validateDataChange(t);
    case "credits_low": return validateCreditsLow(t);
    case "run_started": {
      rejectUnknownKeys(t, ["kind", "tool"], "trigger");
      if (t.tool === undefined || t.tool === null) return { kind: "run_started" };
      if (typeof t.tool !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(t.tool)) refuse("trigger.tool must be the name of an AI tool (1-40 lowercase letters, numbers or hyphens) — or leave it out for every tool");
      return { kind: "run_started", tool: t.tool as string };
    }
    default:
      return refuse(`trigger.kind "${kind}" is not a trigger the engine has — use receiver (a provider's webhook), schedule (a clock), data_change (a record changing), credits_low (a person's credits falling under a number) or run_started (a person starting a run)`);
  }
}

function validateEntitlementInput(value: unknown, what: string): string {
  if (typeof value !== "string" || value.trim() === "") refuse(`${what}.entitlement is required — a plan or product name, or an access:<name> key`);
  if (hasTemplate(value)) refuse(`${what}.entitlement cannot carry a template — a grant must name what it grants`);
  if (value.length > 100) refuse(`${what}.entitlement is too long (max 100 characters)`);
  if (/^access:/i.test(value)) {
    if (!ENTITLEMENT_KEY.test(value.toLowerCase())) {
      refuse(`${what}.entitlement: requires must look like access:<name> — lowercase letters, numbers, dot, dash or underscore, up to 64 characters. access is the only kind that exists: credits, quotas and seats aren't supported yet`);
    }
    const slug = value.slice(value.indexOf(":") + 1);
    if (isUnsafeName(slug)) refuse(`${what}.entitlement "${value}" collides with a JavaScript built-in — name the plan something a person would say`);
  }
  return value.trim();
}

function validateAction(raw: unknown, index: number, triggerKind: RelayTrigger["kind"]): RelayAction {
  const what = `actions[${index}]`;
  const a = requireObject(raw, what);
  const type = requireString(a, "type", what, 40);
  if (!(ACTION_TYPES as readonly string[]).includes(type)) {
    refuse(`${what}.type "${type}" is not an action the engine has — the verbs are ${ACTION_TYPES.join(", ")}; anything else is compute, and compute runs on your own server behind call_url`);
  }
  if (triggerKind === "schedule" && PERSON_ACTIONS.has(type)) {
    refuse(`${what}: a schedule has no person, so ${type} has no one to act on — trigger it from a receiver whose map names ${PERSON_KEYS_SENTENCE}, or from a data_change on a collection whose records have an owner`);
  }
  switch (type as RelayAction["type"]) {
    case "write_record": {
      rejectUnknownKeys(a, ["type", "collection", "data", "to"], what);
      const collection = requireString(a, "collection", what, 64);
      if (!COLLECTION_RE.test(collection)) refuse(`${what}.collection "${collection}" is not a collection name (lowercase letters, digits, underscores)`);
      const data = requireObject(a.data, `${what}.data`);
      if (Object.keys(data).length === 0) refuse(`${what}.data must carry at least one field`);
      const reserved = findReservedFields(data);
      if (reserved.length > 0) refuse(`${what}.data names "${reserved[0]}", a server-managed field — the engine writes it`);
      const unsafe = findUnsafeKeys(data);
      if (unsafe.length > 0) refuse(`${what}.data names "${unsafe[0]}", which collides with a JavaScript built-in`);
      if (Buffer.byteLength(JSON.stringify(data), "utf8") > MAX_RECORD_BYTES) refuse(`${what}.data: Storage record payload exceeds ${MAX_RECORD_BYTES} bytes`);
      const to = optionalString(a, "to", what, 10);
      if (to !== undefined && to !== "person") refuse(`${what}.to can only be "person" (the record is addressed to the event's person) — leave it out for an app-owned record`);
      if (to === "person" && triggerKind === "schedule") {
        refuse(`${what}: a schedule has no person, so to: "person" has no one to address — leave it out, or trigger from a receiver or a data_change`);
      }
      return { type: "write_record", collection, data: structuredClone(data), ...(to === "person" ? { to: "person" as const } : {}) };
    }
    case "grant_access": {
      rejectUnknownKeys(a, ["type", "entitlement", "expiresAt", "reason"], what);
      const entitlement = validateEntitlementInput(a.entitlement, what);
      const expiresAt = optionalString(a, "expiresAt", what, 40);
      if (expiresAt !== undefined && !DURATION_RE.test(expiresAt) && Number.isNaN(Date.parse(expiresAt))) {
        refuse(`${what}.expiresAt must be a duration from the moment of the grant ("30d", "12h", "2w") or an ISO date`);
      }
      const reason = optionalString(a, "reason", what, 200);
      return { type: "grant_access", entitlement, ...(expiresAt !== undefined ? { expiresAt } : {}), ...(reason !== undefined ? { reason } : {}) };
    }
    case "grant_credits": {
      // W9.3 — mirrors apps/api/src/relays/schema.ts (the lockstep test
      // holds them equal): a whole number of credits, 1..10,000, and an
      // optional reason the owner reads in the ledger.
      rejectUnknownKeys(a, ["type", "amount", "reason", "expiresInDays", "ref"], what);
      const amount = a.amount;
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > MAX_RELAY_CREDITS) {
        refuse(`${what}.amount must be a whole number from 1 to ${MAX_RELAY_CREDITS.toLocaleString("en-GB")} credits`);
      }
      const reason = optionalString(a, "reason", what, 200);
      let expiresInDays: number | undefined;
      if (a.expiresInDays !== undefined) {
        if (typeof a.expiresInDays !== "number" || !Number.isInteger(a.expiresInDays) || a.expiresInDays < 1 || a.expiresInDays > MAX_GRANT_EXPIRES_DAYS) {
          refuse(`${what}.expiresInDays must be a whole number of days from 1 to ${MAX_GRANT_EXPIRES_DAYS.toLocaleString("en-GB")} — leave it out for credits that never expire`);
        }
        expiresInDays = a.expiresInDays as number;
      }
      // F5: once per person + ref, forever (mirrors the engine).
      const rawRef = a.ref;
      if (rawRef !== undefined && rawRef !== null && (typeof rawRef !== "string" || rawRef.trim() === "" || rawRef.length > 200)) {
        refuse(`${what}.ref must be text of at most 200 characters (templates allowed)`);
      }
      const ref = typeof rawRef === "string" ? rawRef : undefined;
      return { type: "grant_credits", amount, ...(reason !== undefined ? { reason } : {}), ...(expiresInDays !== undefined ? { expiresInDays } : {}), ...(ref !== undefined ? { ref } : {}) };
    }
    case "fulfil_product":
    case "refund_product": {
      // W9.5 — mirrors apps/api/src/relays/schema.ts (the lockstep test holds
      // them equal): the product is a NAME, never a template; the payment
      // reference may be a template, because it comes out of the event.
      rejectUnknownKeys(a, ["type", "product", "ref"], what);
      const product = a.product;
      if (typeof product !== "string" || !PRODUCT_NAME_RE.test(product.trim())) {
        refuse(`${what}.product must be a product name (1-40 letters, numbers, spaces, or -_.)`);
      }
      const rawRef = a.ref;
      // A written ref that is empty is not the absent ref: absent means "make
      // one from the event id", and a blank string would silently take that
      // road instead of the one the founder wrote. Refused here.
      if (
        rawRef !== undefined &&
        rawRef !== null &&
        (typeof rawRef !== "string" || rawRef.trim() === "" || rawRef.length > 200)
      ) {
        refuse(`${what}.ref must be text of at most 200 characters (templates allowed)`);
      }
      const ref = typeof rawRef === "string" ? rawRef : undefined;
      return { type: a.type as "fulfil_product" | "refund_product", product: (product as string).trim(), ...(ref !== undefined ? { ref } : {}) };
    }
    case "grant_plan":
    case "revoke_plan": {
      // W9.7 — mirrors apps/api/src/relays/schema.ts (the lockstep test holds
      // them equal): the plan is a NAME, never a template; the payment
      // reference may be a template, because it comes out of the event.
      rejectUnknownKeys(a, ["type", "plan", "ref"], what);
      const plan = a.plan;
      if (typeof plan !== "string" || !PRODUCT_NAME_RE.test(plan.trim())) {
        refuse(`${what}.plan must be a plan name (1-40 letters, numbers, spaces, or -_.)`);
      }
      const rawRef = a.ref;
      if (
        rawRef !== undefined &&
        rawRef !== null &&
        (typeof rawRef !== "string" || rawRef.trim() === "" || rawRef.length > 200)
      ) {
        refuse(`${what}.ref must be text of at most 200 characters (templates allowed)`);
      }
      const ref = typeof rawRef === "string" ? rawRef : undefined;
      return { type: a.type as "grant_plan" | "revoke_plan", plan: (plan as string).trim(), ...(ref !== undefined ? { ref } : {}) };
    }
    case "revoke_access": {
      rejectUnknownKeys(a, ["type", "entitlement"], what);
      return { type: "revoke_access", entitlement: validateEntitlementInput(a.entitlement, what) };
    }
    case "email_person": {
      rejectUnknownKeys(a, ["type", "subject", "text", "kind"], what);
      const subject = requireString(a, "subject", what, 300);
      const text = requireString(a, "text", what, 10_000);
      const kind = optionalString(a, "kind", what, 10);
      if (kind !== undefined && kind !== "event" && kind !== "account") refuse(`${what}.kind must be "event" (capped per person) or "account" (account activity — sign-in, access, billing trouble)`);
      return { type: "email_person", subject: subject.replace(/[\r\n]+/g, " ").trim(), text, ...(kind !== undefined ? { kind: kind as "event" | "account" } : {}) };
    }
    case "start_run": {
      rejectUnknownKeys(a, ["type", "tool", "inputs"], what);
      const tool = requireString(a, "tool", what, 40);
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(tool)) refuse(`${what}.tool must be the name of an AI tool (1-40 lowercase letters, numbers or hyphens)`);
      let inputs: Record<string, string> | undefined;
      if (a.inputs !== undefined && a.inputs !== null) {
        const raw = requireObject(a.inputs, `${what}.inputs`);
        const unsafe = findUnsafeKeys(raw);
        if (unsafe.length > 0) refuse(`${what}.inputs names "${unsafe[0]}", which collides with a JavaScript built-in`);
        const entries = Object.entries(raw);
        if (entries.length > 20) refuse(`${what}.inputs carries more than 20 entries — a tool declares at most that many`);
        const out: Record<string, string> = {};
        for (const [k, v] of entries) {
          if (!/^[a-z][a-z0-9_]{0,63}$/.test(k)) refuse(`${what}.inputs names "${k}", which is not an input name (lowercase letters, digits, underscores, starting with a letter)`);
          if (typeof v !== "string" || v.length > 4_000) refuse(`${what}.inputs.${k} must be text of up to 4,000 characters (a template)`);
          out[k] = v;
        }
        inputs = out;
      }
      return { type: "start_run", tool, ...(inputs ? { inputs } : {}) };
    }
    case "call_url": {
      rejectUnknownKeys(a, ["type", "url"], what);
      const url = requireString(a, "url", what, 2048);
      if (hasTemplate(url)) refuse(`${what}.url cannot carry a template — the address is checked before every call, and a substituted address would be a different one`);
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return refuse(`${what}.url must be an absolute https:// URL`);
      }
      const host = parsed.hostname.replace(/^\[|\]$/g, "");
      if (parsed.protocol !== "https:") refuse(`${what}.url must be https:// — http:// and every other scheme are refused`);
      if (isIP(host) !== 0) refuse(`${what}.url must name a host, not an IP address`);
      if (isOwnHost(host)) refuse(`${what}.url must not point at gemmein.com, a gemmein.com subdomain, the API's own host or the file CDN`);
      if (parsed.username || parsed.password) refuse(`${what}.url must not carry credentials — put a secret in your function, not in the address`);
      return { type: "call_url", url };
    }
  }
}

/** The cloud's rules (localMode off: https only). Throws
 *  RelayDefinitionError with the one sentence. */
// Round 5 (port of apps/api/src/relays/schema.ts): a grant or take action
// is unique by its target in one relay.
function grantTarget(action: { type: string } & Record<string, unknown>): string | null {
  switch (action.type) {
    case "fulfil_product":
    case "refund_product": return `product:${String(action.product ?? "").trim().toLowerCase()}`;
    case "grant_plan":
    case "revoke_plan": return "plan";
    case "grant_access":
    case "revoke_access": return `access:${String(action.entitlement ?? "").trim().toLowerCase()}`;
    case "grant_credits": return "credits";
    default: return null;
  }
}
const TARGET_WORDS: Record<string, (target: string) => string> = {
  fulfil_product: (t) => `the product "${t.slice("product:".length)}"`,
  refund_product: (t) => `the product "${t.slice("product:".length)}"`,
  grant_plan: () => "a plan (one grant_plan per relay)",
  revoke_plan: () => "a plan (one revoke_plan per relay)",
  grant_access: (t) => `the access "${t.slice("access:".length)}"`,
  revoke_access: (t) => `the access "${t.slice("access:".length)}"`,
  grant_credits: () => "credits (one grant_credits per relay — write one with the summed amount)",
};
function assertUniqueGrantTargets(actions: ReadonlyArray<{ type: string } & Record<string, unknown>>): void {
  const seen = new Map<string, number>();
  actions.forEach((action, i) => {
    const target = grantTarget(action);
    if (target === null) return;
    const key = `${action.type}|${target}`;
    const first = seen.get(key);
    if (first !== undefined) {
      refuse(`actions[${i}] ${action.type} acts on ${TARGET_WORDS[action.type]!(target)} again (actions[${first}] already does) — a relay grants or takes each target once; merge the two into one action`);
    }
    seen.set(key, i);
  });
}

export function validateRelayDefinition(input: unknown): RelayDefinition {
  const def = requireObject(input, "the relay");
  rejectUnknownKeys(def, ["name", "trigger", "actions"], "the relay");
  const name = requireString(def, "name", "the relay", 64);
  if (!RELAY_NAME_RE.test(name)) refuse(`name "${name}" must be 2–63 lowercase letters, digits and hyphens, starting with a letter — it becomes the receiver URL and the file name`);
  const trigger = validateTrigger(def.trigger);
  if (!Array.isArray(def.actions) || def.actions.length === 0) refuse("actions must be a non-empty list — a relay that does nothing is not one");
  if (def.actions.length > ACTIONS_PER_RELAY) refuse(`actions lists ${def.actions.length} — at most ${ACTIONS_PER_RELAY} per relay; split the rest into a second relay`);
  const actions = def.actions.map((raw, i) => validateAction(raw, i, trigger.kind));
  assertUniqueGrantTargets(actions as unknown as Array<{ type: string } & Record<string, unknown>>);
  // OPEN FIELDS (re-review, 6 Oct): likes, choices and flags never move money.
  if (trigger.kind === "data_change" && (trigger as { openField?: string }).openField !== undefined && actions.some((a) => MONEY_ACTIONS.has((a as { type: string }).type))) {
    refuse("a like or a choice can't move money — trigger this relay on a record update or a payment instead (trigger.openField is for notices: an email, a webhook, a note)");
  }
  const unsigned = unsignedEventProblem({ trigger, actions: actions as RelayAction[] });
  if (unsigned !== null) refuse(unsigned);
  return { name, trigger, actions };
}

// ── the English sentence (schema.ts describeRelay, mirrored) ────────
const EVERY_WORDS: Record<ScheduleEvery, string> = {
  "15m": "Every 15 minutes",
  "30m": "Every 30 minutes",
  "1h": "Every hour",
  "6h": "Every 6 hours",
  "12h": "Every 12 hours",
  "1d": "Every day",
  "1w": "Every week",
};
/** "an orders record", "a bookings record": the article agrees with the name. */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function filterWords(filter: Record<string, unknown> | undefined): string {
  if (!filter) return "";
  const lit = (v: unknown): string => (v === null ? "empty" : String(v));
  const opWords = (ops: Record<string, unknown>): string => Object.entries(ops).map(([op, arg]) => {
    switch (op) {
      case "eq": return `is ${lit(arg)}`;
      case "ne": return `is not ${lit(arg)}`;
      case "gt": return `is over ${lit(arg)}`;
      case "gte": return `is at least ${lit(arg)}`;
      case "lt": return `is under ${lit(arg)}`;
      case "lte": return `is at most ${lit(arg)}`;
      case "in": return `is one of ${(arg as unknown[]).map(lit).join(", ")}`;
      case "nin": return `is none of ${(arg as unknown[]).map(lit).join(", ")}`;
      case "contains": return `contains ${lit(arg)}`;
      case "startsWith": return `starts with ${lit(arg)}`;
      case "exists": return arg ? "is set" : "is missing";
      default: return `${op} ${lit(arg)}`;
    }
  }).join(" and ");
  return " where " + Object.entries(filter).map(([k, v]) => `${k} ${typeof v === "object" && v !== null ? opWords(v as Record<string, unknown>) : `is ${lit(v)}`}`).join(" and ");
}
function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
function entitlementWords(value: string): string {
  return value.startsWith("access:") ? value.slice("access:".length) : value;
}
export function describeRelay(def: RelayDefinition): string {
  const t = def.trigger;
  let when: string;
  if (t.kind === "receiver") when = `When ${def.name} receives an event${filterWords(t.when)}${t.trustUnsignedEvents === true ? " (trusts unsigned events)" : ""}`;
  else if (t.kind === "schedule") when = t.every === "1w" && t.on ? `Every ${t.on.charAt(0).toUpperCase()}${t.on.slice(1)} at ${t.at ?? "00:00"} UTC` : t.at ? `${EVERY_WORDS[t.every]} at ${t.at} UTC` : EVERY_WORDS[t.every];
  else if (t.kind === "credits_low") when = `When a person's credits fall under ${t.below.toLocaleString("en-GB")}`;
  else if (t.kind === "run_started") when = t.tool ? `When a person starts a ${t.tool} run` : "When a person starts a run";
  else when = `When ${article(t.collection)} ${t.collection} record is ${listWords(t.on)}${filterWords(t.where)}`;
  const actions = def.actions.map((a) => {
    switch (a.type) {
      case "write_record": return `write a ${a.collection} record${a.to === "person" ? " for the person" : ""}`;
      case "grant_access": return `grant ${entitlementWords(a.entitlement)}`;
      case "grant_credits": return `grant ${a.amount} credit${a.amount === 1 ? "" : "s"}${a.expiresInDays !== undefined ? ` for ${a.expiresInDays} day${a.expiresInDays === 1 ? "" : "s"}` : ""}${a.ref !== undefined ? ` once per person (${a.ref})` : ""}`;
      case "fulfil_product": return `fulfil ${a.product}`;
      case "refund_product": return `refund ${a.product}`;
      case "grant_plan": return `grant ${a.plan}`;
      case "revoke_plan": return `revoke ${a.plan}`;
      case "revoke_access": return `revoke ${entitlementWords(a.entitlement)}`;
      case "email_person": return "email the person";
      case "call_url": return `call ${a.url}`;
      case "start_run": return `start a ${a.tool} run for the person`;
    }
  });
  return `${when} → ${actions.join(", ")}`;
}

/** The tool's answer: the sentence, or the refusal, plus what only the
 *  cloud can check. Never throws on a bad definition. */
export function explainRelay(input: unknown): { ok: true; sentence: string; definition: RelayDefinition; warning?: string } | { ok: false; refusal: string } {
  try {
    const definition = validateRelayDefinition(input);
    const t = definition.trigger;
    const warning = t.kind === "receiver" && t.trustUnsignedEvents === true ? unsignedEventWarning(t.verify) : undefined;
    return { ok: true, sentence: describeRelay(definition), definition, ...(warning ? { warning } : {}) };
  } catch (error) {
    if (error instanceof RelayDefinitionError) return { ok: false, refusal: error.message };
    throw error;
  }
}

/** What the AI owes the human before it sets trustUnsignedEvents. */
export const UNSIGNED_EVENTS_ASK =
  "Do not set trigger.trustUnsignedEvents without asking the human first. Ask in plain words: this sender proves a message came from it " +
  "(or only that the caller knows a shared token), but not what the message says — someone who sees one real message can send fake ones, " +
  "and this relay would grant, take away, email or create people from them. The safer way: keep this relay to write_record and call_url; " +
  "your function checks the event with the sender's API, then writes a record a data_change relay acts on.";

export const CLOUD_ONLY_NOTE =
  "Checked offline with the cloud's definition rules. Two things are checked only when it runs there: " +
  "call_url must not point at the API's own host or the file CDN (gemmein.com is refused here), and at call time the address " +
  "must resolve to a public host (loopback, private and link-local ranges are refused; redirects are not followed). " +
  "Locally, `gemmein dev` also allows call_url to http://localhost — the cloud never does.";

/** OPEN FIELDS: actions that grant, charge, take or credit — never triggered
 *  by a reader's like, choice or flag. */
const MONEY_ACTIONS = new Set(["grant_access", "revoke_access", "grant_credits", "fulfil_product", "refund_product", "grant_plan", "revoke_plan", "start_run"]);
