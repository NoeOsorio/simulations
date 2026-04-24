import { useNavigate } from 'react-router-dom';
import { simulations, type SimulationMeta } from '../simulations/registry';
import './MainMenu.css';

interface PhaseCard {
  n: string;
  title: string;
  status: 'available' | 'active' | 'locked';
  accent: string;
  glyph: string;
  blurb: string;
  body: string;
  path?: string;
}

const PHASE_ACCENTS: Record<number, string> = {
  1: '#00e5ff',
  2: '#a8ff2b',
  3: '#ff2bd6',
  4: '#ffb020',
};

const COMING_SOON: PhaseCard[] = [
  {
    n: '04',
    title: 'Predator & Prey',
    status: 'locked',
    accent: '#ffb020',
    glyph: 'P',
    blurb: 'First food chains and survival pressure.',
    body:
      'Some creatures start eating other creatures. Speed, size and senses begin to matter. The next phase, on the way.',
  },
];

function buildCards(): PhaseCard[] {
  const cards: PhaseCard[] = simulations.map((s: SimulationMeta) => {
    const isLatest = s.phase === Math.max(...simulations.map((x) => x.phase));
    return {
      n: String(s.phase).padStart(2, '0'),
      title: s.shortTitle,
      status: isLatest ? 'active' : 'available',
      accent: PHASE_ACCENTS[s.phase] ?? '#00e5ff',
      glyph: s.shortTitle.charAt(0).toUpperCase(),
      blurb: s.tagline,
      body: s.description,
      path: s.path,
    };
  });
  return [...cards, ...COMING_SOON];
}

export default function MainMenu() {
  const navigate = useNavigate();
  const cards = buildCards();
  const available = cards.filter((c) => c.status !== 'locked').length;

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing__hero-wrap">
        <div className="brackets hud landing__hero">
          <span className="bk-tr" />
          <span className="bk-bl" />
          <div className="landing__hero-glow landing__hero-glow--tr" />
          <div className="landing__hero-glow landing__hero-glow--bl" />

          <div className="chip chip--cyan" style={{ marginBottom: 22 }}>
            <span
              style={{
                width: 6,
                height: 6,
                background: 'var(--cyan)',
                display: 'inline-block',
                boxShadow: '0 0 8px var(--cyan)',
              }}
            />
            A Phased Simulation Of Life
          </div>

          <h1 className="landing__title">
            <span style={{ color: 'var(--text-0)' }}>Build a world,</span>
            <br />
            <span className="gradient-text">one phase at a time.</span>
          </h1>

          <p className="landing__desc">
            Sim World grows in stages — starting from the simplest organic life and progressing
            toward more complex worlds. Pick a phase to run it. Logs and saves are plain text files
            you can keep.
          </p>

          <div className="landing__phase-map">
            <span className="tick">PHASE MAP</span>
            <div className="landing__phase-map-track">
              {cards.map((p, i) => (
                <div
                  key={p.n}
                  className="landing__phase-map-dot"
                  style={{
                    left: `${(i / Math.max(1, cards.length - 1)) * 100}%`,
                    background: p.status === 'locked' ? 'var(--bg-1)' : p.accent,
                    borderColor: p.status === 'locked' ? 'var(--line-2)' : p.accent,
                    boxShadow: p.status === 'locked' ? 'none' : `0 0 12px ${p.accent}`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Phase cards */}
      <section className="landing__grid-wrap">
        <div className="landing__section-head">
          <span className="tick" style={{ color: 'var(--cyan)' }}>▌ SIMULATIONS</span>
          <div className="landing__section-rule" />
          <span className="tick">
            {available} / {cards.length} AVAILABLE
          </span>
        </div>

        <div className="landing__grid">
          {cards.map((p) => (
            <PhaseCardView
              key={p.n}
              p={p}
              onOpen={() => p.path && navigate(p.path)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PhaseCardView({ p, onOpen }: { p: PhaseCard; onOpen: () => void }) {
  const locked = p.status === 'locked';
  const active = p.status === 'active';
  return (
    <div
      className="hud brackets phase-card"
      style={{
        opacity: locked ? 0.55 : 1,
        background: active ? 'rgba(255,43,214,0.03)' : 'var(--surface)',
        borderColor: active ? 'rgba(255,43,214,0.4)' : undefined,
      }}
    >
      <span className="bk-tr" />
      <span className="bk-bl" />

      <div className="phase-card__head">
        <div
          className="phase-card__glyph"
          style={{
            borderColor: p.accent,
            color: p.accent,
            background: `linear-gradient(135deg, ${p.accent}22, transparent)`,
            boxShadow: locked ? 'none' : `0 0 14px ${p.accent}55, inset 0 0 10px ${p.accent}33`,
          }}
        >
          {p.glyph}
          <span style={{ position: 'absolute', top: -1, left: -1, width: 5, height: 5, borderTop: `1px solid ${p.accent}`, borderLeft: `1px solid ${p.accent}` }} />
          <span style={{ position: 'absolute', top: -1, right: -1, width: 5, height: 5, borderTop: `1px solid ${p.accent}`, borderRight: `1px solid ${p.accent}` }} />
          <span style={{ position: 'absolute', bottom: -1, left: -1, width: 5, height: 5, borderBottom: `1px solid ${p.accent}`, borderLeft: `1px solid ${p.accent}` }} />
          <span style={{ position: 'absolute', bottom: -1, right: -1, width: 5, height: 5, borderBottom: `1px solid ${p.accent}`, borderRight: `1px solid ${p.accent}` }} />
        </div>

        <div className={`chip ${locked ? 'chip--muted' : active ? 'chip--magenta' : 'chip--cyan'}`}>
          {locked ? '◌ LOCKED' : active ? '● ACTIVE' : '◉ AVAILABLE'}
        </div>
      </div>

      <div className="tick phase-card__phase">PHASE · {p.n}</div>
      <h3 className="phase-card__title">{p.title}</h3>
      <p className="phase-card__blurb">{p.blurb}</p>
      <p className="phase-card__body">{p.body}</p>

      {locked ? (
        <button className="btn phase-card__cta" disabled>
          Coming soon
        </button>
      ) : (
        <button
          className={active ? 'btn btn--magenta phase-card__cta' : 'btn btn--primary phase-card__cta'}
          onClick={onOpen}
        >
          Open simulation →
        </button>
      )}
    </div>
  );
}
