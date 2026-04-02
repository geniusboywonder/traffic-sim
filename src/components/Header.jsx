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

export default function Header({ simTime, statsData }) {
  const clock = formatClock(simTime);

  // Consolidate global stats
  const totalIn = Object.values(statsData.corridors).reduce((s, c) => s + (c.spawned || 0), 0);
  const totalOut = Object.values(statsData.corridors).reduce((s, c) => s + (c.exited || 0), 0);
  const active = Object.values(statsData.corridors).reduce((s, c) => s + (c.current || 0), 0);

  return (
    <div className="header-wrapper">
      <nav className="nav-deck">
        <div className="nav-left-group" style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
          <div className="header-logo">
            <div className="logo-dot" />
            <span className="header-logo-text">Tokai-Sim</span>
          </div>

          <ul className="nav-links" style={{ display: 'flex', listStyle: 'none', margin: 0, padding: 0, gap: '1.5rem' }}>
            <li><a href="#simulator">Simulator</a></li>
            <li><a href="#briefing">Models</a></li>
            <li><a href="#findings">Findings</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>

        <div className="nav-right-group" style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <div className="global-summary-pill" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div className="htc-stat" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span className="htc-label">Time</span>
              <span className="htc-value" style={{ width: '70px' }}>{clock}</span>
            </div>
            <div className="htc-divider" style={{ width: '1px', height: '1.25rem', background: 'var(--surface-high)' }} />
            <div className="htc-stat" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span className="htc-label">Total In/Out</span>
              <span className="htc-value">{totalIn} / {totalOut}</span>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
