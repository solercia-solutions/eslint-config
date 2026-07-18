// @ts-check
/**
 * @solercia/eslint-config — preset ESLint compartible (flat config, ESLint 10) del
 * ecosistema Solercia.
 *
 * Extraído de `boki-front/eslint.config.js` (openspec 07-e9-extraccion-solercia-ui,
 * PR2). Encapsula:
 *   1. Las fronteras FSD por capa (`no-restricted-imports`):
 *      app → pages → widgets → features → entities → shared
 *   2. La regla smart/dumb de `shared/ui`: prohíbe importar stores/facades/dominio
 *      (`**\/entities/**`, `**\/features/**`, patrones `*.store`/`*.facade`).
 *   3. La restricción de Chart.js: prohíbe `chart.js` fuera de `shared/ui/chart`.
 *   4. Convenciones de nombres: `@typescript-eslint/naming-convention` (símbolos
 *      tipo/variable/función/parámetro) + `filename-case` propio (kebab-case).
 *
 * Uso (mientras el paquete no se publica — ver README.md de esta carpeta):
 *
 *   import solerciaConfig from './packages/eslint-config/index.js';
 *   export default [
 *     ...solerciaConfig,
 *     // reglas/overrides propios del proyecto consumidor
 *   ];
 *
 * Parametrizable si el proyecto consumidor no usa `src/` como raíz FSD:
 *
 *   import { solerciaEslintConfig } from './packages/eslint-config/index.js';
 *   export default [...solerciaEslintConfig({ srcDir: 'apps/web/src' })];
 */
import tseslint from 'typescript-eslint';

// ─────────────────────────────────────────────────────────────────────────────
// Plugin propio, in-house: regla `filename-case` (kebab-case). Se implementa
// local en vez de instalar `eslint-plugin-unicorn` completo (filosofía del
// proyecto: in-house por defecto — ver CLAUDE.md raíz del monorepo — para no
// arrastrar decenas de reglas ajenas por una sola que además es trivial).
// ─────────────────────────────────────────────────────────────────────────────
const KEBAB_SEGMENT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IGNORED_BASENAMES = new Set(['index.ts', 'index.d.ts']);

