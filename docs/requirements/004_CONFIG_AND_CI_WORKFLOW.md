# 004 - Configuration and CI Workflow

## User Story
As a project maintainer, I want Loom behavior to be configurable and CI-friendly so that documentation checks can be enforced in pull requests.

## Acceptance Criteria
- Loom supports a root configuration file.
- CLI commands can run fully non-interactive in CI.
- Validation can be used as a required quality gate.
- JSON output is stable enough for machine parsing.

## Technical Details
- Config file proposal: `loom.config.ts`
- Minimum config fields:
  - `root`
  - `include`
  - `exclude`
  - `requiredFrontmatter`
  - `site.title`
  - `site.basePath`
- CLI should apply precedence:
  - command-line flags override config values
  - config values override defaults
- CI patterns:
  - `loom scan [path] --json`
  - `loom validate [path] --json`
  - `loom build [path]`
