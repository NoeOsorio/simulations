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
  BOND_GROWTH_BASE,
  BOND_PROPOSE_THRESHOLD,
  BOND_REJECTION_PENALTY,
  CANVAS_H,
  CANVAS_W,
  CARRY_CAPACITY,
  CHILD_DRAIN_MULT,
  CHILD_HOME_RADIUS,
  COOKED_FOOD_ENERGY,
  COOK_INTERVAL_TICKS,
  COOK_RAW_PER_COOKED,
  COURT_COOLDOWN,
  EDUCATION_CAP,
  EDUCATION_PER_CLASS,
  ELDER_DRAIN_MULT,
  ENERGY_DRAIN_BASE,
  FOOD_BASE_ENERGY,
  FOOD_SPAWN_RATE,
  FORAGE_TRIGGER_RAW,
  HOUSE_COOKED_CAP,
  HOUSE_RAW_CAP,
  HUNGER_THRESHOLD,
  INITIAL_FOOD,
  MATE_CONTACT_RADIUS,
  MATE_SEEK_RADIUS,
  MAX_FOOD,
  MAX_POPULATION,
  REPRODUCE_COOLDOWN,
  REPRODUCE_COST_ENERGY,
  REPRODUCE_COST_STAMINA,
  REPRODUCE_ENERGY,
  REPRODUCE_STAMINA,
  ROLE_HUE,
  ROLE_ICON,
  ROLE_LABEL,
  SCHOOL_STUDENT_CAP,
  SCHOOL_TEACHER_CAP,
  STAMINA_DRAIN_WORK,
  STAMINA_RECOVER_IDLE,
  STAMINA_RECOVER_REST,
  abilityCooldownTicks,
  acceptanceProb,
  ascendToAdult,
  buildInitialWorld,
  createBaby,
  createCreature,
  createFood,
  createHouse,
  createSchool,
  descendToElder,
  dist,
  findCreature,
  findHouse,
  hueToRgb,
  isBloodRelated,
} from './helpers';
import type {
  Creature,
  CreatureState,
  Food,
  House,
  LogEntry,
  Role,
  School,
  SimStats,
  FamilyBondsSavedState,
} from './types';
import './FamilyBonds.css';

// Local constant kept here (not in helpers because only this component uses it).
// Stamina threshold below which adults stop working and look to rest.
const LOW_STAMINA = 16;

/**
 * Local extension of the universal LogEntry. We tint the bullet of each
 * event in the log with the relevant creature's body color so the panel
 * scans naturally — births and deaths read at a glance.
 */
interface PhaseLogEntry extends LogEntry {
  color?: string;
}

/** Pick the nearest entity with x/y from a list, optionally filtered. */
function nearest<T extends { x: number; y: number }>(
  from: { x: number; y: number },
  list: T[],
  filter?: (item: T) => boolean,
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const item of list) {
    if (filter && !filter(item)) continue;
    const d = dist(from, item);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

/** Move c toward target by speed; updates c.x/y/vx/vy. Returns dist after move. */
function stepToward(c: Creature, target: { x: number; y: number }, speedMult = 1): number {
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) {
    c.vx = 0;
    c.vy = 0;
    return d;
  }
  const sp = c.speed * speedMult;
  c.vx = (dx / d) * sp;
  c.vy = (dy / d) * sp;
  c.x += c.vx;
  c.y += c.vy;
  return d - sp;
}

/** Wandering — small random drift kept inside canvas bounds. */
function wanderStep(c: Creature) {
  c.vx += (Math.random() - 0.5) * 0.4;
  c.vy += (Math.random() - 0.5) * 0.4;
  const m = Math.hypot(c.vx, c.vy);
  if (m > c.speed) {
    c.vx = (c.vx / m) * c.speed;
    c.vy = (c.vy / m) * c.speed;
  }
  c.x += c.vx;
  c.y += c.vy;
  if (c.x < 12) { c.x = 12; c.vx = Math.abs(c.vx); }
  if (c.x > CANVAS_W - 12) { c.x = CANVAS_W - 12; c.vx = -Math.abs(c.vx); }
  if (c.y < 12) { c.y = 12; c.vy = Math.abs(c.vy); }
  if (c.y > CANVAS_H - 12) { c.y = CANVAS_H - 12; c.vy = -Math.abs(c.vy); }
}

function moodForState(s: CreatureState, energy: number): 'neutral' | 'happy' | 'eating' | 'tired' {
  if (s === 'eat') return 'eating';
  if (s === 'reproduce' || s === 'court' || s === 'bond') return 'happy';
  if (energy < HUNGER_THRESHOLD) return 'tired';
  return 'neutral';
}