const solerciaNamingPlugin = {
  rules: {
    'filename-case': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Exige nombres de archivo en kebab-case (convención FSD Solercia, CONVENCIONES-FRONT-SOLERCIA.md §5).',
        },
        schema: [],
        messages: {
          notKebabCase:
            'El archivo "{{basename}}" no sigue kebab-case (segmento inválido: "{{segment}}"). Usa minúsculas y guiones, ej. "appointment-form.component.ts".',
        },
      },
      create(context) {
        return {
          Program(node) {
            const filename = context.filename ?? context.getFilename();
            const basename = filename.split(/[\\/]/).pop() ?? '';
            if (IGNORED_BASENAMES.has(basename)) return;

            // Quita SOLO la extensión final (.ts/.tsx/.mts/.cts) — el resto de
            // segmentos separados por "." (ej. "button.component.spec") se
            // validan uno por uno, porque cada uno debe ser kebab-case.
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

// ─────────────────────────────────────────────────────────────────────────────
// Fronteras FSD — patrones compartidos por todas las capas.
// ─────────────────────────────────────────────────────────────────────────────

/** Prohíbe deep-imports a slices internos de otra capa: solo la public API (index.ts). */
const DEEP_IMPORT_PATTERNS = [
  { group: ['@pages/*/*/*'], message: 'Importa solo desde la public API: @pages/nombre' },
  { group: ['@widgets/*/*/*'], message: 'Importa solo desde la public API: @widgets/nombre' },
  { group: ['@features/*/*/*'], message: 'Importa solo desde la public API: @features/nombre' },
  { group: ['@entities/*/*/*'], message: 'Importa solo desde la public API: @entities/nombre' },
];

/** Chart.js SIEMPRE envuelto en sol-chart — ninguna vista/feature/entity lo importa directo. */
const CHART_ENGINE_PATTERNS = [
  { group: ['chart.js', 'chart.js/*'],
    message: 'Chart.js solo se importa dentro de shared/ui/chart (sol-chart). Las vistas usan <sol-chart>.' },
];

/**
 * `@angular/cdk` (DragDrop) SIEMPRE envuelto en `sol-kanban-*` de `@solercia/ui`
 * — ninguna vista/feature/entity/widget de un consumidor lo importa directo
 * (11-a-solercia-ui, PR5b/D1). El único lugar autorizado del ECOSISTEMA es el
 * árbol fuente de la propia librería (`projects/solercia/ui/src/lib/ui/kanban/`
 * en boki-front), que este preset compartido no cubre (fuera de `src/**`) — se
 * exime aparte en el `eslint.config.js` de boki-front.
 */
const CDK_PATTERNS = [
  { group: ['@angular/cdk', '@angular/cdk/*'],
    message: '@angular/cdk se importa ÚNICAMENTE dentro de sol-kanban-* (@solercia/ui). Las vistas usan <sol-kanban-board>/<sol-kanban-column>/<sol-kanban-card>.' },
];

/**
 * Regla smart/dumb (CONVENCIONES-FRONT-SOLERCIA.md §4): `shared/ui` contiene
 * SOLO componentes tontos (presentacionales) — no puede inyectar stores,
 * facades ni conocer dominio. Se aplica ADEMÁS de las fronteras de alias
 * (`@entities/*`, `@features/*`) para atrapar también deep-imports relativos
 * que las esquiven (`../../entities/x`) y el patrón de nombre de archivo
 * `*.store` / `*.facade` sin importar la ruta.
 */
const SMART_DUMB_PATTERNS = [
  { group: ['**/entities/**', '**/features/**'],
    message: 'shared/ui es de componentes tontos (presentacionales): no puede importar de entities/ ni features/ (ni siquiera por ruta relativa).' },
  { regex: '\\.(store|facade)$',
    message: 'shared/ui no puede importar stores ni facades — mantiene los componentes sin lógica de dominio.' },
];

/**
 * Construye el preset ESLint compartible del ecosistema Solercia.
 *
 * @param {{ srcDir?: string }} [options]
 *   - srcDir: raíz FSD del proyecto consumidor (default: 'src'). Los alias
 *     (`@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`) son
 *     convención fija del ecosistema (CONVENCIONES-FRONT-SOLERCIA.md) y NO se
 *     parametrizan; lo único variable entre consumidores es la carpeta física.
 * @returns {import('eslint').Linter.Config[]}
 */
export function solerciaEslintConfig(options = {}) {
  const src = (options.srcDir ?? 'src').replace(/\/+$/, '');

  return [
    // Wiring mínimo del parser TypeScript + registro del plugin
    // @typescript-eslint (requerido por `naming-convention`, más abajo).
    // Alcance deliberadamente sin type-checking (sin `parserOptions.project`):
    // las reglas del preset son sintácticas, no requieren info de tipos.
    {
      files: [`${src}/**/*.ts`],
      languageOptions: {
        parser: tseslint.parser,
      },
      plugins: {
        '@typescript-eslint': tseslint.plugin,
        solercia: solerciaNamingPlugin,
      },
      rules: {
        '@typescript-eslint/naming-convention': [
          'error',
          { selector: 'typeLike', format: ['PascalCase'] },
          { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
          {
            // PascalCase permitido ADEMÁS de camelCase/UPPER_CASE: el back
            // (.NET) nombra sus campos en PascalCase (`VcName`, `CompanyId`,
            // `Id`) y el front los espeja tal cual en destructuring y en
            // parámetros de fixtures de test (`const { CompanyId } = ...`,
            // `const cat = (Id, VcName) => ({ Id, VcName })`) — no es un
            // error de estilo, es el contrato del DTO. Ver *.model.ts.
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
      },
    },

    // ── Frontera: shared/** ────────────────────────────────────────────────
    // shared/ NO importa de capas superiores ni de @app/* (bootstrap).
    {
      files: [`${src}/shared/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@entities/*', '@app/*'],
              message: 'shared/ NO puede importar de capas superiores ni de @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },
    // ── shared/ui: además de la frontera anterior, regla smart/dumb ────────
    // (bloque MÁS específico que el anterior — flat config: el último bloque
    // que matchea un archivo gana por completo para un mismo ruleId, así que
    // repetimos la frontera base y sumamos smart/dumb).
    {
      files: [`${src}/shared/ui/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@entities/*', '@app/*'],
              message: 'shared/ NO puede importar de capas superiores ni de @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
            ...SMART_DUMB_PATTERNS,
          ],
        }],
      },
    },
    // ── Exención Chart.js: shared/ui/chart es el ÚNICO lugar autorizado para
    // importar Chart.js. Mantiene smart/dumb (el wrapper tampoco inyecta
    // dominio) pero sin el patrón de chart.js. Va DESPUÉS del bloque de
    // shared/ui para ganar por completo en estos archivos.
    {
      files: [`${src}/shared/ui/chart/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@entities/*', '@app/*'],
              message: 'shared/ NO puede importar de capas superiores ni de @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CDK_PATTERNS,
            ...SMART_DUMB_PATTERNS,
          ],
        }],
      },
    },

    // ── Frontera: entities/** ───────────────────────────────────────────────
    {
      files: [`${src}/entities/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@features/*', '@app/*'],
              message: 'entities/ solo puede importar de @shared/*. NO puede importar de @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },

    // ── Frontera: features/** ───────────────────────────────────────────────
    {
      files: [`${src}/features/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@widgets/*', '@app/*'],
              message: 'features/ solo puede importar de @entities/* y @shared/*. NO puede importar de @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },

    // ── Frontera: widgets/** ────────────────────────────────────────────────
    {
      files: [`${src}/widgets/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@pages/*', '@app/*'],
              message: 'widgets/ NO puede importar de @pages/* ni de @app/* (bootstrap)' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },

    // ── Frontera: pages/** ──────────────────────────────────────────────────
    {
      files: [`${src}/pages/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['@app/*'],
              message: 'pages/ NO puede importar de @app/* (bootstrap). Usa @widgets/@features/@entities/@shared.' },
            ...DEEP_IMPORT_PATTERNS,
            ...CHART_ENGINE_PATTERNS,
            ...CDK_PATTERNS,
          ],
        }],
      },
    },

    // ── Frontera: app/** (capa raíz/bootstrap) ─────────────────────────────
    // Puede importar de cualquier capa FSD, pero mantiene la convención de
    // public API (no deep-import a slices internos).
    {
      files: [`${src}/app/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', { patterns: [...DEEP_IMPORT_PATTERNS, ...CHART_ENGINE_PATTERNS, ...CDK_PATTERNS] }],
      },
    },
  ];
}

/** Config lista para usar con `srcDir: 'src'` (default del ecosistema). */
export default solerciaEslintConfig();
