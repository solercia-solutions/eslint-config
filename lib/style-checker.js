// @ts-check
/**
 * Text-level checker shared by `solercia/style-tokens` (inline component
 * styles in TypeScript) and `solercia/css-style-tokens` (.css files).
 *
 * Source of the rules: the Solercia CSS standards ("Reglas de CSS",
 * summarized in README.md): always theme variables, never hardcoded colors or font families, no
 * `::ng-deep`, no `!important`. A literal is still allowed in two places,
 * because that is how tokens are defined and how first paint survives a
 * missing theme:
 *   - as the value of a custom property (`--sol-bg: #fff`), and
 *   - as the fallback of `var()` (`var(--sol-bg, #fff)`).
 *
 * The checker works on raw CSS text (declaration lists included, for
 * `style="..."` attributes) and returns offsets relative to that text.
 */

/** CSS named colors (CSS Color Module Level 4), without keywords such as `transparent` or `currentColor`. */
const NAMED_COLORS = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue
darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink
deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold
goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush
lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey
lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime
limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise
palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow
springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`
  .split(/\s+/));

/** Properties where a bare identifier can be a color name. */
const COLOR_PROPERTY = /color|background|border|outline|fill|stroke|shadow|column-rule|text-decoration|caret|accent/;

const HEX_COLOR = /#[0-9a-fA-F]{3,8}(?![\w-])/g;
const COLOR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const IDENTIFIER = /(?<![\w-])[a-zA-Z]+(?![\w-(])/g;
const DECLARATION = /(^|[{;\s])(--[\w-]+|-?[a-zA-Z][\w-]*)\s*:(?!:)([^;{}]*?)(?=\s*(?:;|}|$))/g;
const IMPORTANT = /!\s*important\b/gi;
const NG_DEEP = /::ng-deep\b/g;
const FONT_KEYWORDS = /^(inherit|initial|unset|revert|revert-layer)$/i;

/**
 * Replaces comments with spaces so offsets stay valid.
 * @param {string} text
 */
function blankComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/**
 * Ranges (relative to `value`) occupied by `var()` fallbacks, including nested ones.
 * @param {string} value
 * @returns {Array<[number, number]>}
 */
function fallbackRanges(value) {
  /** @type {Array<[number, number]>} */
  const ranges = [];
  const varCall = /(?<![\w-])var\(/gi;
  let match;
  while ((match = varCall.exec(value))) {
    let depth = 1;
    let commaAt = -1;
    let i = match.index + match[0].length;
    for (; i < value.length && depth > 0; i++) {
      const ch = value[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 1 && commaAt < 0) commaAt = i;
    }
    if (commaAt >= 0) ranges.push([commaAt + 1, i - 1]);
  }
  return ranges;
}

/**
 * @typedef {{ messageId: 'hardcodedColor' | 'hardcodedFont' | 'important' | 'ngDeep', index: number, length: number, data?: Record<string, string> }} StyleProblem
 * @param {string} rawText CSS text: a stylesheet or a declaration list.
 * @param {{ allowImportant?: boolean, allowNgDeep?: boolean }} [options]
 * @returns {StyleProblem[]}
 */
export function checkStyles(rawText, options = {}) {
  const text = blankComments(rawText);
  /** @type {StyleProblem[]} */
  const problems = [];

  if (!options.allowNgDeep) {
    for (const m of text.matchAll(NG_DEEP)) problems.push({ messageId: 'ngDeep', index: m.index, length: m[0].length });
  }
  if (!options.allowImportant) {
    for (const m of text.matchAll(IMPORTANT)) problems.push({ messageId: 'important', index: m.index, length: m[0].length });
  }

  for (const decl of text.matchAll(DECLARATION)) {
    const property = decl[2].toLowerCase();
    if (property.startsWith('--')) continue;
    const value = decl[3];
    const valueStart = decl.index + decl[0].length - value.length;
    const allowed = fallbackRanges(value);
    const isAllowed = (/** @type {number} */ at) => allowed.some(([from, to]) => at >= from && at < to);
    const literal = value.replace(IMPORTANT, (s) => ' '.repeat(s.length));

    if (property === 'font-family') {
      const trimmed = literal.trim();
      if (trimmed && !/var\(/i.test(trimmed) && !FONT_KEYWORDS.test(trimmed)) {
        const at = value.indexOf(trimmed);
        problems.push({ messageId: 'hardcodedFont', index: valueStart + at, length: trimmed.length, data: { value: trimmed } });
      }
      continue;
    }

    /** @type {Array<{ at: number, found: string }>} */
    const colors = [];
    for (const m of literal.matchAll(HEX_COLOR)) colors.push({ at: m.index, found: m[0] });
    for (const m of literal.matchAll(COLOR_FUNCTION)) colors.push({ at: m.index, found: m[0].slice(0, -1) });
    if (COLOR_PROPERTY.test(property)) {
      for (const m of literal.matchAll(IDENTIFIER)) {
        if (NAMED_COLORS.has(m[0].toLowerCase())) colors.push({ at: m.index, found: m[0] });
      }
    }
    for (const { at, found } of colors.sort((a, b) => a.at - b.at)) {
      if (isAllowed(at)) continue;
      problems.push({ messageId: 'hardcodedColor', index: valueStart + at, length: found.length, data: { value: found, property } });
    }
  }

  return problems.sort((a, b) => a.index - b.index);
}

export const STYLE_MESSAGES = {
  hardcodedColor:
    'Color literal "{{value}}" en "{{property}}": usa una variable del tema, var(--sol-*). Un literal solo se admite como fallback, var(--sol-x, {{value}}), o al definir una custom property.',
  hardcodedFont:
    'font-family literal "{{value}}": usa la tipografía del tema, var(--sol-font-family) o la variable que corresponda.',
  important: 'No uses !important: revisa la especificidad del selector o expón una variable del tema.',
  ngDeep: 'No uses ::ng-deep: para estilos entre componentes expón una CSS custom property.',
};

export const STYLE_OPTIONS_SCHEMA = [
  {
    type: 'object',
    properties: {
      allowImportant: { type: 'boolean' },
      allowNgDeep: { type: 'boolean' },
    },
    additionalProperties: false,
  },
];
