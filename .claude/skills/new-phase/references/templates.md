# Phase File Templates

Skeletons for every artifact a new phase ships. They are **starting points**, not laws — the parts that should change with the user's design are marked with `// EDIT:` (TS) / `/* EDIT: */` (CSS) / `<!-- EDIT: -->` (Markdown). The parts not marked should stay close to as-is so phases stay consistent.

These templates intentionally lean on the shared libs introduced in `src/lib/sim-render`, `src/lib/sim-math`, `src/lib/sim-types`, `src/lib/sim-names`, and `src/styles/`. If you find yourself rewriting one of those primitives inline, stop and use the shared one — that's the whole point of the foundation.

Replace `<phase-id>` with the kebab-case id (e.g. `predator-prey`), `<PhaseComponent>` with the PascalCase component name (e.g. `PredatorPrey`), `NN` with the two-digit phase number (e.g. `04`), and `<Title>` with the human title (e.g. `Predator & Prey`).

---

## 1. `src/simulations/<phase-id>/types.ts`

```ts
import type { CreatureBase, LogEntry, SavedState } from '../../lib/sim-types';

// EDIT: union of behavioral states this phase models. Reuse the four base
// states from earlier phases unless you have a reason not to.
export type CreatureState =
  | 'wander'
  | 'seek'
  | 'eat'
  | 'reproduce';
//   | 'hunt'      ← example phase-specific state
//   | 'flee';

// EDIT: only if this phase has roles. Delete if it doesn't.
export type Role = 'farmer' | 'harvester';

// EDIT: only if this phase has typed food. Most phases do.
export type FoodType = 'plant' | 'fruit';

// Phase-specific creature. Extends the universal base with whatever this
// phase needs on top.
export interface Creature extends CreatureBase<CreatureState> {
  // EDIT: phase-specific fields go here. Examples below — keep what you need,
  // delete the rest.
  role?: Role;
  abilityValue?: number;
  abilityCooldown?: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  energy: number;
  size: number;
  pulse: number;
  type: FoodType;
}

// EDIT: stats tracked by the simulation. The shape becomes part of the save
// format, so think of it once and try not to churn.
export interface SimStats {
  alive: number;
  food: number;
  born: number;
  died: number;
  totalEaten: number;
}

// Re-export from shared so the phase has a single import for types.
export type { LogEntry };

// EDIT: bump the version literal to track save-format changes within this
// phase. Use a fresh number per phase so old saves from other phases bounce.
export type PhaseSavedState = SavedState<SimStats, Creature, Food> & {
  version: 1;
  // EDIT: add phase-specific collections (nests, totems, etc) if any.
  // nests?: Nest[];
};
```

---

## 2. `src/simulations/<phase-id>/helpers.ts`

