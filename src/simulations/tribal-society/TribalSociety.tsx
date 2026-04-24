import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ADULT_DURATION,
  CANVAS_H,
  CANVAS_W,
  CHILD_DRAIN_MULT,
  CHILD_HUE,
  CHILD_SIZE_MULT,
  CHILD_SPEED_MULT,
  EDUCATION_CAP,
  EDUCATION_PER_CLASS,
  ELDER_DRAIN_MULT,
  ELDER_PRODUCTION_MULT,
  ELDER_SIZE_MULT,
  ENERGY_DRAIN_BASE,
  ENERGY_DRAIN_WORK,
  INITIAL_FOOD,
  LOW_ENERGY,
  LOW_STAMINA,
  MATE_CONTACT_RADIUS,
  MATE_SEEK_RADIUS,
  MAX_FOOD,
  MAX_NESTS,
  MAX_POPULATION,
  NEST_MATE_SEEK_MULT,
  NEST_STAMINA_MULT,
  REPRODUCE_COOLDOWN,
  REPRODUCE_COST_ENERGY,
  REPRODUCE_COST_STAMINA,
  REPRODUCE_ENERGY,
  REPRODUCE_STAMINA,
  REST_EXIT_STAMINA,
  ROLES,
  SERVICE_SEEK_RADIUS,
  ROLE_DESC,
  ROLE_HUE,
  ROLE_ICON,
  ROLE_LABEL,
  STAMINA_DRAIN_WORK,
  STAMINA_RECOVER_IDLE,
  STAMINA_RECOVER_REST,
  TEACHER_REACH,
  abilityCooldownTicks,
  ascendToAdult,
  buildInitialPopulation,
  canDoUsefulWork,
  canEat,
  clamp,
  createBaby,
  createCreature,
  createFood,
  createNest,
  creatureInsideNest,
  descendToElder,
  dist,
  hueToRgb,
} from './helpers';
import type {
  Creature,
  Food,
  LogEntry,
  Nest,
  Role,
  SavedState,
  SimStats,
} from './types';
import {
  downloadText,
  logsToText,
  parseStateText,
  pickTextFile,
  stateToText,
  timestamp,
} from '../../lib/persistence';
import './TribalSociety.css';

