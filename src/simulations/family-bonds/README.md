# Phase 04 — Family Bonds

> _Couples form, families grow, and only your partner can be the parent of your children._

This is the first phase where individuals are not interchangeable. They have **personalities**, they pick **one** partner for life, they raise **their own** children, and the world becomes a network of small families instead of a flat soup of creatures.

## What lives here

- **Creatures** — same canvas-style sprites as earlier phases, but now each one carries three personality traits (1–100) that shape who they bond with and how well they care for their family. Children are born neutral-warm; adults take on the color of their role.
- **Houses** 🏠 — each family has a home. The house holds the family's pantry: a small `raw` stockpile and a smaller `cooked` shelf. Children stay close to their house; reproduction can only happen inside one.
- **Schools** 📚 — two of them at first, sitting between the houses. Teachers walk over to teach; children walk over to learn. They cap at 1 teacher and 4 students each so the population spreads itself across the schools.

## Personality

Three traits are inherited each generation:

| Trait | What it does |
|---|---|
| **Carisma** | How fast you build a bond with people you spend time near, and how persuasive you are when proposing. |
| **Empatía** | How much you care for partners and family — heals more, raises children better, accepts proposals more easily. |
| **Ingenio** | How much you learn at school, and how harshly you filter low-charisma proposals when someone wants to court you. |

Each child trait is `0.5 × averageOfParents + 0.5 × random(1, 100)` — so kids carry the family but the world keeps a strong dose of randomness.

## What they do

| State | When | What you see |
|---|---|---|
| 🚶 Wander | Idle, not tired, not hungry | Drift |
| 🌾 Forage / ↩ Return | Going out to find food / coming back to deposit | Yellow `!` and a green dot trail of carried food |
| 🍽 Eat | At home, eating from the family pantry | Green `✦` |
| ❤ Bond / Court | Single adult building a bond with a candidate | Pink `♥` |
| 💕 Reproduce | Both partners inside the family house | Pink `♥` (sustained) |
| 📚 School | Children learning, teachers teaching | Cyan `✦` (children only when learning) |
| ⇄ Barter | An adult walking to a cocinero family to trade raw for cooked | Lime `⇄` |
| ⏸ Rest | Stamina low | Slow drift |

A small magenta dot below the head means the creature has a partner. Numbers in the corner of each house tell you `R` (raw) and `C` (cooked) inventory.

## Roles

All five roles from Phase 3 are still here. *Harvester* has been renamed to **Cocinero** because we now have an inventory system, and cooking turns into a real mechanic:

| Role | What they do |
|---|---|
| 🌱 Farmer | Plants herbs across the map; the family's pantry fills with whatever the household carries home. |
| 🍞 Cocinero | At home, turns 2 raw into 1 cooked. Cooked food gives +50% energy. Other families can show up and trade `2 raw → 1 cooked`. |
| 💊 Healer | Restores energy to weak family members and partners. |
| 🛖 Builder | Builds new houses and schools as the population grows. |
| 📚 Teacher | Goes to a school and teaches the children inside. |

Children who never make it to school grow up as **farmer** or **cocinero** by default. Only educated children can become healer, builder, or teacher.

## Family rules

- Only your **partner** can be the parent of your children.
- You can only pair with someone who isn't blood-related to you (no parents, children, or siblings).
- If your partner dies, you become single again and can court someone new.
- Staying single is fine — you live alone in your own house and work for yourself.
- If a child loses both parents, they grow up early — they keep whatever education and traits they had at that moment, and have to make their own way.

## Things you can do

- **Click** any creature to read their personality, partner, family graph, and current state in the inspector.
- **Pause / Resume** the world. **Speed up** time.
- **Add an adult** or **food** by hand for stress testing.
- **Export logs** and **Save / Load state** to a `.txt` file.
- **Reset** to start over with four fresh families.

## Why it matters in the bigger picture

Phase 3 made cooperation necessary. Phase 4 makes **identity** necessary: each creature is now somebody specific, with a partner that depends on them, children that need raising, and a personality that propagates through the population. The next phase can build on this — emergent leaders, reputation, conflict between families, or the first abstract idea of property.
