// ── StatsPanel.jsx ────────────────────────────────────────────────────────────
import { memo, useRef, useState, useCallback } from 'react';

function fmtTime(minutes) {
  if (!minutes || minutes === 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Corridor colour palette — light pastel backgrounds, dark text
// gradient: light pastel → slightly deeper shade of same hue
// accent: dark corridor base for borders, bar fill, and ID badge
// textDark / mutedDark: dark text colours for values and labels
const CORR_BG = {
  '1A': { from: '#8FB89A', to: '#6BA47A', accent: '#2D5438', light: '#2D5438', textDark: '#0E1C11', mutedDark: 'rgba(14,28,17,0.6)',  statBg: 'rgba(255,255,255,0.28)', trackColor: 'rgba(0,0,0,0.12)' },
  '2A': { from: '#A1CCA5', to: '#7AAF82', accent: '#415D43', light: '#415D43', textDark: '#132215', mutedDark: 'rgba(19,34,21,0.6)',  statBg: 'rgba(255,255,255,0.28)', trackColor: 'rgba(0,0,0,0.12)' },
  '2B': { from: '#E0B88A', to: '#C49660', accent: '#8B5A28', light: '#8B5A28', textDark: '#221808', mutedDark: 'rgba(34,24,8,0.6)',   statBg: 'rgba(255,255,255,0.28)', trackColor: 'rgba(0,0,0,0.12)' },
  '3A': { from: '#C8E0C8', to: '#A4C4A8', accent: '#709775', light: '#384E3E', textDark: '#0F1E13', mutedDark: 'rgba(15,30,19,0.6)',  statBg: 'rgba(255,255,255,0.28)', trackColor: 'rgba(0,0,0,0.12)' },
};

// ── Stat block: label above, big number below ─────────────────────────────────
// textColor / labelColor / bgColor override dark-theme defaults for light cards
function StatBlock({ label, value, accent, dim, textColor, labelColor, bgColor }) {
  const valueColor = textColor
    ? (dim ? `${textColor}99` : textColor)
    : (dim ? 'rgba(241,245,241,0.5)' : (accent || '#F1F5F1'));

  return (
    <div style={{
      background: bgColor || 'rgba(0,0,0,0.22)',
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
        color: labelColor || 'rgba(241,245,241,0.38)',
        lineHeight: 1,
      }}>{label}</span>
      <span style={{
        fontFamily: 'Manrope, sans-serif',
        fontSize: '1.15rem',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: valueColor,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</span>
    </div>
  );
}

// ── Congestion bar ────────────────────────────────────────────────────────────
function CongBar({ pct, accent, isHot, trackColor }) {
  return (
    <div style={{ height: 4, background: trackColor || 'rgba(241,245,241,0.08)', borderRadius: 2, overflow: 'hidden' }}>
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
        <span className="holo-label" style={{ color: cols.mutedDark }}>{c.label}</span>
        {isHot && <span className="holo-hot">STOPPED</span>}
      </div>

      {/* Row 2 — 2×2 stat grid */}
      <div className="holo-grid">
        <StatBlock label="Traffic In"   value={c.spawned}              accent={cols.light} textColor={cols.textDark} labelColor={cols.mutedDark} bgColor={cols.statBg} />
        <StatBlock label="Avg Time In"  value={fmtTime(c.avgInDelay)}  accent={cols.light} textColor={cols.textDark} labelColor={cols.mutedDark} bgColor={cols.statBg} />
        <StatBlock label="Traffic Out"  value={c.exited}               dim                 textColor={cols.textDark} labelColor={cols.mutedDark} bgColor={cols.statBg} />
        <StatBlock label="Avg Time Out" value={fmtTime(c.avgOutDelay)} dim                 textColor={cols.textDark} labelColor={cols.mutedDark} bgColor={cols.statBg} />
      </div>

      {/* Row 3 — congestion bar */}
      <CongBar pct={congPct} accent={cols.accent} isHot={isHot} trackColor={cols.trackColor} />

      {/* Row 4 — % breakdown */}
      <div className="holo-breakdown" style={{ color: cols.mutedDark }}>
        <span>{pActive}% active</span>
        <span>{pSlowing}% slowing</span>
        <span style={{ color: isHot ? '#8B1A1A' : undefined }}>{pStopped}% stopped</span>
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
  const netActive     = corrList.reduce((s, c) => s + (c.active  || 0), 0);
  const netSlowing    = corrList.reduce((s, c) => s + (c.slowing || 0), 0);
  const netStopped    = corrList.reduce((s, c) => s + (c.stopped || 0), 0);
  const netTotal      = netActive + netSlowing + netStopped || 1;
  const netPActive    = Math.round(netActive  / netTotal * 100);
  const netPSlowing   = Math.round(netSlowing / netTotal * 100);
  const netPStopped   = Math.round(netStopped / netTotal * 100);

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
            {/* Hint — same position in both states */}
            <div className="wmy-focus-hint">Select any road on the map to focus on it</div>

            {/* Row 1 */}
            <div className="holo-header">
              <span className="holo-label" style={{ color: 'rgba(15,30,19,0.6)', fontSize: 9 }}>Overall Summary</span>
            </div>

            {/* Row 2 — 2×2 stat grid */}
            <div className="holo-grid">
              <StatBlock label="Total In"     value={totalIn}             textColor="#0F1E13" labelColor="rgba(15,30,19,0.55)" bgColor="rgba(255,255,255,0.28)" />
              <StatBlock label="Avg Time In"  value={fmtTime(avgInTime)}  textColor="#0F1E13" labelColor="rgba(15,30,19,0.55)" bgColor="rgba(255,255,255,0.28)" />
              <StatBlock label="Total Out"    value={totalOut}            textColor="#0F1E13" labelColor="rgba(15,30,19,0.55)" bgColor="rgba(255,255,255,0.28)" dim />
              <StatBlock label="Avg Time Out" value={fmtTime(avgOutTime)} textColor="#0F1E13" labelColor="rgba(15,30,19,0.55)" bgColor="rgba(255,255,255,0.28)" dim />
            </div>

            {/* Row 3 — congestion */}
            <CongBar pct={globalCongPct} accent="#709775" isHot={isGlobalHot} trackColor="rgba(0,0,0,0.12)" />

            {/* Row 4 */}
            <div className="holo-breakdown" style={{ color: 'rgba(15,30,19,0.55)' }}>
              <span>{netPActive}% active</span>
              <span>{netPSlowing}% slowing</span>
              <span style={{ color: isGlobalHot ? '#8B1A1A' : undefined }}>{netPStopped}% stopped</span>
            </div>
          </>
        ) : (
          <>
            {/* Hint — same position as idle state, clickable to return to summary */}
            <button
              className="wmy-focus-hint"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}
              onClick={onCloseRoad}
            >
              Click here to see Overall Traffic Summary
            </button>

            {/* Row 1 */}
            <div className="holo-header">
              <span className="holo-label" style={{ color: 'rgba(15,30,19,0.6)', fontSize: 9, flex: 1 }}>{selectedRoad.name}</span>
              <button className="rw-close" onClick={onCloseRoad}>×</button>
            </div>

            {/* Row 2 */}
            <div className="holo-grid">
              <StatBlock label="Total In"     value={inbound.total}                   textColor="#0F1E13" labelColor="rgba(15,30,19,0.55)" bgColor="rgba(255,255,255,0.28)" />
              <StatBlock label="Avg Time In"  value={fmtTime(roadStats?.avgInDelay)}  textColor="#0F1E13" labelColor="rgba(15,30,19,0.55)" bgColor="rgba(255,255,255,0.28)" />
              <StatBlock label="Total Out"    value={outbound.total}                  textColor="#0F1E13" labelColor="rgba(15,30,19,0.55)" bgColor="rgba(255,255,255,0.28)" dim />
              <StatBlock label="Avg Time Out" value={fmtTime(roadStats?.avgOutDelay)} textColor="#0F1E13" labelColor="rgba(15,30,19,0.55)" bgColor="rgba(255,255,255,0.28)" dim />
            </div>

            {/* Row 3 */}
            <CongBar pct={wCongPct} accent="#709775" isHot={wIsHot} trackColor="rgba(0,0,0,0.12)" />

            {/* Row 4 */}
            <div className="holo-breakdown" style={{ color: 'rgba(15,30,19,0.55)' }}>
              <span>{wActive}% active</span>
              <span>{wSlowing}% slowing</span>
              <span style={{ color: wIsHot ? '#8B1A1A' : undefined }}>{wStopped}% stopped</span>
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
