# Survival rules — keep populations stable, not extinct, not exploding

A new phase is not done because the code compiles. It's done when, in the 5-minute browser test, the population follows the design — neither dies off in 60 seconds nor explodes past the cap. This file is the math you use to set the constants in `helpers.ts` so the test passes on the first try.

## The core inequality

Energy must come back into a creature, on average, faster than it leaves. Concretely:

```
energy_in_per_creature_per_sec  ≥  energy_out_per_creature_per_sec  ×  1.10
```

The 10% buffer absorbs noise (some creatures get unlucky and don't find food right away). Below 1.0 the population trends extinct; above ~1.5 it explodes.

### Energy in (per creature per second)

```
food_spawn_per_sec      = FOOD_SPAWN_RATE × tickrate              // ticks/sec at 1× speed = 60
food_share_per_creature = food_spawn_per_sec / population
energy_in_per_creature  = food_share_per_creature × avg_food_energy
```

### Energy out (per creature per second)

```
drain_per_sec        = ENERGY_DRAIN_BASE × tickrate
reproduction_amort   = REPRODUCE_COST × births_per_sec / population   // small but non-trivial
energy_out_per_creature = drain_per_sec + reproduction_amort
```

In practice the reproduction term is tiny when the population is stable, so the dominant condition is `food_share × avg_food_energy ≥ drain_per_sec × 1.10`. Make sure the dominant term is healthy and the rest takes care of itself.

## Worked example using P1's numbers

Phase 1 (`micro-ecosystem/helpers.ts`):

```
FOOD_SPAWN_RATE   = 0.03       // per tick
ENERGY_DRAIN_BASE = 0.06 + speed × 0.02   // call it 0.08 worst-case
INITIAL_FOOD      = 25
MAX_FOOD          = 80
INITIAL_CREATURES = 8
avg_food_energy   ≈ 22         // randomRange(15, 30)
```

At 60 ticks/sec, with 8 creatures:

```
food_spawn_per_sec      = 0.03 × 60 = 1.8
food_share_per_creature = 1.8 / 8 = 0.225 foods/sec
energy_in_per_creature  = 0.225 × 22 = 4.95 energy/sec

drain_per_sec           = 0.08 × 60 = 4.80 energy/sec

ratio = 4.95 / 4.80 = 1.03   // tight but stable; the 10% buffer is missing
                              // — and that's why P1 dips before stabilizing.
```

P1 gets away with a tight ratio because creatures eat opportunistically (a fully-fed creature still grabs food when it touches it, banking energy). Don't lean on that — give yourself the 10% buffer.

## Defaults that have shipped reliably

These are the bands P1–P3 ended up in. Start near the middle of the range; tighten if the population explodes, loosen if it crashes.

| Constant | Range | Notes |
|---|---|---|
| `INITIAL_POPULATION` | **8 – 16** | Below 8, a streak of bad luck wipes the run. Above 16, you spend the first 30s in a food fight. |
| `MAX_POPULATION` | **40 – 60** | Caps reproduction so explosion can't happen even if your inequality is generous. |
| `INITIAL_FOOD` | **3× – 5× INITIAL_POPULATION** | Buffer so creatures don't immediately starve. |
| `MAX_FOOD` | **3× – 4× MAX_POPULATION** | Soft cap. With creatures eating opportunistically, food rarely sits at the cap. |
| `FOOD_SPAWN_RATE` | **0.02 – 0.05** per-tick prob | At 60 ticks/sec, this is 1.2–3.0 spawns/sec. |
| `avg_food_energy` (mean of `randomRange`) | **18 – 30** | High-energy food = fewer creatures need to forage. |
| `ENERGY_DRAIN_BASE` | **0.030 – 0.045** per tick | 1.8–2.7 energy/sec at 1× speed. |
| `REPRODUCE_ENERGY` | **55 – 70** | Threshold to allow mating. |
| `REPRODUCE_COST` | **20 – 28** per parent | Both parents pay; baby starts at ~45 energy. |
| `MATE_CONTACT_RADIUS` | **50 – 70** px | Below 40, mates miss each other; above 90, populations explode. |
| `MATE_SEEK_RADIUS` | **180 – 240** px | Detection range. |
| `LOW_ENERGY` (seek threshold) | **20 – 30** | Below this, the creature drops everything to look for food. |

## Phase-specific extras

If your phase introduces stamina, education, ageing, or a producer mechanic (farmer plants herbs), the inequality shifts. Some quick guidance:

- **Stamina**: a creature that runs out of stamina rests, so it doesn't drain. This loosens the energy budget — you can run with `energy_in / energy_out ≈ 1.0` instead of 1.1. Make sure resting isn't blocked (if there's no nest, can creatures rest in place?).
- **Producer roles** (farmer, harvester): when food doesn't spawn naturally, the entire `food_spawn_per_sec` term has to come from the producers' work output. Compute it: `producers × ability_value × work_output_per_tick × tickrate`. If the producer count is < 30% of population, the inequality fails.
- **Ageing / max age**: forces a death rate even when nobody runs out of energy. Compensate by lowering `REPRODUCE_ENERGY` (so mating is more frequent) or raising `MAX_AGE`.
- **Cooldown on reproduction** (`REPRODUCE_COOLDOWN`): pads the inequality on the explosion side. P3 uses 600 ticks (10s) per parent — enough that births can't outrun deaths in the first minute.

## Sanity checklist before you compile

- [ ] `INITIAL_POPULATION ≥ 8` and `MAX_POPULATION ≤ 60`.
- [ ] `INITIAL_FOOD ≥ 3 × INITIAL_POPULATION`.
- [ ] `(FOOD_SPAWN_RATE × 60 / INITIAL_POPULATION) × avg_food_energy ≥ ENERGY_DRAIN_BASE × 60 × 1.10`.
- [ ] If there are producer roles, the producer count × ability_value > population × eat_rate.
- [ ] `REPRODUCE_COOLDOWN` (or equivalent) prevents the same parent from mating every tick.
- [ ] Every cause of death has at least one mitigation (low energy → eat; old age → reproduce in time; predator → flee).

If any of these fail, fix the constants before generating code. The test is much shorter than the build-test-fail-rebuild loop.

## When the test fails anyway

The 5-minute test surfaces problems the math missed. Common patterns and the standard tweak:

| Symptom | Likely cause | Standard fix |
|---|---|---|
| Population drops to 0 in < 60s | Drain too high or food too sparse | `FOOD_SPAWN_RATE += 0.01` and/or `ENERGY_DRAIN_BASE × 0.85` |
| Population stable for 60s, then crashes | Reproduction stops (mating window too narrow) | Lower `REPRODUCE_ENERGY` by 5 |
| Population doubles in < 60s | Mating too easy | Raise `REPRODUCE_ENERGY` by 5 or add/raise `REPRODUCE_COOLDOWN` |
| Population sits at `MAX_POPULATION` | Cap is doing the regulation, not the inequality | `MAX_POPULATION × 0.85` and re-check the inequality — your design is dynamically unstable |
| Some role's action never fires in the log | Trigger condition can't be met | Read your state machine; the role's enter-condition is probably never true (e.g. healer needs targets at energy < 70 but the inequality keeps everyone above 80) |

After two rounds of tweaking without convergence, stop and surface to the user. Some balance issues are design-level (e.g. "this phase needs a producer role; nature alone won't feed everyone") and not just constant-tuning.
