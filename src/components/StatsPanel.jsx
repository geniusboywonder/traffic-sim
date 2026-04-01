// ── StatsPanel.jsx ────────────────────────────────────────────────────────────
// Receives statsData, activeVehicles, totalVehicles from App.

function fmtMin(min) {
  if (min === undefined || min === null || min === 0) return '0.0m';
  return `${min.toFixed(1)}m`;
}

export default function StatsPanel({
  statsData,
  selectedCorridors,
  onToggleCorridor,
  selectedRoad,
  roadStats,
  onCloseRoad
}) {
  const { corridors, parking } = statsData;

  // Stats for Watch My Road
  let inbound = roadStats?.inbound || { total: 0, active: 0, slowing: 0, stopped: 0 };
  let outbound = roadStats?.outbound || { total: 0, active: 0, slowing: 0, stopped: 0 };

  return (
    <aside className="stats-panel">

      {/* ── Watch My Road ────────────────────────────────────────────────── */}
      <div className="stats-section-title">Watch My Road</div>
      {!selectedRoad ? (
        <div className="stat-card" style={{ textAlign: 'center', opacity: 0.6, fontStyle: 'italic', fontSize: 11 }}>
          select any street on the map to see traffic activity
        </div>
      ) : (
        <div className="stat-card" style={{ borderLeftColor: '#8aebff' }}>
          <div className="stat-card-header">
            <div className="stat-card-label" style={{ color: '#8aebff' }}>{selectedRoad.name}</div>
            <button className="rw-close" onClick={onCloseRoad} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          
          <div className="rw-line" style={{ marginTop: 8 }}>
            <div className="rw-line-title" style={{ fontSize: 9, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Traffic In</div>
            <div className="rw-stats-row" style={{ display: 'flex', gap: 3, flexWrap: 'nowrap' }}>
              <span className="rw-stat-pill">Total:<b>{inbound.total}</b></span>
              <span className="rw-stat-pill">Active:<b>{inbound.active}</b></span>
              <span className="rw-stat-pill">Slowing:<b>{inbound.slowing}</b></span>
              <span className="rw-stat-pill">Stopped:<b>{inbound.stopped}</b></span>
            </div>
          </div>

          <div className="rw-line" style={{ marginTop: 8 }}>
            <div className="rw-line-title" style={{ fontSize: 9, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 4 }}>Traffic Out</div>
            <div className="rw-stats-row" style={{ display: 'flex', gap: 3, flexWrap: 'nowrap' }}>
              <span className="rw-stat-pill">Total:<b>{outbound.total}</b></span>
              <span className="rw-stat-pill">Active:<b>{outbound.active}</b></span>
              <span className="rw-stat-pill">Slowing:<b>{outbound.slowing}</b></span>
              <span className="rw-stat-pill">Stopped:<b>{outbound.stopped}</b></span>
            </div>
          </div>
        </div>
      )}

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
                <div className="stat-card-label">{c.label}</div>
                <span className="total-count">In: {c.spawned} / Out: {c.exited}</span>
              </div>

              <div className="metrics-row">
                <div className="metric">
                  <span className="m-label">Active</span>
                  <span className="m-value">{c.current}</span>
                </div>
                <div className="metric">
                  <span className="m-label">Avg Time In</span>
                  <span className="m-value">{fmtMin(c.avgInDelay)}</span>
                </div>
                <div className="metric">
                  <span className="m-label">Avg Time Out</span>
                  <span className="m-value">{fmtMin(c.avgOutDelay)}</span>
                </div>
              </div>

              <div className="congestion-container" style={{ marginTop: 8 }}>
                <div className="m-label" style={{ marginBottom: 4, opacity: 0.8 }}>Congestion Meter</div>
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
