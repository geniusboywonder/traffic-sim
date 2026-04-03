// ── StatsPanel.jsx ────────────────────────────────────────────────────────────
import { memo, useRef, useState, useCallback } from 'react';

function fmtTime(minutes) {
  if (!minutes || minutes === 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Corridor colour palette — dark gradient backgrounds + accent lights
const CORR_BG = {
  '1A': { from: '#1A3020', to: '#0E1C11', accent: '#4A7A56', light: '#8FB89A' },
  '2A': { from: '#223B27', to: '#132215', accent: '#709775', light: '#A1CCA5' },
  '2B': { from: '#3B2910', to: '#221808', accent: '#C4864A', light: '#E0B88A' },
  '3A': { from: '#1D3322', to: '#0F1E13', accent: '#709775', light: '#A1CCA5' },
};

// ── Stat block: label above, big number below ─────────────────────────────────
function StatBlock({ label, value, accent, dim }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.22)',
      borderRadius: 8,
      padding: '0.4rem 0.55rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <span style={{
        fontSize: 7,
        fontWeight: 900,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'rgba(241,245,241,0.38)',
        lineHeight: 1,
      }}>{label}</span>
      <span style={{
        fontFamily: 'Manrope, sans-serif',
        fontSize: '1.15rem',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: dim ? 'rgba(241,245,241,0.5)' : (accent || '#F1F5F1'),
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  );
}

