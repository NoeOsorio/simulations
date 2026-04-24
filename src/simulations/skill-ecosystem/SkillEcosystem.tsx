import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

    // Pre-rendered static backdrop (see CLAUDE.md performance note).
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_W;
    bgCanvas.height = CANVAS_H;
    const bgCtx = bgCanvas.getContext('2d')!;
    const bgGrad = bgCtx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, '#0b1a2f');
    bgGrad.addColorStop(0.5, '#10233c');
    bgGrad.addColorStop(1, '#0a1b2c');
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

  return (
    <div className="sim-page">
      <Link to="/" className="back-link">← Back to menu</Link>

      <header className="sim-header">
        <div>
          <span className="eyebrow mono">Phase 02</span>
          <h1 className="sim-h1">
            Skill <span className="gradient-text">Ecosystem</span>
          </h1>
          <p className="muted sim-tag">
            Four specialist roles, limited food, and inheritable skills. Click a creature to inspect it.
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
            <button className="glass-btn" onClick={addFoodBurst}>🌿 + Food</button>
            <span className="control-spacer" />
            <button className="glass-btn" onClick={exportLogs}>📝 Export logs</button>
            <button className="glass-btn" onClick={saveState}>💾 Save state</button>
            <button className="glass-btn" onClick={loadState}>📥 Load state</button>
          </div>
        </div>

        <aside className="sim-side">
          <section className="glass glass-blur side-card">
            <h3 className="side-title">Statistics</h3>
            <StatRow icon="👥" label="Alive" value={stats.alive} color="#60a5fa" />
            <StatRow icon="🌿" label="Food" value={stats.food} color="#34d399" />
            <StatRow icon="🐣" label="Births" value={stats.born} color="#f472b6" />
            <StatRow icon="💀" label="Deaths" value={stats.died} color="#f87171" />
            <StatRow icon="🍽" label="Meals" value={stats.totalEaten} color="#fbbf24" />
            <StatRow icon="🌾" label="Food produced" value={stats.foodProduced} color="#c084fc" />
            <StatRow icon="🛖" label="Nests" value={`${stats.nests} (${stats.nestsBuilt} built)`} color="#a78bfa" last />
          </section>

          <section className="glass glass-blur side-card roles-card">
            <h3 className="side-title">Roles · click to add</h3>
            {ROLES.map((role, i) => (
              <div
                key={role}
                className="role-row"
                onClick={() => addCreatureOfRole(role)}
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
                    : stats.builders}
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
                style={{ color: hueToRgb(ROLE_HUE[selected.role]) }}
              >
                {ROLE_ICON[selected.role]} {ROLE_LABEL[selected.role]}
              </div>
              <div className="selected-name" style={{ color: hueToRgb(selected.hue) }}>
                {selected.name}
              </div>
              <div className="selected-stats">
                <BarRow label="Energy" value={selected.energy} max={selected.maxEnergy} color={selected.energy > 40 ? '#34d399' : '#f87171'} />
                <BarRow label="Stamina" value={selected.stamina} max={selected.maxStamina} color="#fbbf24" />
                <Row k="Ability lvl" v={selected.abilityValue.toFixed(2)} />
                <Row k="Speed" v={selected.speed.toFixed(2)} />
                <Row k="Generation" v={selected.generation} />
                <Row k="Children" v={selected.children} />
                <Row k="Age" v={`${Math.floor(selected.age / 60)}s`} />
                <Row k="State" v={
                  <span style={{ color: stateColor(selected.state) }}>{stateLabel(selected.state)}</span>
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
        <span className="row-v">{Math.round(value)}</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{
          background: color,
          width: `${ratio * 100}%`,
        }} />
      </div>
    </div>
  );
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
    case 'seek': return '#f87171';
    case 'reproduce': return '#f472b6';
    case 'eat': return '#34d399';
    case 'rest': return '#cbd5e1';
    case 'work': return '#fbbf24';
    default: return '#94a3b8';
  }
}
