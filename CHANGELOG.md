# Changelog — @solercia/eslint-config

All notable changes to this package are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versioning follows
[SemVer](https://semver.org/).

## [0.2.0] - 2026-11-24

### Added

- `solercia/style-tokens` rule: Angular component styles (the decorator `styles` and inline
  template `style` attributes) use theme variables. It reports literal colors and `font-family`
  values, `!important` and `::ng-deep`. A literal is allowed as a `var()` fallback or when defining
  a custom property. The `allowImportant` and `allowNgDeep` options declare explicit exceptions.
- `solercia/css-style-tokens` rule: the same checks on the `.css` files under `src/`, active when
  `@eslint/css` (optional peer, `^2.0.0`) is installed.
- `solercia/fsd-placement` rule: every file lives in an FSD layer and, inside a slice, in a
  segment (`ui`, `model`, `api`, `lib`, `config`, `testing`). Preset options
  `extraSharedSegments` and `allowOutsideLayers`.
- Preset tests with `node --test` (`npm test`).
- MapLibre GL restriction with the same criterion as Chart.js: `maplibre-gl` is only imported
  inside `shared/ui/map` (`sol-map`). A `no-restricted-syntax` rule also covers dynamic
  `import()` calls, which `no-restricted-imports` does not see.

## [0.1.1] - 2026-07-15

### Notes

- Released in lockstep with `@solercia/ui@0.1.1`. No functional changes in the preset compared
  to `0.1.0`.

## [0.1.0] - 2026-07-14

### Added

- Shareable ESLint preset (flat config, ESLint 10): FSD boundaries per layer (`app → pages → widgets
  → features → entities → shared`), the smart/dumb rule of `shared/ui`, a restriction on `chart.js`
  outside `shared/ui/chart` and naming conventions (`naming-convention` + an in-house
  `filename-case`).
- Publication metadata: `Apache-2.0` license and an authorship `NOTICE` (Solercia Solutions SAS).
