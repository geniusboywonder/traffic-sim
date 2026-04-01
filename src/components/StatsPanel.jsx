// ── StatsPanel.jsx ────────────────────────────────────────────────────────────
import { memo } from 'react';

function fmtMin(min) {
  if (!min || min === 0) return '—';
  return `${min.toFixed(1)}m`;
}

const StatsPanel = memo(({ statsData, activeVehicles, selectedCorridors, onToggleCorridor, selectedRoad, roadStats, onCloseRoad }) => {
  const { corridors } = statsData;

  const inbound  = roadStats?.inbound  || { total: 0, active: 0, slowing: 0, stopped: 0 };
  const outbound = roadStats?.outbound || { total: 0, active: 0, slowing: 0, stopped: 0 };

  return (
    <aside className="stats-panel">

      {/* ── Watch My Road ── */}
      <div className="stat-card stat-card--watch" style={{ borderLeftColor: '#5B8FA8' }}>
        {!selectedRoad ? (
          <div className="wmy-empty">
            <span className="wmy-empty-label">Watch My Road</span>
            <span className="wmy-empty-hint">tap any street on the map</span>
          </div>
        ) : (
          <>
            <div className="stat-card-header">
              <div className="stat-card-label" style={{ color: '#5B8FA8' }}>{selectedRoad.name}</div>
              <button className="rw-close" onClick={onCloseRoad}>×</button>
            </div>
            <div className="rw-line">
              <div className="rw-line-title">Traffic In</div>
              <div className="rw-stats-row">
                <span className="rw-stat-pill">Total <b>{inbound.total}</b></span>
                <span className="rw-stat-pill">Active <b>{inbound.active}</b></span>
                <span className="rw-stat-pill">Slow <b>{inbound.slowing}</b></span>
                <span className="rw-stat-pill">Stop <b>{inbound.stopped}</b></span>
              </div>
            </div>
            <div className="rw-line">
              <div className="rw-line-title">Traffic Out</div>
              <div className="rw-stats-row">
                <span className="rw-stat-pill">Total <b>{outbound.total}</b></span>
                <span className="rw-stat-pill">Active <b>{outbound.active}</b></span>
                <span className="rw-stat-pill">Slow <b>{outbound.slowing}</b></span>
                <span className="rw-stat-pill">Stop <b>{outbound.stopped}</b></span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Entry / Exit Corridors ── */}
      <div className="stats-section-title">Entry / Exit Corridors</div>
      <div className="corridor-grid">
        {Object.entries(corridors).map(([id, c]) => {
          const total    = (c.active || 0) + (c.slowing || 0) + (c.stopped || 0);
          const pActive  = total > 0 ? Math.round((c.active  || 0) / total * 100) : 0;
          const pSlowing = total > 0 ? Math.round((c.slowing || 0) / total * 100) : 0;
          const pStopped = total > 0 ? Math.round((c.stopped || 0) / total * 100) : 0;
          const isSelected = selectedCorridors.has(id);

          return (
            <div
              key={id}
              className={`stat-card ${isSelected ? 'selected' : 'deselected'}`}
              style={{ borderLeftColor: `var(--c-${id.toLowerCase()})`, cursor: 'pointer' }}
              onClick={() => onToggleCorridor(id)}
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

              <div className="congestion-container">
                <div className="m-label" style={{ marginBottom: '0.2rem' }}>Congestion Meter</div>
                <div className="congestion-bar">
                  <div className="congestion-fill" style={{
                    width: `${Math.min(100, Math.round((c.congestion ?? 0) * 100))}%`,
                    background: (c.congestion ?? 0) > 0.7 ? '#A64D4D' : (c.congestion ?? 0) > 0.4 ? '#C27D60' : `var(--c-${id.toLowerCase()})`,
                  }} />
                </div>
                <div className="congestion-stats">
                  <span>{pActive}% active</span>
                  <span>{pSlowing}% slowing</span>
                  <span>{pStopped}% stopped</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </aside>
  );
});

export default StatsPanel;
