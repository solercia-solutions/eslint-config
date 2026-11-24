// @ts-check
/**
 * @solercia/eslint-config — shareable ESLint preset (flat config, ESLint 10) of the
 * Solercia ecosystem.
 *
 * It bundles:
 *   1. The FSD boundaries per layer (`no-restricted-imports`):
 *      app → pages → widgets → features → entities → shared
 *   2. The smart/dumb rule of `shared/ui`: forbids importing stores, facades and
 *      domain code (`**\/entities/**`, `**\/features/**`, `*.store`/`*.facade` patterns).
 *   3. The Chart.js restriction: forbids `chart.js` outside `shared/ui/chart`.
 *      Same for MapLibre: `maplibre-gl` only inside `shared/ui/map`
 *      (dynamic `import()` calls included).
 *   4. Naming conventions: `@typescript-eslint/naming-convention` (type, variable,
 *      function and parameter symbols) + an in-house `filename-case` (kebab-case).
 *   5. Theme-variable styles and file placement by layer and segment
 *      (`lib/rules.js`, since 0.2.0).
 *
 * Usage:
 *
 *   import solerciaConfig from '@solercia/eslint-config';
 *   export default [
 *     ...solerciaConfig,
 *     // the consuming project's own rules/overrides
 *   ];
 *
 * Configurable when the consuming project does not use `src/` as its FSD root:
 *
 *   import { solerciaEslintConfig } from '@solercia/eslint-config';
 *   export default [...solerciaEslintConfig({ srcDir: 'apps/web/src' })];
 */
import tseslint from 'typescript-eslint';
import {
  styleTokensRule,
  cssStyleTokensRule,
  fsdPlacementRule,
  DEFAULT_SHARED_SEGMENTS,
  DEFAULT_OUTSIDE_LAYERS,
} from './lib/rules.js';

// `@eslint/css` is an optional peer: with it installed, .css files get the
// same style checks as inline component styles; without it they are skipped.
const cssPlugin = await import('@eslint/css').then((module) => module.default).catch(() => null);

// ─────────────────────────────────────────────────────────────────────────────
// In-house plugin: the `filename-case` rule (kebab-case). It is implemented
// locally instead of installing the whole `eslint-plugin-unicorn` (the project
// prefers in-house code by default) so that dozens of unrelated rules are not
// pulled in for a single rule that is also trivial.
// ─────────────────────────────────────────────────────────────────────────────
const KEBAB_SEGMENT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IGNORED_BASENAMES = new Set(['index.ts', 'index.d.ts']);

const solerciaNamingPlugin = {
  rules: {
    'filename-case': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Requires kebab-case file names (Solercia FSD front-end convention).',
        },
        schema: [],
        messages: {
          notKebabCase:
            'The file "{{basename}}" is not kebab-case (invalid segment: "{{segment}}"). Use lowercase letters and hyphens, e.g. "appointment-form.component.ts".',
        },
      },
      create(context) {
        return {
          Program(node) {
            const filename = context.filename ?? context.getFilename();
            const basename = filename.split(/[\\/]/).pop() ?? '';
            if (IGNORED_BASENAMES.has(basename)) return;

            // Strip ONLY the final extension (.ts/.tsx/.mts/.cts) — the remaining
            // "."-separated segments (e.g. "button.component.spec") are validated
            // one by one, because each of them must be kebab-case.
            const withoutExt = basename.replace(/\.[cm]?tsx?$/, '');
            const segments = withoutExt.split('.').filter(Boolean);
            const badSegment = segments.find((segment) => !KEBAB_SEGMENT_RE.test(segment));

            if (badSegment) {
              context.report({
                node,
                messageId: 'notKebabCase',
                data: { basename, segment: badSegment },
              });
            }
          },
        };
      },
    },
  },
};