```ts
import { clamp, dist, hueToRgb, randomChoice, randomId, randomRange } from '../../lib/sim-math';
import { randomName } from '../../lib/sim-names';
import type { Creature, CreatureState, Food, FoodType, Role } from './types';

// ── World dimensions ──────────────────────────────────────────────────────
export const CANVAS_W = 800;
export const CANVAS_H = 520;

// ── Population & food caps ────────────────────────────────────────────────
// Survival design: see references/survival-rules.md. The defaults below
// produce a stable population around 25–35 individuals with a soft food cap.
export const INITIAL_POPULATION = 12;       // EDIT: ≥ 8
export const MAX_POPULATION = 50;           // EDIT
export const INITIAL_FOOD = 32;             // EDIT
export const MAX_FOOD = 160;                // EDIT
export const FOOD_SPAWN_RATE = 0.03;        // EDIT: per-tick prob (0.02–0.05 range)

// ── Energy / reproduction tuning ──────────────────────────────────────────
export const ENERGY_DRAIN_BASE = 0.034;     // EDIT
export const REPRODUCE_ENERGY = 62;         // EDIT: 55–70 range
export const REPRODUCE_COST = 24;           // EDIT
export const MATE_CONTACT_RADIUS = 60;
export const MATE_SEEK_RADIUS = 220;
export const LOW_ENERGY = 28;

// ── Phase-specific tuning ─────────────────────────────────────────────────
// EDIT: anything that's only in this phase. Keep names UPPER_SNAKE.

// ── Roles (delete if not used) ────────────────────────────────────────────
export const ROLES: Role[] = ['farmer', 'harvester'];   // EDIT

export const ROLE_HUE: Record<Role, number> = {
  farmer: 125,    // green
  harvester: 28,  // orange
};

export const ROLE_LABEL: Record<Role, string> = {
  farmer: 'Farmer',
  harvester: 'Harvester',
};

export const ROLE_DESC: Record<Role, string> = {
  farmer: 'Plants herbs.',
  harvester: 'Picks fruit.',
};

// ── Factories ─────────────────────────────────────────────────────────────

export interface CreatureOpts {
  x?: number;
  y?: number;
  role?: Role;
  generation?: number;
  energy?: number;
}

export function createCreature(opts: CreatureOpts = {}): Creature {
  const role = opts.role ?? randomChoice(ROLES);
  const hue = ROLE_HUE[role];
  return {
    id: randomId(),
    name: randomName(),
    x: opts.x ?? randomRange(20, CANVAS_W - 20),
    y: opts.y ?? randomRange(20, CANVAS_H - 20),
    vx: randomRange(-1, 1),
    vy: randomRange(-1, 1),
    energy: opts.energy ?? randomRange(50, 70),
    maxEnergy: 100,
    size: randomRange(10, 15),
    hue,
    age: 0,
    speed: randomRange(0.8, 1.3),
    eyeAngle: 0,
    state: 'wander',
    blinkTimer: randomRange(0, 200),
    pulsePhase: randomRange(0, Math.PI * 2),
    children: 0,
    generation: opts.generation ?? 1,
    role,
  };
}

export function createFood(opts: { x?: number; y?: number; type?: FoodType } = {}): Food {
  const type = opts.type ?? (Math.random() > 0.3 ? 'plant' : 'fruit');
  return {
    id: randomId(),
    x: opts.x ?? randomRange(10, CANVAS_W - 10),
    y: opts.y ?? randomRange(10, CANVAS_H - 10),
    energy: type === 'fruit' ? randomRange(26, 36) : randomRange(16, 24),
    size: type === 'fruit' ? randomRange(6, 8) : randomRange(4, 6),
    pulse: randomRange(0, Math.PI * 2),
    type,
  };
}

export function createBaby(a: Creature, b: Creature): Creature {
  return createCreature({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    role: Math.random() < 0.5 ? a.role : b.role,
    generation: Math.max(a.generation, b.generation) + 1,
    energy: 45,
  });
}

export function buildInitialPopulation(): Creature[] {
  return Array.from({ length: INITIAL_POPULATION }, () => createCreature());
}

// Re-export so the phase imports `dist`, `hueToRgb`, etc. from one place.
export { clamp, dist, hueToRgb };
```

---

## 3. `src/simulations/<phase-id>/<PhaseComponent>.tsx`

This is the longest skeleton. It's deliberately laid out so you can read top-to-bottom and see the whole loop. The structure mirrors P1's pattern (refs for sim state, useState for UI, throttled stat sync) — that pattern is load-bearing, don't rearrange it.

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildBackground,
  drawCreatureBadge,
  drawCreatureBar,
  drawCreatureBody,
  drawCreatureFace,
  drawCreatureLabel,
  drawSelectionRing,
} from '../../lib/sim-render';
import {
  downloadText,
  logsToText,
  parseStateText,
  pickTextFile,
  stateToText,
  timestamp,
} from '../../lib/persistence';
import {
  CANVAS_H,
  CANVAS_W,
  ENERGY_DRAIN_BASE,
  FOOD_SPAWN_RATE,
  INITIAL_FOOD,
  LOW_ENERGY,
  MATE_CONTACT_RADIUS,
  MATE_SEEK_RADIUS,
  MAX_FOOD,
  MAX_POPULATION,
  REPRODUCE_COST,
  REPRODUCE_ENERGY,
  buildInitialPopulation,
  createBaby,
  createCreature,
  createFood,
  dist,
  hueToRgb,
} from './helpers';
import type { Creature, Food, LogEntry, PhaseSavedState, SimStats } from './types';
import './<PhaseComponent>.css';

