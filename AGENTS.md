# AGENTS.md — @solercia/eslint-config

Instructions for AI coding agents (Claude Code, Codex, OpenCode, Cursor, Copilot…) working in this
repository. `CLAUDE.md` is a symlink to this file.

## What this is

A shareable ESLint 10 flat config (plain ESM JavaScript, no build step) that enforces Feature-Sliced
Design boundaries, file placement and theme-token styling in Angular projects. Published to npm as
`@solercia/eslint-config`.

| Path | Content |
| --- | --- |
| `index.js` | Preset factory `solerciaEslintConfig(options)` and default export |
| `lib/rules.js` | Custom rules `style-tokens`, `css-style-tokens`, `fsd-placement` |
| `lib/style-checker.js` | Text-level CSS checker shared by both style rules |
| `test/preset.test.mjs` | `node:test` suite that lints virtual files through `new ESLint()` |
| `llms.txt` | Machine-readable summary shipped in the package |

## Commands

```bash
npm ci
npm test              # must pass before every commit
npm pack --dry-run    # check the published file list
```

## Rules

- Every behavior change comes with a test in `test/preset.test.mjs` that asserts the `messageId`.
- Lint messages, comments and docs are in English. Messages say what is wrong and what to use instead.
- Do not change rule IDs or option names without a major version: consumers reference them.
- Keep `README.md`, `llms.txt` and `CHANGELOG.md` in sync with any rule or option change.

## Commits

- Conventional Commits, header ≤ 72 characters, lowercase, scope `solercia`:
  `feat(solercia): …`, `fix(solercia): …`, `docs(solercia): …`.
- Body: 2–4 bullets of ≤ 100 characters.
- **No AI attribution**: never add `Co-Authored-By`, `Claude-Session`, `Generated with` or similar.
- Author email: the GitHub noreply address configured in the local clone.

## Every commit is tagged (mandatory)

Each commit that lands on `main` is a release and **must carry its own version tag**:

1. In the same commit, bump `version` in `package.json` (SemVer: `patch` for fixes and docs, `minor`
   for new rules or options, `major` for breaking changes) and add the entry to `CHANGELOG.md`.
2. Commit, then tag it with exactly the package version: `git tag v<version>`.
3. Push the commit and the tag: `git push origin main && git push origin v<version>`.

The tag triggers `.github/workflows/publish.yml`, which checks that the tag matches `package.json` and
publishes to npm with Trusted Publishing (OIDC, no token). An untagged commit on `main` is a defect:
tag it before doing anything else. Never move or delete a pushed tag.