/** Plugin `solercia`: naming plus the style and placement rules (0.2.0, see lib/rules.js). */
const solerciaPlugin = {
  rules: {
    ...solerciaNamingPlugin.rules,
    'style-tokens': styleTokensRule,
    'css-style-tokens': cssStyleTokensRule,
    'fsd-placement': fsdPlacementRule,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FSD boundaries — patterns shared by every layer.
// ─────────────────────────────────────────────────────────────────────────────

/** Forbids deep imports into the internal slices of another layer: only the public API (index.ts). */
const DEEP_IMPORT_PATTERNS = [
  { group: ['@pages/*/*/*'], message: 'Import only from the public API: @pages/<name>' },
  { group: ['@widgets/*/*/*'], message: 'Import only from the public API: @widgets/<name>' },
  { group: ['@features/*/*/*'], message: 'Import only from the public API: @features/<name>' },
  { group: ['@entities/*/*/*'], message: 'Import only from the public API: @entities/<name>' },
];

/** Chart.js is ALWAYS wrapped by sol-chart — no view/feature/entity imports it directly. */
const CHART_ENGINE_PATTERNS = [
  { group: ['chart.js', 'chart.js/*'],
    message: 'Import chart.js only inside shared/ui/chart (sol-chart). Views use <sol-chart>.' },
];

/** MapLibre GL is ALWAYS wrapped by sol-map (lazy loading, light and dark tokens). */
const MAP_ENGINE_MESSAGE =
  'Import maplibre-gl only inside shared/ui/map (sol-map). Views use <sol-map>.';
const MAP_ENGINE_PATTERNS = [
  { group: ['maplibre-gl', 'maplibre-gl/*', '@maplibre/*'], message: MAP_ENGINE_MESSAGE },
];

/**
 * `@angular/cdk` (DragDrop) is ALWAYS wrapped by the `sol-kanban-*` components
 * of `@solercia/ui` — no view/feature/entity/widget of a consumer imports it
 * directly. The only place allowed in the whole ecosystem is the source tree of
 * the library itself (`projects/solercia/ui/src/lib/ui/kanban/` in the
 * @solercia/ui sources), which this preset does not cover (it is outside `src/**`).
 */
const CDK_PATTERNS = [
  { group: ['@angular/cdk', '@angular/cdk/*'],
    message: 'Import @angular/cdk ONLY inside sol-kanban-* (@solercia/ui). Views use <sol-kanban-board>/<sol-kanban-column>/<sol-kanban-card>.' },
];

/**
 * Smart/dumb rule (Solercia front-end conventions): `shared/ui` contains ONLY
 * dumb (presentational) components — it cannot inject stores or facades, nor
 * know the domain. It applies IN ADDITION to the alias boundaries
 * (`@entities/*`, `@features/*`) so it also catches relative deep imports that
 * sidestep them (`../../entities/x`) and the `*.store` / `*.facade` file-name
 * pattern regardless of the path.
 */
const SMART_DUMB_PATTERNS = [
  { group: ['**/entities/**', '**/features/**'],
    message: 'shared/ui holds dumb (presentational) components: it cannot import from entities/ or features/ (not even through a relative path).' },
  { regex: '\\.(store|facade)$',
    message: 'shared/ui cannot import stores or facades — keep components free of domain logic.' },
];

/**
 * Builds the shareable ESLint preset of the Solercia ecosystem.
 *
 * @param {{ srcDir?: string, extraSharedSegments?: string[], allowOutsideLayers?: string[] }} [options]
 *   - srcDir: FSD root of the consuming project (default: 'src'). The aliases
 *     (`@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`) are a
 *     fixed convention of the ecosystem and are NOT configurable; the only thing
 *     that varies between consumers is the physical folder.
 *   - extraSharedSegments: project-specific `shared/` segments, in addition to
 *     the ecosystem ones (`fsd-placement`).
 *   - allowOutsideLayers: bootstrap files outside the layers, relative to
 *     srcDir (`main.ts`, `environments/**`); replaces the default list.
 * @returns {import('eslint').Linter.Config[]}
 */
export function solerciaEslintConfig(options = {}) {
  const src = (options.srcDir ?? 'src').replace(/\/+$/, '');
  const placementOptions = {
    srcDir: src,
    sharedSegments: [...DEFAULT_SHARED_SEGMENTS, ...(options.extraSharedSegments ?? [])],
    allowOutsideLayers: options.allowOutsideLayers ?? DEFAULT_OUTSIDE_LAYERS,
  };

  return [
    // Minimal wiring of the TypeScript parser + registration of the
    // @typescript-eslint plugin (required by `naming-convention`, below).
    // Deliberately scoped without type-checking (no `parserOptions.project`):
    // the preset rules are syntactic and do not need type information.
    {
      files: [`${src}/**/*.ts`],
      languageOptions: {
        parser: tseslint.parser,
      },
      plugins: {
        '@typescript-eslint': tseslint.plugin,
        solercia: solerciaPlugin,
      },
      rules: {
        '@typescript-eslint/naming-convention': [
          'error',
          { selector: 'typeLike', format: ['PascalCase'] },
          { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
          {
            // PascalCase is allowed IN ADDITION to camelCase/UPPER_CASE: the
            // back end (.NET) names its fields in PascalCase (`VcName`,
            // `CompanyId`, `Id`) and the front end mirrors them as-is in
            // destructuring and in test fixture parameters
            // (`const { CompanyId } = ...`,
            // `const cat = (Id, VcName) => ({ Id, VcName })`) — it is not a
            // style error, it is the DTO contract. See *.model.ts.
            selector: 'variable',
            format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
            leadingUnderscore: 'allow',
            trailingUnderscore: 'allow',
          },
          { selector: 'function', format: ['camelCase'] },
          {
            selector: 'parameter',
            format: ['camelCase', 'PascalCase'],
            leadingUnderscore: 'allow',
          },
        ],
        'solercia/filename-case': 'error',
        'solercia/style-tokens': 'error',
        'solercia/fsd-placement': ['error', placementOptions],
      },
    },

    // ── Styles in .css files (only if @eslint/css is installed) ────────────
    ...(cssPlugin
      ? [{
          files: [`${src}/**/*.css`],
          language: 'css/css',
          languageOptions: { tolerant: true },
          plugins: { css: cssPlugin, solercia: solerciaPlugin },
          rules: { 'solercia/css-style-tokens': 'error' },
        }]
      : []),

    // ── Boundary: shared/** ────────────────────────────────────────────────
    // shared/ does NOT import from upper layers or from @app/* (bootstrap).
    {
      files: [`${src}/shared/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@entities/*', '@app/*'],
              message: 'shared/ must NOT import from upper layers or from @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...MAP_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },
    // ── shared/ui: on top of the previous boundary, the smart/dumb rule ────
    // (a MORE specific block than the previous one — flat config: the last
    // block that matches a file wins entirely for a given ruleId, so we
    // repeat the base boundary and add smart/dumb).
    {
      files: [`${src}/shared/ui/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@entities/*', '@app/*'],
              message: 'shared/ must NOT import from upper layers or from @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...MAP_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
            ...SMART_DUMB_PATTERNS,
          ],
        }],
      },
    },
    // ── Chart.js exemption: shared/ui/chart is the ONLY place allowed to
    // import Chart.js. It keeps smart/dumb (the wrapper does not inject domain
    // code either) but without the chart.js pattern. It goes AFTER the
    // shared/ui block so it wins entirely for these files.
    {
      files: [`${src}/shared/ui/chart/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@entities/*', '@app/*'],
              message: 'shared/ must NOT import from upper layers or from @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...MAP_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
            ...SMART_DUMB_PATTERNS,
          ],
        }],
      },
    },
    // ── MapLibre exemption: shared/ui/map (sol-map) is the ONLY place
    // allowed to import maplibre-gl. Same criterion as Chart.js: it keeps
    // smart/dumb and goes after the shared/ui block so it wins.
    {
      files: [`${src}/shared/ui/map/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@entities/*', '@app/*'],
              message: 'shared/ must NOT import from upper layers or from @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
            ...SMART_DUMB_PATTERNS,
          ],
        }],
      },
    },
    // `no-restricted-imports` does not see dynamic `import()` calls: sol-map
    // loads MapLibre lazily and nobody else may do so.
    {
      files: [`${src}/**/*.ts`],
      ignores: [`${src}/shared/ui/map/**`],
      rules: {
        'no-restricted-syntax': ['error', {
          selector: "ImportExpression[source.value=/^maplibre-gl/]",
          message: MAP_ENGINE_MESSAGE,
        }],
      },
    },

    // ── Boundary: entities/** ───────────────────────────────────────────────
    {
      files: [`${src}/entities/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@app/*'],
              message: 'entities/ may only import from @shared/*. It must NOT import from @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...MAP_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },

    // ── Boundary: features/** ───────────────────────────────────────────────
    {
      files: [`${src}/features/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@app/*'],
              message: 'features/ may only import from @entities/* and @shared/*. It must NOT import from @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...MAP_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },

    // ── Boundary: widgets/** ────────────────────────────────────────────────
    {
      files: [`${src}/widgets/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@app/*'],
              message: 'widgets/ must NOT import from @pages/* or @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...MAP_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },

    // ── Boundary: pages/** ──────────────────────────────────────────────────
    {
      files: [`${src}/pages/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@app/*'],
              message: 'pages/ must NOT import from @app/* (bootstrap). Use @widgets/@features/@entities/@shared.' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...MAP_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },

    // ── Boundary: app/** (root/bootstrap layer) ────────────────────────────
    // It may import from any FSD layer, but keeps the public API convention
    // (no deep imports into internal slices).
    {
      files: [`${src}/app/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', { patterns: [...DEEP_IMPORT_PATTERNS, ...CHART_ENGINE_PATTERNS, ...MAP_ENGINE_PATTERNS, ...CDK_PATTERNS] }],
      },
    },
  ];
}

/** Ready-to-use config with `srcDir: 'src'` (the ecosystem default). */
export default solerciaEslintConfig();