export default function <PhaseComponent>(): JSX.Element {
  // ── Simulation state (refs — never trigger re-renders) ────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const creaturesRef = useRef<Creature[]>([]);
  const foodRef = useRef<Food[]>([]);
  const animRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const statsRef = useRef({ born: 0, died: 0, totalEaten: 0 });
  const selectedRef = useRef<Creature | null>(null);
  const logRef = useRef<LogEntry[]>([]);
  const runningRef = useRef(true);
  const speedRef = useRef(1);

  // ── UI state ──────────────────────────────────────────────────────────
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<SimStats>({
    alive: 0, food: 0, born: 0, died: 0, totalEaten: 0,
  });
  const [selected, setSelected] = useState<Creature | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const addLog = useCallback((msg: string) => {
    logRef.current = [{ msg, t: Date.now() }, ...logRef.current].slice(0, 500);
    setLog([...logRef.current.slice(0, 30)]);
  }, []);

  // ── Initialize once ────────────────────────────────────────────────────
  useEffect(() => {
    creaturesRef.current = buildInitialPopulation();
    foodRef.current = Array.from({ length: INITIAL_FOOD }, () => createFood());
    addLog(`Phase ${/* EDIT: NN */ 'NN'} — world seeded with ${creaturesRef.current.length} creatures`);
  }, [addLog]);

  // ── Loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    const bgCanvas = buildBackground({ width: CANVAS_W, height: CANVAS_H });

    const update = () => {
      if (!runningRef.current) return;
      const spd = speedRef.current;
      for (let s = 0; s < spd; s++) {
        tickRef.current++;
        const creatures = creaturesRef.current;
        const food = foodRef.current;

        // EDIT: per-creature update — state machine, movement, eat, mate, etc.
        for (const c of creatures) {
          c.age++;
          c.pulsePhase += 0.05;
          c.blinkTimer -= 1;
          if (c.blinkTimer < 0) c.blinkTimer = 100 + Math.random() * 200;

          // ── State decisions (replace with your phase's state machine) ──
          if (c.energy < LOW_ENERGY) {
            c.state = 'seek';
          } else if (c.energy > REPRODUCE_ENERGY) {
            c.state = 'reproduce';
          } else {
            c.state = 'wander';
          }

          // ── Movement ──
          c.x += c.vx * c.speed;
          c.y += c.vy * c.speed;
          // Wrap to keep them on stage.
          if (c.x < 0) c.x = CANVAS_W;
          if (c.x > CANVAS_W) c.x = 0;
          if (c.y < 0) c.y = CANVAS_H;
          if (c.y > CANVAS_H) c.y = 0;

          // ── Energy drain ──
          c.energy -= ENERGY_DRAIN_BASE;

          // ── Eat ──
          for (let i = food.length - 1; i >= 0; i--) {
            const f = food[i];
            if (dist(c, f) < c.size + f.size) {
              c.energy = Math.min(c.maxEnergy, c.energy + f.energy);
              statsRef.current.totalEaten++;
              c.state = 'eat';
              food.splice(i, 1);
              break;
            }
          }

          // ── Mate ──
          if (c.state === 'reproduce' && creatures.length < MAX_POPULATION) {
            for (const o of creatures) {
              if (o === c) continue;
              if (o.energy < REPRODUCE_ENERGY) continue;
              if (dist(c, o) > MATE_CONTACT_RADIUS) continue;
              const baby = createBaby(c, o);
              creaturesRef.current.push(baby);
              c.energy -= REPRODUCE_COST;
              o.energy -= REPRODUCE_COST;
              c.children++;
              o.children++;
              statsRef.current.born++;
              addLog(`${baby.name} was born (gen ${baby.generation})`);
              break;
            }
          }
        }

        // ── Cull ──
        const dead = creatures.filter((c) => c.energy <= 0);
        for (const c of dead) {
          statsRef.current.died++;
          addLog(`${c.name} has died (age ${Math.round(c.age / 60)}s)`);
        }
        creaturesRef.current = creatures.filter((c) => c.energy > 0);

        // ── Spawn food ──
        if (foodRef.current.length < MAX_FOOD && Math.random() < FOOD_SPAWN_RATE) {
          foodRef.current.push(createFood());
        }

        // EDIT: phase-specific tick logic (role abilities, ageing, teaching, etc).
      }
    };

    const drawFood = (f: Food) => {
      // EDIT: per-phase food rendering. Keep it simple — ~10 lines.
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fillStyle = f.type === 'fruit' ? '#ff6b6b' : '#2ecc71';
      ctx.fill();
    };

    const drawCreature = (c: Creature, tick: number) => {
      const isSelected = selectedRef.current?.id === c.id;
      const ratio = c.energy / c.maxEnergy;
      const mood =
        c.state === 'eat' ? 'eating'
        : c.state === 'reproduce' ? 'happy'
        : c.energy < LOW_ENERGY ? 'tired'
        : 'neutral';

      if (isSelected) {
        drawSelectionRing(ctx, { cx: c.x, cy: c.y, size: c.size, tick });
      }
      drawCreatureBody(ctx, { cx: c.x, cy: c.y, size: c.size, hue: c.hue, pulsePhase: c.pulsePhase });

      if (c.state === 'seek') {
        drawCreatureBadge(ctx, { cx: c.x, cy: c.y, size: c.size, text: '!', color: '#ff4444' });
      } else if (c.state === 'reproduce') {
        drawCreatureBadge(ctx, { cx: c.x, cy: c.y, size: c.size, text: '♥', color: '#ff69b4' });
      } else if (c.state === 'eat') {
        drawCreatureBadge(ctx, { cx: c.x, cy: c.y, size: c.size, text: '✦', color: '#44ff44' });
      }

      drawCreatureFace(ctx, {
        cx: c.x, cy: c.y, size: c.size, hue: c.hue,
        eyeAngle: c.eyeAngle, blinkTimer: c.blinkTimer, mood,
      });
      drawCreatureBar(ctx, { cx: c.x, cy: c.y, size: c.size, ratio, color: 'energy' });

      if (isSelected) {
        drawCreatureLabel(ctx, { cx: c.x, cy: c.y, size: c.size, text: c.name });
      }
    };

    const render = () => {
      const tick = tickRef.current;
      ctx.drawImage(bgCanvas, 0, 0);
      for (const f of foodRef.current) drawFood(f);
      for (const c of creaturesRef.current) drawCreature(c, tick);

      // Throttled UI sync.
      if (tick % 30 === 0) {
        setStats({
          alive: creaturesRef.current.length,
          food: foodRef.current.length,
          born: statsRef.current.born,
          died: statsRef.current.died,
          totalEaten: statsRef.current.totalEaten,
        });
        if (selectedRef.current) {
          const found = creaturesRef.current.find((c) => c.id === selectedRef.current!.id);
          if (found) setSelected({ ...found });
          else { setSelected(null); selectedRef.current = null; }
        }
      }
    };

    const loop = () => {
      if (runningRef.current) update();
      render();
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
  }, [addLog]);

  // ── Controls ──────────────────────────────────────────────────────────
  const togglePause = () => {
    runningRef.current = !runningRef.current;
    setRunning(runningRef.current);
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    speedRef.current = next;
    setSpeed(next);
  };

  // ── Persistence ───────────────────────────────────────────────────────
  // EDIT: bump the version number to match types.ts.
  const saveState = () => {
    const state: PhaseSavedState = {
      version: 1,
      savedAt: timestamp(),
      tick: tickRef.current,
      stats: { ...stats },
      creatures: creaturesRef.current,
      food: foodRef.current,
    };
    downloadText(`phase-NN-${timestamp()}.txt`, stateToText('Phase NN', state));
  };

  const loadState = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const state = parseStateText<PhaseSavedState>(text);
      if (state.version !== 1) throw new Error('Unsupported version');
      runningRef.current = false;
      creaturesRef.current = state.creatures;
      foodRef.current = state.food;
      tickRef.current = state.tick ?? 0;
      statsRef.current = { ...state.stats };
      setSelected(null); selectedRef.current = null;
      addLog('Loaded state');
      runningRef.current = running;
    } catch (err) {
      addLog(`Failed to load: ${(err as Error).message}`);
    }
  };

  const exportLog = () => {
    downloadText(`phase-NN-log-${timestamp()}.txt`, logsToText('Phase NN log', logRef.current));
  };

  // ── Click-to-select ───────────────────────────────────────────────────
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const sy = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    let nearest: Creature | null = null;
    let nearestD = Infinity;
    for (const c of creaturesRef.current) {
      const d = dist({ x: sx, y: sy }, c);
      if (d < c.size + 10 && d < nearestD) { nearest = c; nearestD = d; }
    }
    selectedRef.current = nearest;
    setSelected(nearest ? { ...nearest } : null);
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="sim-screen phase-NN-root">
      <aside className="sim-screen__rail sim-screen__rail--left">
        {/* EDIT: left rail panels — population summary, role distribution, etc. */}
      </aside>

      <main className="sim-screen__main">
        <header className="sim-title">
          <div>
            <div className="tick uc sim-title__eyebrow">Phase NN · <Title></div>
            <h2 className="sim-title__h2">
              {/* EDIT */}
              <span>{/* word 1 */}</span> <span className="sim-title__accent">{/* word 2 */}</span>
            </h2>
            <p className="sim-title__sub">{/* EDIT: tagline */}</p>
          </div>
          <div className="sim-title__rate">
            <div className="tick uc sim-title__rate-label">Tick rate</div>
            <div className={`sim-title__rate-value ${running ? 'sim-title__rate-value--running' : 'sim-title__rate-value--paused'}`}>
              {speed.toFixed(1)}×
            </div>
          </div>
        </header>

        <section className="hud brackets sim-viewport">
          <div className="hud__header">
            <div className="sim-viewport__head-left">
              <span className="dot" />
              <span>LIVE VIEWPORT</span>
              <span className="sim-viewport__code">· VPT-NN</span>
            </div>
            <div className="sim-viewport__head-right">
              <span>GRID 40px</span>
              <span className="sim-viewport__rec">● REC</span>
            </div>
          </div>
          <div className="sim-viewport__stage">
            <div className="sim-viewport__canvas-wrap">
              <canvas ref={canvasRef} className="sim-viewport__canvas" onClick={onCanvasClick} />
              <div className="sim-viewport__overlay sim-viewport__overlay--tl">00.00 · 00.00</div>
              <div className="sim-viewport__overlay sim-viewport__overlay--tr">SECTOR · NN</div>
              <div className="sim-viewport__overlay sim-viewport__overlay--bl">T+{String(tickRef.current).padStart(5, '0')}</div>
              <div className="sim-viewport__overlay sim-viewport__overlay--br">LIVE · {String(stats.alive).padStart(2, '0')} ENTITIES</div>
            </div>
          </div>
        </section>

        <section className="hud sim-controls">
          <button className="btn btn--primary" onClick={togglePause}>{running ? '❚❚ Pause' : '▶ Resume'}</button>
          <button className="btn" onClick={cycleSpeed}>× {speed}× → {speed === 1 ? 2 : speed === 2 ? 4 : 1}×</button>
          <span className="sim-controls__divider" />
          <button className="btn" onClick={() => creaturesRef.current.push(createCreature())}>+ Creature</button>
          <button className="btn" onClick={() => foodRef.current.push(createFood())}>+ Food</button>
          <span className="sim-controls__divider" />
          <button className="btn" onClick={exportLog}>↓ Export logs</button>
          <button className="btn" onClick={saveState}>■ Save state</button>
          <button className="btn" onClick={loadState}>□ Load state</button>
        </section>

        <section className="hud sim-diag">
          <div className="sim-diag__cell"><div className="tick uc sim-diag__label">Alive</div><div className="sim-diag__value">{stats.alive}</div></div>
          <div className="sim-diag__cell"><div className="tick uc sim-diag__label">Food</div><div className="sim-diag__value">{stats.food}</div></div>
          <div className="sim-diag__cell"><div className="tick uc sim-diag__label">Births</div><div className="sim-diag__value">{stats.born}</div></div>
          <div className="sim-diag__cell"><div className="tick uc sim-diag__label">Deaths</div><div className="sim-diag__value">{stats.died}</div></div>
          <div className="sim-diag__cell"><div className="tick uc sim-diag__label">Total meals</div><div className="sim-diag__value">{stats.totalEaten}</div></div>
        </section>
      </main>

      <aside className="sim-screen__rail sim-screen__rail--right">
        {/* EDIT: right rail panels — selection inspector, event log */}
        <div className="hud brackets sim-panel">
          <div className="hud__header">
            <div className="sim-panel__head-left"><span className="dot" /><span>EVENT LOG</span><span className="sim-panel__code">· LOG-NN</span></div>
            <div className="sim-panel__head-right">{log.length} entries</div>
          </div>
          <div className="hud__body">
            <div className="sim-events">
              {log.length === 0 ? <div className="sim-events__empty">// no events yet</div> :
                log.map((e, i) => (
                  <div className="sim-event" key={i}>
                    <span className="sim-event__t">T+{String(tickRef.current - (log.length - i) * 30).padStart(4, '0')}</span>
                    <span className="sim-event__icon">●</span>
                    <span className="sim-event__text">{e.msg}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
```

> **Tip:** if the user's design diverges a lot from the four-state machine (`wander/seek/eat/reproduce`), don't try to stretch the skeleton — replace the `update()` body wholesale. The structure around it (refs / loop / setStats every 30 ticks) is what's load-bearing, not the specific transitions.

---

## 4. `src/simulations/<phase-id>/<PhaseComponent>.css`

Keep this file **small**. The shared kit covers layout, title, viewport, panels, controls, animations.

```css
@import '../../styles/index.css';

/* Phase NN accent — sets the gradient on the title and the eyebrow color. */
.phase-NN-root {
  /* EDIT: pick the accent palette for this phase. */
  --phase-accent: var(--cyan);
  --phase-accent-from: #00e5ff;
  --phase-accent-to: #8b5cf6;
}

/* EDIT: phase-specific rules only. Examples:
   .phase-NN__role-pill { ... }
   .phase-NN__nest-icon { ... }
   Do NOT redefine .sim-screen, .sim-title, .sim-viewport, .sim-panel,
   .sim-controls, .sim-events — they live in src/styles/.
*/
```

---

## 5. `src/simulations/<phase-id>/README.md`

```markdown
# Phase NN — <Title>

> <!-- EDIT: one-line elevator pitch in italics. -->
> _A society where individuals start hunting for the first time._

<!-- EDIT: 2–3 sentences setting up the world this phase models. Keep it
     plain English — no code, no jargon. -->

## What lives here

- **Creatures**: <!-- EDIT: how they look, what's new about them -->
- **Food**: <!-- EDIT: what feeds them, where it comes from -->
- **<Other entities>**: <!-- EDIT: predators, structures, etc. -->

## What they do

| State | When | What you see |
|-------|------|--------------|
| 🚶 Wander | <!-- EDIT --> | <!-- EDIT --> |
| 🔍 Seek   | Energy is low | Red `!` over head |
| 🍽 Eat    | Touched food  | Green `✦` over head |
| 💕 Reproduce | High energy + partner nearby | Pink `♥` over head |
<!-- EDIT: add phase-specific states. Drop the rows that don't apply. -->

## Things you can do

- **Click** a creature to inspect it.
- **Pause / Resume** the world.
- **Speed up** time (×1 → ×2 → ×4).
- **Add** a creature or food by hand.
- **Export logs** and **Save / Load state**.

## Why it matters in the bigger picture

<!-- EDIT: one paragraph linking this phase to the next one. What pressure
     does it introduce? What new capability does it set up? -->
```

---

## 6. `src/simulations/registry.ts` — append

Add the import at the top (alphabetical or below the others — match the existing style):

```ts
import <PhaseComponent> from './<phase-id>/<PhaseComponent>';
```

Append to the `simulations` array, **after the last entry**:

```ts
  {
    id: '<phase-id>',
    phase: NN,
    title: 'Phase NN — <Title>',
    shortTitle: '<Title>',
    tagline: '<one-line tagline from interview>',
    description:
      '<2–3 sentence description from interview>',
    icon: '<emoji>',
    path: '/<phase-id>',
    status: 'available',
    Component: <PhaseComponent>,
  },
```

---

## 7. Project root `README.md` — three updates

### 7a. Header links row

Find the line that lists the phases just under the badges:

```md
[**Live demo**](https://simulations.noeosorio.com) &nbsp;·&nbsp;
[**Phase 01 — Micro Ecosystem**](src/simulations/micro-ecosystem/README.md) &nbsp;·&nbsp;
[**Phase 02 — Skill Ecosystem**](src/simulations/skill-ecosystem/README.md) &nbsp;·&nbsp;
[**Phase 03 — Tribal Society**](src/simulations/tribal-society/README.md)
```

Append the new phase link with the same separator:

```md
[**Phase 03 — Tribal Society**](src/simulations/tribal-society/README.md) &nbsp;·&nbsp;
[**Phase NN — <Title>**](src/simulations/<phase-id>/README.md)
```

### 7b. Phases table

The next "planned" row gets rewritten in place. Pick an accent color (`00e5ff` cyan, `a8ff2b` lime, `ff2bd6` magenta, `ffb020` amber, `8b5cf6` violet) — typically rotate through them so each phase has a distinct badge.

Before:
```md
| **NN** | <placeholder name> | <placeholder> | ![planned](https://img.shields.io/badge/-planned-6b7d93?labelColor=0a0e14) |
```

After:
```md
| **NN** | [**<Title>**](src/simulations/<phase-id>/) | <one-line tagline> | ![available](https://img.shields.io/badge/-available-<accent-hex>?labelColor=0a0e14) |
```

If there isn't already a placeholder row for this phase, insert one in the right numerical position. After the new phase, add a new "planned" placeholder for `NN+1` so the table always shows what's next:

```md
| **NN+1** | <next concept teaser, or "Coming soon"> | <hint> | ![planned](https://img.shields.io/badge/-planned-6b7d93?labelColor=0a0e14) |
```

### 7c. Chronology line

Find:
```text
phase 01 ──●───● phase 02 ──●───● phase 03 ──◌───◌ phase 04 (coming soon)
```

After Phase 4 ships:
```text
phase 01 ──●───● phase 02 ──●───● phase 03 ──●───● phase 04 ──◌───◌ phase 05 (coming soon)
```

The pattern is straightforward: each shipped phase becomes `──●───●`, and the trailing `──◌───◌ phase N+1 (coming soon)` always points to whatever comes next.
