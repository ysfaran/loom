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
