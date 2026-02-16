# loom

Easy docs for devs and AI.

## Monorepo Layout
- `cli/`: `@loom/cli` package (contains the `loom` command)
- `packages/core`: `@loom/core` shared package
- `docs/requirements`: product and implementation requirements

## Setup
- Install dependencies: `pnpm install`
- Run CLI in dev mode: `pnpm dev -- --help`
- Build all packages: `pnpm build`
- Build CLI with dependency-aware Nx orchestration: `pnpm build:cli`

## Current CLI Commands
- `loom list [path]` (alias: `loom ls [path]`)
- `loom validate [path]`
- `loom build [path] --out <path>`
- `loom dev [path] --port <port>`

All commands default to the current working directory when `[path]` is omitted.