export default function TribalSociety() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const creaturesRef = useRef<Creature[]>([]);
  const foodRef = useRef<Food[]>([]);
  const nestsRef = useRef<Nest[]>([]);
  const animRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const statsRef = useRef({
    born: 0,
    died: 0,
    totalEaten: 0,
    foodProduced: 0,
    classesGiven: 0,
    nestsBuilt: 0,
  });

  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<SimStats>({
    alive: 0,
    children: 0,
    adults: 0,
    elders: 0,
    farmers: 0,
    harvesters: 0,
    healers: 0,
    builders: 0,
    teachers: 0,
    food: 0,
    nests: 0,
    born: 0,
    died: 0,
    totalEaten: 0,
    foodProduced: 0,
    classesGiven: 0,
    nestsBuilt: 0,
  });
  const [selected, setSelected] = useState<Creature | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const selectedRef = useRef<Creature | null>(null);
  const logRef = useRef<LogEntry[]>([]);
  const runningRef = useRef(true);
  const speedRef = useRef(1);

  const addLog = useCallback((msg: string) => {
    logRef.current = [{ msg, t: Date.now() }, ...logRef.current].slice(0, 500);
    setLog([...logRef.current.slice(0, 30)]);
  }, []);

  // ----- Init -----
  useEffect(() => {
    creaturesRef.current = buildInitialPopulation();
    const initialFood: Food[] = [];
    for (let i = 0; i < INITIAL_FOOD; i++) {
      initialFood.push(createFood({ type: Math.random() < 0.6 ? 'herb' : 'fruit' }));
    }
    foodRef.current = initialFood;

    addLog('🌍 A tribal society takes shape');
    addLog('👥 11 adults (3🌱 · 3🧺 · 2💊 · 1🛖 · 2📚) + 5 children');
  }, [addLog]);

  // ----- Game loop -----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const applyAbility = (c: Creature) => {
      const prodMult = c.stage === 'elder' ? ELDER_PRODUCTION_MULT : 1;

      switch (c.role) {
        case 'farmer': {
          if (foodRef.current.length >= MAX_FOOD) return;
          const fx = clamp(c.x + (Math.random() - 0.5) * 100, 10, CANVAS_W - 10);
          const fy = clamp(c.y + (Math.random() - 0.5) * 100, 10, CANVAS_H - 10);
          foodRef.current.push(createFood({ x: fx, y: fy, type: 'herb' }));
          statsRef.current.foodProduced++;
          addLog(`🌱 ${c.name} planted a herb`);
          break;
        }
        case 'harvester': {
          if (foodRef.current.length >= MAX_FOOD) return;
          const dirX = Math.random() < 0.5 ? -1 : 1;
          const dirY = Math.random() < 0.5 ? -1 : 1;
          const offX = dirX * (60 + Math.random() * 50);
          const offY = dirY * (60 + Math.random() * 50);
          const fx = clamp(c.x + offX, 10, CANVAS_W - 10);
          const fy = clamp(c.y + offY, 10, CANVAS_H - 10);
          foodRef.current.push(createFood({ x: fx, y: fy, type: 'fruit' }));
          statsRef.current.foodProduced++;
          addLog(`🍎 ${c.name} grew a fruit`);
          break;
        }
        case 'healer': {
          // Heal the weakest nearby — never yourself. Wider reach and a
          // more generous threshold so healers buffer the cross-feeding gaps.
          let target: Creature | null = null;
          let td = Infinity;
          for (const o of creaturesRef.current) {
            if (o.id === c.id) continue;
            if (o.energy >= 70) continue;
            const d = dist(c, o);
            if (d < 140 && d < td) { td = d; target = o; }
          }
          if (target) {
            const heal = (6 + c.abilityValue * 3) * prodMult;
            target.energy = Math.min(target.maxEnergy, target.energy + heal);
            // Healers get a tiny "helper's high" back (net positive contributor).
            c.energy = Math.min(c.maxEnergy, c.energy + 3);
            addLog(`💊 ${c.name} healed ${target.name} (+${Math.round(heal)})`);
          }
          break;
        }
        case 'builder': {
          const nest = createNest(c, tickRef.current);
          nestsRef.current.push(nest);
          if (nestsRef.current.length > MAX_NESTS) nestsRef.current.shift();
          statsRef.current.nestsBuilt++;
          addLog(`🛖 ${c.name} built a nest`);
          break;
        }
        case 'teacher': {
          // Find the nearest child and give them a class.
          let pupil: Creature | null = null;
          let pd = Infinity;
          for (const o of creaturesRef.current) {
            if (o.id === c.id) continue;
            if (o.stage !== 'child') continue;
            const d = dist(c, o);
            if (d < TEACHER_REACH && d < pd) { pd = d; pupil = o; }
          }
          if (pupil) {
            const gained = EDUCATION_PER_CLASS * c.abilityValue * prodMult;
            pupil.education = Math.min(EDUCATION_CAP, pupil.education + gained);
            pupil.learnFlash = 40;
            statsRef.current.classesGiven++;
            addLog(`📚 ${c.name} taught ${pupil.name} (+${gained.toFixed(2)} edu)`);
          }
          break;
        }
        default:
          break;
      }
    };

    const update = () => {
      if (!runningRef.current) return;
      const spd = speedRef.current;
      for (let s = 0; s < spd; s++) {
        tickRef.current++;
        const creatures = creaturesRef.current;
        const food = foodRef.current;

        const newCreatures: Creature[] = [];
        const reproducedThisTick = new Set<string>();

        for (const c of creatures) {
          c.age++;
          c.pulsePhase += 0.05;
          c.blinkTimer--;
          if (c.blinkTimer <= 0) c.blinkTimer = 100 + Math.random() * 200;
          if (c.learnFlash > 0) c.learnFlash--;

          // ----- Life-stage transitions -----
          if (c.stage === 'child' && c.age >= c.adultAge) {
            const { educated } = ascendToAdult(c, creatures);
            const eduTag = educated ? '🎓' : '📖❌';
            addLog(
              `${eduTag} ${c.name} became an adult · ${ROLE_ICON[c.role!]} ${ROLE_LABEL[c.role!]} · lvl ${c.abilityValue.toFixed(2)}`
            );
          } else if (c.stage === 'adult' && c.age >= c.elderAge) {
            descendToElder(c);
            addLog(`👴 ${c.name} became an elder · ${c.role ? ROLE_ICON[c.role] : ''}`);
          }

          // ----- Sense food (respecting diet restrictions) -----
          const perception = 130;
          let nearestFood: Food | null = null;
          let nearestFoodDist = Infinity;
          for (const f of food) {
            if (!canEat(c, f)) continue;
            const d = dist(c, f);
            if (d < nearestFoodDist && d < perception) {
              nearestFoodDist = d;
              nearestFood = f;
            }
          }

          // ----- Nest (builders can't benefit from their own) -----
          const nest = creatureInsideNest(c, nestsRef.current);
          const nestStaminaBoost = nest ? NEST_STAMINA_MULT : 1;

          // ----- Decide next state -----
          const isChild = c.stage === 'child';
          const isElder = c.stage === 'elder';
          const hungry = c.energy <= LOW_ENERGY;
          const wasResting = c.state === 'rest';
          const needsRest = wasResting ? c.stamina < REST_EXIT_STAMINA : c.stamina <= LOW_STAMINA;

          // Children and elders can't reproduce. Adults have a cooldown so
          // they don't breed every few seconds into starvation.
          const canReproduce =
            !isChild &&
            !isElder &&
            !reproducedThisTick.has(c.id) &&
            c.energy >= REPRODUCE_ENERGY &&
            c.stamina >= REPRODUCE_STAMINA &&
            tickRef.current - c.lastReproduceTick >= REPRODUCE_COOLDOWN &&
            creaturesRef.current.length + newCreatures.length < MAX_POPULATION;

          // Children never work. Teachers/healers only work if there's
          // something to do (don't drain stamina on a phantom shift).
          const canWork =
            !isChild &&
            c.stamina > 22 &&
            c.energy > 32 &&
            canDoUsefulWork(c, creatures);

          let nextState: Creature['state'] = 'wander';
          let partner: Creature | null = null;
          let mateTarget: Creature | null = null;
          // Movement target when seeking a service (food, healer, or nest).
          let seekTarget: { x: number; y: number } | null = null;

          if (hungry) {
            if (nearestFood) {
              nextState = 'seek';
              seekTarget = nearestFood;
            } else {
              // No food nearby — look for a healer to walk toward.
              let healer: Creature | null = null;
              let hd = Infinity;
              for (const o of creatures) {
                if (o.id === c.id) continue;
                if (o.role !== 'healer') continue;
                if (o.stage === 'child') continue;
                const d = dist(c, o);
                if (d < hd && d < SERVICE_SEEK_RADIUS) { hd = d; healer = o; }
              }
              if (healer) {
                nextState = 'seek';
                seekTarget = healer;
              }
            }
          } else if (needsRest) {
            nextState = 'rest';
          } else if (canReproduce) {
            const seekRadius = nest ? MATE_SEEK_RADIUS * NEST_MATE_SEEK_MULT : MATE_SEEK_RADIUS;
            let nearestMateDist = Infinity;
            for (const o of creatures) {
              if (o.id === c.id) continue;
              if (o.stage !== 'adult') continue;
              if (reproducedThisTick.has(o.id)) continue;
              if (o.energy < REPRODUCE_ENERGY) continue;
              if (o.stamina < REPRODUCE_STAMINA) continue;
              if (tickRef.current - o.lastReproduceTick < REPRODUCE_COOLDOWN) continue;
              const d = dist(c, o);
              if (d < MATE_CONTACT_RADIUS) { partner = o; break; }
              if (d < nearestMateDist && d < seekRadius) {
                nearestMateDist = d;
                mateTarget = o;
              }
            }
            if (partner) nextState = 'reproduce';
            else if (mateTarget) nextState = 'reproduce';
            else if (canWork) nextState = 'work';
          } else if (canWork) {
            nextState = 'work';
          }

          c.state = nextState;

          switch (nextState) {
            case 'seek': {
              const target = seekTarget ?? nearestFood;
              if (target) {
                const angle = Math.atan2(target.y - c.y, target.x - c.x);
                c.vx += Math.cos(angle) * c.speed * 0.17;
                c.vy += Math.sin(angle) * c.speed * 0.17;
                c.eyeAngle = angle;
              }
              c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_IDLE * 0.5 * nestStaminaBoost);
              break;
            }
            case 'rest': {
              if (!nest) {
                // Not in a nest yet — if there's one in range, walk toward it.
                let targetNest: Nest | null = null;
                let nd = Infinity;
                for (const n of nestsRef.current) {
                  if (n.builderId === c.id) continue;
                  const d = dist(c, n);
                  if (d < nd && d < SERVICE_SEEK_RADIUS) { nd = d; targetNest = n; }
                }
                if (targetNest) {
                  const angle = Math.atan2(targetNest.y - c.y, targetNest.x - c.x);
                  c.vx += Math.cos(angle) * c.speed * 0.13;
                  c.vy += Math.sin(angle) * c.speed * 0.13;
                  c.eyeAngle = angle;
                  c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_IDLE);
                } else {
                  c.vx *= 0.88;
                  c.vy *= 0.88;
                  c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_REST);
                }
              } else {
                c.vx *= 0.88;
                c.vy *= 0.88;
                c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_REST * nestStaminaBoost);
              }
              break;
            }
            case 'reproduce': {
              if (partner) {
                const baby = createBaby(c, partner);
                c.energy -= REPRODUCE_COST_ENERGY;
                partner.energy -= REPRODUCE_COST_ENERGY;
                c.stamina -= REPRODUCE_COST_STAMINA;
                partner.stamina -= REPRODUCE_COST_STAMINA;
                c.lastReproduceTick = tickRef.current;
                partner.lastReproduceTick = tickRef.current;
                c.children++;
                partner.children++;
                reproducedThisTick.add(c.id);
                reproducedThisTick.add(partner.id);
                newCreatures.push(baby);
                statsRef.current.born++;
                addLog(`🐣 ${baby.name} was born · gen ${baby.generation}`);
              } else if (mateTarget) {
                const angle = Math.atan2(mateTarget.y - c.y, mateTarget.x - c.x);
                c.vx += Math.cos(angle) * c.speed * 0.15;
                c.vy += Math.sin(angle) * c.speed * 0.15;
                c.eyeAngle = angle;
              }
              break;
            }
            case 'work': {
              c.stamina = Math.max(0, c.stamina - STAMINA_DRAIN_WORK);
              c.abilityCooldown--;
              if (c.abilityCooldown <= 0) {
                applyAbility(c);
                c.abilityCooldown = abilityCooldownTicks(c.role!, c.abilityValue);
              }
              c.vx += (Math.random() - 0.5) * 0.2;
              c.vy += (Math.random() - 0.5) * 0.2;
              c.eyeAngle = Math.atan2(c.vy, c.vx);
              break;
            }
            case 'wander':
            default: {
              c.vx += (Math.random() - 0.5) * 0.3;
              c.vy += (Math.random() - 0.5) * 0.3;
              c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_IDLE * nestStaminaBoost);
              c.eyeAngle = Math.atan2(c.vy, c.vx);
              break;
            }
          }

          // ----- Energy drain (stage-adjusted) -----
          const stageDrainMult = isChild ? CHILD_DRAIN_MULT : isElder ? ELDER_DRAIN_MULT : 1;
          const drain =
            (ENERGY_DRAIN_BASE + (nextState === 'work' ? ENERGY_DRAIN_WORK : 0) + c.speed * 0.012)
            * stageDrainMult;
          c.energy -= drain;

          // ----- Eat if touching an eatable food -----
          if (nearestFood && nearestFoodDist < c.size + nearestFood.size) {
            c.energy = Math.min(c.maxEnergy, c.energy + nearestFood.energy);
            c.state = 'eat';
            const idx = food.indexOf(nearestFood);
            if (idx > -1) food.splice(idx, 1);
            statsRef.current.totalEaten++;
          }

          // ----- Velocity clamping & movement -----
          const stageSpeedMult = isChild ? CHILD_SPEED_MULT : 1; // elders already baked into c.speed
          const maxV = c.speed * 1.5 * (nextState === 'rest' ? 0.3 : 1) * stageSpeedMult;
          const v = Math.sqrt(c.vx ** 2 + c.vy ** 2);
          if (v > maxV) {
            c.vx = (c.vx / v) * maxV;
            c.vy = (c.vy / v) * maxV;
          }
          c.vx *= 0.97;
          c.vy *= 0.97;
          c.x += c.vx;
          c.y += c.vy;

          if (c.x < c.size) { c.x = c.size; c.vx *= -0.7; }
          if (c.x > CANVAS_W - c.size) { c.x = CANVAS_W - c.size; c.vx *= -0.7; }
          if (c.y < c.size) { c.y = c.size; c.vy *= -0.7; }
          if (c.y > CANVAS_H - c.size) { c.y = CANVAS_H - c.size; c.vy *= -0.7; }
        }

        creaturesRef.current = creatures.filter((c) => {
          // Death: starvation OR old age.
          const diedOfAge = c.age >= c.maxAge;
          const starved = c.energy <= 0;
          if (starved || diedOfAge) {
            statsRef.current.died++;
            const cause = diedOfAge ? 'old age' : 'hunger';
            const roleTag = c.role ? `${ROLE_ICON[c.role]} ${ROLE_LABEL[c.role]}` : '👶 Child';
            addLog(`💀 ${c.name} died of ${cause} · ${roleTag} · age ${Math.floor(c.age / 60)}s`);
            if (selectedRef.current?.id === c.id) {
              setSelected(null);
              selectedRef.current = null;
            }
            return false;
          }
          return true;
        });

        if (newCreatures.length) creaturesRef.current.push(...newCreatures);
      }
    };

    // ----- Pre-rendered backdrop -----
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_W;
    bgCanvas.height = CANVAS_H;
    const bgCtx = bgCanvas.getContext('2d')!;
    const bgGrad = bgCtx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, '#0a1a2e');
    bgGrad.addColorStop(0.5, '#0e2339');
    bgGrad.addColorStop(1, '#0a1c2c');
    bgCtx.fillStyle = bgGrad;
    bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    bgCtx.fillStyle = 'rgba(120,200,255,0.06)';
    for (let x = 20; x < CANVAS_W; x += 30) {
      for (let y = 20; y < CANVAS_H; y += 30) {
        bgCtx.beginPath();
        bgCtx.arc(x, y, 1, 0, Math.PI * 2);
        bgCtx.fill();
      }
    }

    const drawFood = (f: Food, tick: number) => {
      const pulse = Math.sin(f.pulse + tick * 0.04) * 1.5;
      const s = f.size + pulse;

      ctx.save();
      ctx.translate(f.x, f.y);

      if (f.type === 'fruit') {
        const body = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s);
        body.addColorStop(0, '#ff8b8b');
        body.addColorStop(0.55, '#e04747');
        body.addColorStop(1, '#8c2424');
        ctx.beginPath();
        ctx.arc(0, s * 0.1, s, 0, Math.PI * 2);
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = '#5a3a1e';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.85);
        ctx.lineTo(s * 0.15, -s * 1.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(s * 0.35, -s * 1.0, s * 0.32, s * 0.14, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#3fa55a';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-s * 0.35, -s * 0.25, s * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.3);
        g.addColorStop(0, '#6bdf8f');
        g.addColorStop(1, '#1d6a3e');
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,60,35,0.5)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.9);
        ctx.lineTo(0, s * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-s * 0.2, -s * 0.2, s * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
      }

      ctx.restore();
    };

    const drawNest = (n: Nest, tick: number) => {
      const pulse = Math.sin(n.pulse + tick * 0.02) * 3;
      const r = n.radius + pulse;
      ctx.save();
      ctx.translate(n.x, n.y);
      const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      glow.addColorStop(0, 'hsla(275,70%,65%,0.22)');
      glow.addColorStop(0.55, 'hsla(275,70%,55%,0.1)');
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'hsla(275,70%,70%,0.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -tick * 0.15;
      ctx.stroke();
      ctx.setLineDash([]);
      const hs = 7;
      ctx.fillStyle = 'hsla(275,55%,70%,0.7)';
      ctx.beginPath();
      ctx.moveTo(-hs, 2);
      ctx.lineTo(0, -hs);
      ctx.lineTo(hs, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'hsla(275,45%,55%,0.7)';
      ctx.fillRect(-hs * 0.75, 1, hs * 1.5, hs * 0.7);
      ctx.restore();
    };

    const drawRoleGlyph = (role: Role, size: number) => {
      ctx.save();
      ctx.translate(0, -size * 1.55);
      const s = size * 0.5;
      switch (role) {
        case 'farmer':
          ctx.fillStyle = '#7ae587';
          ctx.beginPath();
          ctx.ellipse(0, 0, s * 0.7, s * 0.35, -0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'harvester':
          ctx.fillStyle = '#f3a86b';
          ctx.beginPath();
          ctx.moveTo(-s * 0.6, -s * 0.3);
          ctx.lineTo(s * 0.6, -s * 0.3);
          ctx.lineTo(0, s * 0.45);
          ctx.closePath();
          ctx.fill();
          break;
        case 'healer':
          ctx.fillStyle = '#6de4f2';
          ctx.fillRect(-s * 0.6, -s * 0.14, s * 1.2, s * 0.28);
          ctx.fillRect(-s * 0.14, -s * 0.6, s * 0.28, s * 1.2);
          break;
        case 'builder':
          ctx.fillStyle = '#c9a6ff';
          ctx.beginPath();
          ctx.moveTo(-s * 0.55, s * 0.1);
          ctx.lineTo(0, -s * 0.55);
          ctx.lineTo(s * 0.55, s * 0.1);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#7a5ab0';
          ctx.fillRect(-s * 0.42, s * 0.05, s * 0.84, s * 0.25);
          break;
        case 'teacher':
          // Small open book.
          ctx.fillStyle = '#ff9ed8';
          ctx.beginPath();
          ctx.moveTo(-s * 0.55, -s * 0.35);
          ctx.lineTo(-s * 0.05, -s * 0.2);
          ctx.lineTo(-s * 0.05, s * 0.45);
          ctx.lineTo(-s * 0.55, s * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(s * 0.55, -s * 0.35);
          ctx.lineTo(s * 0.05, -s * 0.2);
          ctx.lineTo(s * 0.05, s * 0.45);
          ctx.lineTo(s * 0.55, s * 0.3);
          ctx.closePath();
          ctx.fill();
          break;
      }
      ctx.restore();
    };

    const drawCreature = (c: Creature, tick: number) => {
      const isSelected = selectedRef.current?.id === c.id;
      const isChild = c.stage === 'child';
      const isElder = c.stage === 'elder';
      const pulse = Math.sin(c.pulsePhase) * 2;
      const sizeMult = isChild ? CHILD_SIZE_MULT : isElder ? ELDER_SIZE_MULT : 1;
      const bodySize = (c.size + pulse) * sizeMult;
      const energyRatio = c.energy / c.maxEnergy;
      const staminaRatio = c.stamina / c.maxStamina;
      const isBlink = c.blinkTimer < 8;

      ctx.save();
      ctx.translate(c.x, c.y);

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(0, 0, bodySize + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,150,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -tick * 0.1;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Shadow
      ctx.beginPath();
      ctx.ellipse(0, bodySize * 0.6, bodySize * 0.8, bodySize * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fill();

      // Aura — bright role-colored glow while working; dim while resting.
      const isWorking = c.state === 'work';
      const isResting = c.state === 'rest';
      const glowRadius = isWorking ? bodySize * 3.4 : isResting ? bodySize * 1.4 : bodySize * 2;
      const glowAlpha = isWorking
        ? 0.55 + Math.sin(c.pulsePhase * 1.6) * 0.12
        : isResting
          ? 0.06
          : 0.22;
      const glow = ctx.createRadialGradient(0, 0, bodySize * 0.2, 0, 0, glowRadius);
      glow.addColorStop(0, `hsla(${c.hue},85%,65%,${glowAlpha})`);
      glow.addColorStop(0.45, `hsla(${c.hue},75%,55%,${glowAlpha * 0.45})`);
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Body color — desaturated for children and elders.
      const sat = isChild ? 25 : isElder ? 38 : 75;
      const light = isChild ? 78 : isElder ? 58 : 55;
      ctx.beginPath();
      ctx.arc(0, 0, bodySize, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(-bodySize * 0.3, -bodySize * 0.3, 0, 0, 0, bodySize);
      if (isChild) {
        grad.addColorStop(0, `hsla(${c.hue},${sat + 5}%,${light + 10}%,1)`);
        grad.addColorStop(0.6, `hsla(${c.hue},${sat}%,${light}%,1)`);
        grad.addColorStop(1, `hsla(${c.hue},${sat - 5}%,${light - 25}%,1)`);
      } else if (isElder) {
        grad.addColorStop(0, `hsla(${c.hue},${sat + 10}%,${light + 8}%,1)`);
        grad.addColorStop(0.6, `hsla(${c.hue},${sat}%,${light}%,1)`);
        grad.addColorStop(1, `hsla(${c.hue},${sat}%,${light - 20}%,1)`);
      } else {
        grad.addColorStop(0, `hsla(${c.hue},80%,75%,1)`);
        grad.addColorStop(0.6, hueToRgb(c.hue));
        grad.addColorStop(1, `hsla(${c.hue},60%,32%,1)`);
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = `hsla(${c.hue},55%,30%,0.6)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Elder: little white hair tuft on top
      if (isElder) {
        ctx.fillStyle = 'rgba(240,240,240,0.85)';
        ctx.beginPath();
        ctx.ellipse(0, -bodySize * 0.85, bodySize * 0.45, bodySize * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Role glyph above head (adults & elders only — children have no role)
      if (!isChild && c.role) drawRoleGlyph(c.role, bodySize);

      // Learning sparkle on children who just took a class
      if (isChild && c.learnFlash > 0) {
        ctx.fillStyle = `rgba(255,245,150,${0.2 + c.learnFlash / 80})`;
        ctx.font = `bold ${Math.round(bodySize * 0.9)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('✦', 0, -bodySize - 8);
      }

      // State indicator (non-rapid states only)
      if (c.state === 'seek') {
        ctx.fillStyle = '#ff6464';
        ctx.font = `bold ${Math.round(bodySize * 0.85)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', bodySize * 0.95, -bodySize - 5);
      } else if (c.state === 'reproduce') {
        ctx.fillStyle = '#ff7fbb';
        ctx.font = `${Math.round(bodySize * 0.75)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('♥', bodySize * 0.95, -bodySize - 5);
      } else if (c.state === 'eat') {
        ctx.fillStyle = '#55ff66';
        ctx.font = `${Math.round(bodySize * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('✦', bodySize * 0.95, -bodySize - 5);
      }

      // Eyes
      const eyeDist = bodySize * 0.35;
      const eyeSize = bodySize * (isChild ? 0.34 : 0.28);
      const lookX = Math.cos(c.eyeAngle) * eyeSize * 0.3;
      const lookY = Math.sin(c.eyeAngle) * eyeSize * 0.3;
      for (const side of [-1, 1]) {
        const ex = side * eyeDist;
        const ey = -bodySize * 0.1;
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeSize, isBlink ? eyeSize * 0.1 : eyeSize, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        if (!isBlink) {
          ctx.beginPath();
          ctx.arc(ex + lookX, ey + lookY, eyeSize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = '#111';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex + lookX - eyeSize * 0.15, ey + lookY - eyeSize * 0.15, eyeSize * 0.18, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fill();
        }
      }

      // Mouth
      ctx.beginPath();
      if (c.state === 'eat') {
        ctx.arc(0, bodySize * 0.25, bodySize * 0.2, 0, Math.PI);
      } else if (c.energy < 20) {
        ctx.arc(0, bodySize * 0.35, bodySize * 0.15, Math.PI, 0);
      } else {
        ctx.arc(0, bodySize * 0.2, bodySize * 0.15, 0.1, Math.PI - 0.1);
      }
      ctx.strokeStyle = `hsla(${c.hue},40%,25%,0.7)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Bars (energy + stamina)
      const barW = bodySize * 2;
      const barH = 3;
      const barY = bodySize + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = `hsl(${120 * energyRatio},85%,50%)`;
      ctx.fillRect(-barW / 2, barY, barW * energyRatio, barH);

      const stamY = barY + barH + 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-barW / 2, stamY, barW, barH - 1);
      ctx.fillStyle = `hsla(45,90%,${35 + staminaRatio * 20}%,0.95)`;
      ctx.fillRect(-barW / 2, stamY, barW * staminaRatio, barH - 1);

      if (isSelected) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = "bold 10px 'Courier New', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(c.name, 0, stamY + 14);
      }

      ctx.restore();
    };

    const render = () => {
      const tick = tickRef.current;
      ctx.drawImage(bgCanvas, 0, 0);

      for (let i = 0; i < 15; i++) {
        const px = (tick * 0.2 + i * 97) % CANVAS_W;
        const py = ((Math.sin(tick * 0.01 + i) * 50 + i * 37) % CANVAS_H + CANVAS_H) % CANVAS_H;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100,200,255,${0.05 + Math.sin(tick * 0.03 + i) * 0.03})`;
        ctx.fill();
      }

      for (const n of nestsRef.current) drawNest(n, tick);
      for (const f of foodRef.current) drawFood(f, tick);
      for (const c of creaturesRef.current) drawCreature(c, tick);

      if (tick % 30 === 0) {
        let children = 0, adults = 0, elders = 0;
        let farmers = 0, harvesters = 0, healers = 0, builders = 0, teachers = 0;
        for (const c of creaturesRef.current) {
          if (c.stage === 'child') children++;
          else if (c.stage === 'adult') adults++;
          else elders++;
          if (c.role === 'farmer') farmers++;
          else if (c.role === 'harvester') harvesters++;
          else if (c.role === 'healer') healers++;
          else if (c.role === 'builder') builders++;
          else if (c.role === 'teacher') teachers++;
        }
        setStats({
          alive: creaturesRef.current.length,
          children, adults, elders,
          farmers, harvesters, healers, builders, teachers,
          food: foodRef.current.length,
          nests: nestsRef.current.length,
          born: statsRef.current.born,
          died: statsRef.current.died,
          totalEaten: statsRef.current.totalEaten,
          foodProduced: statsRef.current.foodProduced,
          classesGiven: statsRef.current.classesGiven,
          nestsBuilt: statsRef.current.nestsBuilt,
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

  // ----- UI handlers -----
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    let clicked: Creature | null = null;
    for (const c of creaturesRef.current) {
      if (dist({ x: mx, y: my }, c) < c.size + 5) { clicked = c; break; }
    }
    selectedRef.current = clicked;
    setSelected(clicked ? { ...clicked } : null);
  };

  const addChild = () => {
    if (creaturesRef.current.length >= MAX_POPULATION) {
      addLog('⚠️ Population cap reached');
      return;
    }
    const c = createCreature({ stage: 'child' });
    creaturesRef.current.push(c);
    addLog(`👶 ${c.name} appeared as a child`);
  };

  const addAdult = () => {
    if (creaturesRef.current.length >= MAX_POPULATION) {
      addLog('⚠️ Population cap reached');
      return;
    }
    const role = ROLES[Math.floor(Math.random() * ROLES.length)];
    const c = createCreature({ stage: 'adult', role });
    creaturesRef.current.push(c);
    addLog(`🧑 ${c.name} appeared · ${ROLE_ICON[role]} ${ROLE_LABEL[role]}`);
  };

  const addFoodBurst = () => {
    for (let i = 0; i < 8; i++) foodRef.current.push(createFood({ type: 'herb' }));
    for (let i = 0; i < 4; i++) foodRef.current.push(createFood({ type: 'fruit' }));
    addLog('🌿 Food rain!');
  };

  const toggleRunning = () => {
    runningRef.current = !runningRef.current;
    setRunning((r) => !r);
  };

  const changeSpeed = () => {
    const next = speedRef.current === 1 ? 2 : speedRef.current === 2 ? 4 : 1;
    speedRef.current = next;
    setSpeed(next);
  };

  // ----- Persistence -----
  const exportLogs = () => {
    const text = logsToText('Sim World — Phase 3: Tribal Society (events)', logRef.current);
    downloadText(`sim-tribalsociety-logs-${timestamp()}.txt`, text);
  };

  const saveState = () => {
    const state: SavedState = {
      version: 1,
      savedAt: new Date().toISOString(),
      tick: tickRef.current,
      stats: { ...statsRef.current },
      creatures: creaturesRef.current,
      food: foodRef.current,
      nests: nestsRef.current,
    };
    downloadText(
      `sim-tribalsociety-state-${timestamp()}.txt`,
      stateToText('tribal-society', state)
    );
    addLog('💾 State exported to file');
  };

  const loadState = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const state = parseStateText<SavedState>(text);
      if (state.version !== 1) throw new Error(`unsupported version ${state.version}`);
      const wasRunning = runningRef.current;
      runningRef.current = false;
      creaturesRef.current = state.creatures;
      foodRef.current = state.food;
      nestsRef.current = state.nests ?? [];
      tickRef.current = state.tick ?? 0;
      statsRef.current = { ...state.stats };
      setSelected(null);
      selectedRef.current = null;
      addLog(`📥 Loaded state: ${state.creatures.length} creatures, ${state.food.length} food, ${nestsRef.current.length} nests`);
      runningRef.current = wasRunning;
      setRunning(wasRunning);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`⚠️ Failed to load state: ${msg}`);
    }
  };

  return (
    <div className="sim-page">
      <Link to="/" className="back-link">← Back to menu</Link>

      <header className="sim-header">
        <div>
          <span className="eyebrow mono">Phase 03</span>
          <h1 className="sim-h1">
            Tribal <span className="gradient-text">Society</span>
          </h1>
          <p className="muted sim-tag">
            Five roles, specialized diets, ages, and teachers. Click a creature to inspect it.
          </p>
        </div>
      </header>

      <div className="sim-layout">
        <div className="sim-canvas-col">
          <div className="canvas-wrap glass">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onClick={handleCanvasClick}
              className="sim-canvas"
            />
          </div>

          <div className="control-row">
            <button className="glass-btn" onClick={toggleRunning} data-variant={running ? undefined : 'accent'}>
              {running ? '⏸ Pause' : '▶ Resume'}
            </button>
            <button className="glass-btn" onClick={changeSpeed}>⚡ ×{speed}</button>
            <button className="glass-btn" onClick={addChild}>👶 + Child</button>
            <button className="glass-btn" onClick={addAdult}>🧑 + Adult</button>
            <button className="glass-btn" onClick={addFoodBurst}>🌿 + Food</button>
            <span className="control-spacer" />
            <button className="glass-btn" onClick={exportLogs}>📝 Export logs</button>
            <button className="glass-btn" onClick={saveState}>💾 Save state</button>
            <button className="glass-btn" onClick={loadState}>📥 Load state</button>
          </div>
        </div>

        <aside className="sim-side">
          <section className="glass glass-blur side-card">
            <h3 className="side-title">Population · cap {MAX_POPULATION}</h3>
            <StatRow icon="👥" label="Alive" value={stats.alive} color="#60a5fa" />
            <StatRow icon="👶" label="Children" value={stats.children} color="#fbbf24" />
            <StatRow icon="🧑" label="Adults" value={stats.adults} color="#60a5fa" />
            <StatRow icon="👴" label="Elders" value={stats.elders} color="#cbd5e1" />
            <StatRow icon="🐣" label="Births" value={stats.born} color="#f472b6" />
            <StatRow icon="💀" label="Deaths" value={stats.died} color="#f87171" last />
          </section>

          <section className="glass glass-blur side-card">
            <h3 className="side-title">Production</h3>
            <StatRow icon="🌿" label="Food" value={stats.food} color="#34d399" />
            <StatRow icon="🍽" label="Meals" value={stats.totalEaten} color="#fbbf24" />
            <StatRow icon="🌾" label="Produced" value={stats.foodProduced} color="#c084fc" />
            <StatRow icon="📚" label="Classes" value={stats.classesGiven} color="#ff9ed8" />
            <StatRow icon="🛖" label="Nests" value={`${stats.nests} (${stats.nestsBuilt} built)`} color="#a78bfa" last />
          </section>

          <section className="glass glass-blur side-card roles-card">
            <h3 className="side-title">Roles · adults &amp; elders</h3>
            {ROLES.map((role, i) => (
              <div
                key={role}
                className="role-row"
                style={{ borderBottom: i === ROLES.length - 1 ? 'none' : undefined }}
              >
                <span
                  className="role-swatch"
                  style={{ background: hueToRgb(ROLE_HUE[role]), color: hueToRgb(ROLE_HUE[role]) }}
                />
                <div>
                  <div className="role-name">
                    {ROLE_ICON[role]} {ROLE_LABEL[role]}
                  </div>
                  <div className="role-hint">{ROLE_DESC[role]}</div>
                </div>
                <div className="role-count" style={{ color: hueToRgb(ROLE_HUE[role]) }}>
                  {role === 'farmer' ? stats.farmers
                    : role === 'harvester' ? stats.harvesters
                    : role === 'healer' ? stats.healers
                    : role === 'builder' ? stats.builders
                    : stats.teachers}
                </div>
              </div>
            ))}
          </section>

          {selected && (
            <section
              className="glass glass-blur side-card"
              style={{ borderColor: `hsla(${selected.hue},60%,55%,0.5)` }}
            >
              <div
                className="selected-badge"
                style={{ color: selected.role ? hueToRgb(ROLE_HUE[selected.role]) : '#cbd5e1' }}
              >
                {stageLabel(selected)}
              </div>
              <div
                className="selected-name"
                style={{ color: selected.stage === 'child' ? hueToRgb(CHILD_HUE) : hueToRgb(selected.hue) }}
              >
                {selected.name}
              </div>
              <div className="selected-stats">
                <BarRow label="Energy" value={selected.energy} max={selected.maxEnergy} color={selected.energy > 40 ? '#34d399' : '#f87171'} />
                <BarRow label="Stamina" value={selected.stamina} max={selected.maxStamina} color="#fbbf24" />
                {selected.stage === 'child' && (
                  <BarRow
                    label="Education"
                    value={selected.education}
                    max={EDUCATION_CAP}
                    color="#ff9ed8"
                  />
                )}
                {selected.role && <Row k="Ability lvl" v={selected.abilityValue.toFixed(2)} />}
                <Row k="Age" v={`${Math.floor(selected.age / 60)}s / ${Math.floor(selected.maxAge / 60)}s`} />
                <Row k="Generation" v={selected.generation} />
                <Row k="Children" v={selected.children} />
                <Row k="State" v={
                  <span style={{ color: stateColor(selected.state) }}>{stateLabel2(selected.state)}</span>
                } />
              </div>
            </section>
          )}

          <section className="glass glass-blur side-card events-card">
            <h3 className="side-title">Events</h3>
            <div className="events-scroll">
              {log.slice(0, 30).map((l, i) => (
                <div key={i} className="event-line" style={{ opacity: Math.max(0.55, 1 - i * 0.012) }}>
                  {l.msg}
                </div>
              ))}
              {log.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No events yet.</div>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// Silence unused-import noise when ADULT_DURATION is only documentation.
void ADULT_DURATION;

function StatRow({ icon, label, value, color, last }: {
  icon: string; label: string; value: number | string; color: string; last?: boolean;
}) {
  return (
    <div className="stat-row" style={{ borderBottom: last ? 'none' : undefined }}>
      <span className="stat-label">{icon} {label}</span>
      <span className="stat-value" style={{ color }}>{value}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="row">
      <span className="row-k">{k}</span>
      <span className="row-v">{v}</span>
    </div>
  );
}

function BarRow({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const ratio = Math.max(0, Math.min(1, value / max));
  return (
    <div className="row" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span className="row-k">{label}</span>
        <span className="row-v">{Math.round(value * 100) / 100}</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ background: color, width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function stageLabel(c: Creature): string {
  if (c.stage === 'child') return '👶 Child';
  const roleBadge = c.role ? `${ROLE_ICON[c.role]} ${ROLE_LABEL[c.role]}` : '';
  if (c.stage === 'elder') return `👴 Elder · ${roleBadge}`;
  return `🧑 Adult · ${roleBadge}`;
}

function stateLabel2(s: Creature['state']): string {
  switch (s) {
    case 'seek': return '🔍 Seeking food';
    case 'reproduce': return '💕 Reproducing';
    case 'eat': return '🍽 Eating';
    case 'rest': return '💤 Resting';
    case 'work': return '⚙ Working';
    default: return '🚶 Wandering';
  }
}

function stateColor(s: Creature['state']): string {
  switch (s) {
    case 'seek': return '#f87171';
    case 'reproduce': return '#f472b6';
    case 'eat': return '#34d399';
    case 'rest': return '#cbd5e1';
    case 'work': return '#fbbf24';
    default: return '#94a3b8';
  }
}
