# Phase 01 — Micro Ecosystem

> The very first spark of organic life.

This is the simplest simulation in Sim World. A small group of round, single-cell-ish creatures swims around a dark pool. Plants and fruit appear out of nowhere. Creatures wander, get hungry, look for food, eat, and — when they have enough energy — meet a partner and make a baby.

## What lives here

- **Creatures**: each one has a name, a color, an energy bar, a speed, and a "generation" number. They blink, they have eyes that follow what they're looking at, and they show a small icon over their head depending on what they're doing right now.
- **Food**: small green plants and red fruit. They appear at random and give energy when eaten.

## What they do

A creature is always in one of four moods:

| State        | When                                        | What you see        |
|--------------|---------------------------------------------|---------------------|
| 🚶 Wander    | Energy is fine, no urgent need              | Drifts around       |
| 🔍 Seek      | Energy is low and food is nearby            | Red `!` over head   |
| 🍽 Eat       | Touched a piece of food                     | Green `✦` over head |
| 💕 Reproduce | Energy is high and a partner is nearby      | Pink `♥` over head  |

If a creature's energy reaches zero, it dies. When two well-fed creatures meet, a baby is born — its color and speed mix the parents' values, with a small random nudge.

## Things you can do

- **Click a creature** to inspect its stats (energy, generation, children, age, current state).
- **Pause / Resume** the world.
- **Speed up** time (×1 → ×2 → ×4).
- **Add a creature** or trigger a **food rain** by hand.
- **Export logs**: download a `.txt` file with every event of the run, time-stamped.
- **Save state**: download a `.txt` file holding the full snapshot of the world.
- **Load state**: pick a previously-saved `.txt` to bring an old world back to life.

## Why it matters in the bigger picture

This phase only models the most basic loop of life: **eat, survive, reproduce**. There are no predators, no senses beyond the simple "find the closest food", no aging beyond running out of energy. The next phases will start adding pressure — predators, scarcity, smarter brains.