// ── Congestion bar ────────────────────────────────────────────────────────────
function CongBar({ pct, accent, isHot }) {
  return (
    <div style={{ height: 4, background: 'rgba(241,245,241,0.08)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        borderRadius: 2,
        background: isHot ? '#A64D4D' : accent,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// ── Corridor Card — full holographic style ────────────────────────────────────
function CorridorCard({ id, c, isSelected, onToggle }) {
  const cardRef   = useRef(null);
  const shimmerRef = useRef(null);
  const cols      = CORR_BG[id] || CORR_BG['2A'];

  const total    = (c.active || 0) + (c.slowing || 0) + (c.stopped || 0) || 1;
  const pActive  = Math.round((c.active  || 0) / total * 100);
  const pSlowing = Math.round((c.slowing || 0) / total * 100);
  const pStopped = Math.round((c.stopped || 0) / total * 100);
  const congPct  = Math.min(100, Math.round((c.congestion ?? 0) * 100));
  const isHot    = (c.congestion ?? 0) > 0.7;

  const handleMouseMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rx = ((y - rect.height / 2) / rect.height) * 10;
    const ry = ((rect.width  / 2 - x) / rect.width)  * 10;
    el.style.transform = `perspective(600px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.02)`;
    el.style.transition = 'none';
    if (shimmerRef.current) {
      const gx = (x / rect.width)  * 100;
      const gy = (y / rect.height) * 100;
      shimmerRef.current.style.background =
        `radial-gradient(ellipse at ${gx}% ${gy}%, rgba(255,255,255,0.13) 0%, transparent 65%)`;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.5s cubic-bezier(0.32,0.72,0,1), opacity 0.3s ease, box-shadow 0.3s ease';
    el.style.transform = '';
    if (shimmerRef.current) shimmerRef.current.style.background = 'transparent';
  }, []);

  return (
    <div
      ref={cardRef}
      className={`stat-card holo-card${isSelected ? '' : ' deselected'}`}
      style={{
        background: `linear-gradient(145deg, ${cols.from}, ${cols.to})`,
        borderLeft: `3px solid ${cols.accent}`,
        cursor: 'pointer',
        boxShadow: `0 8px 24px -8px ${cols.accent}44`,
        transition: 'transform 0.5s cubic-bezier(0.32,0.72,0,1), opacity 0.3s ease, box-shadow 0.3s ease',
        willChange: 'transform',
      }}
      onClick={() => onToggle(id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Shimmer overlay */}
      <div ref={shimmerRef} className="holo-shimmer" />

      {/* Row 1 — corridor ID badge + road name */}
      <div className="holo-header">
        <span className="holo-id" style={{ color: cols.accent, borderColor: `${cols.accent}55` }}>
          {id}
        </span>
        <span className="holo-label">{c.label}</span>
        {isHot && <span className="holo-hot">HOT</span>}
      </div>

      {/* Row 2 — 2×2 stat grid */}
      <div className="holo-grid">
        <StatBlock label="In"      value={c.spawned}            accent={cols.light} />
        <StatBlock label="Out"     value={c.exited}             dim />
        <StatBlock label="Avg In"  value={fmtTime(c.avgInDelay)}  accent={cols.light} />
        <StatBlock label="Avg Out" value={fmtTime(c.avgOutDelay)} dim />
      </div>

      {/* Row 3 — congestion bar */}
      <CongBar pct={congPct} accent={cols.accent} isHot={isHot} />

      {/* Row 4 — % breakdown */}
      <div className="holo-breakdown">
        <span>{pActive}% active</span>
        <span>{pSlowing}% slowing</span>
        <span style={{ color: isHot ? '#A64D4D' : undefined }}>{pStopped}% stopped</span>
      </div>
    </div>
  );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────
const StatsPanel = memo(({ statsData, selectedCorridors, onToggleCorridor, selectedRoad, roadStats, onCloseRoad }) => {
  const { corridors } = statsData;

  const watchRef    = useRef(null);
  const watchShimRef = useRef(null);

  const corrList      = Object.values(corridors);
  const totalIn       = corrList.reduce((s, c) => s + (c.spawned || 0), 0);
  const totalOut      = corrList.reduce((s, c) => s + (c.exited  || 0), 0);
  const activeDelays  = corrList.filter(c => c.avgInDelay > 0);
  const avgInTime     = activeDelays.length > 0
    ? activeDelays.reduce((s, c) => s + c.avgInDelay, 0) / activeDelays.length : 0;
  const avgOutTime    = activeDelays.length > 0
    ? activeDelays.reduce((s, c) => s + c.avgOutDelay, 0) / activeDelays.length : 0;
  const globalCong    = corrList.reduce((s, c) => s + (c.congestion || 0), 0) / Math.max(corrList.length, 1);
  const globalCongPct = Math.min(100, Math.round(globalCong * 100));
  const isGlobalHot   = globalCong > 0.7;

  const inbound  = roadStats?.inbound  || { total: 0, active: 0, slowing: 0, stopped: 0 };
  const outbound = roadStats?.outbound || { total: 0, active: 0, slowing: 0, stopped: 0 };
  const watchTotal  = (inbound.active || 0) + (inbound.slowing || 0) + (inbound.stopped || 0) || 1;
  const wCongestion = (inbound.stopped || 0) / watchTotal;
  const wActive     = Math.round((inbound.active  || 0) / watchTotal * 100);
  const wSlowing    = Math.round((inbound.slowing || 0) / watchTotal * 100);
  const wStopped    = Math.round((inbound.stopped || 0) / watchTotal * 100);
  const wCongPct    = Math.min(100, Math.round(wCongestion * 100));
  const wIsHot      = wCongestion > 0.7;

  const handleWatchMove = useCallback((e) => {
    const el = watchRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.transform = `perspective(800px) rotateX(${(((y - rect.height / 2) / rect.height) * 6).toFixed(2)}deg) rotateY(${(((rect.width / 2 - x) / rect.width) * 6).toFixed(2)}deg)`;
    el.style.transition = 'none';
    if (watchShimRef.current) {
      watchShimRef.current.style.background =
        `radial-gradient(ellipse at ${(x/rect.width*100).toFixed(0)}% ${(y/rect.height*100).toFixed(0)}%, rgba(255,255,255,0.1) 0%, transparent 60%)`;
    }
  }, []);

  const handleWatchLeave = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.style.transition = 'transform 0.5s cubic-bezier(0.32,0.72,0,1)';
      watchRef.current.style.transform = '';
    }
    if (watchShimRef.current) watchShimRef.current.style.background = 'transparent';
  }, []);

  return (
    <aside className="stats-panel">

      {/* ── Overall Summary / Watch My Road ── */}
      <div
        ref={watchRef}
        className="stat-card stat-card--watch holo-card"
        style={{ willChange: 'transform' }}
        onMouseMove={handleWatchMove}
        onMouseLeave={handleWatchLeave}
      >
        <div ref={watchShimRef} className="holo-shimmer" />

        {!selectedRoad ? (
          <>
            <div className="wmy-focus-hint">Click any road to focus on it</div>

            {/* Row 1 */}
            <div className="holo-header">
              <span className="holo-label" style={{ color: '#A1CCA5', fontSize: 9 }}>Overall Summary</span>
            </div>

            {/* Row 2 — 2×2 stat grid */}
            <div className="holo-grid">
              <StatBlock label="Total In"  value={totalIn}           accent="#A1CCA5" />
              <StatBlock label="Total Out" value={totalOut}          dim />
              <StatBlock label="Avg In"    value={fmtTime(avgInTime)}  accent="#A1CCA5" />
              <StatBlock label="Avg Out"   value={fmtTime(avgOutTime)} dim />
            </div>

            {/* Row 3 — congestion */}
            <CongBar pct={globalCongPct} accent="#709775" isHot={isGlobalHot} />

            {/* Row 4 */}
            <div className="holo-breakdown">
              <span>{corrList.reduce((s, c) => s + (c.current || 0), 0)} active vehicles</span>
              <span>{globalCongPct}% congestion</span>
            </div>
          </>
        ) : (
          <>
            {/* Row 1 */}
            <div className="holo-header">
              <span className="holo-label" style={{ color: '#A1CCA5', fontSize: 9, flex: 1 }}>{selectedRoad.name}</span>
              <button className="rw-close" onClick={onCloseRoad}>×</button>
            </div>

            {/* Row 2 */}
            <div className="holo-grid">
              <StatBlock label="In"      value={inbound.total}            accent="#A1CCA5" />
              <StatBlock label="Out"     value={outbound.total}           dim />
              <StatBlock label="Avg In"  value={fmtTime(roadStats?.avgInDelay)}  accent="#A1CCA5" />
              <StatBlock label="Avg Out" value={fmtTime(roadStats?.avgOutDelay)} dim />
            </div>

            {/* Row 3 */}
            <CongBar pct={wCongPct} accent="#709775" isHot={wIsHot} />

            {/* Row 4 */}
            <div className="holo-breakdown">
              <span>{wActive}% active</span>
              <span>{wSlowing}% slowing</span>
              <span style={{ color: wIsHot ? '#A64D4D' : undefined }}>{wStopped}% stopped</span>
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
