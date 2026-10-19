# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Git policy (important)

- **Do not commit or push in this repo.** The owner commits manually. Make file
  changes only and leave staging/committing to them.
- Never add a `Co-Authored-By` or any other Claude attribution line to commit
  messages or PR descriptions for this project.

## What this is

`d3-floorplan` (npm) / `allnash/d3-floorplans` (GitHub): interactive floor
plans for the web. A framework-agnostic TypeScript core on D3 v7 modules, a
React wrapper, and a self-contained IIFE bundle for script-tag embedding.
Animations use motion.dev. Version 1.0.0 was a full rewrite of the 2018 D3 v4
prototype (`d3.v4.floorplan`).

## Layout

- `src/core/types.ts` – public types: `Floor`, `Zone`, `Sensor`, `Mode`,
  `FloorplanOptions`, `Floorplan` (the engine API), events.
- `src/core/floor.ts` – pure immutable operations on `Floor` (add/move/remove
  zones and sensors, clamp). Unit-tested; keep it free of DOM code.
- `src/core/geometry.ts` – centroid, containment, rounding, uuid.
- `src/core/floorplan.ts` – the engine `createFloorplan(container, options)`.
  Owns the SVG, d3-zoom, d3-drag behaviours, drawing state, selection,
  keyboard handling, rendering (data joins keyed by id), and motion animations.
- `src/core/context-menu.ts` – small HTML popover menu, no dependencies.
- `src/core/icons.ts` – default sensor icon as a data URI.
- `src/styles/floorplan.css` – all styling, themeable through `--fp-*` custom
  properties on `.fp-container`. Stroke widths divide by `--fp-zoom` so lines
  stay constant on screen when zoomed.
- `src/react/FloorPlan.tsx` – controlled React component; `useFloorState.ts`
  adds undo/redo. `src/react/index.ts` re-exports the core too.
- `src/index.ts` – core entry (imports the CSS).
- `examples/react/` – Vite demo site (also the React example). Aliases
  `d3-floorplan` to `src/`, serves `assets/` as its public dir, builds to `site/`.
- `examples/vanilla/index.html` – script-tag example against `dist/`.
- `assets/floorplans/*.svg` – hand-authored office floor plans used by demos.
- `test/` – vitest: `floor.test.ts` (pure ops), `engine.test.ts` (jsdom).
- `.github/workflows/` – CI, Pages deploy of the demo, npm publish on `v*` tag.

## Commands

```bash
npm run dev          # demo with HMR (port 5173 or next free)
npm test             # vitest
npm run typecheck    # tsc --noEmit
npm run build        # dist/ (ESM + React entry + IIFE + CSS + .d.ts)
npm run build:demo   # site/
```

## Design rules

- **Immutability.** The engine never mutates the floor it was given. Every edit
  goes through `src/core/floor.ts` and is emitted as a new object via the
  `change` event. React passes it straight back as the `floor` prop; `setFloor`
  no-ops on the same reference, which is what prevents render loops.
- **Coordinates** are floor-image units. The SVG `viewBox` equals the image
  rect, and `d3-zoom` transforms `g.fp-viewport`. Use `pointer(event, viewport)`
  for floor coordinates; never read CSS transforms back.
- **Drag vs zoom.** d3-drag stops propagation on mousedown, so zone/handle/
  sensor drags do not start a pan. The zoom filter also ignores events whose
  target is inside `.fp-zone`, `.fp-sensor` or `.fp-handle`.
- **Transforms during drag** use `element.style.transform` (CSS), not the SVG
  `transform` attribute, because motion.dev also writes CSS transforms and the
  two would conflict. Clear the style on drag end.
- **Exiting nodes** get `.fp-exiting` and are excluded from data joins so a
  fade-out never collides with a re-added id.
- Keep the IIFE bundle React-free; React stays a peer dependency of the
  `./react` entry only.
- ES2020 target, strict TypeScript, 2-space indent, single quotes.

## Gotchas

- `vite.config.ts` imports `defineConfig` from `vitest/config` so the `test`
  key typechecks. The IIFE build is a separate config because IIFE output
  cannot have multiple entries.
- The demo reads `import.meta.env.BASE_URL` for asset paths; Pages deploys
  with `DEMO_BASE=/<repo>/`.
- jsdom has no layout, so engine tests assert DOM structure and events, not
  pointer geometry.
