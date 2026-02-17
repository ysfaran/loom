# 001 - Core CLI, Config, and Plugin Contract

## User Story
As a user, I want Loom to be a generic CLI tool that is configured through `loom.config.ts`, so I can define behavior through plugins instead of hardcoded framework modes.

## Acceptance Criteria
- Loom provides a CLI with commands for:
  - `init`
    Creates a starter `loom.config.ts` with a valid default plugin setup.
  - `list`
    Scans the target path and prints discovered documentation files.
  - `validate`
    Checks documentation input for parse and structural issues before rendering.
  - `build`
    Produces the static documentation site output for deployment.
  - `dev`
    Starts a local development server for interactive documentation preview.
- Loom supports initialization via `loom init`, generating a usable starter config.
- Loom loads configuration from `loom.config.ts` (plus existing supported variants).
- Plugin registration is the primary mechanism for enabling functionality.
- Config validation/compilation fails unless plugin context provides all required command functions:
  - `list`
  - `validate`
  - `build`
  - `dev`
- Failure message clearly explains missing context and suggests likely cause (for example missing renderer plugin when `build`/`dev` are absent).

## Technical Details
- Plugin system baseline:
  - Plugins are registered in config in deterministic order.
  - Plugins can add context/functions consumed by CLI operations.
  - Core CLI should execute commands only through context functions exposed by plugins.
- Required context contract for a valid runnable config:
  - `list(...)`
  - `validate(...)`
  - `build(...)`
  - `dev(...)`
- `loom init` should generate a config that already satisfies this contract by including at least one plugin set that exposes the required functions.
