# @solercia/eslint-config

Preset ESLint compartible (flat config, ESLint 10) del ecosistema Solercia. Extraído de
`boki-front/eslint.config.js` (openspec `07-e9-extraccion-solercia-ui`, PR2) para que otros
proyectos (empezando por `gestion_proyectos`) hereden las mismas reglas **por dependencia**,
en vez de clonarlas.

## Qué incluye

1. **Fronteras FSD** (`no-restricted-imports` por capa): `app → pages → widgets → features →
   entities → shared`, con `shared/**` sin poder importar de capas superiores.
2. **Regla smart/dumb** de `shared/ui`: prohíbe importar stores/facades/dominio
   (`**/entities/**`, `**/features/**`, patrones `*.store`/`*.facade`).
3. **Restricción de Chart.js**: prohíbe `chart.js` fuera de `shared/ui/chart` (las vistas usan
   `<sol-chart>`). Igual con MapLibre: `maplibre-gl` solo dentro de `shared/ui/map` (las vistas
   usan `<sol-map>`), incluidos sus `import()` dinámicos.
4. **Convenciones de nombres**: `@typescript-eslint/naming-convention` (clases/interfaces/tipos
   en PascalCase, variables/funciones/parámetros en camelCase) + `filename-case` propio
   (kebab-case de archivos). Implementado in-house (sin `eslint-plugin-unicorn`) siguiendo la
   filosofía "in-house por defecto" del proyecto.
5. **Estilos con variables del tema** (`solercia/style-tokens`, desde 0.2.0), según
   `CODING_STANDARDS.md` § «Reglas de CSS». Revisa los `styles` del decorador `@Component` y los
   atributos `style="..."` del `template` inline:
   - colores literales (`#hex`, `rgb()`, `hsl()`, `oklch()`… y nombres como `white`) → `var(--sol-*)`;
   - `font-family` literal → la tipografía del tema;
   - `!important` y `::ng-deep`.

   Un literal se admite en dos lugares: como fallback (`var(--sol-bg, #fff)`) y al definir una
   custom property (`--sol-bg: #fff`). Con `@eslint/css` instalado (peer opcional), la regla
   `solercia/css-style-tokens` aplica lo mismo a los `.css` de `src/`. No cubre plantillas
   `templateUrl` (`.html`) ni medidas en `px`.
6. **Ubicación de archivos** (`solercia/fsd-placement`, desde 0.2.0): todo `.ts` de `src/` vive en
   una capa (`app`, `pages`, `widgets`, `features`, `entities`, `shared`). En `pages`, `widgets`,
   `features` y `entities` cada archivo va en `<slice>/<segmento>/` (`ui`, `model`, `api`, `lib`,
   `config`, `testing`); los grupos de slices están permitidos (`pages/admin/usuarios/ui/`). En la
   raíz del slice solo va `index.ts` y, en `pages`, `<slice>.routes.ts`. En `shared` el segundo
   nivel debe ser un segmento conocido (`api`, `config`, `crud`, `i18n`, `lib`, `model`, `tenant`,
   `tokens`, `ui`). Fuera de las capas solo se admiten `main.ts`, `test-setup.ts`, `polyfills.ts`
   y `environments/**`.

### Excepciones declaradas en el consumidor

Las excepciones se declaran en el `eslint.config.js` del proyecto, nunca en el preset:

```js
import { solerciaEslintConfig } from '@solercia/eslint-config';

export default [
  ...solerciaEslintConfig({ extraSharedSegments: ['support'] }),
  // Hoja que sobrescribe un tema de terceros: el !important es deliberado.
  { files: ['src/assets/legacy-theme.css'], rules: { 'solercia/css-style-tokens': ['error', { allowImportant: true }] } },
];
```

Para un caso puntual (por ejemplo una hoja de impresión) basta un
`/* eslint-disable-next-line solercia/style-tokens -- motivo */` con el motivo escrito.

## Estado de distribución

Hoy es un paquete **preparado para publicar, aún sin publicar realmente** (metadata de
publicación lista: licencia `Apache-2.0`, `NOTICE`, `publishConfig` hacia GitHub Packages,
`npm publish --dry-run` verificado — ver `openspec/07-e9-extraccion-solercia-ui/tasks.md`,
PR4). La publicación real está bloqueada por la decisión D1 del fundador (owner/organización
del scope `@solercia`, repositorio de alojamiento y método de autenticación). Mientras tanto,
`boki-front` NO declara `workspaces` en su `package.json` raíz, así que en vez de instalarlo
como dependencia de npm, se referencia por **ruta relativa** desde `eslint.config.js`:

```js
import solerciaConfig from './packages/eslint-config/index.js';

export default [
  ...solerciaConfig,
  // reglas/overrides propios del proyecto consumidor
];
```

Cuando se publique en GitHub Packages (PR4 de `07-e9-extraccion-solercia-ui`), este paquete
pasa a instalarse como cualquier devDependency y el import cambia a
`import solerciaConfig from '@solercia/eslint-config';`.

## Parametrización

Los alias (`@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`) son convención
fija del ecosistema (`CONVENCIONES-FRONT-SOLERCIA.md`) y no se parametrizan. Lo único variable
entre consumidores es la carpeta física raíz de FSD (`src/` por default):

```js
import { solerciaEslintConfig } from './packages/eslint-config/index.js';

export default [...solerciaEslintConfig({ srcDir: 'apps/web/src' })];
```

## Licencia

`Apache-2.0` © 2026 Solercia Solutions SAS. Ver [`LICENSE`](./LICENSE) y [`NOTICE`](./NOTICE).