export default function FamilyBonds(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Simulation state — refs so the rAF loop never re-runs effects ─────
  const creaturesRef = useRef<Creature[]>([]);
  const foodRef = useRef<Food[]>([]);
  const housesRef = useRef<House[]>([]);
  const schoolsRef = useRef<School[]>([]);
  const animRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const statsRef = useRef({
    born: 0,
    died: 0,
    proposalsAccepted: 0,
    proposalsRejected: 0,
    housesBuilt: 0,
    schoolsBuilt: 0,
    totalCooked: 0,
    totalBartered: 0,
    classesGiven: 0,
  });
  const selectedRef = useRef<Creature | null>(null);
  const logRef = useRef<PhaseLogEntry[]>([]);
  const runningRef = useRef(true);
  const speedRef = useRef(1);
  /** Per-cocinero cook cooldown tick. */
  const lastCookRef = useRef<Record<string, number>>({});
  /** Per-house build cooldown tick. */
  const lastBuildRef = useRef<Record<string, number>>({});

  // ── UI state — only what shows in the DOM ────────────────────────────
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<SimStats>({
    alive: 0, children: 0, adults: 0, elders: 0,
    farmers: 0, cocineros: 0, healers: 0, builders: 0, teachers: 0,
    food: 0, houses: 0, schools: 0,
    partnered: 0, singles: 0,
    born: 0, died: 0,
    proposalsAccepted: 0, proposalsRejected: 0,
    housesBuilt: 0, schoolsBuilt: 0,
    totalCooked: 0, totalBartered: 0,
    classesGiven: 0,
  });
  const [selected, setSelected] = useState<Creature | null>(null);
  const [selectedPartnerName, setSelectedPartnerName] = useState<string | null>(null);
  const [displayTick, setDisplayTick] = useState(0);
  const [log, setLog] = useState<PhaseLogEntry[]>([]);

  const addLog = useCallback((msg: string, color?: string) => {
    logRef.current = [{ msg, t: Date.now(), color }, ...logRef.current].slice(0, 500);
    setLog([...logRef.current.slice(0, 30)]);
  }, []);

  // ── Initialize once ──────────────────────────────────────────────────
  useEffect(() => {
    const { creatures, houses, schools } = buildInitialWorld();
    creaturesRef.current = creatures;
    housesRef.current = houses;
    schoolsRef.current = schools;
    foodRef.current = Array.from({ length: INITIAL_FOOD }, () => createFood());
    addLog(`World seeded — ${houses.length} families, ${creatures.length} creatures`);
  }, [addLog]);

  // ── The big loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    const bgCanvas = buildBackground({ width: CANVAS_W, height: CANVAS_H });

    // ──────────────────────────────────────────────────────────────────
    // UPDATE
    // ──────────────────────────────────────────────────────────────────
    const update = () => {
      if (!runningRef.current) return;
      const spd = speedRef.current;

      for (let s = 0; s < spd; s++) {
        tickRef.current++;
        const tick = tickRef.current;
        const creatures = creaturesRef.current;
        const houses = housesRef.current;
        const schools = schoolsRef.current;
        const food = foodRef.current;

        // Vacancy bookkeeping for houses.
        for (const h of houses) {
          // Drop dead residents from the list before counting.
          h.residentIds = h.residentIds.filter((id) =>
            creatures.some((c) => c.id === id && c.energy > 0 && c.age < c.maxAge),
          );
          if (h.residentIds.length === 0) h.vacancyTimer++;
          else h.vacancyTimer = 0;
        }

        // Reset school occupancy each tick — re-derived from creatures' state.
        for (const sch of schools) {
          sch.teacherIds = [];
          sch.studentIds = [];
        }

        // ── Per-creature update ──────────────────────────────────────
        for (const c of creatures) {
          c.age++;
          c.pulsePhase += 0.05;
          c.blinkTimer -= 1;
          if (c.blinkTimer < 0) c.blinkTimer = 80 + Math.random() * 200;
          if (c.learnFlash > 0) c.learnFlash--;
          if (c.abilityCooldown > 0) c.abilityCooldown--;

          // Track an arbitrary look angle.
          c.eyeAngle += (Math.random() - 0.5) * 0.1;

          // ── Stage transitions ─────────────────────────────────────
          if (c.stage === 'child' && c.age >= c.adultAge) {
            // Promote to adult — pick a role based on education.
            const { role, educated } = ascendToAdult(c, creatures);
            addLog(`${c.name} grew into adulthood — ${role}${educated ? ' (educated)' : ''}`, hueToRgb(c.hue));
          } else if (c.stage === 'adult' && c.age >= c.elderAge) {
            descendToElder(c);
            addLog(`${c.name} became an elder`, hueToRgb(c.hue));
          }

          // ── Death by old age ──────────────────────────────────────
          if (c.age >= c.maxAge) {
            c.energy = 0;
            continue;
          }

          // ── Energy drain ──────────────────────────────────────────
          const stageDrainMult =
            c.stage === 'child' ? CHILD_DRAIN_MULT
              : c.stage === 'elder' ? ELDER_DRAIN_MULT
                : 1.0;
          c.energy -= ENERGY_DRAIN_BASE * stageDrainMult;

          // Stamina drift.
          if (c.state === 'work' || c.state === 'forage' || c.state === 'return' || c.state === 'barter') {
            c.stamina = Math.max(0, c.stamina - STAMINA_DRAIN_WORK * 0.4);
          } else if (c.state === 'rest') {
            c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_REST);
          } else {
            c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_IDLE);
          }

          // ── Orphan check ──────────────────────────────────────────
          // Fires earlier (age > 30) so orphans can ascend before they
          // starve, and ascends with a fresh energy boost so they don't
          // die in the next few ticks anyway.
          if (c.stage === 'child' && c.age > 30) {
            const [pa, pb] = c.parentIds;
            const motherDead = pa !== null && !creatures.some((o) => o.id === pa && o.energy > 0);
            const fatherDead = pb !== null && !creatures.some((o) => o.id === pb && o.energy > 0);
            const noParents = (pa === null || motherDead) && (pb === null || fatherDead);
            if (noParents && (pa !== null || pb !== null)) {
              ascendToAdult(c, creatures);
              c.energy = Math.max(c.energy, 70);
              c.stamina = Math.max(c.stamina, 60);
              addLog(`${c.name} was orphaned and grew up early`, hueToRgb(c.hue));
            }
          }

          // ── Behavior decision tree ────────────────────────────────
          const home = findHouse(c.houseId, houses);

          // CHILDREN: stay near home, eat from inventory, optionally go to school.
          if (c.stage === 'child') {
            if (c.energy < HUNGER_THRESHOLD && home) {
              if (dist(c, home) > home.radius - 5) {
                // Walk back to home.
                c.state = 'return';
                stepToward(c, home);
              } else if (home.cooked > 0) {
                // Eat cooked.
                home.cooked -= 1;
                c.energy = Math.min(c.maxEnergy, c.energy + COOKED_FOOD_ENERGY);
                c.state = 'eat';
              } else if (home.raw > 0) {
                home.raw -= 1;
                c.energy = Math.min(c.maxEnergy, c.energy + FOOD_BASE_ENERGY);
                c.state = 'eat';
              } else {
                // Wait at home; nothing to eat.
                c.state = 'home';
                wanderStep(c);
              }
              continue;
            }

            // Possibly go to school for a learning session.
            const targetSchool = nearest(c, schools, (sc) =>
              sc.teacherIds.length > 0 || sc.studentIds.length < SCHOOL_STUDENT_CAP,
            );
            const wantsLearning = c.education < EDUCATION_CAP && Math.random() < 0.005;
            if (
              wantsLearning && targetSchool &&
              dist(c, targetSchool) < CHILD_HOME_RADIUS * 1.3
            ) {
              if (dist(c, targetSchool) > targetSchool.radius - 5) {
                c.state = 'school';
                stepToward(c, targetSchool);
              } else {
                // Inside school — register and learn if a teacher is present.
                if (targetSchool.studentIds.length < SCHOOL_STUDENT_CAP) {
                  targetSchool.studentIds.push(c.id);
                }
                c.state = 'school';
                wanderStep(c);
                if (targetSchool.teacherIds.length > 0 && c.education < EDUCATION_CAP) {
                  c.education = Math.min(EDUCATION_CAP, c.education + EDUCATION_PER_CLASS / 60);
                  c.learnFlash = 30;
                }
              }
              continue;
            }

            // Default: wander around home within radius. While at home,
            // pick up a tiny amount of education from any roled adult
            // present — parents teaching their own kids by example. This
            // ensures children can still eventually qualify for specialist
            // work even when no teacher is alive in the world.
            if (home) {
              const d = dist(c, home);
              if (d > CHILD_HOME_RADIUS) {
                c.state = 'home';
                stepToward(c, home);
              } else {
                c.state = 'home';
                wanderStep(c);
                if (c.education < EDUCATION_CAP) {
                  const teacherNearby = creatures.some((o) =>
                    o !== c && o.role && o.stage !== 'child' &&
                    dist(o, home) < home.radius,
                  );
                  if (teacherNearby) {
                    c.education = Math.min(EDUCATION_CAP, c.education + 0.0002);
                  }
                }
              }
            } else {
              wanderStep(c);
            }
            continue;
          }

          // ADULT / ELDER behavior.
          // --------------------------------------------------------------
          // Priority 1: hunger response.
          if (c.energy < HUNGER_THRESHOLD) {
            if (home) {
              const dh = dist(c, home);
              if (dh > home.radius - 5) {
                // Drop carry off only at home; keep walking back.
                c.state = 'return';
                stepToward(c, home);
                continue;
              }
              // At home. Try cooked > raw.
              if (home.cooked > 0) {
                home.cooked -= 1;
                c.energy = Math.min(c.maxEnergy, c.energy + COOKED_FOOD_ENERGY);
                c.state = 'eat';
                continue;
              }
              if (home.raw > 0) {
                home.raw -= 1;
                c.energy = Math.min(c.maxEnergy, c.energy + FOOD_BASE_ENERGY);
                c.state = 'eat';
                continue;
              }
              // No food at home. If we have raw to barter elsewhere:
              if (home.raw === 0 && home.cooked === 0) {
                // Try barter against another family's cooked surplus.
                const cocineroHomes = houses.filter((h) => {
                  if (h === home) return false;
                  if (h.cooked <= 0) return false;
                  // Does the resident family include a cocinero?
                  return h.residentIds.some((id) => {
                    const r = creatures.find((cr) => cr.id === id);
                    return r?.role === 'cocinero';
                  });
                });
                const target = nearest(c, cocineroHomes);
                if (target) {
                  if (dist(c, target) > target.radius - 5) {
                    c.state = 'barter';
                    stepToward(c, target);
                  } else {
                    // Arrived. Trade: 2 raw goes from home (we don't have any!)
                    // OR if we are carrying ≥ 2, give from carry. Otherwise just eat 1 cooked
                    // as charity (rare case; community stays alive).
                    let raw = 0;
                    if (c.carrying >= 2) {
                      c.carrying -= 2;
                      raw = 2;
                    }
                    target.cooked = Math.max(0, target.cooked - 1);
                    target.raw = Math.min(HOUSE_RAW_CAP, target.raw + raw);
                    c.energy = Math.min(c.maxEnergy, c.energy + COOKED_FOOD_ENERGY);
                    c.state = 'barter';
                    statsRef.current.totalBartered++;
                    addLog(`${c.name} bartered ${raw} raw for cooked`, hueToRgb(c.hue));
                  }
                  continue;
                }
              }
              // Last resort: go find food in the world directly. Eat it
              // on the spot instead of carrying — survival > family pantry.
              const fEmergency = nearest(c, food);
              if (fEmergency) {
                if (dist(c, fEmergency) < c.size + fEmergency.size + 3) {
                  c.energy = Math.min(c.maxEnergy, c.energy + fEmergency.energy);
                  c.state = 'eat';
                  foodRef.current = food.filter((x) => x !== fEmergency);
                } else {
                  c.state = 'forage';
                  stepToward(c, fEmergency);
                }
                continue;
              }
              // Truly nothing nearby. Rest and hope a farmer shows up.
              c.state = 'rest';
              wanderStep(c);
              continue;
            }
            // No home — graze the world directly.
            const f = nearest(c, food);
            if (f && dist(c, f) < c.size + f.size + 3) {
              c.energy = Math.min(c.maxEnergy, c.energy + f.energy);
              c.state = 'eat';
              foodRef.current = food.filter((x) => x !== f);
            } else if (f) {
              c.state = 'forage';
              stepToward(c, f);
            } else {
              wanderStep(c);
            }
            continue;
          }

          // Priority 2: carrying — go deposit at home.
          if (c.carrying > 0) {
            if (home) {
              if (dist(c, home) > home.radius - 5) {
                c.state = 'return';
                stepToward(c, home);
              } else {
                const space = HOUSE_RAW_CAP - home.raw;
                const deposit = Math.min(c.carrying, space);
                home.raw += deposit;
                c.carrying -= deposit;
                if (c.carrying > 0) {
                  // Home full — barter what's left.
                  const cocineroHomes = houses.filter((h) =>
                    h !== home && h.residentIds.some((id) => {
                      const r = creatures.find((cr) => cr.id === id);
                      return r?.role === 'cocinero';
                    }) && h.cooked > 0,
                  );
                  const target = nearest(c, cocineroHomes);
                  if (target && c.carrying >= 2) {
                    c.state = 'barter';
                    stepToward(c, target);
                    continue;
                  }
                  // No barter target — drop the rest on the ground (lost).
                  c.carrying = 0;
                }
                c.state = 'wander';
              }
            } else {
              // Lost — drop carry.
              c.carrying = 0;
              wanderStep(c);
            }
            continue;
          }

          // Priority 3: reproduction with partner. Goes BEFORE foraging so
          // couples don't permanently get distracted by groceries — but
          // GATED on the family pantry having at least a couple of meals
          // stored. Otherwise mate-eat-mate cycles drain the inventory and
          // children at home starve before adults restock.
          const familyFoodReserve = home ? home.raw + home.cooked : 0;
          if (
            c.partnerId &&
            c.energy >= REPRODUCE_ENERGY &&
            c.stamina >= REPRODUCE_STAMINA &&
            tick - c.lastReproduceTick > REPRODUCE_COOLDOWN &&
            c.stage === 'adult' &&
            creatures.length < MAX_POPULATION &&
            home &&
            familyFoodReserve >= 2
          ) {
            const partner = findCreature(c.partnerId, creatures);
            if (
              partner && partner.energy >= REPRODUCE_ENERGY &&
              partner.stamina >= REPRODUCE_STAMINA &&
              tick - partner.lastReproduceTick > REPRODUCE_COOLDOWN &&
              partner.stage === 'adult'
            ) {
              const dh = dist(c, home);
              const dph = dist(partner, home);
              if (dh > home.radius - 5) {
                c.state = 'reproduce';
                stepToward(c, home);
                continue;
              }
              if (dph > home.radius - 5) {
                // Wait — partner not yet here.
                c.state = 'reproduce';
                wanderStep(c);
                continue;
              }
              // Both inside the same house. Mate.
              const baby = createBaby(c, partner);
              creaturesRef.current.push(baby);
              home.residentIds.push(baby.id);
              c.energy -= REPRODUCE_COST_ENERGY;
              partner.energy -= REPRODUCE_COST_ENERGY;
              c.stamina -= REPRODUCE_COST_STAMINA;
              partner.stamina -= REPRODUCE_COST_STAMINA;
              c.children++;
              partner.children++;
              c.lastReproduceTick = tick;
              partner.lastReproduceTick = tick;
              statsRef.current.born++;
              addLog(`${baby.name} was born to ${c.name} and ${partner.name}`, hueToRgb(baby.hue));
              c.state = 'wander';
              continue;
            }
          }

          // Priority 4: courtship (singles only). Above foraging on
          // purpose — without this, single adults always get distracted
          // grocery-running and never form pairs, freezing population
          // growth at the initial four couples.
          if (
            !c.partnerId &&
            c.stage === 'adult' &&
            tick - c.lastCourtTick > COURT_COOLDOWN &&
            c.energy > HUNGER_THRESHOLD + 10
          ) {
            // Find best candidate within seek radius.
            const candidates = creatures.filter((o) =>
              o !== c &&
              o.stage === 'adult' &&
              !o.partnerId &&
              o.energy > 0 &&
              !isBloodRelated(c, o) &&
              dist(c, o) < MATE_SEEK_RADIUS,
            );

            if (candidates.length > 0) {
              // Build / strengthen bond with all nearby singles.
              for (const other of candidates) {
                const d = dist(c, other);
                if (d < MATE_SEEK_RADIUS) {
                  const grow = BOND_GROWTH_BASE * (other.personality.carisma / 100) *
                    (1 - d / MATE_SEEK_RADIUS);
                  c.bonds[other.id] = Math.min(100, (c.bonds[other.id] ?? 0) + grow);
                }
              }
              // Pick highest-bond candidate.
              let bestId: string | null = null;
              let bestBond = 0;
              for (const id in c.bonds) {
                const v = c.bonds[id] ?? 0;
                if (v > bestBond) {
                  bestBond = v;
                  bestId = id;
                }
              }
              const best = bestId ? findCreature(bestId, creatures) : null;
              if (best && best.energy > 0 && !best.partnerId && !isBloodRelated(c, best)) {
                // Move toward them; if close enough and bond ≥ threshold, propose.
                if (bestBond >= BOND_PROPOSE_THRESHOLD) {
                  if (dist(c, best) > MATE_CONTACT_RADIUS) {
                    c.state = 'court';
                    stepToward(c, best);
                  } else {
                    // Propose. Acceptance based on personalities.
                    const accept = Math.random() < acceptanceProb(c, best);
                    if (accept) {
                      c.partnerId = best.id;
                      best.partnerId = c.id;
                      // Pick a target house: prefer an empty one nearby
                      // (so existing solo households actually get used),
                      // otherwise the closer of the two existing homes.
                      const empty = houses
                        .filter((h) => h.residentIds.length === 0)
                        .sort((h1, h2) => dist(c, h1) - dist(c, h2));
                      const ha = findHouse(c.houseId, houses);
                      const hb = findHouse(best.houseId, houses);
                      const targetH =
                        empty[0] && (ha && dist(c, empty[0]) < dist(c, ha) * 1.2 ? empty[0] : (empty[0] ?? null)) ||
                        (ha && hb ? (dist(c, ha) <= dist(c, hb) ? ha : hb) : (ha ?? hb));
                      if (targetH) {
                        // Remove both from any prior house residency.
                        for (const h of houses) {
                          h.residentIds = h.residentIds.filter((id) => id !== c.id && id !== best.id);
                        }
                        c.houseId = targetH.id;
                        best.houseId = targetH.id;
                        targetH.residentIds.push(c.id, best.id);
                      }
                      c.bonds = {};
                      best.bonds = {};
                      statsRef.current.proposalsAccepted++;
                      addLog(`${c.name} and ${best.name} are now partners`, hueToRgb(c.hue));
                    } else {
                      c.bonds[best.id] = (c.bonds[best.id] ?? 0) * (1 - BOND_REJECTION_PENALTY);
                      best.bonds[c.id] = (best.bonds[c.id] ?? 0) * (1 - BOND_REJECTION_PENALTY);
                      c.lastCourtTick = tick;
                      best.lastCourtTick = tick;
                      statsRef.current.proposalsRejected++;
                      addLog(`${best.name} rejected ${c.name}'s proposal`, hueToRgb(best.hue));
                    }
                    c.state = 'court';
                  }
                  continue;
                }
                // Move toward best to keep bonding.
                c.state = 'bond';
                stepToward(c, best, 0.7);
                continue;
              }
            }
          }

          // Priority 5: family pantry low — forage. Couples that have
          // already mated and singles that have no candidate near them
          // fall here.
          const familyRaw = home?.raw ?? 0;
          if (
            home &&
            familyRaw < FORAGE_TRIGGER_RAW &&
            c.carrying < CARRY_CAPACITY &&
            c.stamina > LOW_STAMINA &&
            c.stage !== 'elder'
          ) {
            const f = nearest(c, food);
            if (f) {
              if (dist(c, f) < c.size + f.size + 3) {
                c.carrying = Math.min(CARRY_CAPACITY, c.carrying + 1);
                foodRef.current = food.filter((x) => x !== f);
                c.state = 'forage';
              } else {
                c.state = 'forage';
                stepToward(c, f);
              }
              continue;
            }
            // No food in the world right now — fall through to other behaviors.
          }

          // Priority 6: stamina low — rest.
          if (c.stamina < LOW_STAMINA) {
            c.state = 'rest';
            wanderStep(c);
            continue;
          }

          // Priority 7: role-specific work.
          c.state = 'work';
          performRoleWork(c, creatures, houses, schools, food, tick);

          if (c.state === 'work' || c.state === 'wander') {
            wanderStep(c);
          }
        }

        // ── Cleanup: cull dead, food, etc. ─────────────────────────
        const aliveBefore = creatures.length;
        creaturesRef.current = creatures.filter((c) => {
          const dead = c.energy <= 0 || c.age >= c.maxAge;
          if (dead) {
            statsRef.current.died++;
            addLog(`${c.name} (${Math.round(c.age / 60)}s) has died`, hueToRgb(c.hue));
            // Free partner.
            if (c.partnerId) {
              const p = creatures.find((o) => o.id === c.partnerId);
              if (p) p.partnerId = null;
            }
            // Drop from house residents.
            if (c.houseId) {
              const h = houses.find((hh) => hh.id === c.houseId);
              if (h) h.residentIds = h.residentIds.filter((id) => id !== c.id);
            }
          }
          return !dead;
        });
        if (creaturesRef.current.length !== aliveBefore) {
          // No-op marker; useful if you want to debug pop drops.
        }

        // Spawn food.
        if (food.length < MAX_FOOD && Math.random() < FOOD_SPAWN_RATE) {
          food.push(createFood());
        }
      }
    };

    // ──────────────────────────────────────────────────────────────────
    // ROLE WORK ACTIONS
    // ──────────────────────────────────────────────────────────────────
    const performRoleWork = (
      c: Creature,
      creatures: Creature[],
      houses: House[],
      schools: School[],
      food: Food[],
      tick: number,
    ) => {
      const home = findHouse(c.houseId, houses);

      switch (c.role) {
        case 'farmer': {
          // Plant a herb on cooldown if energy/stamina ok.
          if (c.abilityCooldown <= 0 && food.length < MAX_FOOD) {
            food.push(createFood({
              x: c.x + (Math.random() - 0.5) * 80,
              y: c.y + (Math.random() - 0.5) * 80,
              type: 'herb',
            }));
            c.abilityCooldown = abilityCooldownTicks('farmer', c.abilityValue);
          }
          break;
        }
        case 'cocinero': {
          // Cook only when at home.
          if (!home) break;
          if (dist(c, home) > home.radius - 5) {
            stepToward(c, home);
            break;
          }
          const last = lastCookRef.current[c.id] ?? 0;
          if (
            tick - last >= COOK_INTERVAL_TICKS &&
            home.raw >= COOK_RAW_PER_COOKED &&
            home.cooked < HOUSE_COOKED_CAP
          ) {
            home.raw -= COOK_RAW_PER_COOKED;
            home.cooked += 1;
            lastCookRef.current[c.id] = tick;
            statsRef.current.totalCooked++;
          }
          break;
        }
        case 'healer': {
          // Healing is a deliberate, costly act: it drains the healer's
          // work bar (stamina) and they must rest before doing it again.
          // This stops the healer from dominating the event log and makes
          // each heal feel like a real intervention.
          if (c.abilityCooldown > 0) break;
          if (c.stamina < 28) break; // Too tired — rest first.

          const target = nearest(c, creatures, (o) =>
            o !== c && o.energy < 55 && o.energy > 0 && dist(c, o) < 220,
          );
          if (target) {
            const d = dist(c, target);
            if (d > 30) {
              stepToward(c, target);
            } else {
              const heal = 12 * c.abilityValue;
              target.energy = Math.min(target.maxEnergy, target.energy + heal);
              c.energy -= 4;
              c.stamina = Math.max(0, c.stamina - 25); // The big change.
              c.abilityCooldown = abilityCooldownTicks('healer', c.abilityValue);
              addLog(`${c.name} healed ${target.name} (+${Math.round(heal)})`, hueToRgb(c.hue));
            }
          }
          break;
        }
        case 'builder': {
          // Build a new house only when there's actual housing pressure, and
          // place it where the map is sparsest so houses don't cluster around
          // the builder's own corner.
          const last = lastBuildRef.current[c.id] ?? -10000;
          if (tick - last < 60 * 30) break; // 30s minimum between builds
          const adultsCount = creatures.filter((o) => o.stage === 'adult').length;
          const housesCount = houses.length;
          const schoolsCount = schools.length;
          const childrenCount = creatures.filter((o) => o.stage === 'child').length;

          // Don't build extra houses if a substantial chunk are sitting empty.
          const emptyHouses = houses.filter((h) => h.residentIds.length === 0).length;
          const wantHouse = adultsCount > housesCount * 2 && emptyHouses < 2;
          const wantSchool = childrenCount > schoolsCount * 3;

          // Pick the sparsest spot on a coarse grid as the build target.
          const pickSparseSpot = (others: { x: number; y: number }[]): { x: number; y: number } => {
            let bestX = c.x, bestY = c.y, bestD = 0;
            for (let gx = 100; gx <= CANVAS_W - 100; gx += 80) {
              for (let gy = 100; gy <= CANVAS_H - 100; gy += 80) {
                let minD = Infinity;
                for (const o of others) {
                  const d = Math.hypot(gx - o.x, gy - o.y);
                  if (d < minD) minD = d;
                }
                if (minD > bestD) {
                  bestD = minD;
                  bestX = gx;
                  bestY = gy;
                }
              }
            }
            return { x: bestX, y: bestY };
          };

          if (wantHouse) {
            const spot = pickSparseSpot(houses);
            houses.push(createHouse(c.id, spot.x, spot.y, tick));
            lastBuildRef.current[c.id] = tick;
            statsRef.current.housesBuilt++;
            addLog(`${c.name} built a new house`, hueToRgb(c.hue));
          } else if (wantSchool) {
            const spot = pickSparseSpot([...houses, ...schools]);
            schools.push(createSchool(c.id, spot.x, spot.y, tick));
            lastBuildRef.current[c.id] = tick;
            statsRef.current.schoolsBuilt++;
            addLog(`${c.name} built a school`, hueToRgb(c.hue));
          }
          break;
        }
        case 'teacher': {
          // Walk to the closest school with a free teacher slot.
          const target = nearest(c, schools, (sc) => sc.teacherIds.length < SCHOOL_TEACHER_CAP);
          if (target) {
            if (dist(c, target) > target.radius - 5) {
              stepToward(c, target);
            } else {
              if (target.teacherIds.length < SCHOOL_TEACHER_CAP) {
                target.teacherIds.push(c.id);
              }
              // Teach passively while at school — count students.
              for (const studentId of target.studentIds) {
                const st = creatures.find((cr) => cr.id === studentId);
                if (st && st.education < EDUCATION_CAP) {
                  st.education = Math.min(EDUCATION_CAP, st.education + EDUCATION_PER_CLASS / 60);
                  st.learnFlash = 30;
                  if (Math.random() < 0.005) {
                    statsRef.current.classesGiven++;
                    addLog(`${c.name} taught ${st.name}`, hueToRgb(c.hue));
                  }
                }
              }
              wanderStep(c);
            }
          }
          break;
        }
      }
    };

    // ──────────────────────────────────────────────────────────────────
    // RENDER
    // ──────────────────────────────────────────────────────────────────

    const drawFood = (f: Food, tick: number) => {
      const pulse = Math.sin(f.pulse + tick * 0.04) * 1.5;
      const r = f.size + pulse;
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.type === 'fruit') {
        const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
        g.addColorStop(0, '#ff6b6b');
        g.addColorStop(1, '#c0392b');
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
        g.addColorStop(0, '#2ecc71');
        g.addColorStop(1, '#16a085');
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.7, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.7, 0);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.restore();
    };

    const drawHouse = (h: House, tick: number) => {
      const pulse = Math.sin(h.pulse + tick * 0.02) * 1.5;
      ctx.save();
      ctx.translate(h.x, h.y);

      // Floor disc — filled, denser than P3 nests.
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h.radius);
      g.addColorStop(0, 'rgba(255, 176, 32, 0.2)');
      g.addColorStop(1, 'rgba(255, 176, 32, 0.04)');
      ctx.beginPath();
      ctx.arc(0, 0, h.radius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      // Border ring.
      ctx.beginPath();
      ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 176, 32, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Roof icon.
      ctx.fillStyle = 'rgba(255, 220, 130, 0.85)';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏠', 0, 0);

      // Inventory chips.
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`R ${h.raw}`, -h.radius + 6, h.radius - 16);
      ctx.fillStyle = 'rgba(168, 255, 43, 0.85)';
      ctx.fillText(`C ${h.cooked}`, -h.radius + 6, h.radius - 4);

      ctx.restore();
    };

    const drawSchool = (sc: School, tick: number) => {
      const pulse = Math.sin(sc.pulse + tick * 0.03) * 1.5;
      ctx.save();
      ctx.translate(sc.x, sc.y);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sc.radius);
      g.addColorStop(0, 'rgba(0, 229, 255, 0.18)');
      g.addColorStop(1, 'rgba(0, 229, 255, 0.02)');
      ctx.beginPath();
      ctx.arc(0, 0, sc.radius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, sc.radius, 0, Math.PI * 2);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(150, 220, 255, 0.85)';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📚', 0, 0);
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,229,255,0.7)';
      ctx.fillText(`T ${sc.teacherIds.length}/${SCHOOL_TEACHER_CAP}  S ${sc.studentIds.length}/${SCHOOL_STUDENT_CAP}`, -sc.radius + 6, sc.radius - 4);
      ctx.restore();
    };

    const drawCreature = (c: Creature, tick: number) => {
      const isSelected = selectedRef.current?.id === c.id;
      const energyRatio = c.energy / c.maxEnergy;
      const stamRatio = c.stamina / c.maxStamina;
      const eduRatio = c.education / EDUCATION_CAP;

      if (isSelected) {
        drawSelectionRing(ctx, { cx: c.x, cy: c.y, size: c.size, tick });
      }

      drawCreatureBody(ctx, {
        cx: c.x, cy: c.y, size: c.size, hue: c.hue, pulsePhase: c.pulsePhase,
      });

      // State badges.
      if (c.state === 'reproduce' || c.state === 'court') {
        drawCreatureBadge(ctx, { cx: c.x, cy: c.y, size: c.size, text: '♥', color: '#ff69b4' });
      } else if (c.state === 'eat') {
        drawCreatureBadge(ctx, { cx: c.x, cy: c.y, size: c.size, text: '✦', color: '#44ff44' });
      } else if (c.state === 'forage' || c.state === 'return') {
        drawCreatureBadge(ctx, { cx: c.x, cy: c.y, size: c.size, text: '!', color: '#ffb020' });
      } else if (c.state === 'school' && c.stage === 'child' && c.learnFlash > 0) {
        drawCreatureBadge(ctx, { cx: c.x, cy: c.y, size: c.size, text: '✦', color: '#00e5ff' });
      } else if (c.state === 'barter') {
        drawCreatureBadge(ctx, { cx: c.x, cy: c.y, size: c.size, text: '⇄', color: '#a8ff2b' });
      }

      // Partner ring marker — small static below the body.
      if (c.partnerId) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(c.x, c.y - c.size - 14, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff2bd6';
        ctx.shadowColor = '#ff2bd6';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
      }

      // Carrying indicator — small dots above the head if carrying.
      if (c.carrying > 0) {
        ctx.save();
        ctx.fillStyle = '#a8ff2b';
        for (let i = 0; i < c.carrying; i++) {
          ctx.beginPath();
          ctx.arc(c.x - 6 + i * 6, c.y - c.size - 22, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      drawCreatureFace(ctx, {
        cx: c.x, cy: c.y, size: c.size, hue: c.hue,
        eyeAngle: c.eyeAngle, blinkTimer: c.blinkTimer,
        mood: moodForState(c.state, c.energy),
      });

      // Energy bar.
      drawCreatureBar(ctx, { cx: c.x, cy: c.y, size: c.size, ratio: energyRatio, color: 'energy' });
      // Stamina bar (only adults/elders).
      if (c.stage !== 'child') {
        drawCreatureBar(ctx, { cx: c.x, cy: c.y, size: c.size, ratio: stamRatio, color: 'stamina', yOffset: 11 });
      } else if (c.education > 0) {
        drawCreatureBar(ctx, { cx: c.x, cy: c.y, size: c.size, ratio: eduRatio, color: 'education', yOffset: 11 });
      }

      if (isSelected) {
        drawCreatureLabel(ctx, { cx: c.x, cy: c.y, size: c.size, text: c.name });
      }
    };

    const render = () => {
      const tick = tickRef.current;
      ctx.drawImage(bgCanvas, 0, 0);
      for (const sc of schoolsRef.current) drawSchool(sc, tick);
      for (const h of housesRef.current) drawHouse(h, tick);
      for (const f of foodRef.current) drawFood(f, tick);
      for (const c of creaturesRef.current) drawCreature(c, tick);

      if (tick % 30 === 0) {
        setDisplayTick(tick);
        const cs = creaturesRef.current;
        const next: SimStats = {
          alive: cs.length,
          children: cs.filter((c) => c.stage === 'child').length,
          adults: cs.filter((c) => c.stage === 'adult').length,
          elders: cs.filter((c) => c.stage === 'elder').length,
          farmers: cs.filter((c) => c.role === 'farmer').length,
          cocineros: cs.filter((c) => c.role === 'cocinero').length,
          healers: cs.filter((c) => c.role === 'healer').length,
          builders: cs.filter((c) => c.role === 'builder').length,
          teachers: cs.filter((c) => c.role === 'teacher').length,
          food: foodRef.current.length,
          houses: housesRef.current.length,
          schools: schoolsRef.current.length,
          partnered: cs.filter((c) => c.partnerId).length,
          singles: cs.filter((c) => c.stage !== 'child' && !c.partnerId).length,
          born: statsRef.current.born,
          died: statsRef.current.died,
          proposalsAccepted: statsRef.current.proposalsAccepted,
          proposalsRejected: statsRef.current.proposalsRejected,
          housesBuilt: statsRef.current.housesBuilt,
          schoolsBuilt: statsRef.current.schoolsBuilt,
          totalCooked: statsRef.current.totalCooked,
          totalBartered: statsRef.current.totalBartered,
          classesGiven: statsRef.current.classesGiven,
        };
        setStats(next);
        if (selectedRef.current) {
          const found = creaturesRef.current.find((c) => c.id === selectedRef.current!.id);
          if (found) {
            setSelected({ ...found });
            const partner = found.partnerId
              ? creaturesRef.current.find((c) => c.id === found.partnerId)
              : null;
            setSelectedPartnerName(partner?.name ?? null);
          } else {
            setSelected(null);
            setSelectedPartnerName(null);
            selectedRef.current = null;
          }
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
  // These use functional setState so rapid double-clicks actually cycle.
  // Closure-captured state was making consecutive clicks look like no-ops.
  const togglePause = () => {
    runningRef.current = !runningRef.current;
    setRunning(runningRef.current);
  };
  const cycleSpeed = () => {
    setSpeed((prev) => {
      const next = prev === 1 ? 2 : prev === 2 ? 4 : 1;
      speedRef.current = next;
      return next;
    });
  };
  const addCreature = () => {
    creaturesRef.current.push(createCreature({
      stage: 'adult',
      role: 'farmer',
    }));
    addLog('A new adult joined the world');
  };
  const addFood = () => {
    for (let i = 0; i < 5; i++) foodRef.current.push(createFood());
    addLog('Food rained');
  };
  const reset = () => {
    const { creatures, houses, schools } = buildInitialWorld();
    creaturesRef.current = creatures;
    housesRef.current = houses;
    schoolsRef.current = schools;
    foodRef.current = Array.from({ length: INITIAL_FOOD }, () => createFood());
    tickRef.current = 0;
    statsRef.current = {
      born: 0, died: 0, proposalsAccepted: 0, proposalsRejected: 0,
      housesBuilt: 0, schoolsBuilt: 0, totalCooked: 0, totalBartered: 0,
      classesGiven: 0,
    };
    lastCookRef.current = {};
    lastBuildRef.current = {};
    setSelected(null);
    selectedRef.current = null;
    addLog('World reset');
  };

  const exportLog = () => {
    downloadText(
      `family-bonds-log-${timestamp()}.txt`,
      logsToText('Phase 04 — Family Bonds log', logRef.current),
    );
  };

  const saveState = () => {
    const state: FamilyBondsSavedState = {
      version: 1,
      savedAt: timestamp(),
      tick: tickRef.current,
      stats,
      creatures: creaturesRef.current,
      food: foodRef.current,
      houses: housesRef.current,
      schools: schoolsRef.current,
    };
    downloadText(
      `family-bonds-${timestamp()}.txt`,
      stateToText('Phase 04 — Family Bonds', state),
    );
  };

  const loadState = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const state = parseStateText<FamilyBondsSavedState>(text);
      if (state.version !== 1) throw new Error('Unsupported version');
      const wasRunning = runningRef.current;
      runningRef.current = false;
      creaturesRef.current = state.creatures;
      foodRef.current = state.food;
      housesRef.current = state.houses ?? [];
      schoolsRef.current = state.schools ?? [];
      tickRef.current = state.tick ?? 0;
      setSelected(null);
      selectedRef.current = null;
      addLog('Loaded state');
      runningRef.current = wasRunning;
      setRunning(wasRunning);
    } catch (err) {
      addLog(`Failed to load: ${(err as Error).message}`);
    }
  };

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
    const partner = nearest?.partnerId
      ? creaturesRef.current.find((c) => c.id === nearest!.partnerId)
      : null;
    setSelectedPartnerName(partner?.name ?? null);
  };

  return (
    <div className="sim-screen family-bonds-root">
      <aside className="sim-screen__rail sim-screen__rail--left">
        <PopulationPanel stats={stats} />
        <RolesPanel stats={stats} />
      </aside>

      <main className="sim-screen__main">
        <header className="sim-title">
          <div>
            <div className="tick uc sim-title__eyebrow">Phase 04 · Family Bonds</div>
            <h2 className="sim-title__h2">
              <span>Family </span>
              <span className="sim-title__accent">Bonds</span>
            </h2>
            <p className="sim-title__sub">
              Couples form, families grow, only your partner can be the parent of your children.
            </p>
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
              <span className="sim-viewport__code">· VPT-04</span>
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
              <div className="sim-viewport__overlay sim-viewport__overlay--tr">SECTOR · FAMILY-04</div>
              <div className="sim-viewport__overlay sim-viewport__overlay--bl">T+{String(displayTick).padStart(5, '0')}</div>
              <div className="sim-viewport__overlay sim-viewport__overlay--br">LIVE · {String(stats.alive).padStart(2, '0')} ENTITIES</div>
            </div>
          </div>
        </section>

        <section className="hud sim-controls">
          <button className="btn btn--primary" onClick={togglePause}>{running ? '❚❚ Pause' : '▶ Resume'}</button>
          <button className="btn" onClick={cycleSpeed}>× {speed}× → {speed === 1 ? 2 : speed === 2 ? 4 : 1}×</button>
          <span className="sim-controls__divider" />
          <button className="btn" onClick={addCreature}>+ Adult</button>
          <button className="btn" onClick={addFood}>+ Food</button>
          <span className="sim-controls__divider" />
          <button className="btn" onClick={exportLog}>↓ Export logs</button>
          <button className="btn" onClick={saveState}>■ Save state</button>
          <button className="btn" onClick={loadState}>□ Load state</button>
          <span className="sim-controls__spacer" />
          <button className="btn btn--danger" onClick={reset}>↺ Reset</button>
        </section>

        <section className="hud sim-diag">
          <Cell label="Population" value={stats.alive} />
          <Cell label="Houses" value={stats.houses} />
          <Cell label="Births" value={stats.born} />
          <Cell label="Deaths" value={stats.died} />
          <Cell label="Partnered" value={`${stats.partnered}/${stats.adults + stats.elders}`} />
        </section>
      </main>

      <aside className="sim-screen__rail sim-screen__rail--right">
        <SelectionPanel selected={selected} partnerName={selectedPartnerName} />
        <EventsPanel log={log} tick={displayTick} />
      </aside>
    </div>
  );
}

// ── Side panels ──────────────────────────────────────────────────────────

function Cell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="sim-diag__cell">
      <div className="tick uc sim-diag__label">{label}</div>
      <div className="sim-diag__value">{value}</div>
    </div>
  );
}

