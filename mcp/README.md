# @gemmein/mcp

The [Gemmein](https://gemmein.com) MCP server — gives your coding agent the
whole Gemmein contract as tools, straight in the editor.

Gemmein is the backend for web and mobile apps: sign-in, protected data, payments, AI tools and a dashboard to run your customers.
Eight tools are read-only, and all but `guide` work offline: `guide` makes one
read-only GET to `https://docs.gemmein.com/llms-dashboard.txt` for the
dashboard section. `check_integration` runs live checks against your
app; with a development secret key it also writes in the development
environment: it creates two test people and a probe record, deletes the
record, and signs the test people out of earlier sessions. Without a secret
key it writes nothing while the app's boundaries hold — but if a private
collection is open to strangers, the anonymous test write succeeds and its
record stays, in whatever environment the key names (live included), and the
check fails, naming the collection.

## Setup

Claude Code:

```sh
claude mcp add gemmein -- npx -y @gemmein/mcp
```

Cursor / any MCP client (`mcpServers` config):

```json
{ "gemmein": { "command": "npx", "args": ["-y", "@gemmein/mcp"] } }
```

## Tools

- **`guide`** — call first: it opens with two doors — an idea with nothing
  built yet, or an app that already exists — and both reach the same fit
  assessment (FITS / FITS EXCEPT / DOESN'T FIT — the verdict an agent
  delivers before any install), then the full builder's guide (auth flow, the seven collection
  safety rules, record shapes, links, uploads, contention patterns, payments,
  credits, AI tools, relays, mobile). The guide is the packaged contract —
  what code calls, matching the installed SDK. The dashboard section
  (connecting Stripe, the dashboard's rooms, health checks) is read live from
  docs.gemmein.com, because it changes with the dashboard; offline, the guide
  ends with a link to it instead.
- **`reference`** — the exact SDK API reference: every method, signature,
  return shape, error code.
- **`search_docs`** — targeted search over both packaged documents, offline.
- **`explain_rule`** — any safety rule's contract, what it's right for, and
  the mistakes to avoid (or a cheat-sheet of all seven).
- **`explain_error`** — what a `GemmeinError` code means and exactly what to do.
- **`explain_relay`** — how a relay is written: its trigger, the ten action
  verbs (write_record, grant_access, revoke_access, grant_credits,
  email_person, call_url, fulfil_product, refund_product, grant_plan,
  revoke_plan), templates, and the refusals the engine answers.
- **`validate_collection_name`** — catch a bad collection name at planning
  time (a bad name throws synchronously and can blank an app silently).
- **`reaffirm_template`** — the ready-to-edit CI harness that proves an app's
  boundaries on every deploy.
- **`check_integration`** — run those boundary checks live against your own
  app right now: anonymous access refused where it must be, cross-user
  isolation proven with throwaway dev test sessions, structured pass/fail
  back. Never pass a live secret key — `sk_live` is refused by design.

## The companion SDK

Your app talks to Gemmein through [`@gemmein/sdk`](https://www.npmjs.com/package/@gemmein/sdk).
This server teaches your agent to use it correctly.

MIT © Gemmein Limited
