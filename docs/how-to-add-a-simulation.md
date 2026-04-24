# How to add a new simulation

Quick checklist for adding the next phase. Keep every simulation **self-contained** — do not modify any existing phase while building a new one (see `CLAUDE.md` → Rules).

## Checklist

- [ ] 1. **Pick a phase number and id.** Short, kebab-case (e.g. `predator-prey`).
- [ ] 2. **Create the folder** `src/simulations/<phase-id>/` with:
  - [ ] `<Phase>.tsx` — React component, default export.
  - [ ] `<Phase>.css` — styles (duplicate shared `.sim-*` layout classes; do not import CSS from other phases).
  - [ ] `helpers.ts` — constants, factories, math.
  - [ ] `types.ts` — `Creature`, `Food` (or equivalents), `SavedState` with `version: 1`, `SimStats`, `LogEntry`.
  - [ ] `README.md` — plain-English description of what the phase models, written for a non-technical reader.
- [ ] 3. **Use the shared helpers** from `src/lib/persistence.ts`:
  - [ ] `downloadText`, `pickTextFile` for file I/O.
  - [ ] `logsToText` for the event log export.
  - [ ] `stateToText` / `parseStateText` for save/load. Reject older `version` numbers on load.
- [ ] 4. **Register the simulation** in `src/simulations/registry.ts` — append a `SimulationMeta` entry (id, phase, title, shortTitle, tagline, description, icon, path, status, Component).
- [ ] 5. **Update `src/components/MainMenu.tsx`** — bump the `ComingSoonCard` to the next phase number if needed.
- [ ] 6. **Follow the canvas-loop pattern** from Phase 01:
  - [ ] Refs for simulation state, `useState` only for UI (updated on a throttled cadence, e.g. every 30 ticks).
  - [ ] Pre-render static backdrops to an offscreen canvas and `drawImage` once per frame.
  - [ ] `speedRef` multiplies update iterations per rAF tick, not the rAF rate itself.
  - [ ] `addLog` pushes to both `logRef` (capped ~500 for export) and a short `log` state slice (~30 for display).
- [ ] 7. **Stay consistent with the design system** (see `CLAUDE.md`):
  - [ ] No underlines on links / buttons / cards.
  - [ ] `.glass` without `.glass-blur` for any card wrapping the animated canvas.
  - [ ] `.glass-blur` only for static cards over the ambient gradient.
- [ ] 8. **Verify types** with `npm run build` before committing.
- [ ] 9. **Sanity-check in a browser** — dev server and ideally `npm run preview` (dev is noticeably slower due to StrictMode).

## Design conventions worth keeping

- Every creature's mutable per-frame data lives in refs; only "displayable" stats go through React state.
- Save files are a `#`-prefixed comment line plus a JSON blob; `parseStateText` strips the header before parsing.
- Logs are plain text, one event per line, timestamped ISO.
- Each phase picks its own rendering approach (canvas, SVG, WebGL, DOM). The shared contract is only the registry entry and the persistence file format.
