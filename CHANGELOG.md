# Changelog — @solercia/eslint-config

Todos los cambios notables de este paquete se documentan en este archivo. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado es
[SemVer](https://semver.org/lang/es/).

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
