# Phase 03 — Tribal Society

> A village that only works when nobody is self-sufficient.

Phase 02 gave every creature a role, but each role could still feed itself and cover its own needs. Phase 03 breaks that. Now every creature *depends on somebody else*: no producer is allowed to consume their own product, no healer can heal themselves, no builder can live in their own nest. The tribe only survives if the roles feed, heal, house, and teach each other.

## The five roles

| Role         | Color     | What they do                                                |
|--------------|-----------|-------------------------------------------------------------|
| 🌱 Farmer    | green     | Plants **herbs**. Cannot eat herbs — they eat fruit.         |
| 🧺 Harvester | orange    | Grows **apples**. Cannot eat apples — they eat herbs.        |
| 💊 Healer    | cyan      | Donates energy to weak allies. Cannot heal themselves.      |
| 🛖 Builder   | purple    | Builds nests. Cannot benefit from their own nests.          |
| 📚 Teacher   | magenta   | Gives classes to nearby children. Educated kids grow stronger. |

Everyone who isn't a producer (healer, builder, teacher, children) eats any food.

## Life stages

Every creature now has an age, and walks through three stages:

| Stage     | When                                | What they do                             |
|-----------|-------------------------------------|------------------------------------------|
| 👶 Child  | Birth → ~60s (varies ±20%)          | No job. Eats, wanders, can take classes. |
| 🧑 Adult  | ~60s → ~240s                        | Works, reproduces. Role assigned the moment they grow up. |
| 👴 Elder  | ~240s → ~300s                       | Still works (0.5× production) and consumes 0.5× food. Cannot reproduce. Slower. |
| ☠️ Death  | ~300–360s (individual longevity)    | Of old age — or earlier if they starve.  |

Children are rendered in a single neutral cream color regardless of future role. Elders keep their role color but desaturated, with a small white hair tuft.

## Role assignment at adulthood

Roles are **not inherited** this time. When a child ascends into adulthood:

- If they have **at least 0.3 education**, they can take any of the five roles — they're considered "skilled" — and the tribe assigns them the one with the fewest members.
- If they were **undereducated**, they can only become a 🌱 Farmer or 🧺 Harvester. Specialist roles (healer, builder, teacher) are locked.

This is the real economy of the tribe: if all your teachers die, the next generation of kids won't be taught, and no new specialists will appear. Eventually the society loses healers and builders and collapses back into pure subsistence farming.

## Services — creatures go to them

Creatures now actively walk toward services rather than waiting for them:

- **When tired** (stamina low): they seek out the nearest 🛖 nest and walk over to rest in it. Outside a nest stamina still recovers slowly, but it's much faster inside.
- **When starving but no food is nearby**: they walk toward the nearest 💊 healer and hope to be revived before collapse.

## Education

While a child, a teacher nearby can give them a class. Each class adds a tiny bit of education (capped at +1.0 ability bonus total). When that child becomes an adult, their ability level is `base + education` — so a well-taught child becomes a stronger-than-average worker for the rest of their life. Teachers are the long-term lever on tribe productivity.

## Nests

Builders still raise nests. Within a nest, stamina recovers 2× faster and the mate-seeking radius expands 1.8×. Builders can't use their own nests — so two builders end up raising each other's shelters, which is the point.

## Population cap

Hard-capped at **50**. Reproduction pauses once the tribe hits the cap. You start with **11 adults** (3 Farmer, 3 Harvester, 2 Healer, 1 Builder, 2 Teachers) and **5 children** — enough redundancy for the cross-feeding economy to survive a few early deaths. Intervene with `+ Child` / `+ Adult` to seed specific stages.

## What to watch for

- If all teachers die, new adults have no education and the tribe's average productivity decays.
- Because farmers feed harvesters and vice versa, you need both alive — losing one kills the other.
- Elders hang around consuming less food but still pulling their weight at half output.
- A builder surrounded only by their own nests starves from "no nest benefits." Two builders can house each other.
