import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  FOOD_SPAWN_RATE,
  INITIAL_CREATURES,
  INITIAL_FOOD,
  MAX_FOOD,
  REPRODUCE_ENERGY,
  createCreature,
  createFood,
  dist,
  hueToRgb,
} from './helpers';
import type {
  Creature,
  Food,
  LogEntry,
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
import './MicroEcosystem.css';

type EventKind = 'eat' | 'born' | 'die' | 'seek' | 'mate' | 'sys';

interface SimLogEntry extends LogEntry {
  tick: number;
  kind: EventKind;
  icon: string;
  text: string;
}

const EVENT_COLORS: Record<EventKind, string> = {
  eat: 'var(--lime)',
  born: 'var(--lime)',
  die: 'var(--red)',
  seek: 'var(--amber)',
  mate: 'var(--magenta)',
  sys: 'var(--cyan)',
};

function stateLabel(s: Creature['state']): string {
  switch (s) {
    case 'seek': return 'Seeking';
    case 'reproduce': return 'Reproducing';
    case 'eat': return 'Eating';
    default: return 'Wandering';
  }
}

function stateColor(s: Creature['state']): string {
  switch (s) {
    case 'seek': return 'var(--amber)';
    case 'reproduce': return 'var(--magenta)';
    case 'eat': return 'var(--lime)';
    default: return 'var(--text-1)';
  }
}

export default function MicroEcosystem() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const creaturesRef = useRef<Creature[]>([]);
  const foodRef = useRef<Food[]>([]);
  const animRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const statsRef = useRef({ born: 0, died: 0, totalEaten: 0 });

  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [displayTick, setDisplayTick] = useState(0);
  const [stats, setStats] = useState<SimStats>({
    alive: INITIAL_CREATURES,
    food: INITIAL_FOOD,
    born: 0,
    died: 0,
    totalEaten: 0,
  });
  const [selected, setSelected] = useState<Creature | null>(null);
  const [log, setLog] = useState<SimLogEntry[]>([]);

  const selectedRef = useRef<Creature | null>(null);
  const logRef = useRef<SimLogEntry[]>([]);
  const runningRef = useRef(true);
  const speedRef = useRef(1);

  const addLog = useCallback(
    (msg: string, kind: EventKind = 'sys', icon = '●') => {
      const entry: SimLogEntry = {
        t: Date.now(),
        tick: tickRef.current,
        kind,
        icon,
        text: msg,
        msg,
      };
      logRef.current = [entry, ...logRef.current].slice(0, 500);
      setLog([...logRef.current.slice(0, 30)]);
    },
    []
  );

  // ----- Init -----
  useEffect(() => {
    const creatures: Creature[] = [];
    for (let i = 0; i < INITIAL_CREATURES; i++) creatures.push(createCreature());
    creaturesRef.current = creatures;

    const food: Food[] = [];
    for (let i = 0; i < INITIAL_FOOD; i++) food.push(createFood());
    foodRef.current = food;

    addLog('Ecosystem created', 'sys', '◆');
    addLog(`${INITIAL_CREATURES} creatures have appeared`, 'sys', '●');
  }, [addLog]);

  // ----- Game loop -----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      if (!runningRef.current) return;
      const spd = speedRef.current;
      for (let s = 0; s < spd; s++) {
        tickRef.current++;
        const creatures = creaturesRef.current;
        const food = foodRef.current;

        if (Math.random() < FOOD_SPAWN_RATE && food.length < MAX_FOOD) {
          food.push(createFood());
        }

        const newCreatures: Creature[] = [];

        for (const c of creatures) {
          c.age++;
          c.energy -= 0.06 + c.speed * 0.02;
          c.pulsePhase += 0.05;
          c.blinkTimer--;
          if (c.blinkTimer <= 0) c.blinkTimer = 100 + Math.random() * 200;

          let nearestFood: Food | null = null;
          let nearestDist = Infinity;
          for (const f of food) {
            const d = dist(c, f);
            if (d < nearestDist) {
              nearestDist = d;
              nearestFood = f;
            }
          }

          if (c.energy < 40 && nearestFood) {
            c.state = 'seek';
            const angle = Math.atan2(nearestFood.y - c.y, nearestFood.x - c.x);
            c.vx += Math.cos(angle) * c.speed * 0.15;
            c.vy += Math.sin(angle) * c.speed * 0.15;
            c.eyeAngle = angle;
          } else if (c.energy >= REPRODUCE_ENERGY) {
            c.state = 'reproduce';
            let partner: Creature | null = null;
            for (const o of creatures) {
              if (o.id !== c.id && o.energy >= REPRODUCE_ENERGY && dist(c, o) < 60) {
                partner = o;
                break;
              }
            }
            if (partner) {
              const babyHue = (c.hue + partner.hue) / 2 + (Math.random() - 0.5) * 30;
              const baby = createCreature(
                (c.x + partner.x) / 2,
                (c.y + partner.y) / 2,
                babyHue
              );
              baby.speed = (c.speed + partner.speed) / 2 + (Math.random() - 0.5) * 0.3;
              baby.generation = Math.max(c.generation, partner.generation) + 1;
              baby.energy = 40;
              c.energy -= 30;
              partner.energy -= 30;
              c.children++;
              partner.children++;
              newCreatures.push(baby);
              statsRef.current.born++;
              addLog(`${baby.name} was born (gen ${baby.generation})`, 'born', '+');
            }
          } else {
            c.state = 'wander';
            c.vx += (Math.random() - 0.5) * 0.3;
            c.vy += (Math.random() - 0.5) * 0.3;
            c.eyeAngle = Math.atan2(c.vy, c.vx);
          }

          if (nearestFood && nearestDist < c.size + nearestFood.size) {
            c.energy = Math.min(c.maxEnergy, c.energy + nearestFood.energy);
            c.state = 'eat';
            const idx = food.indexOf(nearestFood);
            if (idx > -1) food.splice(idx, 1);
            statsRef.current.totalEaten++;
          }

          const maxV = c.speed * 1.5;
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
            addLog(`${c.name} has died (age: ${Math.floor(c.age / 60)}s)`, 'die', '×');
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

    const drawCreature = (c: Creature, tick: number) => {
      const isSelected = selectedRef.current?.id === c.id;
      const pulse = Math.sin(c.pulsePhase) * 2;
      const bodySize = c.size + pulse;
      const energyRatio = c.energy / c.maxEnergy;
      const color = hueToRgb(c.hue);
      const isBlink = c.blinkTimer < 8;

      ctx.save();
      ctx.translate(c.x, c.y);

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(0, 0, bodySize + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,100,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -tick * 0.1;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.ellipse(0, bodySize * 0.6, bodySize * 0.8, bodySize * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fill();

      const glow = ctx.createRadialGradient(0, 0, bodySize * 0.2, 0, 0, bodySize * 1.8);
      glow.addColorStop(0, `hsla(${c.hue},70%,60%,0.3)`);
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(0, 0, bodySize * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, bodySize, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(-bodySize * 0.3, -bodySize * 0.3, 0, 0, 0, bodySize);
      grad.addColorStop(0, `hsla(${c.hue},80%,75%,1)`);
      grad.addColorStop(0.6, color);
      grad.addColorStop(1, `hsla(${c.hue},60%,35%,1)`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = `hsla(${c.hue},50%,30%,0.5)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (c.state === 'seek') {
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${Math.round(bodySize * 0.8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, -bodySize - 6);
      } else if (c.state === 'reproduce') {
        ctx.fillStyle = '#ff69b4';
        ctx.font = `${Math.round(bodySize * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('♥', 0, -bodySize - 6);
      } else if (c.state === 'eat') {
        ctx.fillStyle = '#44ff44';
        ctx.font = `${Math.round(bodySize * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('✦', 0, -bodySize - 6);
      }

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

      const barW = bodySize * 2;
      const barH = 3;
      const barY = bodySize + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-barW / 2, barY, barW, barH);
      const eColor =
        energyRatio > 0.5
          ? `hsl(${120 * energyRatio},80%,45%)`
          : `hsl(${120 * energyRatio},90%,45%)`;
      ctx.fillStyle = eColor;
      ctx.fillRect(-barW / 2, barY, barW * energyRatio, barH);

      if (isSelected) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = "bold 10px 'Courier New', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(c.name, 0, bodySize + 18);
      }

      ctx.restore();
    };

    const drawFood = (f: Food, tick: number) => {
      const pulse = Math.sin(f.pulse + tick * 0.04) * 1.5;
      const s = f.size + pulse;

      ctx.save();
      ctx.translate(f.x, f.y);

      if (f.type === 'fruit') {
        const g = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s);
        g.addColorStop(0, '#ff6b6b');
        g.addColorStop(1, '#c0392b');
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.4, -s * 0.8, s * 0.5, s * 0.2, 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#27ae60';
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.2);
        g.addColorStop(0, '#2ecc71');
        g.addColorStop(1, '#16a085');
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-s * 0.2, -s * 0.2, s * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
      }

      ctx.restore();
    };

    // Pre-render the static background (radial fill + HUD grid) once to an
    // offscreen canvas so each frame only needs a single drawImage call.
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_W;
    bgCanvas.height = CANVAS_H;
    const bgCtx = bgCanvas.getContext('2d')!;

    // Radial dark fill — matches the SimScreen viewport backdrop.
    const bgGrad = bgCtx.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H / 2,
      0,
      CANVAS_W / 2,
      CANVAS_H / 2,
      Math.max(CANVAS_W, CANVAS_H) * 0.8
    );
    bgGrad.addColorStop(0, '#0c1420');
    bgGrad.addColorStop(1, '#05070a');
    bgCtx.fillStyle = bgGrad;
    bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 40px cyan grid
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
    // Stronger 200px major grid
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

    const drawCornerTicks = () => {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
      ctx.lineWidth = 1;
      const tl = 10;
      // TL
      ctx.beginPath(); ctx.moveTo(0, tl); ctx.lineTo(0, 0); ctx.lineTo(tl, 0); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(CANVAS_W - tl, 0); ctx.lineTo(CANVAS_W, 0); ctx.lineTo(CANVAS_W, tl); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(0, CANVAS_H - tl); ctx.lineTo(0, CANVAS_H); ctx.lineTo(tl, CANVAS_H); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(CANVAS_W - tl, CANVAS_H); ctx.lineTo(CANVAS_W, CANVAS_H); ctx.lineTo(CANVAS_W, CANVAS_H - tl); ctx.stroke();
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
        ctx.fillStyle = `rgba(0,229,255,${0.05 + Math.sin(tick * 0.03 + i) * 0.03})`;
        ctx.fill();
      }

      for (const f of foodRef.current) drawFood(f, tick);
      for (const c of creaturesRef.current) drawCreature(c, tick);

      drawCornerTicks();

      if (tick % 30 === 0) {
        setDisplayTick(tick);
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

  const addCreature = () => {
    const c = createCreature();
    creaturesRef.current.push(c);
    addLog(`${c.name} was created manually`, 'sys', '+');
  };

  const addFoodBurst = () => {
    for (let i = 0; i < 10; i++) foodRef.current.push(createFood());
    addLog('Food rain triggered', 'sys', '✦');
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
    const text = logsToText('Sim World — Phase 1: Micro Ecosystem (events)', logRef.current);
    downloadText(`sim-microecosystem-logs-${timestamp()}.txt`, text);
  };

  const saveState = () => {
    const state: SavedState = {
      version: 1,
      savedAt: new Date().toISOString(),
      tick: tickRef.current,
      stats: { ...statsRef.current },
      creatures: creaturesRef.current,
      food: foodRef.current,
    };
    downloadText(
      `sim-microecosystem-state-${timestamp()}.txt`,
      stateToText('micro-ecosystem', state)
    );
    addLog('State exported to file', 'sys', '◼');
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
      tickRef.current = state.tick ?? 0;
      statsRef.current = { ...state.stats };
      setSelected(null);
      selectedRef.current = null;
      addLog(
        `Loaded state with ${state.creatures.length} creatures, ${state.food.length} food`,
        'sys',
        '◻'
      );
      runningRef.current = wasRunning;
      setRunning(wasRunning);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Failed to load state: ${msg}`, 'sys', '!');
    }
  };

  const speedLabel = running ? `${speed.toFixed(1)}×` : 'PAUSED';

  return (
    <div className="sim-screen">
      <main className="sim-screen__main">
        {/* Title block */}
        <div className="sim-title">
          <div>
            <div className="tick sim-title__eyebrow">▌ PHASE 01 · MICRO ECOSYSTEM</div>
            <h2 className="sim-title__h2">
              Micro <span className="sim-title__accent">Ecosystem</span>
            </h2>
            <p className="sim-title__sub">
              Tiny creatures wander, eat, and reproduce. Click a creature to inspect it.
            </p>
          </div>
          <div className="sim-title__rate">
            <div className="tick sim-title__rate-label">Tick rate</div>
            <div
              className={`sim-title__rate-value ${
                running ? 'sim-title__rate-value--running' : 'sim-title__rate-value--paused'
              }`}
            >
              {speedLabel}
            </div>
          </div>
        </div>

        {/* Viewport frame */}
        <div className="hud brackets sim-viewport">
          <span className="bk-tr" />
          <span className="bk-bl" />
          <div className="hud__header">
            <div className="sim-viewport__head-left">
              <span className="dot" />
              <span>Live Viewport</span>
              <span className="sim-viewport__code">· VPT-01</span>
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
                SECTOR · MICRO-01
              </div>
              <div className="sim-viewport__overlay sim-viewport__overlay--bl">
                T + {String(displayTick).padStart(5, '0')}
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
          <button className="btn" onClick={changeSpeed}>
            ⚡ {speed}× → {speed === 4 ? '1' : speed === 2 ? '4' : '2'}×
          </button>
          <div className="sim-controls__divider" />
          <button className="btn" onClick={addCreature}>+ Creature</button>
          <button className="btn" onClick={addFoodBurst}>+ Food</button>
          <div className="sim-controls__divider" />
          <button className="btn" onClick={exportLogs}>⎘ Export logs</button>
          <button className="btn" onClick={saveState}>◼ Save state</button>
          <button className="btn" onClick={loadState}>◻ Load state</button>
          <button
            className="btn btn--danger sim-controls__spacer"
            onClick={() => {
              creaturesRef.current = [];
              foodRef.current = [];
              tickRef.current = 0;
              setDisplayTick(0);
              statsRef.current = { born: 0, died: 0, totalEaten: 0 };
              for (let i = 0; i < INITIAL_CREATURES; i++) creaturesRef.current.push(createCreature());
              for (let i = 0; i < INITIAL_FOOD; i++) foodRef.current.push(createFood());
              setSelected(null);
              selectedRef.current = null;
              logRef.current = [];
              setLog([]);
              addLog('Ecosystem reset', 'sys', '⟳');
            }}
          >
            ⟳ Reset
          </button>
        </div>

        {/* Diagnostics strip */}
        <div className="hud sim-diag">
          <Diag label="Alive" value={stats.alive} color="var(--cyan)" />
          <Diag label="Food" value={stats.food} color="var(--lime)" />
          <Diag label="Births" value={stats.born} color="var(--lime)" />
          <Diag label="Deaths" value={stats.died} color="var(--red)" />
          <Diag label="Total meals" value={stats.totalEaten} color="var(--amber)" />
        </div>
      </main>

      {/* Right rail */}
      <aside className="sim-screen__rail">
        {selected && <SelectionPanel creature={selected} />}
        <StatsPanel stats={stats} />
        <EventsPanel log={log} />
      </aside>
    </div>
  );
}

// =============================================================
// Sub-components
// =============================================================
function Diag({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="sim-diag__cell">
      <div className="tick sim-diag__label">{label}</div>
      <div
        className="sim-diag__value"
        style={{ color, textShadow: `0 0 10px ${color}` }}
      >
        {value}
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  code,
  accent,
  right,
}: {
  title: string;
  code: string;
  accent: 'cyan' | 'magenta' | 'amber' | 'lime';
  right?: React.ReactNode;
}) {
  return (
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
        <span className="sim-panel__code">· {code}</span>
      </div>
      {right !== undefined && <div className="sim-panel__head-right">{right}</div>}
    </div>
  );
}

function StatsPanel({ stats }: { stats: SimStats }) {
  const cap = 60;
  const alivePct = Math.min(100, (stats.alive / cap) * 100);
  return (
    <div className="hud brackets sim-panel">
      <span className="bk-tr" />
      <span className="bk-bl" />
      <PanelHeader title="Population" code="POP-01" accent="cyan" right={`CAP ${cap}`} />
      <div className="hud__body">
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
          <div className="statbar__fill" style={{ width: `${alivePct}%` }} />
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
            Total meals
          </div>
          <div className="stat__value stat__value--amber">{stats.totalEaten}</div>
        </div>
      </div>
    </div>
  );
}

function EventsPanel({ log }: { log: SimLogEntry[] }) {
  return (
    <div className="hud brackets sim-panel">
      <span className="bk-tr" />
      <span className="bk-bl" />
      <PanelHeader
        title="Event Log"
        code="LOG-02"
        accent="cyan"
        right={`${log.length} entries`}
      />
      <div className="hud__body">
        <div className="sim-events">
          {log.map((e, i) => {
            const color = EVENT_COLORS[e.kind] ?? 'var(--text-2)';
            return (
              <div className="sim-event" key={i}>
                <span className="sim-event__t">
                  T+{String(e.tick).padStart(4, '0')}
                </span>
                <span
                  className="sim-event__icon"
                  style={{ color, textShadow: `0 0 6px ${color}` }}
                >
                  {e.icon}
                </span>
                <span className="sim-event__text">{e.text}</span>
              </div>
            );
          })}
          {log.length === 0 && (
            <div className="sim-events__empty">// no events yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SelectionPanel({ creature }: { creature: Creature }) {
  const color = hueToRgb(creature.hue);
  const energyPct = Math.max(0, Math.min(100, (creature.energy / creature.maxEnergy) * 100));
  const sColor = stateColor(creature.state);
  return (
    <div className="hud brackets sim-panel">
      <span className="bk-tr" />
      <span className="bk-bl" />
      <PanelHeader
        title={`Entity · ${creature.name}`}
        code={creature.id.slice(0, 4).toUpperCase()}
        accent="magenta"
      />
      <div className="hud__body">
        <div className="sim-sel__head">
          <div className="sim-sel__swatch" style={{ background: color, color }} />
          <div>
            <div className="sim-sel__name">{creature.name}</div>
            <div
              className="sim-sel__role"
              style={{ color, textShadow: `0 0 6px ${color}` }}
            >
              Creature · gen {creature.generation}
            </div>
          </div>
        </div>
        <div className="sim-sel__body">
          <div className="stat">
            <div className="stat__label">Energy</div>
            <div className="stat__value stat__value--cyan">
              {Math.round(creature.energy)}
            </div>
          </div>
          <div className="statbar">
            <div
              className="statbar__fill"
              style={{ width: `${energyPct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
            />
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
            <div className="stat__label">Current state</div>
            <div className="stat__value">
              <span
                className="sim-sel__state-pill"
                style={{ color: sColor }}
              >
                {stateLabel(creature.state)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
