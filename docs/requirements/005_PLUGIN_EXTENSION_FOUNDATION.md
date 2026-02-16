# 005 - Plugin Extension Foundation

## User Story
As an advanced user, I want Loom to expose plugin extension points so that I can add features like search and ADR workflows without modifying core.

## Acceptance Criteria
- Core architecture defines explicit plugin hook points.
- Plugin lifecycle is documented (load, execute, error handling).
- Plugin failures are isolated and reported clearly.
- MVP does not need full plugin implementation, but must avoid blocking it.

## Technical Details
- Planned hook areas:
  - file validation (`onValidateFile`)
  - frontmatter schema extension
  - route generation (`onRouteBuild`)
  - search index generation
  - ADR content helpers
- Plugin API versioning strategy is required before public release.
- Plugin execution model should support deterministic ordering.
- Security boundary and trust model for third-party plugins must be documented before enabling remote plugin install.
