# 003 - Build React Docs Site

## User Story
As a repo contributor, I want Loom to render valid MDX docs into a React-based static website so that documentation is easy to browse for humans and AI agents.

## Acceptance Criteria
- Each valid MDX file becomes one generated docs page.
- Route paths are derived from source-relative file paths.
- `index.mdx` resolves to the directory root route.
- Navigation is generated from folder structure.
- Build fails when blocking validation errors exist.
- Build output is reproducible on repeated runs from same input.

## Technical Details
- Command: `loom build [path]`
- Default path: current working directory (`.` at execution time)
- Flags:
  - `--out <path>` (default: `dist/docs`)
- Rendering requirements:
  - React-based static output
  - Sidebar navigation
  - Heading anchors
  - Code block rendering
  - Mobile-responsive layout
- Build summary includes:
  - generated page count
  - warning count
  - total duration
- Output directory should be cleaned or overwritten in a deterministic way.
