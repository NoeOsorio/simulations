# Phase 02 — Skill Ecosystem

> Food stops being free. Now someone has to make it.

In Phase 01 food fell from the sky. In Phase 02 the world is empty unless somebody works for it. Each creature is born into one of four **roles**, and the survival of the whole group depends on the mix.

## The four roles

| Role         | Color   | What they do                                                |
|--------------|---------|-------------------------------------------------------------|
| 🌱 Farmer    | green   | Plants **herbs** — many, low energy, fast production.        |
| 🧺 Harvester | orange  | Grows **apples** 60–110px away — fewer, higher energy.       |
| 💊 Healer    | cyan    | Donates energy directly to weak allies within 110px.         |
| 🛖 Builder   | purple  | Builds **nests** — static zones that help everyone.          |

Food comes in two tiers: green herbs (cheap and common) and red apples (a real meal). Harvesters plant their apples a short distance away from themselves on purpose — so they can't just hoard the fruit. The tribe has to share.

Every creature has an **ability level** (roughly 0.4 – 3.0) — a farmer with level 2.0 plants herbs twice as fast as one with level 1.0, a harvester at 2.0 grows apples twice as fast, a healer at 2.0 donates more per shift, a builder at 2.0 builds nests twice as often.

### Nests

Nests are the builder's contribution. Each one is a soft glowing circle (~58px radius) that stays on the map. While a creature is inside a nest:

- **Stamina recovers 2× as fast** — whether resting, wandering, or seeking.
- **Mate-seeking radius expands ~1.8×** — ready adults spot each other from much farther.

Up to 3 nests exist at once; a builder making a new one will cause the oldest one to fade. You'll see the whole tribe start to gravitate toward these zones — they rest, recover, and reproduce there.

## Visual cues

Working creatures get a **bright colored aura** in their role's color — that's how you can tell at a glance who is producing right now. Resting creatures look dim and desaturated. Hungry ones show a red `!` above their head; ones about to mate show a pink `♥`; ones eating a green `✦`.

## Work, rest, repeat

Nobody can work all the time. Every creature has **two bars**:

- **Energy** — drops over time; when it hits zero the creature dies. Replenished by eating food.
- **Stamina** — drops while working. Replenished by resting (and slowly while wandering).

Each tick, a creature picks one state based on its bars:

| State          | When it kicks in                                            |
|----------------|-------------------------------------------------------------|
| 🔍 Seeking     | Energy below 28 and food is visible.                        |
| 💤 Resting     | Stamina below 16. Slows down, recovers fast.                |
| 💕 Reproducing | Energy ≥ 72, stamina ≥ 38, mature, and a ready partner nearby. |
| ⚙ Working      | Stamina > 22 and energy > 32. Fires the role's ability on a cooldown. |
| 🚶 Wandering   | Anything else. Drifts around, recovers slowly.              |

A creature can only do one thing at a time — working drains stamina, so they must rest eventually; resting means no food gets planted; planting too slowly means someone will starve. The whole simulation is the tension between these loops.

## Inheritance

When two healthy adults meet and reproduce, the baby inherits:

- **Role** — 50/50 from one of the two parents (not mixed).
- **Ability level** — from the parent whose role was chosen, plus a small random mutation (±0.15 typical).
- **Color** — follows the role, with a subtle shade for ability strength.

Over generations you can watch populations drift: farmer lineages slowly getting better at planting, healer lineages getting stronger — or the opposite if mutations go the wrong way.

## What you can do

- **Click a creature** to see its role, stats, energy & stamina bars, ability level, generation.
- **Pause / Resume** the world.
- **Speed up** time (×1 → ×2 → ×4).
- **Click a role** in the side panel to add one fresh creature of that role.
- **+ Food** drops 10 pieces of regular food (useful when the ecosystem is collapsing).
- **Export logs / Save state / Load state** — plain `.txt` files, same format as Phase 01.

## What to watch for

- Kill all farmers and harvesters → no new food → everyone starves. The ecosystem is fragile.
- Too few builders early on → the population stays scattered and reproduces slowly.
- A strong healer lineage keeps weak individuals alive long enough to contribute.
- Once a nest appears, watch the tribe start to converge on it for rest and mating.

## Why it matters in the bigger picture

Phase 01 only needed creatures to **eat and reproduce**. Phase 02 adds the idea of **specialization, production, and interdependence**. You can't just be alive — somebody in the group has to make the food, somebody has to distribute it, and the whole thing only works if the mix of skills stays in balance. The next phases will layer pressure on top of this: predators, scarcity, smarter decision-making.
