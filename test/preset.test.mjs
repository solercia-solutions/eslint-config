// Behavior tests for the preset rules added in 0.2.0: style tokens (inline
// component styles and .css files) and FSD file placement. They lint real
// strings through the public preset, the same way a consumer runs ESLint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
import { solerciaEslintConfig } from '../index.js';

const cwd = '/virtual-project';

async function lint(filePath, code, options) {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: solerciaEslintConfig(options),
  });
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/${filePath}` });
  return result.messages;
}

const ids = (messages, ruleId) =>
  messages.filter((m) => m.ruleId === ruleId).map((m) => m.messageId);

const component = (styles, template = '<p></p>') => `
import { Component } from '@angular/core';
@Component({
  selector: 'app-demo',
  template: \`${template}\`,
  styles: [\`${styles}\`],
})
export class DemoComponent {}
`;

const STYLE_RULE = 'solercia/style-tokens';
const UI_FILE = 'src/features/demo/ui/demo.component.ts';

test('style-tokens: theme variables pass', async () => {
  const messages = await lint(UI_FILE, component(
    '.card { color: var(--sol-text); background: color-mix(in srgb, var(--sol-primary) 10%, transparent); }',
  ));
  assert.deepEqual(ids(messages, STYLE_RULE), []);
});

test('style-tokens: a literal color in a declaration is reported', async () => {
  const messages = await lint(UI_FILE, component('.card { color: #333333; border: 1px solid rgba(0, 0, 0, 0.1); }'));
  assert.deepEqual(ids(messages, STYLE_RULE), ['hardcodedColor', 'hardcodedColor']);
});

test('style-tokens: a named color in a color property is reported', async () => {
  const messages = await lint(UI_FILE, component('.card { background: white; }'));
  assert.deepEqual(ids(messages, STYLE_RULE), ['hardcodedColor']);
});

test('style-tokens: a literal color as var() fallback is allowed', async () => {
  const messages = await lint(UI_FILE, component('.card { color: var(--sol-text, #333); border-color: var(--sol-border, rgb(0 0 0 / 10%)); }'));
  assert.deepEqual(ids(messages, STYLE_RULE), []);
});

test('style-tokens: a literal color as the main var() argument is reported', async () => {
  const messages = await lint(UI_FILE, component('.card { color: color-mix(in srgb, #ff0000 10%, var(--sol-bg)); }'));
  assert.deepEqual(ids(messages, STYLE_RULE), ['hardcodedColor']);
});

test('style-tokens: defining a custom property with a literal is allowed', async () => {
  const messages = await lint(UI_FILE, component(':host { --demo-accent: #2563eb; }'));
  assert.deepEqual(ids(messages, STYLE_RULE), []);
});

test('style-tokens: token names that contain a color word are not colors', async () => {
  const messages = await lint(UI_FILE, component('.card { color: var(--sol-red); border: 1px solid var(--sol-white-alpha); }'));
  assert.deepEqual(ids(messages, STYLE_RULE), []);
});

test('style-tokens: id selectors are not colors', async () => {
  const messages = await lint(UI_FILE, component('#abc .card:hover { color: var(--sol-text); }'));
  assert.deepEqual(ids(messages, STYLE_RULE), []);
});

test('style-tokens: !important and ::ng-deep are reported', async () => {
  const messages = await lint(UI_FILE, component(':host ::ng-deep .x { display: none !important; }'));
  assert.deepEqual(ids(messages, STYLE_RULE).sort(), ['important', 'ngDeep']);
});

test('style-tokens: a literal font-family is reported, a token is not', async () => {
  const bad = await lint(UI_FILE, component('.a { font-family: Inter, sans-serif; }'));
  const good = await lint(UI_FILE, component('.a { font-family: var(--sol-font-family); } .b { font-family: inherit; }'));
  assert.deepEqual(ids(bad, STYLE_RULE), ['hardcodedFont']);
  assert.deepEqual(ids(good, STYLE_RULE), []);
});

test('style-tokens: inline style attributes in the template are checked', async () => {
  const messages = await lint(UI_FILE, component('.a { color: var(--sol-text); }', '<p style="color: #fff; margin: 0">x</p>'));
  assert.deepEqual(ids(messages, STYLE_RULE), ['hardcodedColor']);
});

test('style-tokens: a single styles string is checked', async () => {
  const code = `
import { Component } from '@angular/core';
@Component({ selector: 'app-x', template: '', styles: '.a { color: red; }' })
export class XComponent {}
`;
  assert.deepEqual(ids(await lint(UI_FILE, code), STYLE_RULE), ['hardcodedColor']);
});

test('style-tokens: comments are ignored', async () => {
  const messages = await lint(UI_FILE, component('/* old: #fff !important */ .a { color: var(--sol-text); }'));
  assert.deepEqual(ids(messages, STYLE_RULE), []);
});

test('style-tokens: the report points at the offending literal', async () => {
  const code = component('.card { color: #333333; }');
  const [message] = (await lint(UI_FILE, code)).filter((m) => m.ruleId === STYLE_RULE);
  const line = code.split('\n')[message.line - 1];
  assert.equal(line.slice(message.column - 1, message.column - 1 + 7), '#333333');
});

test('style-tokens: options can allow !important for a legacy override file', async () => {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [
      ...solerciaEslintConfig(),
      { files: ['src/**/*.ts'], rules: { [STYLE_RULE]: ['error', { allowImportant: true }] } },
    ],
  });
  const [result] = await eslint.lintText(component('.a { display: none !important; }'), { filePath: `${cwd}/${UI_FILE}` });
  assert.deepEqual(ids(result.messages, STYLE_RULE), []);
});

