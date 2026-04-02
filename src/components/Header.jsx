// ── Header.jsx ────────────────────────────────────────────────────────────────
// Clean nav pill: logo + nav links (desktop) + sim clock.
// Sim controls (play/pause, speed, scenario, source) live inside SimMap.

function formatClock(simTime) {
  const totalSec  = Math.floor(simTime ?? 0);
  const baseMin   = 6 * 60 + 30;
  const totalMin  = baseMin + Math.floor(totalSec / 60);
  const hours24   = Math.floor(totalMin / 60) % 24;
  const mins      = totalMin % 60;
  const h12       = hours24 % 12 || 12;
  const ampm      = hours24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
}

export default function Header({ simTime }) {
  const clock = formatClock(simTime);

  return (
    <div className="header-wrapper">
      <nav className="nav-deck">
        <div className="header-logo">
          <div className="logo-dot" />
          <span className="header-logo-text">TokaiSim</span>
        </div>

        <ul className="nav-links">
          <li><a href="#simulator">Simulator</a></li>
          <li><a href="#models">Models</a></li>
          <li><a href="#findings">Findings</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 1, height: '1.25rem', background: 'var(--surface-high)', flexShrink: 0 }} />
          <time className="header-time">{clock}</time>
        </div>
      </nav>
    </div>
  );
}
