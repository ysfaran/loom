# 001 - Scan MDX Files

## User Story
As a documentation maintainer, I want Loom CLI to scan from the current working directory (or a provided root) for MDX files so that documentation can stay co-located with each app/module and still be discovered easily.

## Acceptance Criteria
- Given no positional path argument, Loom scans recursively from the current working directory where the command is executed.
- Given a positional path argument, Loom scans recursively from the provided path.
- Include and exclude patterns can narrow the scanned set.
- The command prints a clear summary with total files discovered.
- The command returns exit code `0` on successful scan.
- The scan model supports co-located docs in different module folders (for example monorepos with separate frontend/backend docs paths).

## Technical Details
- Command: `loom scan [path]`
- Default root: current working directory (`.` at execution time)
- Flags:
  - `--include <glob>` (repeatable)
  - `--exclude <glob>` (repeatable)
  - `--json` (machine-readable output)
- Output model fields (minimum):
  - `root`
  - `files` (array of paths)
  - `count`
  - `durationMs`
- Path normalization should be deterministic across operating systems.