function PopulationPanel({ stats }: { stats: SimStats }) {
  return (
    <div className="hud brackets sim-panel">
      <div className="hud__header">
        <div className="sim-panel__head-left"><span className="dot" /><span>POPULATION</span><span className="sim-panel__code">· POP-04</span></div>
        <div className="sim-panel__head-right">CAP {MAX_POPULATION}</div>
      </div>
      <div className="hud__body">
        <div className="stat"><span className="stat__label">Alive</span><span className="stat__value stat__value--cyan">{stats.alive}</span></div>
        <div className="stat"><span className="stat__label">— children</span><span className="stat__value">{stats.children}</span></div>
        <div className="stat"><span className="stat__label">— adults</span><span className="stat__value">{stats.adults}</span></div>
        <div className="stat"><span className="stat__label">— elders</span><span className="stat__value">{stats.elders}</span></div>
        <div className="stat"><span className="stat__label">Partnered</span><span className="stat__value stat__value--magenta">{stats.partnered}</span></div>
        <div className="stat"><span className="stat__label">Singles</span><span className="stat__value">{stats.singles}</span></div>
        <div className="stat"><span className="stat__label">Houses</span><span className="stat__value stat__value--amber">{stats.houses}</span></div>
        <div className="stat"><span className="stat__label">Schools</span><span className="stat__value">{stats.schools}</span></div>
      </div>
    </div>
  );
}

