<p align="center">
  <img src="https://raw.githubusercontent.com/solercia-solutions/eslint-config/main/.github/assets/solercia-mark.svg" alt="Solercia" width="48" height="92">
</p>

<h1 align="center">@solercia/eslint-config</h1>

<p align="center">
  Shareable ESLint flat config that enforces Feature-Sliced Design boundaries, file placement and
  theme-token styling in Angular projects built on <a href="https://github.com/solercia-solutions/solercia-ui"><code>@solercia/ui</code></a>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@solercia/eslint-config"><img src="https://img.shields.io/npm/v/@solercia/eslint-config?color=10c1d6" alt="npm version"></a>
  <a href="https://github.com/solercia-solutions/eslint-config/actions/workflows/ci.yml"><img src="https://github.com/solercia-solutions/eslint-config/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-45fdae" alt="License: Apache-2.0"></a>
</p>

---

## Why

Several teams — and AI coding agents — work on the same Angular codebases. This preset turns the
architecture into rules the linter checks on every commit, so a file in the wrong folder, an import
across layers or a hardcoded color fails CI instead of slipping through review.

## Requirements

| Dependency          | Version   | Notes                                                    |
| ------------------- | --------- | -------------------------------------------------------- |
| Node.js             | `>= 22.14` |                                                         |
| `eslint`            | `^10.0.0` | Flat config only.                                        |
| `typescript-eslint` | `^8.0.0`  | Syntactic rules only; no type information needed.        |
| `@eslint/css`       | `^2.0.0`  | Optional. When installed, `.css` files are checked too.  |

## Installation

```bash
npm install --save-dev @solercia/eslint-config eslint typescript-eslint @eslint/css
```

```js
// eslint.config.js
import solerciaConfig from '@solercia/eslint-config';

export default [
  { ignores: ['.angular/', 'dist/', 'coverage/', 'node_modules/'] },
  ...solerciaConfig,
];
```

```json
// package.json
{ "scripts": { "lint": "eslint ." } }
```

## Rules

