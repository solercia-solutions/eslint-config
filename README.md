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
   `<sol-chart>`).
4. **Convenciones de nombres**: `@typescript-eslint/naming-convention` (clases/interfaces/tipos
   en PascalCase, variables/funciones/parámetros en camelCase) + `filename-case` propio
   (kebab-case de archivos). Implementado in-house (sin `eslint-plugin-unicorn`) siguiendo la
   filosofía "in-house por defecto" del proyecto.

## Estado de distribución

Hoy es un paquete **local, sin publicar** (`"private": true`). `boki-front` NO declara
`workspaces` en su `package.json` raíz, así que en vez de instalarlo como dependencia de npm,
se referencia por **ruta relativa** desde `eslint.config.js`:

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