function RolesPanel({ stats }: { stats: SimStats }) {
  const roles: { role: Role; count: number; }[] = [
    { role: 'farmer', count: stats.farmers },
    { role: 'cocinero', count: stats.cocineros },
    { role: 'healer', count: stats.healers },
    { role: 'builder', count: stats.builders },
    { role: 'teacher', count: stats.teachers },
  ];
  return (
    <div className="hud brackets sim-panel">
      <div className="hud__header">
        <div className="sim-panel__head-left"><span className="dot" /><span>ROLES</span><span className="sim-panel__code">· RLS-04</span></div>
      </div>
      <div className="hud__body">
        {roles.map(({ role, count }) => (
          <div className="stat" key={role}>
            <span className="stat__label">
              <span className="swatch" style={{ background: hueToRgb(ROLE_HUE[role]) }} />
              {ROLE_ICON[role]} {ROLE_LABEL[role]}
            </span>
            <span className="stat__value">{count}</span>
          </div>
        ))}
        <div className="stat"><span className="stat__label">Cooked total</span><span className="stat__value stat__value--lime">{stats.totalCooked}</span></div>
        <div className="stat"><span className="stat__label">Bartered</span><span className="stat__value stat__value--lime">{stats.totalBartered}</span></div>
      </div>
    </div>
  );
}

