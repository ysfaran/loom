# 002 - Validate MDX Files

## User Story
As a developer, I want Loom CLI to validate MDX files and report exact issues so that I can fix documentation quality problems before publishing.

## Acceptance Criteria
- Validation fails when an MDX file has parse errors.
- Validation fails when frontmatter YAML is invalid.
- Validation fails when required frontmatter fields are missing.
- Validation fails when internal relative links are broken.
- The output includes file path, line/column (if available), and a readable message.
- The command exits with code `1` when any error exists.

## Technical Details
- Command: `loom validate [path]`
- Default path: current working directory (`.` at execution time)
- Required frontmatter in MVP:
  - `title`
- Rule IDs should be stable for CI parsing, for example:
  - `mdx/parse-error`
  - `frontmatter/invalid-yaml`
  - `frontmatter/missing-required`
  - `links/broken-internal`
- External link checks are out of scope in MVP.
- Parser and validation dependencies must be version-pinned.
- Validation output should include:
  - `errors[]` semantics with `ruleId`, `message`, `file`, `line`, `column` (when available)
  - a final summary line with total errors and files checked
