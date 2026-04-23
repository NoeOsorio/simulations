# Sim World

A growing collection of simulations that mimic the **history of organic life**, built one phase at a time. Each phase is a self-contained simulation; together they form an evolving world.

The app is a single-page React + Vite + TypeScript project with an Apple-style **liquid glass** UI. A main menu lists every available simulation as a card; clicking one opens it.

---

## Phases

Each simulation lives in its own folder under `src/simulations/<phase-name>/` and registers itself in `src/simulations/registry.ts`. Adding a new phase is just: drop a folder, add a registry entry, and it appears on the menu.

| #  | Name             | Status     | Folder                                  |
|----|------------------|------------|-----------------------------------------|
| 01 | Micro Ecosystem  | available  | `src/simulations/micro-ecosystem/`      |
| 02 | Predator & Prey  | planned    | —                                       |
| …  | (more to come)   | —          | —                                       |

> Each simulation folder contains its own short `README.md` describing — in plain English — what that phase is about.

---

## Getting started

```bash
# from the project root
npm install
npm run dev          # http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

---

## Persistence — logs & state

Every simulation can produce two kinds of plain-text files (downloaded straight from the browser, no server):

1. **Event logs** — `sim-<phase>-logs-YYYYMMDD-HHMMSS.txt`
   A timestamped, human-readable list of every event that happened in the run (births, deaths, food rains, etc.).

2. **Saved state** — `sim-<phase>-state-YYYYMMDD-HHMMSS.txt`
   A `#`-commented header followed by a JSON snapshot of the simulation. Re-loadable from the same simulation page via the **Load state** button.

The persistence helpers are shared across all simulations in `src/lib/persistence.ts`:

- `downloadText(filename, content)` — trigger a file download
- `pickTextFile()` — open the system picker and return the file's text
- `logsToText(header, entries)` — format an event log as text
- `stateToText(label, state)` / `parseStateText(text)` — round-trip simulation state

### Example saved-state file

```
# sim-world state · micro-ecosystem · 2026-04-23T01:42:11.039Z
{
  "version": 1,
  "savedAt": "2026-04-23T01:42:11.039Z",
  "tick": 4218,
  "stats": { "born": 12, "died": 4, "totalEaten": 87 },
  "creatures": [ ... ],
  "food": [ ... ]
}
```

---

## Project structure

```
simulations/
├── README.md                       ← you are here
├── src/
│   ├── App.tsx                     ← shell + router
│   ├── main.tsx
│   ├── index.css                   ← liquid-glass design tokens
│   ├── components/
│   │   ├── MainMenu.tsx            ← landing page with simulation cards
│   │   └── MainMenu.css
│   ├── lib/
│   │   └── persistence.ts          ← shared text-file save/load
│   └── simulations/
│       ├── registry.ts             ← list of all simulations (drives the menu)
│       └── micro-ecosystem/        ← Phase 01
│           ├── README.md           ← plain-English description of the phase
│           ├── MicroEcosystem.tsx
│           ├── MicroEcosystem.css
│           ├── helpers.ts
│           └── types.ts
└── package.json
```

---

## Adding a new phase

1. Create `src/simulations/<my-phase>/` with at minimum:
   - `README.md` — short, plain-English description.
   - A React component that renders the simulation.
2. Append a `SimulationMeta` entry in `src/simulations/registry.ts`:
   ```ts
   {
     id: 'my-phase',
     phase: 2,
     title: 'Phase 2 — My Phase',
     shortTitle: 'My Phase',
     tagline: 'One-line hook.',
     description: 'A few sentences for the menu card.',
     icon: '🧪',
     path: '/my-phase',
     status: 'available',
     Component: MyPhase,
   }
   ```
3. The card and route appear automatically.

---

## Design notes

- **Apple liquid glass**: translucent surfaces with backdrop blur, subtle 1px borders, soft layered shadows, and a vibrant background gradient bleeding through. Tokens live on `:root` in `src/index.css` and the `.glass` / `.glass-btn` utility classes do the heavy lifting.
- **Hash-based router** (`HashRouter`) so the build can be opened from `file://` or any static host without server rewrites.
- Every simulation is free to use whatever rendering approach fits — Phase 01 uses an HTML5 `<canvas>`; future phases might use SVG, WebGL, or DOM.
