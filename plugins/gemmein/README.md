# Gemmein plugin for Claude

![Gemmein](assets/icon.png)

Gemmein is the backend for web and mobile apps: sign-in, protected data,
payments, AI tools and a dashboard to run your customers. This plugin gives
Claude what it needs to build an app on Gemmein: the Gemmein MCP server and
one skill, `build-on-gemmein`, that walks the first hour.

## What it adds

- **MCP server `gemmein`**: runs `@gemmein/mcp` on your machine with
  `npx`, pinned to an exact version. It needs Node 20 or later and no
  environment variables. Its nine tools:
  - `guide`: the full builder's guide.
  - `reference`: every SDK method, signature, return shape and error code.
  - `search_docs`: finds one fact in the guide or the reference.
  - `explain_rule`: explains the seven collection safety rules.
  - `explain_error`: what an error code means and what to do about it.
  - `validate_collection_name`: checks a collection name before it is used.
  - `reaffirm_template`: the ready-to-edit test file for an app's CI.
  - `explain_relay`: checks a relay definition offline.
  - `check_integration`: checks an app's access rules live against Gemmein.
- **Skill `build-on-gemmein`**: tells Claude to read
  https://docs.gemmein.com/llms.txt, ask the person what they're building,
  give a verdict on whether Gemmein fits, and then follow the path:
  `npx -y gemmein dev`, collections, `npx gemmein sync` with the CLI key
  from the dashboard, then going live.

The MCP server runs in Claude Code, and in Cowork sessions that run on your
computer. Chat on claude.ai loads the skill only.

## Install

In Claude Code:

```
/plugin marketplace add gemmeinhq/gemmein-release
/plugin install gemmein@gemmein
```

Then ask Claude to build your app on Gemmein, or run `/gemmein:build-on-gemmein`.

## What it runs, sends and stores

- The first time the MCP server starts, `npx` downloads `@gemmein/mcp` and
  its dependencies from the npm registry.
- Eight tools work offline, from the guide and reference bundled in the
  package. They send nothing and write nothing.
- `check_integration` calls the Gemmein API (api.gemmein.com, or the
  `apiUrl` you pass) with the keys you give it. With the app key it only
  reads, unless the app lets strangers write a private collection, in which
  case its test write succeeds and the check fails. With a development
  secret key (`sk_dev_…`) it also writes in your app's development
  environment: it creates two test people and a probe record, deletes the
  record, and signs the test people out of earlier sessions. The test people
  stay. If you name your own test people, those people are signed out of
  their development sessions. A live key (`sk_live_…`) is refused.
- The plugin itself stores nothing and collects nothing. Gemmein's privacy
  policy: https://gemmein.com/privacy

## Links

- Docs: https://docs.gemmein.com/mcp
- MCP server source (MIT): https://github.com/gemmeinhq/gemmein-release/tree/main/mcp
- Support: hello@gemmein.com

## License

MIT. See [LICENSE](LICENSE).