const CSS_RULE = 'solercia/css-style-tokens';

test('css-style-tokens: .css files get the same checks', async () => {
  const messages = await lint('src/styles.css', ':root { --sol-bg: #ffffff; }\nbody { color: #111; margin: 0 !important; }\n');
  assert.deepEqual(ids(messages, CSS_RULE).sort(), ['hardcodedColor', 'important']);
  const color = messages.find((m) => m.messageId === 'hardcodedColor');
  assert.equal(color.line, 2);
  assert.equal(color.column, 15);
});

test('css-style-tokens: a clean stylesheet passes', async () => {
  const messages = await lint('src/app/app.component.css', ':host { display: block; color: var(--sol-text, #222); }\n');
  assert.deepEqual(messages, []);
});

const PLACEMENT = 'solercia/fsd-placement';

test('fsd-placement: files inside a slice segment pass', async () => {
  for (const file of [
    'src/features/login/ui/login-form.component.ts',
    'src/features/login/index.ts',
    'src/entities/user/model/user.model.ts',
    'src/pages/admin/telemetry/ui/usage-page.component.ts',
    'src/shared/ui/button/button.component.ts',
    'src/shared/tokens/theme.service.ts',
    'src/app/app.config.ts',
    'src/features/index.ts',
    'src/pages/catalog/catalog.routes.ts',
    'src/entities/pos-sale/testing/pos-sale.fixtures.ts',
    'src/main.ts',
    'src/environments/environment.ts',
  ]) {
    assert.deepEqual(ids(await lint(file, 'export const valueX = 1;\n'), PLACEMENT), [], file);
  }
});

test('fsd-placement: a file outside the FSD layers is reported', async () => {
  assert.deepEqual(ids(await lint('src/helpers/format.ts', 'export const valueX = 1;\n'), PLACEMENT), ['unknownLayer']);
});

test('fsd-placement: a slice file outside a segment is reported', async () => {
  assert.deepEqual(ids(await lint('src/features/login/login.service.ts', 'export const valueX = 1;\n'), PLACEMENT), ['missingSegment']);
});

test('fsd-placement: a routes file is only allowed at the root of a page slice', async () => {
  assert.deepEqual(ids(await lint('src/features/login/login.routes.ts', 'export const valueX = 1;\n'), PLACEMENT), ['missingSegment']);
});

test('fsd-placement: a file directly under a layer is reported', async () => {
  assert.deepEqual(ids(await lint('src/widgets/sidebar.component.ts', 'export const valueX = 1;\n'), PLACEMENT), ['missingSegment']);
});

test('fsd-placement: an unknown shared segment is reported and can be allowed', async () => {
  const file = 'src/shared/support/report.ts';
  assert.deepEqual(ids(await lint(file, 'export const valueX = 1;\n'), PLACEMENT), ['unknownSharedSegment']);
  assert.deepEqual(ids(await lint(file, 'export const valueX = 1;\n', { extraSharedSegments: ['support'] }), PLACEMENT), []);
});
