---
name: new-phase
description: Build a new simulation phase end-to-end for the Sim World project (`src/simulations/<phase-id>/`). Use this skill whenever the user wants to add the next phase to the simulation series — phrases like "/new-phase", "vamos a crear Phase 4", "crear nueva fase", "nueva fase", "siguiente fase", "next phase", "arrancamos Phase N", "agreguemos otra simulación", "let's start the next simulation", "build the predator phase", "add another simulation". Conducts a short creative interview, sanity-checks survival rules before any code is written, scaffolds the phase using the shared libs (`src/lib/sim-math`, `sim-types`, `sim-names`, `sim-render`, and `src/styles/*`) so the visual style stays constant across phases, wires the registry and per-phase README, runs build + lint, drives a 5-minute survival test in a real browser, and opens a PR with a simple description plus a link to the per-phase README. Never modifies previous phases.
---

# New Phase Builder for Sim World

Take a creative idea and turn it into a working, balanced, visually-consistent new simulation phase, merged into the project — fast, and without touching the phases that already shipped.

This skill exists because every new phase used to mean copy-pasting ~1500 LOC from the previous one and re-implementing the same drawCreature / loop / save-state logic. After the shared-foundation refactor (PR #6), all of that lives in `src/lib/` and `src/styles/`. The job now is to keep new phases lean, balanced, and hooked into the project README.

## Hard rules (do not break)

1. **Previous phases are frozen.** Never modify, "clean up", or import from any file under `src/simulations/<existing-phase>/`. If you need a helper that already exists in P1–P3, get the equivalent from `src/lib/`. If it isn't there yet, build the new phase with a local copy and propose extraction in a follow-up PR — not in this PR.
2. **Visuals stay consistent across phases.** Always import the rendering layers from `src/lib/sim-render/` and the shared styles from `src/styles/`. Override visuals only via the documented CSS vars (`--phase-accent`, `--phase-accent-from`, `--phase-accent-to`) or by passing different params (different `hue`, different `mood`, additional `drawCreatureBar` calls). Don't hand-roll a new `drawCreature`. If the user explicitly wants a radically different look, surface that as a tradeoff before going there: it diverges the visual language of the project.
3. **Survival is a design constraint, not a wish.** No phase ships if `npm run build` is clean but the population goes extinct or explodes in normal play. The 5-minute browser test is non-negotiable. See `references/survival-rules.md` for the inequality and the defaults that have worked across P1–P3.
4. **Every phase ships with the same five artifacts:** the phase folder under `src/simulations/`, an entry in `src/simulations/registry.ts`, a plain-English `README.md` inside the phase folder, an updated row in the project root `README.md` (header link + table row + chronology line), and a PR with a **short** description that links to the per-phase README.

## Workflow

Conduct steps 1–3 entirely in conversation before writing any code. Once the user has signed off on the design and the survival numbers, the rest is mechanical and you can move quickly.

### 1. Pre-flight check

Run these in parallel:

- `git status` — must be clean (or stash/commit/confirm with the user before continuing).
- `git branch --show-current` — if not `main`, ask the user before continuing.
- `git fetch origin && git log HEAD..origin/main --oneline` — confirm local main is up to date.
- Read `src/simulations/registry.ts` and find the highest existing `phase` number; the new phase is `max + 1`. Surface this to the user.
- Read the project root `README.md`, locate the "Phases" table and the `phase 01 ──● ... (coming soon)` chronology line. The current "planned" placeholder for the next phase number lives in that table — when this phase ships, that row gets rewritten.

If anything blocks (dirty tree, behind on main), pause and let the user resolve.

### 2. Creative interview

Speak the user's language (this conversation has been in Spanish so far — match what they use). Ask open questions, summarize back, and only proceed when the design is concrete. Don't make them fill out a form; let them describe freely and pull the structure out of what they say.

You need answers to these, in this order. Ask one or two at a time, not all at once:

- **El concepto en una frase.** "¿De qué trata esta fase?" / "What is this phase about?" — e.g. *"depredadores y presas, los individuos pueden cazar"*.
- **Identidad.** Phase number (you already know — confirm), kebab-case `id` (e.g. `predator-prey`), `title`, `shortTitle`, one-line `tagline`, 2–3 sentence `description`, `icon` (emoji), and the route `path` (`/<id>`).
- **Qué cambia.** New roles? New behavioral states (e.g. `'hunt'`, `'flee'`)? New entities (predators, weapons, traps)? New mechanics (territory, leadership, mating rituals, day/night cycle)?
- **Qué se mantiene.** Default assumption: visuals from `sim-render`, save format from `sim-types.SavedState`, names from `sim-names`, math from `sim-math`. Only override per item the user names explicitly.
- **Reglas de supervivencia.** ¿Qué los mata? (energía, edad, depredador) ¿Cómo se alimentan? ¿Cuándo se reproducen? ¿Cuáles son los costos? Cooldowns?

After the interview, write back a 6–10 line summary covering: concept, what changes, what stays, survival logic, expected stable population. Ask the user to confirm or adjust before moving on.

### 3. Survival design check

Before generating code, check the survival numbers against the inequality in `references/survival-rules.md`. The rough condition is:

> energy gained per creature per second (from food and recovery) ≥ energy lost per creature per second (drain + work + reproduction cost amortized) × 1.1

If the user's numbers don't satisfy this, surface it. Don't silently rebalance — explain what's tight and propose a small adjustment ("subir `INITIAL_FOOD` de 20 a 32, o bajar `ENERGY_DRAIN_BASE` de 0.05 a 0.034").

Also confirm: `INITIAL_POPULATION ≥ 8` (small populations get unlucky), `MAX_POPULATION` is set, `MAX_FOOD` is set, and there's a non-zero `FOOD_SPAWN_RATE` (or an equivalent producer mechanic).

### 4. Branch + scaffold

```bash
git checkout main && git pull origin main
git checkout -b phase-NN-<id>     # e.g. phase-04-predator-prey
mkdir -p src/simulations/<phase-NN-id>
```

Then create the five files using the templates in `references/templates.md`. Read that file when you get here — it has full skeletons annotated with which sections you should adapt vs leave as-is.

The order that minimizes churn:

1. `types.ts` — extend `CreatureBase<TState>` from `sim-types`, define phase-specific `CreatureState` union, `Role`, `Food`, etc.
2. `helpers.ts` — constants (CANVAS_W, CANVAS_H, INITIAL_*, MAX_*, ENERGY_DRAIN_*, REPRODUCE_*), import `dist`, `clamp`, `hueToRgb`, `randomId`, `randomChoice` from `sim-math`, import `randomName` from `sim-names`, define `createCreature`, `createFood`, `createBaby`, etc.
3. `<Phase>.tsx` — the main component. Use the shared rAF loop pattern (refs for sim state, useState only for UI, `setStats` every 30 ticks). Inside `drawCreature`, compose the layers from `sim-render` instead of hand-rolling each shape:

   ```ts
   import {
     buildBackground, drawCreatureBody, drawCreatureFace,
     drawCreatureBar, drawCreatureBadge, drawCreatureLabel, drawSelectionRing,
   } from '../../lib/sim-render';
   ```

4. `<Phase>.css` — `@import '../../styles/index.css';` at the top, then **only** rules that don't already exist in the shared kit (role pills, education bars, anything truly phase-specific). Set `--phase-accent`, `--phase-accent-from`, `--phase-accent-to` on the phase's root element.
5. `README.md` — plain English. The first line is the title `# Phase NN — <Title>`, the second line is a one-line elevator pitch in italics, then sections: *What lives here* (creatures, food, structures), *What they do* (state table), *Things you can do* (controls), *Why it matters* (one paragraph linking to next phase). See `src/simulations/micro-ecosystem/README.md` for the canonical form.

### 5. Wire registry + project README

**Registry** (`src/simulations/registry.ts`):

- Add `import <PhaseComponent> from './<phase-id>/<PhaseComponent>';` at the top.
- Append a `SimulationMeta` entry to the `simulations` array. `status: 'available'`. Use the values gathered in the interview.

**Project root `README.md`** — three updates (see `references/templates.md` for exact patterns):

- Header links row: add `[**Phase NN — <Title>**](src/simulations/<id>/README.md)`.
- "Phases" table: replace the next "planned" row with the new phase, link the title to the folder, switch the badge from `planned` to `available` with a phase-appropriate accent color.
- Chronology line: extend it. `phase 03 ──●───● phase 04 ──◌───◌ phase 05 (coming soon)` becomes `phase 03 ──●───● phase 04 ──●───● phase 05 ──◌───◌ phase 06 (coming soon)` once Phase 4 is live.

### 6. Validate

```bash
npm run build         # tsc -b && vite build — must be clean
npm run lint          # eslint . — must be clean
```

Fix errors yourself. Don't proceed past this point with anything red.

### 7. Manual survival test (5 minutes)

Follow `references/manual-testing.md`. The short version: open the new phase in a real browser via Playwright, push speed to its max, snapshot stats every 60s for 5 minutes, then evaluate:

- Population trend: alive count must not drop to 0 and must not exceed `MAX_POPULATION × 1.1`.
- Births vs deaths roughly track each other after the first minute. Births being slightly higher is fine; deaths being higher than births for 3+ snapshots in a row is a fail.
- The event log shows phase-specific events firing (a healer healing, a hunter hunting, a teacher teaching). If the role exists but never fires its action, the rule is broken.
- No console errors.

If the test fails, don't ship. Adjust constants in `helpers.ts` (per the survival inequality), rebuild, retest. Two iterations max — after that, surface to the user and ask before further tweaks. Isolated bad runs happen; the test is for systemic problems.

Save final stats and a final screenshot to a temp path; reference both in the PR body.

### 8. Commit + push + PR

Stage only the new phase files plus the registry and README updates — never `git add -A`. The commit message follows the project's plain-English style (see `git log --oneline -5`):

```
Add Phase NN — <Title>

- One sentence about what's new.
- One sentence about the rules / mechanics.
- Link: src/simulations/<id>/README.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Push and open the PR. **Keep the PR description short** — the user has explicitly asked for "una descripción bastante sencilla". Aim for ~10 lines:

```markdown
## Summary
- New Phase NN: <Title>. <One sentence about what's new.>
- Reuses the shared foundation (`sim-render` layers, `sim-types`, `sim-math`, `src/styles/*`); zero changes to P1–P{N-1}.

## Read this
- Per-phase description: [`src/simulations/<id>/README.md`](src/simulations/<id>/README.md)

## Survival test (5 min, browser)
- Initial population: NN
- Final population: NN (births NN / deaths NN)
- Stable: yes / no
- Screenshot: <attach if useful>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Always **output the PR URL on its own line** at the end of the response. The user expects to be able to copy-paste it.

### 9. Wrap up

Tell the user, in 2–3 lines: phase name, PR URL, what the survival test showed. Don't auto-merge — that's the user's call. If they want to merge, they'll say so.

## When something goes off-script

- **Build error after scaffolding** → re-read the offending file, fix, rebuild. Don't push through with `--no-verify` or by deleting code that's failing the type check.
- **Lint error** → fix at the source. Most common: `noUnusedLocals` flagging an import you forgot to use.
- **Extinction in 5-min test** → check `FOOD_SPAWN_RATE`, `INITIAL_FOOD`, `ENERGY_DRAIN_BASE`. Usually the fix is +20% on food spawn or −20% on energy drain. Rebuild, retest.
- **Population explosion in 5-min test** → check `REPRODUCE_ENERGY` threshold (raise it), `REPRODUCE_COST` (raise it), or add/raise `MAX_POPULATION`. Rebuild, retest.
- **The user's idea genuinely needs a new shared primitive** (e.g. spatial hashing for predator-prey) → build it inline in the phase first. Don't extract to `src/lib/` in the same PR. Note the duplication in the PR body and propose a follow-up extraction PR. We extract only after the pattern shows up twice.
- **The user changes their mind mid-flow** → it's cheap. Adjust the design summary, re-confirm survival numbers, regenerate affected files. Don't grind through a stale plan.

## Reference files

When you reach a step that needs more detail, read the matching file:

- `references/templates.md` — full skeletons for `types.ts`, `helpers.ts`, `<Phase>.tsx`, `<Phase>.css`, per-phase `README.md`, the `registry.ts` append, and the three project README updates.
- `references/survival-rules.md` — the energy-balance inequality, the working numerical ranges, and a worked example using P1–P3 numbers.
- `references/manual-testing.md` — the Playwright protocol with the exact `evaluate()` calls used to snapshot stats and the pass/fail rubric.
