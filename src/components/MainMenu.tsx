import { Link } from 'react-router-dom';
import { simulations } from '../simulations/registry';
import './MainMenu.css';

export default function MainMenu() {
  return (
    <div className="menu-wrap">
      <section className="menu-hero glass glass-blur">
        <div className="menu-hero-inner">
          <span className="eyebrow mono">a phased simulation of life</span>
          <h1 className="menu-title">
            Build a world,<br />
            <span className="gradient-text">one phase at a time.</span>
          </h1>
          <p className="menu-sub">
            Sim World grows in stages — starting from the simplest organic
            life and progressing toward more complex worlds. Pick a phase to
            run it. Logs and saves are plain text files you can keep.
          </p>
        </div>
      </section>

      <h2 className="section-title">Simulations</h2>
      <div className="menu-grid">
        {simulations.map((sim) => (
          <SimCard key={sim.id} sim={sim} />
        ))}
        <ComingSoonCard />
      </div>
    </div>
  );
}

function SimCard({ sim }: { sim: typeof simulations[number] }) {
  const inner = (
    <article className="sim-card glass glass-blur">
      <div className="sim-card-head">
        <span className="sim-icon" aria-hidden>{sim.icon}</span>
        <span className={`sim-status sim-status-${sim.status}`}>
          {sim.status === 'available' ? 'available' : 'planned'}
        </span>
      </div>
      <div className="sim-phase mono">PHASE {String(sim.phase).padStart(2, '0')}</div>
      <h3 className="sim-title">{sim.shortTitle}</h3>
      <p className="sim-tagline">{sim.tagline}</p>
      <p className="sim-desc muted">{sim.description}</p>
      <div className="sim-cta glass-btn" data-variant="accent">
        Open simulation →
      </div>
    </article>
  );

  return sim.status === 'available'
    ? <Link to={sim.path} className="sim-card-link">{inner}</Link>
    : <div className="sim-card-link sim-card-disabled">{inner}</div>;
}

function ComingSoonCard() {
  return (
    <article className="sim-card glass glass-blur sim-card-disabled">
      <div className="sim-card-head">
        <span className="sim-icon" aria-hidden>✨</span>
        <span className="sim-status sim-status-planned">soon</span>
      </div>
      <div className="sim-phase mono">PHASE 04</div>
      <h3 className="sim-title">Predator & Prey</h3>
      <p className="sim-tagline">First food chains and survival pressure.</p>
      <p className="sim-desc muted">
        Some creatures start eating other creatures. Speed, size and senses
        begin to matter. The next phase, on the way.
      </p>
      <div className="sim-cta glass-btn" aria-disabled>Coming soon</div>
    </article>
  );
}
