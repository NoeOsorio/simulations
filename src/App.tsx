import { Route, Routes, Link } from 'react-router-dom';
import MainMenu from './components/MainMenu';
import { simulations } from './simulations/registry';
import './App.css';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-dot" />
          <span className="brand-name">Sim<span className="gradient-text">World</span></span>
        </Link>
        <span className="muted mono header-tag">phases of life</span>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<MainMenu />} />
          {simulations.map((sim) => (
            <Route key={sim.id} path={sim.path} element={<sim.Component />} />
          ))}
        </Routes>
      </main>
    </div>
  );
}
