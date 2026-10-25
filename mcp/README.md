# @gemmein/mcp

The [Gemmein](https://gemmein.com) MCP server — gives your coding agent the
whole Gemmein contract as tools, straight in the editor.

Gemmein is the backend for web and mobile apps: hosting, sign-in, protected data, payments, AI tools and a dashboard to run your customers.
Ten tools work without an account. Nine are read-only, and all but `guide` work offline: `guide` makes one
read-only GET to `https://docs.gemmein.com/llms-dashboard.txt` for the
dashboard section. `check_integration` runs live checks against your
app; with a development secret key it also writes in the development
environment: it creates two test people and a probe record, deletes the
record, and signs the test people out of earlier sessions. Without a secret
key it writes nothing while the app's boundaries hold — but if a private
collection is open to strangers, the anonymous test write succeeds and its
record stays, in whatever environment the key names (live included), and the
check fails, naming the collection.

Nine more tools act on a linked Gemmein app — `create_app` and the Views
family (`put_view`, `dev_view`, `live_view`, `dev_delete_view`,
`view_action`, `view_add`, `view_edit`, `view_reorder`). Link the project
once with `npx gemmein login` (a browser approval, 7 days); without a link
these refuse, naming that command — no key is ever asked for in the chat.

## Setup

Claude Code:

```sh
claude mcp add gemmein -- npx -y @gemmein/mcp
```

Cursor / any MCP client (`mcpServers` config):

```json
{ "gemmein": { "command": "npx", "args": ["-y", "@gemmein/mcp"] } }
```

No terminal? The same tools are hosted at `https://api.gemmein.com/mcp`
(MCP over Streamable HTTP, OAuth sign-in) — add it as a custom connector in
ChatGPT, Claude, Lovable, Replit, Bolt or v0. The ten tools need no account.
After your human approves the connection once, the hosted server also builds
the app in Development (pull and sync the gemmein/ files, test members, test
mail, sandbox test payments) and asks your human to approve each Live change
in their browser; reading Live is a separate approval, and every read is on
their Logs. Secret keys are shown once in the browser, never in the chat.
On the hosted server, `check_integration` checks the API it runs on only.

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
  ends with a link to it instead. It ends with every docs page's markdown
  link; pass `topic` ("refund a payment") to get only the sections that
  answer it, each a direct link such as
  https://docs.gemmein.com/payments/refunds.md#refunds.
- **`reference`** — the exact SDK API reference: every method, signature,
  return shape, error code. Pass `topic` ("checkout") for only the matching
  sections, with each section's direct link.
- **`search_docs`** — the docs site's sections that answer a question, best
  first, each a direct markdown link with its anchor, then the matching
  passages of both packaged documents. Offline: the section index ships with
  the server.
- **`changes`** — what changed in each Gemmein release after the version you
  knew (`since`), or the last three: every change as was → now, with the
  error codes it added or removed. Bundled, offline — call it when what you
  remember may be older than the installed release.
- **`explain_rule`** — any safety rule's contract, what it's right for, and
  the mistakes to avoid (or a cheat-sheet of all seven).
- **`explain_error`** — what a `GemmeinError` code means and exactly what to
  do, with the code's own page (https://docs.gemmein.com/errors/<code>).
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

The following nine need a linked project (`npx gemmein login`):

- **`create_app`** — ask to make another app on the same account, in
  Development only. Your human approves it in their browser with the
  emailed code.
- **`put_view`** — create or update one Development view: a recipe over one
  collection (filter, sort, columns, totals, layout, action buttons).
- **`dev_view`** / **`live_view`** — read one view's rows, exactly as its
  layout shows them, with totals and each row's open actions. `live_view`
  needs the `live:read` grant.
- **`dev_delete_view`** — delete a view's recipe from Development; the
  collection and its records are untouched, and Live keeps its own copy for
  good.
- **`view_action`** — move one record one step along a view's own action
  buttons. In Development it happens at once; with `env: "live"` your human
  approves it in their browser (no emailed code).
- **`view_add`** / **`view_edit`** / **`view_reorder`** — add, edit or
  reorder a record through a view's own form, Development only.

## The companion SDK

Your app talks to Gemmein through [`@gemmein/sdk`](https://www.npmjs.com/package/@gemmein/sdk).
This server teaches your agent to use it correctly.

MIT © Gemmein Limited
