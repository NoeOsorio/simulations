# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- **Never modify or "clean up" simulations of previous phases while building a new one.** Each simulation under `src/simulations/<phase-id>/` is frozen after it ships. When adding Phase N, you may only add new files under `src/simulations/<phase-N-id>/` and append to shared entry points (`registry.ts`, `MainMenu.tsx`'s coming-soon card). Do not edit earlier phases' `.tsx`, `.css`, `helpers.ts`, `types.ts`, or `README.md` — even to extract "shared" styles or refactor. If you need a style or helper from an earlier phase, **duplicate it** inside the new phase's folder. The only shared surfaces are `src/index.css`, `src/lib/persistence.ts`, the registry, and the app shell.
- **General documentation lives in `docs/`.** Per-simulation docs live inside that simulation's folder (`README.md`). Don't scatter docs elsewhere.

## Commands

```bash
npm install          # install deps
npm run dev          # dev server at http://localhost:5173 (React StrictMode — expect noticeably slower than prod)
npm run build        # tsc -b && vite build  — run this to verify types before committing
npm run preview      # serve the production build (use this to judge real performance)
npm run lint         # eslint .
```

There is no test runner configured yet.

## Big picture

Sim World is a single-page React + Vite + TypeScript app that hosts a growing series of **self-contained simulations**, each one representing a "phase" in the history of organic life. Phase 01 (`micro-ecosystem`) is implemented; future phases are added as additional folders.

The app shell (`src/App.tsx`) is just a sticky header + hash-routed `<main>`. It uses `HashRouter` so the build can be opened from `file://` or any static host with no server rewrites.

### How simulations plug in

The **single registry** at `src/simulations/registry.ts` drives both the main menu and the router. Every simulation is a `SimulationMeta` entry: metadata (id, phase number, title, tagline, icon, status) plus a route path and the React `Component` that renders it. Adding a phase means:

1. Create `src/simulations/<phase-id>/` with at least `<Phase>.tsx` (default export) and a short `README.md`.
2. Append a `SimulationMeta` entry to the registry.

The menu card (`src/components/MainMenu.tsx`) and the route (`src/App.tsx`) pick it up automatically — there is no separate registration step. The `status: 'planned'` flag renders a disabled card; `'available'` makes it clickable.

### Shared persistence

Every simulation is expected to save **logs and state to plain text files** downloaded straight from the browser (there is no backend). The shared helpers live in `src/lib/persistence.ts`:

- `downloadText(filename, content)` — trigger a download.
- `pickTextFile()` — open the system picker and return the selected file's text.
- `logsToText(header, entries)` — format an event log (array of `{t, msg}`) into a timestamped `.txt`.
- `stateToText(label, state)` / `parseStateText(text)` — round-trip a snapshot. Files are written as a single `#`-prefixed comment header followed by a JSON blob; `parseStateText` strips the header line before `JSON.parse`.

Simulations should version their saved-state payload (`version: 1`) and reject older versions on load so the format can evolve without silently corrupting state.

### Design system — Apple "liquid glass"

Design tokens and utility classes are in `src/index.css` on `:root`. Two primitives:

- `.glass` — translucent card **without** backdrop blur. Cheap. Use for any element that wraps animated content (e.g. the simulation canvas) — otherwise the browser re-composites the blur every frame.
- `.glass-blur` — opt-in `backdrop-filter` blur. Add it **in addition to** `.glass` only on static cards over the ambient gradient where the blur actually shows.

The ambient background (multi-layer radial gradient) lives on `body::before` as a `position: fixed` layer with `z-index: -1`. Do **not** put that gradient on `body` with `background-attachment: fixed` — that caused whole-viewport repaints during canvas animation.

The user dislikes text-decoration underlines; `index.css` forces `text-decoration: none !important` on links, buttons, and card-links. Hover cues use color/background/transform. Keyboard focus uses a purple `:focus-visible` outline.

### Simulation loop pattern (see `micro-ecosystem/MicroEcosystem.tsx`)

The canvas loop follows a pattern worth keeping consistent across phases:

- **Refs for simulation state, `useState` only for UI**. Mutable data that changes every frame (creatures, food, tick, running flag, speed multiplier) lives in `useRef` so the `requestAnimationFrame` loop doesn't re-run effects. `useState` is used only for things that render to the DOM, and is updated on a throttled cadence (every 30 ticks) from inside `render()`.
- **Pre-render static backdrops to an offscreen canvas** and `drawImage` each frame. The initial version drew ~533 grid dots per frame and was visibly sluggish; the cached background version is one `drawImage`.
- **`speedRef` multiplies the update loop count per rAF tick**, not the rAF rate. Rendering still happens once per rAF.
- **`addLog` pushes to both `logRef` (capped at 500 for export) and `log` state (sliced to 30 for display)**. The render loop must not also call `setLog` — that was redundant and added re-renders.

## Conventions

- Do not introduce new link underlines. The user has pushed back on this — use color, weight, or background for hover/active cues.
- Keep backdrop-filter blur off anything that wraps an animated canvas or anything that re-renders frequently.
- Simulations are free to pick their own rendering approach (canvas/SVG/WebGL/DOM) — the shared contract is only the registry entry and the persistence file format.
- Per-simulation `README.md` must be **plain English** describing what the phase models. The global `README.md` describes the project, persistence format, and how to add new phases.
