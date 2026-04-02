// ── StatsPanel.jsx ────────────────────────────────────────────────────────────
import { memo } from 'react';

function fmtTime(minutes) {
  if (!minutes || minutes === 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function CorridorCard({ id, c, isSelected, onToggle }) {
  const total    = (c.active || 0) + (c.slowing || 0) + (c.stopped || 0) || 1;
  const pActive  = Math.round((c.active  || 0) / total * 100);
  const pSlowing = Math.round((c.slowing || 0) / total * 100);
  const pStopped = Math.round((c.stopped || 0) / total * 100);
  const congPct  = Math.min(100, Math.round((c.congestion ?? 0) * 100));
  const isHot    = (c.congestion ?? 0) > 0.7;

  return (
    <div
      className={`stat-card${isSelected ? '' : ' deselected'}`}
      style={{ borderLeftColor: `var(--c-${id.toLowerCase()})`, cursor: 'pointer' }}
      onClick={() => onToggle(id)}
    >
      {/* Row 1 — road name + traffic counts */}
      <div className="card-row-1">
        <span className="sc-label">{c.label}</span>
        <span className="sc-counts">In: {c.spawned} / Out: {c.exited}</span>
      </div>

      {/* Row 2 — avg travel time */}
      <div className="card-row-2">
        <span className="sc-meta">Avg Travel Time</span>
        <span className="sc-times">In: {fmtTime(c.avgInDelay)} / Out: {fmtTime(c.avgOutDelay)}</span>
      </div>

      {/* Row 3 — congestion bar */}
      <div className="card-row-3">
        <div className="congestion-bar">
          <div className="congestion-fill" style={{
            width: `${congPct}%`,
            background: isHot ? 'var(--delay)' : `var(--c-${id.toLowerCase()})`,
          }} />
        </div>
      </div>

      {/* Row 4 — % breakdown */}
      <div className="card-row-4">
        <span>{pActive}% active</span>
        <span>{pSlowing}% slowing</span>
        <span>{pStopped}% stopped</span>
      </div>
    </div>
  );
}

const StatsPanel = memo(({ statsData, selectedCorridors, onToggleCorridor, selectedRoad, roadStats, onCloseRoad }) => {
  const { corridors } = statsData;

  const inbound  = roadStats?.inbound  || { total: 0, active: 0, slowing: 0, stopped: 0 };
  const outbound = roadStats?.outbound || { total: 0, active: 0, slowing: 0, stopped: 0 };
  const watchTotal  = (inbound.active || 0) + (inbound.slowing || 0) + (inbound.stopped || 0) || 1;
  const wCongestion = (inbound.stopped || 0) / watchTotal;
  const wActive     = Math.round((inbound.active  || 0) / watchTotal * 100);
  const wSlowing    = Math.round((inbound.slowing || 0) / watchTotal * 100);
  const wStopped    = Math.round((inbound.stopped || 0) / watchTotal * 100);

  return (
    <aside className="stats-panel">

      {/* ── Watch My Road — spans full corridor grid width ── */}
      <div className="stat-card stat-card--watch">
        {!selectedRoad ? (
          <div className="wmy-empty">
            <span className="wmy-empty-label">Watch My Road</span>
            <span className="wmy-empty-hint">Click any street on the map</span>
          </div>
        ) : (
          <>
            <div className="card-row-1">
              <span className="sc-label" style={{ color: 'var(--c-2a)' }}>{selectedRoad.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="sc-counts" style={{ color: 'rgba(241,245,241,0.7)' }}>
                  In: {inbound.total} / Out: {outbound.total}
                </span>
                <button className="rw-close" onClick={onCloseRoad}>×</button>
              </div>
            </div>
            <div className="card-row-2">
              <span className="sc-meta" style={{ color: 'rgba(241,245,241,0.5)' }}>Avg Travel Time</span>
              <span className="sc-times" style={{ color: '#F1F5F1' }}>
                In: {fmtTime(roadStats?.avgInDelay)} / Out: {fmtTime(roadStats?.avgOutDelay)}
              </span>
            </div>
            <div className="card-row-3">
              <div className="congestion-bar">
                <div className="congestion-fill" style={{
                  width: `${Math.min(100, Math.round(wCongestion * 100))}%`,
                  background: wCongestion > 0.7 ? 'var(--delay)' : 'var(--c-2a)',
                }} />
              </div>
            </div>
            <div className="card-row-4" style={{ color: 'rgba(241,245,241,0.5)' }}>
              <span>{wActive}% active</span>
              <span>{wSlowing}% slowing</span>
              <span>{wStopped}% stopped</span>
            </div>
          </>
        )}
      </div>

      {/* ── Corridor 2×2 grid ── */}
      <div className="corridor-grid">
        {Object.entries(corridors).map(([id, c]) => (
          <CorridorCard
            key={id}
            id={id}
            c={c}
            isSelected={selectedCorridors.has(id)}
            onToggle={onToggleCorridor}
          />
        ))}
      </div>

    </aside>
  );
});

export default StatsPanel;
