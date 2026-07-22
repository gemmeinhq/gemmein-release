# gemmein

The distribution home of the [Gemmein](https://gemmein.com) CLI — the
`gemmein` package on npm, and the release record of the local engine it runs.

Gemmein is the trustworthy backend for AI-built apps: accounts, data,
payments — with the boundaries enforced by the platform, not by your app's
code. The CLI brings that to your machine: `npx gemmein init` shapes your
product's boundaries in plain language, and `gemmein dev` runs a real local
backend that enforces them while you build.

## How the launcher works

The npm package you install is a small launcher, published as readable
source — what you see in `shim/` is exactly what runs on your machine.

On first run it downloads the Gemmein engine, verifies it against SHA-256
hashes pinned inside this package, caches it locally, and runs it. After
that one download, everything works fully offline. If a downloaded file
ever fails verification, the launcher refuses to run it.

- `shim/` — the `gemmein` npm package (plain JS, no build step)
- `manifest/releases.json` — every engine release and its file hashes

## Using it

```bash
npx gemmein init
```

Docs: [docs.gemmein.com](https://docs.gemmein.com) · Questions:
hello@gemmein.com
