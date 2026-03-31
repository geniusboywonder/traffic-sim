// ── StatsPanel.jsx ────────────────────────────────────────────────────────────
// Receives statsData, activeVehicles, totalVehicles from App.

function fmtMin(min) {
  if (min === undefined || min === null || min === 0) return '0.0m';
  return `${min.toFixed(1)}m`;
}

export default function StatsPanel({ statsData, activeVehicles, totalVehicles, activeRoutes, selectedCorridors, onToggleRoute, onToggleCorridor }) {
  const { corridors, bottlenecks, parking } = statsData;

  return (
    <aside className="stats-panel">

      {/* ── Entry / Exit corridors ────────────────────────────────────────── */}
      <div className="stats-section-title">Entry / Exit Corridors</div>
      <div className="stat-cards-grid">
        {Object.entries(corridors).map(([id, c]) => {
          const totalInbound = c.active + c.slowing + c.stopped;
          const pActive  = totalInbound > 0 ? Math.round((c.active / totalInbound) * 100) : 0;
          const pSlowing = totalInbound > 0 ? Math.round((c.slowing / totalInbound) * 100) : 0;
          const pStopped = totalInbound > 0 ? Math.round((c.stopped / totalInbound) * 100) : 0;

          return (
            <div 
              key={id} 
              className={`stat-card corridor-${id} ${selectedCorridors.has(id) ? 'selected' : 'deselected'}`}
              onClick={() => onToggleCorridor(id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-card-header">
                <div className="stat-card-label">
                  {c.label} <span className="total-count">{c.spawned}/{c.exited}</span>
                </div>
                <button 
                  className={`route-toggle-btn ${activeRoutes.has(id) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleRoute(id); }}
                >
                  {activeRoutes.has(id) ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="metrics-row">
                <div className="metric">
                  <span className="m-label">Active</span>
                  <span className="m-value">{c.current}</span>
                </div>
                <div className="metric">
                  <span className="m-label">Avg In</span>
                  <span className="m-value">{fmtMin(c.avgInDelay)}</span>
                </div>
                <div className="metric">
                  <span className="m-label">Avg Out</span>
                  <span className="m-value">{fmtMin(c.avgOutDelay)}</span>
                </div>
              </div>

              <div className="congestion-container" style={{ marginTop: 8 }}>
                <div className="congestion-bar" style={{ height: 4, background: '#1e3a5f', borderRadius: 2, overflow: 'hidden' }}>
                  <div 
                    className="congestion-fill" 
                    style={{ 
                      height: '100%',
                      width: `${Math.round((c.congestion ?? 0) * 100)}%`,
                      background: c.congestion > 0.7 ? '#ef4444' : c.congestion > 0.4 ? '#f59e0b' : '#10b981',
                      transition: 'width 0.3s ease',
                    }} 
                  />
                </div>
                <div className="congestion-stats" style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{pActive}% active</span>
                  <span>{pSlowing}% slowing</span>
                  <span>{pStopped}% stopped</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottlenecks ─────────────────────────────────────────────────── */}
      <div className="stats-section-title">Network Bottlenecks</div>
      <div className="stat-cards-grid">
        {Object.entries(bottlenecks).map(([id, b]) => (
          <div key={id} className="stat-card bottleneck-card">
            <div className="stat-card-header">
              <div className="stat-card-label">{b.label}</div>
            </div>
            <div className="metrics-row">
              <div className="metric">
                <span className="m-label">Active</span>
                <span className="m-value">{b.active}</span>
              </div>
              <div className="metric">
                <span className="m-label">Slowing</span>
                <span className="m-value">{b.slowing}</span>
              </div>
              <div className="metric">
                <span className="m-label">Stopped</span>
                <span className="m-value">{b.stopped}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Parking ─────────────────────────────────────────────────────── */}
      <div className="stats-section-title">Parking & Dwell</div>
      <div className="stat-card parking-card">
        <div className="metrics-row">
          <div className="metric">
            <span className="m-label">On-Site Occupancy</span>
            <span className="m-value">{parking.onSite} <small style={{ opacity: 0.5 }}>/ 98</small></span>
          </div>
          <div className="metric">
            <span className="m-label">On-Street Overflow</span>
            <span className="m-value">{parking.onStreet} <small style={{ opacity: 0.5 }}>/ 22</small></span>
          </div>
        </div>
      </div>

      <div className="coming-soon" style={{ marginTop: 'auto', paddingTop: 20, textAlign: 'center', opacity: 0.4, fontSize: 10 }}>
        TokaiSim v2.1.0 • Kinetic Sentinel
      </div>
    </aside>
  );
}
