// ── StatsPanel.jsx ────────────────────────────────────────────────────────────
import { memo, useRef, useCallback } from 'react';
import { Eye, EyeOff, Car, Timer, ArrowUpFromLine, ArrowDownFromLine, X } from 'lucide-react';

function fmtTime(minutes) {
  if (!minutes || minutes === 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Corridor colour palette
const CORR_BG = {
  '1A': { from: '#8FB89A', to: '#6BA47A', accent: '#2D5438', light: '#2D5438', textDark: '#0E1C11', mutedDark: 'rgba(14,28,17,0.6)',  statBg: 'rgba(255,255,255,0.28)', trackColor: 'rgba(0,0,0,0.12)' },
  '2A': { from: '#A1CCA5', to: '#7AAF82', accent: '#415D43', light: '#415D43', textDark: '#132215', mutedDark: 'rgba(19,34,21,0.6)',  statBg: 'rgba(255,255,255,0.28)', trackColor: 'rgba(0,0,0,0.12)' },
  '2B': { from: '#E0B88A', to: '#C49660', accent: '#8B5A28', light: '#8B5A28', textDark: '#221808', mutedDark: 'rgba(34,24,8,0.6)',   statBg: 'rgba(255,255,255,0.28)', trackColor: 'rgba(0,0,0,0.12)' },
  '3A': { from: '#C8E0C8', to: '#A4C4A8', accent: 'var(--c-3a)', light: '#384E3E', textDark: '#0F1E13', mutedDark: 'rgba(15,30,19,0.6)',  statBg: 'rgba(255,255,255,0.28)', trackColor: 'rgba(0,0,0,0.12)' },
};

function StatBlock({ label, value, accent, dim, textColor, labelColor, bgColor }) {
  const valueColor = textColor
    ? (dim ? `${textColor}99` : textColor)
    : (dim ? 'rgba(241,245,241,0.5)' : (accent || 'var(--canvas)'));

  return (
    <div style={{
      background: bgColor || 'rgba(0,0,0,0.15)',
      borderRadius: 8,
      padding: '0.2rem 0.4rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      flex: 1,
      minWidth: 0,
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      <span style={{
        fontSize: '0.6rem',
        fontWeight: 900,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: labelColor || 'rgba(241,245,241,0.38)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>{label}</span>
      <span style={{
        fontFamily: 'Manrope, sans-serif',
        fontSize: '1.1rem',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: valueColor,
        lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>{value}</span>
    </div>
  );
}

function CongBar({ pct, accent, isHot, trackColor }) {
  return (
    <div style={{ height: 6, background: trackColor || 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        borderRadius: 3,
        background: isHot ? '#8B1A1A' : accent,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

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
      className={`stat-card holo-card`}
      style={{
        background: `linear-gradient(145deg, ${cols.from}, ${cols.to})`,
        borderLeft: `3px solid ${cols.accent}`,
        cursor: 'pointer',
        boxShadow: `0 8px 24px -8px ${cols.accent}44`,
        transition: 'transform 0.5s cubic-bezier(0.32,0.72,0,1), opacity 0.3s ease, box-shadow 0.3s ease',
        willChange: 'transform',
        position: 'relative',
        padding: '0.6rem 0.75rem',
        gap: '0.2rem'
      }}
      onClick={() => onToggle(id)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ opacity: isSelected ? 1 : 0.2, transition: 'opacity 0.3s ease' }}>
        <div ref={shimmerRef} className="holo-shimmer" />

        <div className="holo-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="holo-id" style={{ color: cols.accent, borderColor: `${cols.accent}55` }}>
              {id}
            </span>
            <span className="holo-label" style={{ color: cols.mutedDark }}>{c.label}</span>
            {isHot && <span className="holo-hot" style={{display:'none'}}></span>}
          </div>
          <div 
            className="holo-eye" 
            style={{ 
              color: isSelected ? cols.accent : cols.mutedDark,
              opacity: isSelected ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}
          >
            {isSelected ? <Eye size={14} strokeWidth={3} /> : <EyeOff size={14} strokeWidth={3} />}
          </div>
        </div>

        <div className="holo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem', marginTop: '0.5rem', minWidth: 0 }}>
          {/* Row 1 — Traffic */}
          <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr', gap: '0.4rem', alignItems: 'center', minWidth: 0 }}>
            <Car size={18} strokeWidth={2.5} color={cols.mutedDark} style={{ flexShrink: 0, opacity: 0.8 }} />
            <StatBlock label="In"  value={c.spawned} accent={cols.light} textColor={cols.textDark} labelColor={cols.mutedDark} bgColor={cols.statBg} />
            <StatBlock label="Out" value={c.exited}  dim                 textColor={cols.textDark} labelColor={cols.mutedDark} bgColor={cols.statBg} />
          </div>
          {/* Row 2 — Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr', gap: '0.4rem', alignItems: 'center', minWidth: 0 }}>
            <Timer size={18} strokeWidth={2.5} color={cols.mutedDark} style={{ flexShrink: 0, opacity: 0.8 }} />
            <StatBlock label="In"  value={fmtTime(c.avgInDelay)}  accent={cols.light} textColor={cols.textDark} labelColor={cols.mutedDark} bgColor={cols.statBg} />
            <StatBlock label="Out" value={fmtTime(c.avgOutDelay)} dim                 textColor={cols.textDark} labelColor={cols.mutedDark} bgColor={cols.statBg} />
          </div>
        </div>

        <div style={{ marginTop: '0.5rem' }}>
          <CongBar pct={congPct} accent={cols.accent} isHot={isHot} trackColor={cols.trackColor} />
        </div>

        <div className="holo-breakdown" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '0.4rem',
          fontSize: '0.5rem',
          fontWeight: 900,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: cols.mutedDark,
          opacity: 0.8,
          padding: '0 0.1rem'
        }}>
          <span>{pActive}% active</span>
          <span>{pSlowing}% slowing</span>
          <span style={{ color: isHot ? '#8B1A1A' : undefined }}>{pStopped}% stopped</span>
        </div>
      </div>
    </div>
  );
}

const StatsPanel = memo(({ statsData, selectedCorridors, onToggleCorridor, selectedRoad, roadStats, onCloseRoad }) => {
  const { corridors } = statsData;
  const watchRef    = useRef(null);
  const watchShimRef = useRef(null);

  const corrList      = Object.values(corridors);
  const totalIn       = corrList.reduce((s, c) => s + (c.spawned || 0), 0);
  const totalOut      = corrList.reduce((s, c) => s + (c.exited  || 0), 0);
  const activeDelays  = corrList.filter(c => c.avgInDelay > 0);
  const avgInTime     = activeDelays.length > 0 ? activeDelays.reduce((s, c) => s + c.avgInDelay, 0) / activeDelays.length : 0;
  const avgOutTime    = activeDelays.length > 0 ? activeDelays.reduce((s, c) => s + c.avgOutDelay, 0) / activeDelays.length : 0;
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
      watchShimRef.current.style.background = `radial-gradient(ellipse at ${(x/rect.width*100).toFixed(0)}% ${(y/rect.height*100).toFixed(0)}%, rgba(255,255,255,0.1) 0%, transparent 60%)`;
    }
  }, []);

  const handleWatchLeave = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.style.transition = 'transform 0.5s cubic-bezier(0.32,0.72,0,1)';
      watchRef.current.style.transform = '';
    }
    if (watchShimRef.current) watchShimRef.current.style.background = 'transparent';
  }, []);

  const summaryCols = { mutedDark: 'rgba(15,30,19,0.6)', textDark: '#0F1E13', statBg: 'rgba(255,255,255,0.28)' };

  return (
    <aside className="stats-panel">
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
            <div className="wmy-focus-hint" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flexWrap: 'wrap' }}>
              <ArrowUpFromLine size={12} strokeWidth={3} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <span>Select any road on the map to focus on it</span>
            </div>
            <div className="holo-header">
              <ArrowUpFromLine size={14} strokeWidth={3} color="rgba(15,30,19,0.6)" style={{ marginRight: '0.3rem' }} />
              <span className="holo-label" style={{ color: 'rgba(15,30,19,0.6)', fontSize: '0.6rem' }}>Overall Summary</span>
            </div>
            <div className="holo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem', marginTop: '0.5rem', minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr', gap: '0.4rem', alignItems: 'center', minWidth: 0 }}>
                <Car size={18} strokeWidth={2.5} color={summaryCols.mutedDark} style={{ flexShrink: 0, opacity: 0.8 }} />
                <StatBlock label="In"  value={totalIn}  textColor={summaryCols.textDark} labelColor={summaryCols.mutedDark} bgColor={summaryCols.statBg} />
                <StatBlock label="Out" value={totalOut} textColor={summaryCols.textDark} labelColor={summaryCols.mutedDark} bgColor={summaryCols.statBg} dim />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr', gap: '0.4rem', alignItems: 'center', minWidth: 0 }}>
                <Timer size={18} strokeWidth={2.5} color={summaryCols.mutedDark} style={{ flexShrink: 0, opacity: 0.8 }} />
                <StatBlock label="In"  value={fmtTime(avgInTime)}  textColor={summaryCols.textDark} labelColor={summaryCols.mutedDark} bgColor={summaryCols.statBg} />
                <StatBlock label="Out" value={fmtTime(avgOutTime)} textColor={summaryCols.textDark} labelColor={summaryCols.mutedDark} bgColor={summaryCols.statBg} dim />
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <CongBar pct={globalCongPct} accent="var(--c-3a)" isHot={isGlobalHot} trackColor="rgba(0,0,0,0.12)" />
            </div>
            <div className="holo-breakdown" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginTop: '0.4rem',
              fontSize: '0.5rem',
              fontWeight: 900,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'rgba(15,30,19,0.55)',
              padding: '0 0.1rem'
            }}>
              <span>{netPActive}% active</span>
              <span>{netPSlowing}% slowing</span>
              <span style={{ color: isGlobalHot ? '#8B1A1A' : undefined }}>{netPStopped}% stopped</span>
            </div>
          </>
        ) : (
          <>
            <button className="wmy-focus-hint" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={onCloseRoad}>
              <ArrowDownFromLine size={12} strokeWidth={3} /> Click here to see Overall Traffic Summary
            </button>
            <div className="holo-header">
              <ArrowDownFromLine size={14} strokeWidth={3} color="rgba(15,30,19,0.6)" style={{ marginRight: '0.3rem' }} />
              <span className="holo-label" style={{ color: 'rgba(15,30,19,0.6)', fontSize: '0.6rem', flex: 1 }}>{selectedRoad.name}</span>
              <button className="rw-close" onClick={onCloseRoad}><X size={14} /></button>
            </div>
            <div className="holo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem', marginTop: '0.5rem', minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr', gap: '0.4rem', alignItems: 'center', minWidth: 0 }}>
                <Car size={18} strokeWidth={2.5} color={summaryCols.mutedDark} style={{ flexShrink: 0, opacity: 0.8 }} />
                <StatBlock label="In"  value={inbound.total}  textColor={summaryCols.textDark} labelColor={summaryCols.mutedDark} bgColor={summaryCols.statBg} />
                <StatBlock label="Out" value={outbound.total} textColor={summaryCols.textDark} labelColor={summaryCols.mutedDark} bgColor={summaryCols.statBg} dim />
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <CongBar pct={wCongPct} accent="var(--c-3a)" isHot={wIsHot} trackColor="rgba(0,0,0,0.12)" />
            </div>
            <div className="holo-breakdown" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginTop: '0.4rem',
              fontSize: '0.5rem',
              fontWeight: 900,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'rgba(15,30,19,0.55)',
              padding: '0 0.1rem'
            }}>
              <span>{wActive}% active</span>
              <span>{wSlowing}% slowing</span>
              <span style={{ color: wIsHot ? '#8B1A1A' : undefined }}>{wStopped}% stopped</span>
            </div>
          </>
        )}
      </div>
      <div className="corridor-grid">
        {['3A', '2B', '2A', '1A'].map(id => corridors[id] ? (
          <CorridorCard key={id} id={id} c={corridors[id]} isSelected={selectedCorridors.has(id)} onToggle={onToggleCorridor} />
        ) : null)}
      </div>
    </aside>
  );
});

export default StatsPanel;
