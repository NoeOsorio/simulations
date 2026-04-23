import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function MicroEcosystem() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const creaturesRef = useRef<Creature[]>([]);
  const foodRef = useRef<Food[]>([]);
  const animRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const statsRef = useRef({ born: 0, died: 0, totalEaten: 0 });

  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<SimStats>({
    alive: INITIAL_CREATURES,
    food: INITIAL_FOOD,
    born: 0,
    died: 0,
    totalEaten: 0,
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
    const creatures: Creature[] = [];
    for (let i = 0; i < INITIAL_CREATURES; i++) creatures.push(createCreature());
    creaturesRef.current = creatures;

    const food: Food[] = [];
    for (let i = 0; i < INITIAL_FOOD; i++) food.push(createFood());
    foodRef.current = food;

    addLog('🌍 Ecosystem created');
    addLog(`🐾 ${INITIAL_CREATURES} creatures have appeared`);
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
              addLog(`🐣 ${baby.name} was born (gen ${baby.generation})`);
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
            addLog(`💀 ${c.name} has died (age: ${Math.floor(c.age / 60)}s)`);
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

    // Pre-render the static background (gradient + dot grid) once to an
    // offscreen canvas so each frame only needs a single drawImage call.
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_W;
    bgCanvas.height = CANVAS_H;
    const bgCtx = bgCanvas.getContext('2d')!;
    const bgGrad = bgCtx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, '#0a1628');
    bgGrad.addColorStop(0.5, '#0f2035');
    bgGrad.addColorStop(1, '#0a1a2e');
    bgCtx.fillStyle = bgGrad;
    bgCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    bgCtx.fillStyle = 'rgba(100,180,255,0.06)';
    for (let x = 20; x < CANVAS_W; x += 30) {
      for (let y = 20; y < CANVAS_H; y += 30) {
        bgCtx.beginPath();
        bgCtx.arc(x, y, 1, 0, Math.PI * 2);
        bgCtx.fill();
      }
    }

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

      for (const f of foodRef.current) drawFood(f, tick);
      for (const c of creaturesRef.current) drawCreature(c, tick);

      if (tick % 30 === 0) {
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
    addLog(`🐾 ${c.name} was created manually`);
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
      tickRef.current = state.tick ?? 0;
      statsRef.current = { ...state.stats };
      setSelected(null);
      selectedRef.current = null;
      addLog(`📥 Loaded state with ${state.creatures.length} creatures, ${state.food.length} food`);
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
          <span className="eyebrow mono">Phase 01</span>
          <h1 className="sim-h1">
            Micro <span className="gradient-text">Ecosystem</span>
          </h1>
          <p className="muted sim-tag">
            Artificial life simulation · click a creature to inspect it.
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
            <button className="glass-btn" onClick={addCreature}>🐾 + Creature</button>
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
            <StatRow icon="🐾" label="Alive" value={stats.alive} color="#60a5fa" />
            <StatRow icon="🌿" label="Food" value={stats.food} color="#34d399" />
            <StatRow icon="🐣" label="Births" value={stats.born} color="#f472b6" />
            <StatRow icon="💀" label="Deaths" value={stats.died} color="#f87171" />
            <StatRow icon="🍽" label="Meals" value={stats.totalEaten} color="#fbbf24" last />
          </section>

          {selected && (
            <section
              className="glass glass-blur side-card"
              style={{ borderColor: `hsla(${selected.hue},60%,55%,0.5)` }}
            >
              <div className="selected-name" style={{ color: hueToRgb(selected.hue) }}>
                {selected.name}
              </div>
              <div className="selected-stats">
                <Row k="Energy" v={
                  <span style={{ color: selected.energy > 40 ? '#34d399' : '#f87171' }}>
                    {Math.round(selected.energy)}
                  </span>
                } />
                <Row k="Speed" v={selected.speed.toFixed(2)} />
                <Row k="Generation" v={selected.generation} />
                <Row k="Children" v={selected.children} />
                <Row k="Age" v={`${Math.floor(selected.age / 60)}s`} />
                <Row k="State" v={
                  <span style={{
                    color:
                      selected.state === 'seek' ? '#f87171' :
                      selected.state === 'reproduce' ? '#f472b6' :
                      selected.state === 'eat' ? '#34d399' : '#94a3b8'
                  }}>{stateLabel(selected.state)}</span>
                } />
              </div>
            </section>
          )}

          <section className="glass glass-blur side-card events-card">
            <h3 className="side-title">Events</h3>
            <div className="events-scroll">
              {log.slice(0, 30).map((l, i) => (
                <div key={i} className="event-line" style={{ opacity: 1 - i * 0.025 }}>
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
  icon: string; label: string; value: number; color: string; last?: boolean;
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

function stateLabel(s: Creature['state']): string {
  switch (s) {
    case 'seek': return '🔍 Seeking';
    case 'reproduce': return '💕 Reproducing';
    case 'eat': return '🍽 Eating';
    default: return '🚶 Wandering';
  }
}