function SelectionPanel({ selected, partnerName }: { selected: Creature | null; partnerName: string | null }) {
  if (!selected) {
    return (
      <div className="hud brackets sim-panel">
        <div className="hud__header">
          <div className="sim-panel__head-left"><span className="dot" /><span>INSPECTOR</span><span className="sim-panel__code">· INS-04</span></div>
        </div>
        <div className="hud__body">
          <div className="muted mono" style={{ fontSize: 11 }}>// click a creature on the grid to inspect</div>
        </div>
      </div>
    );
  }
  const c = selected;
  const swatchColor = c.role ? hueToRgb(ROLE_HUE[c.role]) : '#ffd57a';
  return (
    <div className="hud brackets sim-panel">
      <div className="hud__header">
        <div className="sim-panel__head-left"><span className="dot" /><span>INSPECTOR</span><span className="sim-panel__code">· INS-04</span></div>
      </div>
      <div className="hud__body">
        <div className="sim-sel__head">
          <div className="sim-sel__swatch" style={{ background: swatchColor, color: swatchColor }} />
          <div>
            <div className="sim-sel__name">{c.name}</div>
            <div className="sim-sel__role">
              {c.stage === 'child' ? '🐣 child' : c.role ? `${ROLE_ICON[c.role]} ${ROLE_LABEL[c.role]}` : 'unknown'}
              {c.stage === 'elder' ? ' · elder' : ''}
            </div>
          </div>
        </div>
        <div className="sim-sel__body">
          <div className="stat"><span className="stat__label">State</span><span className="stat__value">{c.state}</span></div>
          <div className="stat"><span className="stat__label">Generation</span><span className="stat__value">{c.generation}</span></div>
          <div className="stat"><span className="stat__label">Age</span><span className="stat__value">{Math.round(c.age / 60)}s</span></div>
          <div className="stat"><span className="stat__label">Energy</span><span className="stat__value">{Math.round(c.energy)}</span></div>
          <div className="stat"><span className="stat__label">Stamina</span><span className="stat__value">{Math.round(c.stamina)}</span></div>
          <div className="stat"><span className="stat__label">Children</span><span className="stat__value">{c.children}</span></div>
          {partnerName ? (
            <div className="stat"><span className="stat__label">Partner</span><span className="stat__value stat__value--magenta">{partnerName}</span></div>
          ) : (
            <div className="stat"><span className="stat__label">Partner</span><span className="stat__value">—</span></div>
          )}
          <div className="stat"><span className="stat__label">Carisma</span><span className="stat__value">{c.personality.carisma}</span></div>
          <div className="stat"><span className="stat__label">Empatía</span><span className="stat__value">{c.personality.empatia}</span></div>
          <div className="stat"><span className="stat__label">Ingenio</span><span className="stat__value">{c.personality.ingenio}</span></div>
          {c.stage === 'child' ? (
            <div className="stat"><span className="stat__label">Education</span><span className="stat__value stat__value--amber">{Math.round(c.education * 100)}%</span></div>
          ) : null}
          {c.carrying > 0 ? (
            <div className="stat"><span className="stat__label">Carrying</span><span className="stat__value stat__value--lime">{c.carrying}</span></div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EventsPanel({ log, tick }: { log: PhaseLogEntry[]; tick: number }) {
  return (
    <div className="hud brackets sim-panel">
      <div className="hud__header">
        <div className="sim-panel__head-left"><span className="dot" /><span>EVENT LOG</span><span className="sim-panel__code">· LOG-04</span></div>
        <div className="sim-panel__head-right">{log.length} entries</div>
      </div>
      <div className="hud__body">
        <div className="sim-events">
          {log.length === 0 ? <div className="sim-events__empty">// no events yet</div> :
            log.map((e, i) => (
              <div className="sim-event" key={`${e.t}-${i}`}>
                <span className="sim-event__t">T+{String(Math.max(0, tick - (log.length - i) * 30)).padStart(4, '0')}</span>
                <span
                  className="sim-event__icon"
                  style={e.color ? { color: e.color, textShadow: `0 0 6px ${e.color}` } : undefined}
                >●</span>
                <span className="sim-event__text">{e.msg}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
