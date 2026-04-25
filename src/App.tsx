import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MainMenu from './components/MainMenu';
import SimulationViewer from './components/SimulationViewer';
import { simulations } from './simulations/registry';
import './App.css';

function fmtClock(d: Date = new Date()): string {
  return d.toISOString().slice(11, 19);
}

function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [clock, setClock] = useState(fmtClock());

  useEffect(() => {
    const id = setInterval(() => setClock(fmtClock()), 1000);
    return () => clearInterval(id);
  }, []);

  const onHome = location.pathname === '/' || location.pathname === '';
  const sim = simulations.find((s) => location.pathname.startsWith(s.path));
  const current = onHome
    ? 'HOME'
    : sim
      ? `${sim.shortTitle.toUpperCase()} · P${String(sim.phase).padStart(2, '0')}`
      : 'UNKNOWN';

  return (
    <nav className="topnav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <button
          className="topnav__brand"
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
          aria-label="Sim World — home"
        >
          <img
            className="logo"
            src="/logo.png"
            width={24}
            height={24}
            alt=""
            aria-hidden="true"
          />
          <span>SIM·WORLD</span>
        </button>
        <span style={{ color: 'var(--text-3)' }}>│</span>
        {!onHome && (
          <button
            className="btn btn--ghost"
            style={{ padding: '4px 10px', fontSize: 10 }}
            onClick={() => navigate('/')}
          >
            ← Phases
          </button>
        )}
        <span className="chip chip--cyan">{current}</span>
      </div>
      <div className="topnav__meta">
        <div>SESSION <span>#7A3F</span></div>
        <div>NET <span style={{ color: 'var(--lime)' }}>● ONLINE</span></div>
        <div>UTC <span>{clock}</span></div>
        <div style={{ color: 'var(--cyan)' }}>PHASES OF LIFE</div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <TopNav />
      <main>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          {simulations.map((sim) => (
            <Route
              key={sim.id}
              path={sim.path}
              element={
                <SimulationViewer>
                  <sim.Component />
                </SimulationViewer>
              }
            />
          ))}
        </Routes>
      </main>
    </div>
  );
}
