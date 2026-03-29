// ── StatsPanel.jsx ────────────────────────────────────────────────────────────
// Receives statsData, activeVehicles, totalVehicles from App.
// Corridor cards colour-coded by corridor ID to match map palette.

function loadClass(current, max) {
  const pct = max > 0 ? current / max : 0;
  if (pct > 0.8) return 'load-high';
  if (pct > 0.5) return 'load-mid';
  return 'load-low';
}

export default function StatsPanel({ statsData, activeVehicles, totalVehicles, activeRoutes, onToggleRoute }) {
  const { corridors, bottlenecks } = statsData;

  return (
    <aside className="stats-panel">

      {/* Mobile-only: active + total vehicle counts */}
      <div className="mobile-counts">
        <div className="mobile-count-item">
          <span className="count-label">Active vehicles</span>
          <span className="count-value">{activeVehicles}</span>
        </div>
        <div className="mobile-count-item">
          <span className="count-label">Total vehicles</span>
          <span className="count-value">{totalVehicles}</span>
        </div>
      </div>

      {/* ── Entry / Exit corridors ────────────────────────────────────────── */}
      <div className="stats-section-title">Entry / Exit Corridors</div>
      <div className="stat-cards-grid">
        {Object.entries(corridors).map(([id, c]) => (
          <div key={id} className={`stat-card corridor-${id} ${loadClass(c.current, c.maxVehicles)}`}>
            <div className="stat-card-header">
              <div className="stat-card-label">{c.label}</div>
              <button 
                className={`route-toggle-btn ${activeRoutes.has(id) ? 'active' : ''}`}
                onClick={() => onToggleRoute(id)}
              >
                {activeRoutes.has(id) ? 'Hide Route' : 'Show Route'}
              </button>
            </div>
            
            <div className="stat-grid">
              <div className="stat-item">
                <div className="stat-item-label">Active</div>
                <div className="stat-item-value">{c.current}</div>
              </div>
              <div className="stat-item">
                <div className="stat-item-label">Delayed In</div>
                <div className="stat-item-value">{c.total}</div>
                <div className="stat-item-small" style={{ color: c.avgInDelay > 300 ? '#ef4444' : c.avgInDelay > 150 ? '#eab308' : '#64748b' }}>
                  avg {c.avgInDelay}s
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-item-label">Delayed Out</div>
                <div className="stat-item-value">{c.exited}</div>
                <div className="stat-item-small" style={{ color: c.avgOutDelay > 120 ? '#ef4444' : c.avgOutDelay > 60 ? '#eab308' : '#64748b' }}>
                  avg {c.avgOutDelay}s
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottlenecks ────────────────────────────────────────────────────── */}
      <div className="stats-section-title">Bottlenecks</div>
      <div className="stat-cards-grid">
        {/* Christopher Rd */}
        <div className={`stat-card corridor-1A ${loadClass(bottlenecks.christopher.current, bottlenecks.christopher.maxVehicles)}`}>
          <div className="stat-card-label">{bottlenecks.christopher.label}</div>
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-item-label">Active</div>
              <div className="stat-item-value">{bottlenecks.christopher.current}</div>
            </div>
            <div className="stat-item">
              <div className="stat-item-label">Delayed In</div>
              <div className="stat-item-value">{bottlenecks.christopher.current}</div>
              <div className="stat-item-small">avg --s</div>
            </div>
            <div className="stat-item">
              <div className="stat-item-label">Delayed Out</div>
              <div className="stat-item-value">
                {bottlenecks.christopher.maxVehicles > 0
                  ? `${Math.round(bottlenecks.christopher.current / bottlenecks.christopher.maxVehicles * 100)}%`
                  : '—'}
              </div>
              <div className="stat-item-small">capacity</div>
            </div>
          </div>
        </div>

        {/* Ruskin Rd */}
        <div className={`stat-card corridor-1A ${bottlenecks.ruskin.queued > 5 ? 'load-high' : bottlenecks.ruskin.queued > 2 ? 'load-mid' : 'load-low'}`}>
          <div className="stat-card-label">{bottlenecks.ruskin.label}</div>
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-item-label">Active</div>
              <div className="stat-item-value">{bottlenecks.ruskin.queued}</div>
            </div>
            <div className="stat-item">
              <div className="stat-item-label">Delayed In</div>
              <div className="stat-item-value">{bottlenecks.ruskin.queued}</div>
              <div className="stat-item-small">queued</div>
            </div>
            <div className="stat-item">
              <div className="stat-item-label">Delayed Out</div>
              <div className="stat-item-value">--</div>
              <div className="stat-item-small">avg --s</div>
            </div>
          </div>
        </div>

        {/* Aristea Rd */}
        <div className={`stat-card corridor-egress ${loadClass(bottlenecks.aristea.current, bottlenecks.aristea.maxVehicles)}`}>
          <div className="stat-card-label">{bottlenecks.aristea.label}</div>
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-item-label">Active</div>
              <div className="stat-item-value">{bottlenecks.aristea.current}</div>
            </div>
            <div className="stat-item">
              <div className="stat-item-label">Delayed In</div>
              <div className="stat-item-value">--</div>
              <div className="stat-item-small">avg --s</div>
            </div>
            <div className="stat-item">
              <div className="stat-item-label">Delayed Out</div>
              <div className="stat-item-value">{bottlenecks.aristea.current}</div>
              <div className="stat-item-small">outbound</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIA assumption info cards ──────────────────────────────────────── */}
      <div className="stats-section-title">TIA Assumptions</div>
      <div className="tia-card">
        <div className="tia-card-title">Drop-off dwell time</div>
        45 s <em>(TIA assumption — fixed for all scenarios)</em>
      </div>
      <div className="tia-card">
        <div className="tia-card-title">On-street parking (Ruskin Rd)</div>
        22 bays <em>(not assessed in TIA)</em>
      </div>
      <div className="tia-card">
        <div className="tia-card-title">Ruskin Rd road class</div>
        Class 5 local <em>(unstudied in TIA)</em>
      </div>
      <div className="tia-card">
        <div className="tia-card-title">Modal split reduction</div>
        0% applied <em>(TIA figure)</em>
      </div>

      <div className="coming-soon">What-if scenario controls — coming soon</div>
    </aside>
  );
}
