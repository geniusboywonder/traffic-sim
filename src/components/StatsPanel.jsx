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
      <div className="stat-card stat-card--watch">
        {!selectedRoad ? (
          <div className="wmy-empty">
            <span className="wmy-empty-label">Watch My Road</span>
            <span className="wmy-empty-hint">tap any street on the map</span>
          </div>
        ) : (
          <>
            <div className="card-row-1">
              <div className="v2-roadname" style={{ color: 'var(--c-3a)' }}>{selectedRoad.name}</div>
              <div className="v2-h">Traffic In: {inbound.total} / Traffic Out: {outbound.total}</div>
              <button className="rw-close" onClick={onCloseRoad}>×</button>
            </div>
            <div className="card-row-2">
              <div className="v2-h">Avg Travel Time</div>
              <div className="v2-big-num" style={{ fontSize: '1.25rem' }}>
                <span className="v2-h">In</span> {fmtMin(roadStats?.avgInDelay)} 
                <span className="v2-h" style={{ marginLeft: '10px' }}>Out</span> {fmtMin(roadStats?.avgOutDelay)}
              </div>
            </div>
            <div className="card-row-3">
              <div className="v2-h">Road Congestion</div>
              <div className="congestion-bar" style={{ height: '6px', marginTop: '4px' }}>
                <div className="congestion-fill" style={{ 
                  width: `${Math.round(((inbound.stopped + outbound.stopped) / (inbound.total + outbound.total || 1)) * 100)}%`,
                  background: 'var(--delay)'
                }} />
              </div>
            </div>
            <div className="card-row-4">
              <span>{Math.round((inbound.active / (inbound.total || 1)) * 100)}% active</span>
              <span>{Math.round((inbound.slowing / (inbound.total || 1)) * 100)}% slowing</span>
              <span>{Math.round((inbound.stopped / (inbound.total || 1)) * 100)}% stopped</span>
            </div>
          </>
        )}
      </div>

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
              <div className="card-row-1">
                <div className="v2-roadname" style={{ fontSize: '11px' }}>{c.label}</div>
                <div className="v2-h">In: {c.spawned} / Out: {c.exited}</div>
              </div>

              {!isSelected ? (
                <div className="v2-h" style={{ marginTop: '4px', opacity: 0.6 }}>Deselected — Click to focus</div>
              ) : (
                <>
                  <div className="card-row-2">
                    <div className="v2-big-num">{c.spawned + c.exited}<span className="v2-avg-time">{fmtMin(c.avgInDelay)}</span></div>
                    <div className="v2-big-num" style={{ textAlign: 'right' }}>{c.exited}<span className="v2-avg-time">{fmtMin(c.avgOutDelay)}</span></div>
                  </div>
                  <div className="card-row-3">
                    <div className="v2-h">Congestion</div>
                    <div className="congestion-bar">
                      <div className="congestion-fill" style={{
                        width: `${Math.min(100, Math.round((c.congestion ?? 0) * 100))}%`,
                        background: (c.congestion ?? 0) > 0.7 ? 'var(--delay)' : `var(--c-${id.toLowerCase()})`,
                      }} />
                    </div>
                  </div>
                  <div className="card-row-4">
                    <span>{pActive}% act</span>
                    <span>{pSlowing}% slw</span>
                    <span>{pStopped}% stp</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
});

export default StatsPanel;
