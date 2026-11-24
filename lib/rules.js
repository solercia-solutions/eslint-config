// @ts-check
/**
 * In-house rules of @solercia/eslint-config 0.2.0:
 *   - `style-tokens`: theme tokens in Angular component styles (TypeScript).
 *   - `css-style-tokens`: the same checks on .css files (@eslint/css language).
 *   - `fsd-placement`: every source file lives in an FSD layer and segment.
 */
import { checkStyles, STYLE_MESSAGES, STYLE_OPTIONS_SCHEMA } from './style-checker.js';

/**
 * Reports every problem found in a CSS fragment that starts at `baseOffset` of the source.
 * @param {import('eslint').Rule.RuleContext} context
 * @param {string} cssText
 * @param {number} baseOffset
 */
function reportFragment(context, cssText, baseOffset) {
  const sourceCode = context.sourceCode;
  for (const problem of checkStyles(cssText, context.options[0] ?? {})) {
    const start = baseOffset + problem.index;
    context.report({
      loc: {
        start: sourceCode.getLocFromIndex(start),
        end: sourceCode.getLocFromIndex(start + problem.length),
      },
      messageId: problem.messageId,
      data: problem.data,
    });
  }
}

/**
 * String pieces of a node, each one with the source offset of its first character.
 * Template literal expressions (`${...}`) are skipped: only the static text is CSS.
 * @param {any} node
 * @returns {Array<{ text: string, offset: number }>}
 */
function stringPieces(node) {
  if (!node) return [];
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return [{ text: node.raw.slice(1, -1), offset: node.range[0] + 1 }];
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((/** @type {any} */ quasi) => ({ text: quasi.value.raw, offset: quasi.range[0] + 1 }));
  }
  if (node.type === 'ArrayExpression') return node.elements.flatMap(stringPieces);
  return [];
}

const STYLE_ATTRIBUTE = /(?<![\w-])style\s*=\s*(["'])([\s\S]*?)\1/g;

/** @type {import('eslint').Rule.RuleModule} */
export const styleTokensRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Requires theme variables in Angular component styles (styles and template style attributes): no literal colors or font families, no !important and no ::ng-deep.',
    },
    schema: STYLE_OPTIONS_SCHEMA,
    messages: STYLE_MESSAGES,
  },
  create(context) {
    return {
      /** @param {any} node */
      'Decorator > CallExpression[callee.name="Component"] > ObjectExpression > Property'(node) {
        const key = node.key.type === 'Identifier' ? node.key.name : node.key.value;
        if (key === 'styles') {
          for (const piece of stringPieces(node.value)) reportFragment(context, piece.text, piece.offset);
        } else if (key === 'template') {
          for (const piece of stringPieces(node.value)) {
            for (const attr of piece.text.matchAll(STYLE_ATTRIBUTE)) {
              const declarations = attr[2];
              const at = /** @type {number} */ (attr.index) + attr[0].length - declarations.length - 1;
              reportFragment(context, declarations, piece.offset + at);
            }
          }
        }
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
export const cssStyleTokensRule = {
  meta: {
    type: 'problem',
    docs: { description: 'The same style-tokens checks on .css files (requires the css/css language from @eslint/css).' },
    schema: STYLE_OPTIONS_SCHEMA,
    messages: STYLE_MESSAGES,
  },
  create(context) {
    return {
      StyleSheet() {
        reportFragment(context, context.sourceCode.text, 0);
      },
    };
  },
};

const SLICE_LAYERS = new Set(['pages', 'widgets', 'features', 'entities']);
/** `testing` holds fixtures and test doubles of a slice. */
const SLICE_SEGMENTS = new Set(['ui', 'model', 'api', 'lib', 'config', 'testing']);
export const DEFAULT_SHARED_SEGMENTS = ['api', 'config', 'crud', 'i18n', 'lib', 'model', 'tenant', 'tokens', 'ui'];
export const DEFAULT_OUTSIDE_LAYERS = ['main.ts', 'test-setup.ts', 'polyfills.ts', 'environments/**'];

/**
 * @param {string} relative path relative to srcDir, with forward slashes
 * @param {string[]} patterns exact paths or `dir/**` prefixes
 */
function matchesAny(relative, patterns) {
  return patterns.some((pattern) =>
    pattern.endsWith('/**') ? relative.startsWith(pattern.slice(0, -2)) : relative === pattern);
}

/** @type {import('eslint').Rule.RuleModule} */
export const fsdPlacementRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Requires every file to live in an FSD layer (app, pages, widgets, features, entities, shared) and, inside a slice, in a segment (ui, model, api, lib, config, testing).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          srcDir: { type: 'string' },
          sharedSegments: { type: 'array', items: { type: 'string' } },
          allowOutsideLayers: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unknownLayer:
        '"{{path}}" is outside the FSD layers. Move it into app, pages, widgets, features, entities or shared, or declare it in allowOutsideLayers if it is a bootstrap file.',
      missingSegment:
        '"{{path}}" is not inside a segment. In {{layer}} every file goes in <slice>/(ui|model|api|lib|config|testing)/; the slice root only holds index.ts (the public API) and, in pages, <slice>.routes.ts.',
      unknownSharedSegment:
        '"{{segment}}" is not a shared segment ({{allowed}}). Use an existing one or add it with extraSharedSegments in the project eslint.config.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const srcDir = (options.srcDir ?? 'src').replace(/\/+$/, '');
    const sharedSegments = options.sharedSegments ?? DEFAULT_SHARED_SEGMENTS;
    const outside = options.allowOutsideLayers ?? DEFAULT_OUTSIDE_LAYERS;

    return {
      /** @param {any} node */
      Program(node) {
        const filename = context.filename.split('\\').join('/');
        const root = `${context.cwd.split('\\').join('/').replace(/\/+$/, '')}/${srcDir}/`;
        if (!filename.startsWith(root)) return;
        const relative = filename.slice(root.length);
        if (matchesAny(relative, outside)) return;

        const parts = relative.split('/');
        const [layer] = parts;
        const report = (/** @type {string} */ messageId, /** @type {Record<string, string>} */ data) =>
          context.report({ node, messageId, data: { path: `${srcDir}/${relative}`, layer, ...data } });

        if (layer === 'app') return;
        if (layer === 'shared') {
          if (parts.length === 2 && parts[1] === 'index.ts') return;
          if (parts.length < 3 || !sharedSegments.includes(parts[1])) {
            report('unknownSharedSegment', { segment: parts.length < 3 ? '(root)' : parts[1], allowed: sharedSegments.join(', ') });
          }
          return;
        }
        if (!SLICE_LAYERS.has(layer)) {
          report('unknownLayer', {});
          return;
        }
        // Public API barrels (layer or slice index.ts) and the lazy routes of a page slice.
        if (parts.at(-1) === 'index.ts') return;
        if (layer === 'pages' && parts.length === 3 && parts[2].endsWith('.routes.ts')) return;
        const segmentAt = parts.findIndex((part, i) => i >= 2 && i < parts.length - 1 && SLICE_SEGMENTS.has(part));
        if (segmentAt < 0) report('missingSegment', {});
      },
    };
  },
};