| Area | Rule | What it enforces |
| --- | --- | --- |
| Layer boundaries | `no-restricted-imports` | `app → pages → widgets → features → entities → shared`. A layer imports only from layers below it; `shared/**` never imports from upper layers or `@app/*`. |
| Public API | `no-restricted-imports` | Slices are consumed through their `index.ts` (`@features/login`), never through deep paths (`@features/login/ui/form`). |
| Smart/dumb UI | `no-restricted-imports` | `shared/ui` holds presentational components only: no imports from `entities/`, `features/`, `*.store` or `*.facade`, even through relative paths. |
| Wrapped engines | `no-restricted-imports`, `no-restricted-syntax` | `chart.js` only inside `shared/ui/chart` (`<sol-chart>`), `maplibre-gl` only inside `shared/ui/map` (`<sol-map>`, dynamic `import()` included) and `@angular/cdk` only through the `sol-kanban-*` components. |
| Naming | `@typescript-eslint/naming-convention` | `PascalCase` classes, interfaces and types; `camelCase` variables, functions and parameters. |
| File names | `solercia/filename-case` | Every dot-separated segment is kebab-case: `appointment-form.component.ts`. |
| File placement | `solercia/fsd-placement` | See [File placement](#file-placement). |
| Theme styles | `solercia/style-tokens` | Inline component `styles` and `style="..."` attributes in inline templates use theme variables. See [Styles](#styles). |
| Theme styles (CSS) | `solercia/css-style-tokens` | The same checks on `src/**/*.css`. Active only when `@eslint/css` is installed. |

### File placement

Every `.ts` file under `src/` belongs to a layer: `app`, `pages`, `widgets`, `features`, `entities`
or `shared`.

```text
src/
├── main.ts                      allowed outside layers (also test-setup.ts, polyfills.ts, environments/**)
├── app/                         anything goes (bootstrap, routes, providers)
├── pages/
│   └── users/
│       ├── index.ts             public API
│       ├── users.routes.ts      allowed at the slice root (pages only)
│       └── ui/users-page.component.ts
├── features/<slice>/<segment>/  segment ∈ ui | model | api | lib | config | testing
├── entities/<slice>/<segment>/  slice groups are allowed: pages/admin/users/ui/
└── shared/<segment>/            segment ∈ api | config | crud | i18n | lib | model | tenant | tokens | ui
```

### Styles

| Reported | Use instead |
| --- | --- |
| Color literals: `#fff`, `rgb()`, `hsl()`, `oklch()`, named colors such as `white` | `var(--sol-*)` |
| Literal `font-family` | `var(--sol-font-family)` or the matching theme variable |
| `!important` | A more specific selector or a theme variable |
| `::ng-deep` | A CSS custom property exposed by the child component |

A literal is still allowed in two places, because that is how tokens are defined and how first
paint survives a missing theme:

```css
:host {
  --sol-card-bg: #ffffff;                      /* defining a custom property */
  background: var(--sol-bg-surface, #ffffff);  /* fallback inside var() */
}
```

Not covered: external templates (`templateUrl`) and `px` units.

## Options

```js
import { solerciaEslintConfig } from '@solercia/eslint-config';

export default [
  ...solerciaEslintConfig({
    srcDir: 'apps/web/src',              // FSD root, default 'src'
    extraSharedSegments: ['support'],    // project-specific shared/ segments
    allowOutsideLayers: ['main.ts'],     // replaces the default bootstrap allow-list
  }),
];
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `srcDir` | `string` | `'src'` | Physical FSD root. The aliases `@app`, `@pages`, `@widgets`, `@features`, `@entities` and `@shared` are fixed. |
| `extraSharedSegments` | `string[]` | `[]` | Added to the default `shared/` segments. |
| `allowOutsideLayers` | `string[]` | `main.ts`, `test-setup.ts`, `polyfills.ts`, `environments/**` | Globs relative to `srcDir` allowed outside the layers. |

The style rules accept `{ allowImportant?: boolean, allowNgDeep?: boolean }`.

### Declaring exceptions

Exceptions live in the consumer's `eslint.config.js`, never in the preset, so they stay visible in
code review:

```js
export default [
  ...solerciaEslintConfig({ extraSharedSegments: ['support'] }),
  // Overrides a third-party theme: !important is intentional here.
  {
    files: ['src/assets/legacy-theme.css'],
    rules: { 'solercia/css-style-tokens': ['error', { allowImportant: true }] },
  },
];
```

For a single line, write the reason next to the directive:

```css
/* eslint-disable-next-line solercia/css-style-tokens -- print stylesheet needs pure black */
```

## For AI coding agents

If you are an AI agent editing a project that uses this preset:

1. Run `npx eslint <changed files>` before finishing; a clean run is part of the definition of done.
2. Place new files by layer and segment first, then write them. When unsure, read the nearest
   `index.ts` of the slice you are extending.
3. Fix violations at the source. Do not add `eslint-disable` comments or loosen the config unless
   the user explicitly asks; if an exception is truly needed, declare it in `eslint.config.js` with
   a comment explaining why.
4. For colors, fonts and spacing, look up the existing `--sol-*` variable in the theme instead of
   writing a literal.

A machine-readable summary is available in [`llms.txt`](./llms.txt).

## Development

```bash
npm ci
npm test            # node --test over test/*.test.mjs
npm pack --dry-run  # inspect the published file list
```

### Releasing

1. Bump `version` in `package.json` and add the entry to `CHANGELOG.md`.
2. Push a tag `v<version>`.
3. `.github/workflows/publish.yml` checks that the tag matches the version and publishes with npm
   Trusted Publishing (OIDC, no token). The package's Trusted Publisher on npmjs.com is organization
   `solercia-solutions`, repository `eslint-config`, workflow `publish.yml`.

## Related packages

- [`@solercia/ui`](https://github.com/solercia-solutions/solercia-ui) — Angular component library and theme tokens.
- [`@solercia/chat`](https://github.com/solercia-solutions/solercia-chat) — embeddable chat for Solercia assistants.

## License

[Apache-2.0](./LICENSE) © 2026 Solercia Solutions SAS. See [`NOTICE`](./NOTICE).
