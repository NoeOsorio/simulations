import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  ENERGY_DRAIN_BASE,
  ENERGY_DRAIN_WORK,
  INITIAL_FOOD,
  LOW_ENERGY,
  LOW_STAMINA,
  MATE_CONTACT_RADIUS,
  MATE_SEEK_RADIUS,
  MATURE_AGE,
  MAX_FOOD,
  MAX_NESTS,
  NEST_MATE_SEEK_MULT,
  NEST_STAMINA_MULT,
  REPRODUCE_COST_ENERGY,
  REPRODUCE_COST_STAMINA,
  REPRODUCE_ENERGY,
  REPRODUCE_STAMINA,
  REST_EXIT_STAMINA,
  ROLES,
  ROLE_DESC,
  ROLE_HUE,
  ROLE_ICON,
  ROLE_LABEL,
  STAMINA_DRAIN_WORK,
  STAMINA_RECOVER_IDLE,
  STAMINA_RECOVER_REST,
  abilityCooldownTicks,
  buildInitialPopulation,
  clamp,
  createChild,
  createCreature,
  createFood,
  createNest,
  creatureInsideNest,
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
import './SkillEcosystem.css';

const PHASE_ACCENT = '#a8ff2b'; // lime

export default function SkillEcosystem() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const creaturesRef = useRef<Creature[]>([]);
  const foodRef = useRef<Food[]>([]);
  const nestsRef = useRef<Nest[]>([]);
  const animRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const statsRef = useRef({ born: 0, died: 0, totalEaten: 0, foodProduced: 0, nestsBuilt: 0 });

  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [stats, setStats] = useState<SimStats>({
    alive: 0,
    food: 0,
    farmers: 0,
    harvesters: 0,
    healers: 0,
    builders: 0,
    nests: 0,
    born: 0,
    died: 0,
    totalEaten: 0,
    foodProduced: 0,
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
    const food: Food[] = [];
    for (let i = 0; i < INITIAL_FOOD; i++) food.push(createFood());
    foodRef.current = food;

    addLog('🌍 A society takes shape');
    addLog(`👥 ${creaturesRef.current.length} creatures: 4 farmers, 3 harvesters, 3 healers, 2 builders`);
  }, [addLog]);

  // ----- Game loop -----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const applyAbility = (c: Creature) => {
      switch (c.role) {
        case 'farmer': {
          if (foodRef.current.length >= MAX_FOOD) return;
          const fx = clamp(c.x + (Math.random() - 0.5) * 100, 10, CANVAS_W - 10);
          const fy = clamp(c.y + (Math.random() - 0.5) * 100, 10, CANVAS_H - 10);
          foodRef.current.push(createFood({ x: fx, y: fy, type: 'leaf' }));
          statsRef.current.foodProduced++;
          addLog(`🌱 ${c.name} planted a herb`);
          break;
        }
        case 'harvester': {
          if (foodRef.current.length >= MAX_FOOD) return;
          // Fruit spawns 60–110px away so the harvester can't just eat
          // their own crops — the tribe has to share them.
          const dirX = (Math.random() < 0.5 ? -1 : 1);
          const dirY = (Math.random() < 0.5 ? -1 : 1);
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
          let target: Creature | null = null;
          let td = Infinity;
          for (const o of creaturesRef.current) {
            if (o.id === c.id) continue;
            if (o.energy >= 55) continue;
            const d = dist(c, o);
            if (d < 110 && d < td) { td = d; target = o; }
          }
          if (target) {
            const heal = 6 + c.abilityValue * 3;
            target.energy = Math.min(target.maxEnergy, target.energy + heal);
            // Helping energizes the healer a little — they're a net positive,
            // not a battery that runs down trying to keep others alive.
            c.energy = Math.min(c.maxEnergy, c.energy + 3);
            addLog(`💊 ${c.name} healed ${target.name} (+${Math.round(heal)})`);
          }
          break;
        }
        case 'builder': {
          // Builders plop down a new nest at their location. Enforce a global
          // cap so the map doesn't get carpeted — oldest nest falls off.
          const nest = createNest(c, tickRef.current);
          nestsRef.current.push(nest);
          if (nestsRef.current.length > MAX_NESTS) nestsRef.current.shift();
          statsRef.current.nestsBuilt++;
          addLog(`🛖 ${c.name} built a nest`);
          break;
        }
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

          const nest = creatureInsideNest(c, nestsRef.current);
          const perception = 130;
          let nearestFood: Food | null = null;
          let nearestFoodDist = Infinity;
          for (const f of food) {
            const d = dist(c, f);
            if (d < nearestFoodDist && d < perception) {
              nearestFoodDist = d;
              nearestFood = f;
            }
          }

          // State decision — with hysteresis on rest so creatures don't
          // flicker between work and rest at the stamina threshold.
          const hungry = c.energy <= LOW_ENERGY;
          const wasResting = c.state === 'rest';
          const needsRest = wasResting ? c.stamina < REST_EXIT_STAMINA : c.stamina <= LOW_STAMINA;
          const canReproduce =
            !reproducedThisTick.has(c.id) &&
            c.energy >= REPRODUCE_ENERGY &&
            c.stamina >= REPRODUCE_STAMINA &&
            c.age >= MATURE_AGE;
          const canWork = c.stamina > 22 && c.energy > 32;

          let nextState: Creature['state'] = 'wander';
          let partner: Creature | null = null;
          let mateTarget: Creature | null = null;

          if (hungry && nearestFood) {
            nextState = 'seek';
          } else if (needsRest) {
            nextState = 'rest';
          } else if (canReproduce) {
            // Inside a nest, mates can be spotted from farther away.
            const seekRadius = nest ? MATE_SEEK_RADIUS * NEST_MATE_SEEK_MULT : MATE_SEEK_RADIUS;
            let nearestMateDist = Infinity;
            for (const o of creatures) {
              if (o.id === c.id) continue;
              if (reproducedThisTick.has(o.id)) continue;
              if (o.age < MATURE_AGE) continue;
              if (o.energy < REPRODUCE_ENERGY) continue;
              if (o.stamina < REPRODUCE_STAMINA) continue;
              const d = dist(c, o);
              if (d < MATE_CONTACT_RADIUS) { partner = o; break; }
              if (d < nearestMateDist && d < seekRadius) {
                nearestMateDist = d;
                mateTarget = o;
              }
            }
            if (partner) nextState = 'reproduce';
            else if (mateTarget) nextState = 'reproduce'; // seeking, not mating yet
            else if (canWork) nextState = 'work';
            else nextState = 'wander';
          } else if (canWork) {
            nextState = 'work';
          }

          c.state = nextState;

          const nestStaminaBoost = nest ? NEST_STAMINA_MULT : 1;

          switch (nextState) {
            case 'seek': {
              const boost = c.role === 'harvester' ? 1.2 : 1;
              const angle = Math.atan2(nearestFood!.y - c.y, nearestFood!.x - c.x);
              c.vx += Math.cos(angle) * c.speed * 0.17 * boost;
              c.vy += Math.sin(angle) * c.speed * 0.17 * boost;
              c.eyeAngle = angle;
              c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_IDLE * 0.5 * nestStaminaBoost);
              break;
            }
            case 'rest': {
              c.vx *= 0.88;
              c.vy *= 0.88;
              c.stamina = Math.min(c.maxStamina, c.stamina + STAMINA_RECOVER_REST * nestStaminaBoost);
              break;
            }
            case 'reproduce': {
              if (partner) {
                const baby = createChild(c, partner);
                c.energy -= REPRODUCE_COST_ENERGY;
                partner.energy -= REPRODUCE_COST_ENERGY;
                c.stamina -= REPRODUCE_COST_STAMINA;
                partner.stamina -= REPRODUCE_COST_STAMINA;
                c.children++;
                partner.children++;
                reproducedThisTick.add(c.id);
                reproducedThisTick.add(partner.id);
                newCreatures.push(baby);
                statsRef.current.born++;
                addLog(
                  `🐣 ${baby.name} born · ${ROLE_ICON[baby.role]} ${ROLE_LABEL[baby.role]} · gen ${baby.generation} · lvl ${baby.abilityValue.toFixed(2)}`
                );
              } else if (mateTarget) {
                // Move toward the far-away mate.
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
                c.abilityCooldown = abilityCooldownTicks(c.role, c.abilityValue);
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

          // Energy drain for this tick
          const drain =
            ENERGY_DRAIN_BASE +
            (nextState === 'work' ? ENERGY_DRAIN_WORK : 0) +
            c.speed * 0.012;
          c.energy -= drain;

          // Any state: if touching food, eat it. Energy gain is just the
          // food's own value now — no more harvester double-dip bonus.
          if (nearestFood && nearestFoodDist < c.size + nearestFood.size) {
            c.energy = Math.min(c.maxEnergy, c.energy + nearestFood.energy);
            c.state = 'eat';
            const idx = food.indexOf(nearestFood);
            if (idx > -1) food.splice(idx, 1);
            statsRef.current.totalEaten++;
          }

          // Velocity clamping
          const maxV = c.speed * 1.5 * (nextState === 'rest' ? 0.3 : 1);
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
          if (c.energy <= 0) {
            statsRef.current.died++;
            addLog(
              `💀 ${c.name} died · ${ROLE_ICON[c.role]} ${ROLE_LABEL[c.role]} · age ${Math.floor(c.age / 60)}s`
            );
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

    // Pre-rendered static backdrop: radial dark void + cyan HUD grid.
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_W;
    bgCanvas.height = CANVAS_H;
    const bgCtx = bgCanvas.getContext('2d')!;
    const bgGrad = bgCtx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, 0,
      CANVAS_W / 2, CANVAS_H / 2, Math.max(CANVAS_W, CANVAS_H) * 0.8
    );
    bgGrad.addColorStop(0, '#0c1420');
    bgGrad.addColorStop(1, '#05070a');
    bgCtx.fillStyle = bgGrad;
    bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Minor 40px grid.
    bgCtx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
    bgCtx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 40) {
      bgCtx.beginPath();
      bgCtx.moveTo(x + 0.5, 0);
      bgCtx.lineTo(x + 0.5, CANVAS_H);
      bgCtx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 40) {
      bgCtx.beginPath();
      bgCtx.moveTo(0, y + 0.5);
      bgCtx.lineTo(CANVAS_W, y + 0.5);
      bgCtx.stroke();
    }
    // Major 200px grid.
    bgCtx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    for (let x = 0; x < CANVAS_W; x += 200) {
      bgCtx.beginPath();
      bgCtx.moveTo(x + 0.5, 0);
      bgCtx.lineTo(x + 0.5, CANVAS_H);
      bgCtx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 200) {
      bgCtx.beginPath();
      bgCtx.moveTo(0, y + 0.5);
      bgCtx.lineTo(CANVAS_W, y + 0.5);
      bgCtx.stroke();
    }

    const drawFood = (f: Food, tick: number) => {
      const pulse = Math.sin(f.pulse + tick * 0.04) * 1.5;
      const s = f.size + pulse;

      ctx.save();
      ctx.translate(f.x, f.y);

      if (f.type === 'rare') {
        // Rare fruit — golden glow + star core
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.6);
        halo.addColorStop(0, 'rgba(255,225,120,0.55)');
        halo.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(0, 0, s * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();
        const core = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s);
        core.addColorStop(0, '#fff6bd');
        core.addColorStop(1, '#d89a3c');
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();
        ctx.strokeStyle = '#b17621';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Sparkle
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(-s * 0.28, -s * 0.28, s * 0.18, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'fruit') {
        // Apple — red/pink round body + stem + leaf
        const body = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s);
        body.addColorStop(0, '#ff8b8b');
        body.addColorStop(0.55, '#e04747');
        body.addColorStop(1, '#8c2424');
        ctx.beginPath();
        ctx.arc(0, s * 0.1, s, 0, Math.PI * 2);
        ctx.fillStyle = body;
        ctx.fill();
        // Stem
        ctx.strokeStyle = '#5a3a1e';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.85);
        ctx.lineTo(s * 0.15, -s * 1.15);
        ctx.stroke();
        // Tiny leaf
        ctx.beginPath();
        ctx.ellipse(s * 0.35, -s * 1.0, s * 0.32, s * 0.14, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#3fa55a';
        ctx.fill();
        // Highlight
        ctx.beginPath();
        ctx.arc(-s * 0.35, -s * 0.25, s * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fill();
      } else {
        // Leaf — green diamond/teardrop
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
        // Vein
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
          // Tiny hut roof: pointed triangle with a square base.
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
      }
      ctx.restore();
    };

    const drawCreature = (c: Creature, tick: number) => {
      const isSelected = selectedRef.current?.id === c.id;
      const pulse = Math.sin(c.pulsePhase) * 2;
      const bodySize = c.size + pulse;
      const energyRatio = c.energy / c.maxEnergy;
      const staminaRatio = c.stamina / c.maxStamina;
      const color = hueToRgb(c.hue);
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

      // Aura: bright role-colored glow while working, dim while resting.
      const isWorking = c.state === 'work';
      const isResting = c.state === 'rest';
      const glowRadius = isWorking ? bodySize * 3.4 : isResting ? bodySize * 1.4 : bodySize * 2;
      const glowAlpha = isWorking
        ? 0.55 + Math.sin(c.pulsePhase * 1.6) * 0.12
        : isResting
          ? 0.06
          : 0.22 + Math.min(0.22, Math.max(0, c.abilityValue - 1) * 0.18);
      const glow = ctx.createRadialGradient(0, 0, bodySize * 0.2, 0, 0, glowRadius);
      glow.addColorStop(0, `hsla(${c.hue},85%,65%,${glowAlpha})`);
      glow.addColorStop(0.45, `hsla(${c.hue},75%,55%,${glowAlpha * 0.45})`);
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Body — dimmed when resting
      ctx.beginPath();
      ctx.arc(0, 0, bodySize, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(-bodySize * 0.3, -bodySize * 0.3, 0, 0, 0, bodySize);
      if (isResting) {
        grad.addColorStop(0, `hsla(${c.hue},40%,55%,1)`);
        grad.addColorStop(0.6, `hsla(${c.hue},40%,38%,1)`);
        grad.addColorStop(1, `hsla(${c.hue},40%,22%,1)`);
      } else {
        grad.addColorStop(0, `hsla(${c.hue},80%,75%,1)`);
        grad.addColorStop(0.6, color);
        grad.addColorStop(1, `hsla(${c.hue},60%,32%,1)`);
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = `hsla(${c.hue},55%,30%,0.6)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Role glyph above head
      drawRoleGlyph(c.role, bodySize);

      // State indicator — only the meaningful, non-rapid states.
      // Work uses the role glow; rest uses the dim body; wander shows nothing.
      const stateGlyphY = -bodySize - 5;
      if (c.state === 'seek') {
        ctx.fillStyle = '#ff6464';
        ctx.font = `bold ${Math.round(bodySize * 0.85)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', bodySize * 0.95, stateGlyphY);
      } else if (c.state === 'reproduce') {
        ctx.fillStyle = '#ff7fbb';
        ctx.font = `${Math.round(bodySize * 0.75)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('♥', bodySize * 0.95, stateGlyphY);
      } else if (c.state === 'eat') {
        ctx.fillStyle = '#55ff66';
        ctx.font = `${Math.round(bodySize * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('✦', bodySize * 0.95, stateGlyphY);
      }

      // Eyes
      const eyeDist = bodySize * 0.35;
      const eyeSize = bodySize * 0.28;
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

      // Energy bar
      const barW = bodySize * 2;
      const barH = 3;
      const barY = bodySize + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = `hsl(${120 * energyRatio},85%,50%)`;
      ctx.fillRect(-barW / 2, barY, barW * energyRatio, barH);

      // Stamina bar
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

    const drawNest = (n: Nest, tick: number) => {
      const pulse = Math.sin(n.pulse + tick * 0.02) * 3;
      const r = n.radius + pulse;
      ctx.save();
      ctx.translate(n.x, n.y);

      // Soft radial glow (purple, same hue family as builders)
      const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      glow.addColorStop(0, 'hsla(275,70%,65%,0.22)');
      glow.addColorStop(0.55, 'hsla(275,70%,55%,0.1)');
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Rim
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'hsla(275,70%,70%,0.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -tick * 0.15;
      ctx.stroke();
      ctx.setLineDash([]);

      // Little hut icon at center
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

    const render = () => {
      const tick = tickRef.current;
      ctx.drawImage(bgCanvas, 0, 0);

      // Ambient drifting particles — mostly invisible but add motion in the void.
      for (let i = 0; i < 15; i++) {
        const px = (tick * 0.2 + i * 97) % CANVAS_W;
        const py = ((Math.sin(tick * 0.01 + i) * 50 + i * 37) % CANVAS_H + CANVAS_H) % CANVAS_H;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100,200,255,${0.05 + Math.sin(tick * 0.03 + i) * 0.03})`;
        ctx.fill();
      }

      // Nests live behind food and creatures so they feel like ground decoration.
      for (const n of nestsRef.current) drawNest(n, tick);
      for (const f of foodRef.current) drawFood(f, tick);
      for (const c of creaturesRef.current) drawCreature(c, tick);

      // HUD corner tick marks (10px L brackets in cyan).
      ctx.save();
      ctx.strokeStyle = 'rgba(0,229,255,0.5)';
      ctx.lineWidth = 1;
      const tl = 10;
      ctx.beginPath();
      ctx.moveTo(0, tl); ctx.lineTo(0, 0); ctx.lineTo(tl, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CANVAS_W - tl, 0); ctx.lineTo(CANVAS_W, 0); ctx.lineTo(CANVAS_W, tl);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H - tl); ctx.lineTo(0, CANVAS_H); ctx.lineTo(tl, CANVAS_H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CANVAS_W - tl, CANVAS_H); ctx.lineTo(CANVAS_W, CANVAS_H); ctx.lineTo(CANVAS_W, CANVAS_H - tl);
      ctx.stroke();
      ctx.restore();

      if (tick % 30 === 0) {
        let farmers = 0, harvesters = 0, healers = 0, builders = 0;
        for (const c of creaturesRef.current) {
          if (c.role === 'farmer') farmers++;
          else if (c.role === 'harvester') harvesters++;
          else if (c.role === 'healer') healers++;
          else if (c.role === 'builder') builders++;
        }
        setStats({
          alive: creaturesRef.current.length,
          food: foodRef.current.length,
          farmers,
          harvesters,
          healers,
          builders,
          nests: nestsRef.current.length,
          born: statsRef.current.born,
          died: statsRef.current.died,
          totalEaten: statsRef.current.totalEaten,
          foodProduced: statsRef.current.foodProduced,
          nestsBuilt: statsRef.current.nestsBuilt,
        });
        setTick(tick);
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
      if (dist({ x: mx, y: my }, c) < c.size + 5) {
        clicked = c;
        break;
      }
    }
    selectedRef.current = clicked;
    setSelected(clicked ? { ...clicked } : null);
  };

  const addCreatureOfRole = (role: Role) => {
    const c = createCreature({ role });
    creaturesRef.current.push(c);
    addLog(`➕ ${c.name} appeared · ${ROLE_ICON[role]} ${ROLE_LABEL[role]} · lvl ${c.abilityValue.toFixed(2)}`);
  };

  const addFoodBurst = () => {
    for (let i = 0; i < 10; i++) foodRef.current.push(createFood());
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
    const text = logsToText('Sim World — Phase 2: Skill Ecosystem (events)', logRef.current);
    downloadText(`sim-skillecosystem-logs-${timestamp()}.txt`, text);
  };

  const saveState = () => {
    const state: SavedState = {
      version: 2,
      savedAt: new Date().toISOString(),
      tick: tickRef.current,
      stats: { ...statsRef.current },
      creatures: creaturesRef.current,
      food: foodRef.current,
      nests: nestsRef.current,
    };
    downloadText(
      `sim-skillecosystem-state-${timestamp()}.txt`,
      stateToText('skill-ecosystem', state)
    );
    addLog('💾 State exported to file');
  };

  const loadState = async () => {
    const text = await pickTextFile();
    if (!text) return;
    try {
      const state = parseStateText<SavedState>(text);
      if (state.version !== 2) throw new Error(`unsupported version ${state.version}`);
      const wasRunning = runningRef.current;
      runningRef.current = false;
      creaturesRef.current = state.creatures;
      foodRef.current = state.food;
      nestsRef.current = state.nests ?? [];
      tickRef.current = state.tick ?? 0;
      statsRef.current = { ...state.stats };
      setSelected(null);
      selectedRef.current = null;
      addLog(`📥 Loaded state with ${state.creatures.length} creatures, ${state.food.length} food, ${nestsRef.current.length} nests`);
      runningRef.current = wasRunning;
      setRunning(wasRunning);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`⚠️ Failed to load state: ${msg}`);
    }
  };

  const aliveCap = 60;
  const netDelta = stats.born - stats.died;

  return (
    <div className="sim-screen">
      <div className="sim-screen__main">
        {/* Title block */}
        <div className="sim-title">
          <div>
            <div className="tick sim-title__eyebrow">▌ PHASE 02 · SKILL ECOSYSTEM</div>
            <h2 className="sim-title__h2">
              Skill <span className="sim-title__accent">Ecosystem</span>
            </h2>
            <p className="sim-title__sub">
              Four specialist roles, limited food, and inheritable skills. Click a creature to inspect it.
            </p>
          </div>
          <div className="sim-title__rate">
            <div className="tick sim-title__rate-label">Tick rate</div>
            <div
              className={
                running
                  ? 'sim-title__rate-value sim-title__rate-value--running'
                  : 'sim-title__rate-value sim-title__rate-value--paused'
              }
            >
              {running ? `${speed.toFixed(1)}×` : 'PAUSED'}
            </div>
          </div>
        </div>

        {/* Viewport */}
        <div className="hud brackets sim-viewport">
          <span className="bk-tr" />
          <span className="bk-bl" />
          <div className="hud__header">
            <div className="sim-viewport__head-left">
              <span className="dot" />
              <span>Live Viewport</span>
              <span className="sim-viewport__code">· VPT-02</span>
            </div>
            <div className="sim-viewport__head-right">
              <span>GRID 40px</span>
              <span className="sim-viewport__rec">● REC</span>
            </div>
          </div>
          <div className="sim-viewport__stage">
            <div className="sim-viewport__canvas-wrap">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                onClick={handleCanvasClick}
                className="sim-viewport__canvas"
              />
              <div className="sim-viewport__overlay sim-viewport__overlay--tl">
                00.00 · 00.00
              </div>
              <div className="sim-viewport__overlay sim-viewport__overlay--tr">
                SECTOR · SKILL-02
              </div>
              <div className="sim-viewport__overlay sim-viewport__overlay--bl">
                T + {String(tick).padStart(5, '0')}
              </div>
              <div className="sim-viewport__overlay sim-viewport__overlay--br">
                LIVE · {String(stats.alive).padStart(2, '0')} entities
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="sim-controls">
          <button
            className={running ? 'btn' : 'btn btn--primary'}
            onClick={toggleRunning}
          >
            {running ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button className="btn" onClick={changeSpeed}>⚡ ×{speed}</button>
          <div className="sim-controls__divider" />
          <button className="btn" onClick={addFoodBurst}>🌿 + Food</button>
          <div className="sim-controls__divider" />
          <button className="btn" onClick={exportLogs}>⎘ Export logs</button>
          <button className="btn" onClick={saveState}>◼ Save state</button>
          <button className="btn" onClick={loadState}>◻ Load state</button>
        </div>

        {/* Diagnostics strip */}
        <div className="hud sim-diag">
          <Diag label="Entities" value={stats.alive} color="var(--cyan)" />
          <Diag label="Food" value={stats.food} color="var(--lime)" />
          <Diag label="Births" value={stats.born} color="var(--lime)" />
          <Diag label="Deaths" value={stats.died} color="var(--red)" />
          <Diag label="Net Δ" value={netDelta} color="var(--magenta)" signed />
        </div>
      </div>

      {/* Left rail — selection + population + roles */}
      <aside className="sim-screen__rail sim-screen__rail--left">
        {selected && (
          <SelectionPanel creature={selected} />
        )}

        <PanelShell title="Population" code="POP-01" accent="cyan" right={`CAP ${aliveCap}`}>
          <div className="stat">
            <div className="stat__label">
              <span className="swatch" style={{ background: 'var(--cyan)' }} />
              Alive
            </div>
            <div className="stat__value stat__value--cyan">
              {String(stats.alive).padStart(2, '0')}
            </div>
          </div>
          <div className="statbar">
            <div
              className="statbar__fill"
              style={{ width: `${Math.min(100, (stats.alive / aliveCap) * 100)}%` }}
            />
          </div>
          <div className="stat">
            <div className="stat__label">
              <span className="swatch" style={{ background: 'var(--lime)' }} />
              Food
            </div>
            <div className="stat__value stat__value--lime">{stats.food}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Births</div>
            <div className="stat__value stat__value--lime">{stats.born}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Deaths</div>
            <div className="stat__value stat__value--red">{stats.died}</div>
          </div>
          <div className="stat">
            <div className="stat__label">
              <span className="swatch" style={{ background: 'var(--amber)' }} />
              Meals
            </div>
            <div className="stat__value stat__value--amber">{stats.totalEaten}</div>
          </div>
          <div className="stat">
            <div className="stat__label">
              <span className="swatch" style={{ background: 'var(--magenta)' }} />
              Food produced
            </div>
            <div className="stat__value stat__value--magenta">{stats.foodProduced}</div>
          </div>
          <div className="stat">
            <div className="stat__label">
              <span className="swatch" style={{ background: 'var(--violet)' }} />
              Nests
            </div>
            <div className="stat__value">
              {stats.nests}{' '}
              <span className="sim-panel__faint">({stats.nestsBuilt} built)</span>
            </div>
          </div>
        </PanelShell>

        <PanelShell title="Roles · click to add" code="RLS-02" accent="magenta">
          {ROLES.map((role) => {
            const color = hueToRgb(ROLE_HUE[role]);
            const count =
              role === 'farmer'
                ? stats.farmers
                : role === 'harvester'
                  ? stats.harvesters
                  : role === 'healer'
                    ? stats.healers
                    : stats.builders;
            return (
              <button
                key={role}
                type="button"
                className="sim-role"
                onClick={() => addCreatureOfRole(role)}
              >
                <span
                  className="sim-role__dot"
                  style={{
                    background: color,
                    boxShadow: `0 0 10px ${color}, 0 0 4px ${color}`,
                  }}
                />
                <div className="sim-role__body">
                  <div className="sim-role__name">
                    {ROLE_ICON[role]} {ROLE_LABEL[role]}
                  </div>
                  <div className="sim-role__desc">{ROLE_DESC[role]}</div>
                </div>
                <div
                  className="sim-role__count"
                  style={{ color, textShadow: `0 0 8px ${color}` }}
                >
                  {count}
                </div>
              </button>
            );
          })}
        </PanelShell>
      </aside>

      {/* Right rail — event log */}
      <aside className="sim-screen__rail sim-screen__rail--right">
        <PanelShell
          title="Event Log"
          code="LOG-03"
          accent="cyan"
          right={`${log.length} entries`}
        >
          <div className="sim-events">
            {log.slice(0, 30).map((l, i) => (
              <EventLine key={i} entry={l} tick={tick} />
            ))}
            {log.length === 0 && (
              <div className="sim-events__empty">// no events yet</div>
            )}
          </div>
        </PanelShell>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers / sub-components
// ─────────────────────────────────────────────────────────────────────────

function PanelShell({
  title,
  code,
  right,
  accent = 'cyan',
  children,
}: {
  title: string;
  code?: string;
  right?: string;
  accent?: 'cyan' | 'magenta' | 'amber' | 'lime';
  children: React.ReactNode;
}) {
  return (
    <div className="hud brackets sim-panel">
      <span className="bk-tr" />
      <span className="bk-bl" />
      <div className="hud__header">
        <div className="sim-panel__head-left">
          <span
            className="dot"
            style={{
              background: `var(--${accent})`,
              boxShadow: `0 0 10px var(--${accent})`,
            }}
          />
          <span>{title}</span>
          {code && <span className="sim-panel__code">· {code}</span>}
        </div>
        {right && <div className="sim-panel__head-right">{right}</div>}
      </div>
      <div className="hud__body">{children}</div>
    </div>
  );
}

function Diag({
  label,
  value,
  color,
  signed,
}: {
  label: string;
  value: number;
  color: string;
  signed?: boolean;
}) {
  const display = signed ? (value >= 0 ? `+${value}` : `${value}`) : value;
  return (
    <div className="sim-diag__cell">
      <div className="tick sim-diag__label">{label}</div>
      <div
        className="sim-diag__value"
        style={{ color, textShadow: `0 0 10px ${color}` }}
      >
        {display}
      </div>
    </div>
  );
}

function SelectionPanel({ creature }: { creature: Creature }) {
  const color = hueToRgb(ROLE_HUE[creature.role]);
  const energyRatio = Math.max(0, Math.min(1, creature.energy / creature.maxEnergy));
  const staminaRatio = Math.max(0, Math.min(1, creature.stamina / creature.maxStamina));

  return (
    <PanelShell
      title={`Entity · ${creature.name}`}
      code={creature.id.slice(0, 4).toUpperCase()}
      accent="magenta"
    >
      <div className="sim-sel__head">
        <div
          className="sim-sel__swatch"
          style={{ background: color, color }}
        />
        <div>
          <div className="sim-sel__name">{creature.name}</div>
          <div className="sim-sel__role" style={{ color, textShadow: `0 0 6px ${color}` }}>
            {ROLE_ICON[creature.role]} {ROLE_LABEL[creature.role]}
          </div>
        </div>
      </div>
      <div className="sim-sel__body">
        <div className="stat">
          <div className="stat__label">Energy</div>
          <div className="stat__value stat__value--cyan">
            {Math.round(creature.energy)} / {creature.maxEnergy}
          </div>
        </div>
        <div className="statbar">
          <div
            className="statbar__fill"
            style={{
              width: `${energyRatio * 100}%`,
              background: color,
              boxShadow: `0 0 6px ${color}`,
            }}
          />
        </div>
        <div className="stat">
          <div className="stat__label">Stamina</div>
          <div className="stat__value stat__value--amber">
            {Math.round(creature.stamina)} / {creature.maxStamina}
          </div>
        </div>
        <div className="statbar">
          <div
            className="statbar__fill"
            style={{
              width: `${staminaRatio * 100}%`,
              background: 'var(--amber)',
              boxShadow: '0 0 6px var(--amber)',
            }}
          />
        </div>
        <div className="stat">
          <div className="stat__label">Ability level</div>
          <div className="stat__value">{creature.abilityValue.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Speed</div>
          <div className="stat__value">{creature.speed.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Generation</div>
          <div className="stat__value">{creature.generation}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Children</div>
          <div className="stat__value">{creature.children}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Age</div>
          <div className="stat__value">{Math.floor(creature.age / 60)}s</div>
        </div>
        <div className="stat">
          <div className="stat__label">State</div>
          <div className="stat__value" style={{ color: stateColor(creature.state) }}>
            {stateLabel(creature.state)}
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function EventLine({ entry, tick }: { entry: LogEntry; tick: number }) {
  const icon = pickEventIcon(entry.msg);
  const color = pickEventColor(entry.msg);
  // Approximate tick-at-time display: logs are tagged with wall-clock ms
  // (from addLog). Show current tick for the most recent entry; older ones
  // tag with a decreasing synthetic offset so users get a rough ordering.
  const displayTick = Math.max(0, tick);
  return (
    <div className="sim-event">
      <span className="sim-event__t">T+{String(displayTick).padStart(4, '0')}</span>
      <span
        className="sim-event__icon"
        style={{ color, textShadow: `0 0 6px ${color}` }}
      >
        {icon}
      </span>
      <span className="sim-event__text">{stripLeadingIcon(entry.msg)}</span>
    </div>
  );
}

function pickEventIcon(msg: string): string {
  // Keep the original leading glyph when there is one.
  const first = [...msg.trim()][0] ?? '·';
  return first;
}

function stripLeadingIcon(msg: string): string {
  // Drop the leading glyph + any following whitespace so the text column is clean.
  const arr = [...msg.trim()];
  if (arr.length === 0) return msg;
  const rest = arr.slice(1).join('').trimStart();
  return rest.length > 0 ? rest : msg;
}

function pickEventColor(msg: string): string {
  if (msg.includes('🌱') || msg.includes('🌿')) return 'var(--lime)';
  if (msg.includes('🍎') || msg.includes('🧺')) return 'var(--amber)';
  if (msg.includes('💊')) return 'var(--cyan)';
  if (msg.includes('🛖')) return 'var(--violet)';
  if (msg.includes('🐣') || msg.includes('➕')) return 'var(--lime)';
  if (msg.includes('💀')) return 'var(--red)';
  if (msg.includes('💾') || msg.includes('📥')) return 'var(--magenta)';
  if (msg.includes('⚠️')) return 'var(--amber)';
  return 'var(--cyan)';
}

function stateLabel(s: Creature['state']): string {
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
    case 'seek': return 'var(--red)';
    case 'reproduce': return 'var(--magenta)';
    case 'eat': return 'var(--lime)';
    case 'rest': return 'var(--text-1)';
    case 'work': return 'var(--amber)';
    default: return 'var(--text-2)';
  }
}

// Keep the lime phase-accent referenced so it's exported in the module graph
// for any tooling that might follow constants; no runtime use.
void PHASE_ACCENT;
