# 004 - Configuration and CI Workflow

## User Story
As a project maintainer, I want Loom behavior to be configurable and CI-friendly so that documentation checks can be enforced in pull requests.

## Acceptance Criteria
- Loom supports a root configuration file.
- CLI commands can run fully non-interactive in CI.
- Validation can be used as a required quality gate.
- Validation output is clear and stable enough for CI logs and pull request review.

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
  - `loom list [path]`
  - `loom validate [path]`
  - `loom build [path]`
