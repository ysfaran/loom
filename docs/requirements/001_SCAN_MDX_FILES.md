# 001 - List MDX Files

## User Story
As a documentation maintainer, I want Loom CLI to list MDX files from the current working directory (or a provided root) so that documentation can stay co-located with each app/module and still be discovered easily.

## Acceptance Criteria
- Given no positional path argument, Loom scans recursively from the current working directory where the command is executed.
- Given a positional path argument, Loom scans recursively from the provided path.
- The command prints only matched `.mdx` file paths, one per line.
- The command returns exit code `0` on successful listing.
- The listing model supports co-located docs in different module folders (for example monorepos with separate frontend/backend docs paths).

## Technical Details
- Command: `loom list [path]` (alias: `loom ls [path]`)
- Default root: current working directory (`.` at execution time)
- Output model fields (minimum):
  - `root`
  - `files` (array of paths)
  - `count`
  - `durationMs`
- Path normalization should be deterministic across operating systems.
