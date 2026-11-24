# Changelog — @solercia/eslint-config

Todos los cambios notables de este paquete se documentan en este archivo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[SemVer](https://semver.org/lang/es/).

## [0.2.0] - Sin publicar

### Agregado

- Regla `solercia/style-tokens`: los estilos de componentes Angular (`styles` del decorador y
  atributos `style` del template inline) usan variables del tema. Reporta colores y `font-family`
  literales, `!important` y `::ng-deep`. Un literal se admite como fallback de `var()` o al definir
  una custom property. Opciones `allowImportant` y `allowNgDeep` para excepciones declaradas.
- Regla `solercia/css-style-tokens`: las mismas comprobaciones sobre los `.css` de `src/`, activa
  cuando `@eslint/css` (peer opcional, `^2.0.0`) está instalado.
- Regla `solercia/fsd-placement`: cada archivo vive en una capa FSD y, dentro de un slice, en un
  segmento (`ui`, `model`, `api`, `lib`, `config`, `testing`). Opciones del preset
  `extraSharedSegments` y `allowOutsideLayers`.
- Pruebas del preset con `node --test` (`npm test`).
- Restricción de MapLibre GL con el mismo criterio que Chart.js: `maplibre-gl` solo se importa
  dentro de `shared/ui/map` (`sol-map`). Una regla `no-restricted-syntax` cubre además los
  `import()` dinámicos, que `no-restricted-imports` no ve.

## [0.1.1] - 2026-07-15

### Notas

- Release en lockstep con `@solercia/ui@0.1.1` (el workflow publica ambos paquetes por tag `v*`). Sin
  cambios funcionales en el preset respecto a `0.1.0`.

## [0.1.0] - 2026-07-14

### Agregado

- Preset ESLint compartible (flat config, ESLint 10): fronteras FSD por capa (`app → pages → widgets
  → features → entities → shared`), regla smart/dumb de `shared/ui`, restricción de `chart.js` fuera
  de `shared/ui/chart` y convenciones de nombres (`naming-convention` + `filename-case` in-house).
- Metadata de publicación: licencia `Apache-2.0`, `NOTICE` de autoría (Solercia Solutions SAS),
  `publishConfig` apuntando a GitHub Packages (`https://npm.pkg.github.com`).

### Notas

- Hoy se consume por ruta relativa desde `boki-front/eslint.config.js` (sin `workspaces` declarados
  en el `package.json` raíz). Publicación real pendiente de la decisión D1 del fundador.
