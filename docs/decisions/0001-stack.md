# 0001 — Stack for the Proofroom server

## Context

The course machine is one `shared-cpu-1x` Fly VM with 256 MB of memory and one
volume at `/data`; the app must serve plain HTTP on `0.0.0.0:$PORT`. The Crit 8
slice needs: create/revisit a question, append a claim or evidence item with
server-assigned actor and timestamp, durable storage that survives a restart,
and `/readme/` serving the full `README.md` as server-sent HTML. The repo
already pins Node 24.21.0 and pnpm 11.9.0 via `mise.toml`, and its `tsconfig.json`
is written for running `.ts` files directly (`allowImportingTsExtensions`,
`verbatimModuleSyntax`), not for a bundler.

Two options were evaluated.

## Option A — Express + better-sqlite3 (not chosen)

Express gives routing, body parsing and middleware conventions most
developers already know; `better-sqlite3` is a mature, synchronous, stable
SQLite binding. Trade-off: `better-sqlite3` is a native addon — it has to be
compiled (or fetch a prebuilt binary) during the Docker image build, on
whatever architecture Fly's remote builder uses. That's an extra failure mode
(toolchain/arch mismatches) to debug under a tight deadline, for an app with
only about half a dozen routes where Express's conveniences save little.

## Option B — Node built-ins only, plus `marked` (chosen)

Verified empirically on this machine before deciding:

- `node ts_probe.ts` ran a typed `.ts` file directly with no flags and no
  build step — confirms the tsconfig's direct-execution intent actually
  works on the pinned Node version.
- `node -e "require('node:sqlite')"` (`DatabaseSync`) created a table, inserted
  and read a row with no native compilation and no extra dependency. The CLI
  flag is `--no-experimental-sqlite` — i.e. it ships enabled by default.

So: `node:http` with a small hand-written router, `node:sqlite` for the
durable store, `crypto.randomUUID()` for IDs, and exactly one runtime
dependency — `marked`, to turn `README.md` into real HTML at `/readme/`
(hand-rolling a Markdown parser is a bigger risk of subtly breaking the
heading-order check in `spec/invariants.test.ts` than taking a small, widely
used, zero-dependency library for it).

## Decision

Option B. Zero build step, zero native addons, one small runtime dependency.
Fits the 256 MB machine and a Docker image with no compiler toolchain inside
it.

## Consequences

- `node:sqlite` is labelled experimental upstream. The SQL surface used here
  is deliberately plain (no triggers, no extensions, single-file WAL-off
  access from one process), and it sits behind one module (`src/db.ts`), so
  swapping in `better-sqlite3` later is a contained change if it ever causes
  trouble.
- No framework means routing, body parsing, cookies and HTML escaping are a
  few dozen lines of hand-written code instead of a dependency. For this
  route count that is less risk than more.
- Running `.ts` directly means `pnpm build` has nothing to emit; it's kept as
  a type-check (`tsc --noEmit`) so the script still exists and still fails the
  build on a type error, matching the brief's "build script" expectation
  without inventing a compile step this app doesn't need.
