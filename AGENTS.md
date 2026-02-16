# AGENTS.md

## Commit Message Convention
All commits in this repository must follow the Conventional Commits specification.

Format:
`<type>(<optional-scope>): <short description>`

Examples:
- `feat(cli): add positional path support for scan command`
- `fix(validate): handle invalid frontmatter yaml parsing`
- `docs(requirements): update scan requirement default path`
- `chore(ci): add validation check to pull request workflow`

Allowed types:
- `feat`
- `fix`
- `docs`
- `chore`
- `refactor`
- `test`
- `build`
- `ci`
- `perf`
- `revert`

Rules:
- Use lowercase for type and scope.
- Keep subject concise and imperative.
- Do not end subject with a period.
- Use `!` after type/scope for breaking changes, for example: `feat(cli)!: change default scan behavior`.
- Add a `BREAKING CHANGE:` footer in the body when applicable.

## Code Readability Preferences
- Prefer top-to-bottom readable flow in files.
- Avoid extracting tiny single-use helper functions when inline logic is clearer.
- Keep related build/runtime setup steps close together in one place when practical.
- Extract helpers only when logic is reused or significantly improves clarity.
