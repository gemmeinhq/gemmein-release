#!/usr/bin/env node
// @gemmein/mcp — the Gemmein MCP server over stdio (`npx -y @gemmein/mcp`).
//
// The tools themselves live in tools.ts, shared with the hosted connector
// (https://api.gemmein.com/mcp) so the two can never say different things.
// This entry only says how the local server reads its docs and SDK: from
// the installed @gemmein/sdk package — one source of truth, no copies to
// drift. The packaged guide is the contract (what code calls); the
// dashboard how-to changes with the dashboard, so `guide` reads it live.

import { createRequire } from "node:module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { sdkFile } from "./dashboard.ts";
import { createGemmeinServer } from "./tools.ts";

const require = createRequire(import.meta.url);

const server = createGemmeinServer({
  // The one version, read from package.json — a literal here drifted once
  // (announced 0.1.0 while the package said 0.2.1; review 26 Aug).
  version: (require("../package.json") as { version: string }).version,
  docs: sdkFile,
  sdk: () => import("@gemmein/sdk"),
});

await server.connect(new StdioServerTransport());
