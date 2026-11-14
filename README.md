# gemmein

The distribution home of the [Gemmein](https://gemmein.com) CLI — the
`gemmein` package on npm, and the release record of the local engine it runs.

Gemmein is the trustworthy backend for AI-built apps: accounts, data,
payments — with the boundaries enforced by the platform, not by your app's
code. The CLI brings that to your machine: `npx gemmein init` shapes your
product's boundaries in plain language, and `gemmein dev` runs a real local
backend that enforces them while you build.

## MCP server

`@gemmein/mcp` gives a coding agent the whole Gemmein contract as tools — the
builder guide, the SDK reference, rule and error explainers, and a live check
of an app's access boundaries. Eight tools are read-only. `check_integration`
runs live checks against your app; with a development secret key it also
writes in the development environment: it creates two test people and a
probe record, deletes the record, and signs the test people out of earlier
sessions.

Install for Claude Code:

```sh
claude mcp add gemmein -- npx -y @gemmein/mcp
```

Install for Claude Desktop, Cursor, or any client that takes an `mcpServers`
block:

```json
{
  "mcpServers": {
    "gemmein": {
      "command": "npx",
      "args": ["-y", "@gemmein/mcp"]
    }
  }
}
```

No environment variables are required to run it.

Tools it serves:

- `guide` — the full builder's guide, covering auth flow, the seven safety
  rules, record shapes, links, uploads, contention, payments, plus the
  dashboard steps read live from docs.gemmein.com/llms-dashboard.txt.
- `reference` — every SDK method, exact signature, return shape, and error
  code.
- `search_docs` — targeted search over both, when it needs one fact.
- `explain_rule` — any rule's contract, what it's right for, and the
  mistakes to avoid, or a cheat-sheet of all seven at planning time.
- `explain_error` — what a `GemmeinError` code means and exactly what to do
  about it.
- `validate_collection_name` — catches a misnamed collection before every
  read starts returning empty results.
- `explain_relay` — a `gemmein/relays/<name>.json` definition in, the
  sentence the dashboard would show out, or the one refusal naming the
  field; offline, over the eleven verbs `write_record`, `grant_access`,
  `revoke_access`, `grant_credits`, `email_person`, `call_url`,
  `fulfil_product`, `refund_product`, `grant_plan`, `revoke_plan` and
  `start_run`.
- `reaffirm_template` — the CI harness, ready to copy.
- `check_integration` — runs an app's isolation and access checks live
  against itself and hands back structured pass/fail.

The server's full source is in [`mcp/`](mcp/) (MIT). It is a standalone
Node package: `cd mcp && npm install && npm run build`, then run
`node dist/index.js`. It does not use the Gemmein engine.

Docs: [docs.gemmein.com/mcp](https://docs.gemmein.com/mcp).

## Claude plugin

[`plugins/gemmein/`](plugins/gemmein/) is a Claude plugin that bundles the
MCP server above, pinned to an exact version, with one skill,
`build-on-gemmein`: it has Claude read the Gemmein guide, ask what the app
is for, say whether Gemmein fits, and then follow the first-hour path
(`npx -y gemmein dev`, collections, `npx gemmein sync`, going live). This
repository is also a plugin marketplace. In Claude Code:

```
/plugin marketplace add gemmeinhq/gemmein-release
/plugin install gemmein@gemmein
```

What the plugin runs, sends and stores is in
[`plugins/gemmein/README.md`](plugins/gemmein/README.md).

## How the launcher works

The npm package you install is a small launcher, published as readable
source — what you see in `shim/` is exactly what runs on your machine.

On first run it downloads the Gemmein engine, verifies it against SHA-256
hashes pinned inside this package, caches it locally, and runs it. After
that one download, everything works fully offline. If a downloaded file
ever fails verification, the launcher refuses to run it.

- `shim/` — the `gemmein` npm package (plain JS, no build step)
- `manifest/releases.json` — every engine release and its file hashes

## Licensing

Two licenses, on purpose:

- The MCP server (`mcp/`, published as `@gemmein/mcp`) is **MIT**.
- The npm launcher (`shim/`) is **MIT** — read it, audit it, it's yours.
- The downloaded engine is proprietary, under the
  [Gemmein Engine License](LICENSE-ENGINE.md) — you can run and cache it
  freely for building against Gemmein (offline once cached, even if a
  version is retired), but not redistribute or extract it. It's also served
  at [downloads.gemmein.com/engine/LICENSE](https://downloads.gemmein.com/engine/LICENSE).

## Using it

```bash
npx gemmein init
```

Docs: [docs.gemmein.com](https://docs.gemmein.com) · Questions:
hello@gemmein.com
