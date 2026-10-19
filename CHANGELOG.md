# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-19

Complete rewrite. Package renamed from `d3.v4.floorplan` to `d3-floorplan`;
repository moved to `allnash/d3-floorplans`.

### Added
- Framework-agnostic core `createFloorplan(container, options)` built on D3 v7
  modules with full enter/update/exit rendering from a single `Floor` object.
- React component `FloorPlan` and `useFloorState` hook (undo/redo) under
  `d3-floorplan/react`. Closes #3 (React support).
- Working pan and zoom with wheel/drag, `zoomToFit`, `zoomBy`, min/max scale
  and translate extents. Closes #2 (zoom did not work).
- Embeddable IIFE build exposing `window.Floorplan` for script-tag use.
- motion.dev animations for zone/sensor enter and exit, label rename pulse,
  context menu and zoom-to-fit.
- Built-in context menu with rename/delete, "start zone here", "place sensor
  here" and "zoom to fit"; customisable through `onContextMenu`.
- Keyboard support: Enter closes a zone, Esc cancels/deselects, Delete removes.
- Zone colours, sensor labels, read-only mode, label toggle, responsive sizing
  via SVG `viewBox`, CSS custom properties for theming.
- TypeScript types, unit tests (vitest) and jsdom engine tests.
- Realistic SVG office floor plans (ground and first floor) used by the demo.
- Demo site (`examples/react`) and vanilla example (`examples/vanilla`).
- GitHub Actions: CI, GitHub Pages deploy of the demo, npm publish on tag.

### Changed
- Build moved from Grunt/browserify to Vite library mode.
- Edits are immutable: the engine emits a new floor instead of mutating input.

### Removed
- Legacy `d3.floorplan()` API, jQuery-based example, vendored `d3-context-menu`
  and `d3-polygon`, LESS stylesheet.

## [0.0.1]

Original prototype on D3 v4.
