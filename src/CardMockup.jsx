// ── CardMockup.jsx ────────────────────────────────────────────────────────────
// Corridor card styled in 7 different approaches.
// Standalone page — does NOT touch any existing app code.

import { useState, useRef, useCallback } from 'react';

// ── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = {
  canvas:    '#F1F5F1',
  surfLow:   '#E1E9E1',
  surfHigh:  '#D1DAD1',
  onSurf:    '#111D13',
  muted:     '#717977',
  delay:     '#A64D4D',
  ok:        '#3D7A4A',
};

// ── Mock corridor data ────────────────────────────────────────────────────────
const CORRIDORS = [
  {
    id: '1A', label: 'Main Rd',         color: '#2D5438', lightColor: '#4A7A56',
    spawned: 87,  exited: 71,  avgInDelay: 3.8, avgOutDelay: 1.9,
    congestion: 0.62, active: 58, slowing: 28, stopped: 14,
  },
  {
    id: '2A', label: 'Homestead Ave',   color: '#709775', lightColor: '#A1CCA5',
    spawned: 198, exited: 162, avgInDelay: 4.5, avgOutDelay: 2.3,
    congestion: 0.78, active: 42, slowing: 33, stopped: 25,
  },
  {
    id: '2B', label: "Children's Way",  color: '#C4864A', lightColor: '#E0B88A',
    spawned: 243, exited: 187, avgInDelay: 5.2, avgOutDelay: 2.8,
    congestion: 0.85, active: 35, slowing: 38, stopped: 27,
  },
  {
    id: '3A', label: 'Firgrove Way',    color: '#709775', lightColor: '#A1CCA5',
    spawned: 112, exited: 98,  avgInDelay: 3.2, avgOutDelay: 1.7,
    congestion: 0.41, active: 71, slowing: 20, stopped: 9,
  },
];

function fmtTime(minutes) {
  if (!minutes) return '—';
  const s = Math.round(minutes * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Static sparkline data (fake history, 12 points)
const SPARK = {
  '1A': [30, 38, 42, 55, 60, 62, 58, 63, 65, 61, 62, 62],
  '2A': [20, 35, 50, 65, 72, 75, 78, 76, 79, 77, 78, 78],
  '2B': [15, 28, 45, 60, 72, 80, 83, 85, 86, 84, 85, 85],
  '3A': [18, 22, 28, 35, 38, 41, 40, 42, 40, 41, 41, 41],
};

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color, width = 60, height = 20 }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - (v / max) * height * 0.9,
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const fill = `${line} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <path d={fill} fill={color} fillOpacity={0.15} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Congestion bar ────────────────────────────────────────────────────────────
function CongBar({ pct, color, bg = '#D1DAD1', height = 4 }) {
  return (
    <div style={{ height, background: bg, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: pct > 0.7 ? PALETTE.delay : color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ num, title, source, children }) {
  return (
    <section style={{ marginBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: `1px solid ${PALETTE.surfHigh}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
          <span style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: PALETTE.muted }}>Style {num}</span>
          <span style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: 800, color: PALETTE.onSurf, letterSpacing: '-0.02em' }}>{title}</span>
          <a href={source} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', fontSize: 10, color: PALETTE.muted, fontFamily: 'Work Sans', letterSpacing: '0.05em', textDecoration: 'underline', textUnderlineOffset: 2 }}>source ↗</a>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {children}
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLE 1 — System Monitor (compact rows + sparklines)
// ══════════════════════════════════════════════════════════════════════════════
function Card1({ c }) {
  const rows = [
    { label: 'IN',       value: c.spawned,           unit: 'veh', spark: SPARK[c.id] },
    { label: 'OUT',      value: c.exited,             unit: 'veh', spark: SPARK[c.id].map(v => v * 0.82) },
    { label: 'AVG TIME', value: fmtTime(c.avgInDelay), unit: '',   spark: SPARK[c.id].map(v => v * 0.6) },
  ];
  const isHot = c.congestion > 0.7;
  return (
    <div style={{ background: '#1A2E1C', borderRadius: 12, padding: '1rem', fontFamily: 'Manrope', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(241,245,241,0.6)' }}>{c.label}</span>
        {isHot && <span style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 900, background: PALETTE.delay, color: '#fff', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.08em' }}>HOT</span>}
      </div>
      {/* Rows */}
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', borderRadius: 8, marginBottom: '0.2rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(241,245,241,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.05em', color: 'rgba(241,245,241,0.45)', textTransform: 'uppercase' }}>{row.label.split(' ')[0]}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 8, color: 'rgba(241,245,241,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{row.label}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: isHot && row.label === 'IN' ? PALETTE.delay : '#F1F5F1', fontVariantNumeric: 'tabular-nums' }}>{row.value}{row.unit && <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 2 }}>{row.unit}</span>}</span>
            </div>
            <Sparkline data={row.spark} color={c.lightColor} width={80} height={14} />
          </div>
        </div>
      ))}
      {/* Footer congestion */}
      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(241,245,241,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(241,245,241,0.35)' }}>Congestion</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: isHot ? PALETTE.delay : c.lightColor }}>{Math.round(c.congestion * 100)}%</span>
        </div>
        <CongBar pct={c.congestion} color={c.lightColor} bg="rgba(241,245,241,0.1)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 7, fontWeight: 800, color: 'rgba(241,245,241,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>{c.active}% active</span>
          <span>{c.slowing}% slow</span>
          <span>{c.stopped}% stop</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLE 2 — Glowing Effect (mouse-tracking glow border)
// ══════════════════════════════════════════════════════════════════════════════
function Card2({ c }) {
  const cardRef = useRef(null);
  const [glowStyle, setGlowStyle] = useState({});

  const handleMouseMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setGlowStyle({ background: `radial-gradient(circle at ${x}% ${y}%, ${c.lightColor}55 0%, transparent 65%)` });
  }, [c.lightColor]);

  const handleMouseLeave = useCallback(() => setGlowStyle({}), []);

  const isHot = c.congestion > 0.7;
  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        background: '#0E1F10',
        borderRadius: 16,
        padding: 2,
        position: 'relative',
        cursor: 'default',
        boxShadow: `0 8px 32px -8px ${c.color}44`,
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Glow layer */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', ...glowStyle, zIndex: 0 }} />
      {/* Border */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, border: `1px solid ${c.color}44`, pointerEvents: 'none', zIndex: 1 }} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, background: '#111D13', borderRadius: 14, padding: '1.25rem', fontFamily: 'Manrope' }}>
        {/* Icon + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${c.color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" stroke={c.lightColor} strokeWidth="1.5" />
              <circle cx="7" cy="7" r="2" fill={c.lightColor} />
            </svg>
          </div>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(241,245,241,0.5)' }}>{c.label}</span>
        </div>
        {/* Big counts */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.25rem' }}>
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(241,245,241,0.35)', marginBottom: 2 }}>In</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#F1F5F1', lineHeight: 1 }}>{c.spawned}</div>
            </div>
            <div>
              <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(241,245,241,0.35)', marginBottom: 2 }}>Out</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: 'rgba(241,245,241,0.55)', lineHeight: 1 }}>{c.exited}</div>
            </div>
          </div>
        </div>
        {/* Avg time */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.85rem', padding: '0.5rem 0.75rem', background: 'rgba(241,245,241,0.05)', borderRadius: 8 }}>
          <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(241,245,241,0.35)' }}>Avg Travel</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#F1F5F1', fontVariantNumeric: 'tabular-nums' }}>In {fmtTime(c.avgInDelay)} / Out {fmtTime(c.avgOutDelay)}</span>
        </div>
        {/* Congestion */}
        <CongBar pct={c.congestion} color={c.lightColor} bg="rgba(241,245,241,0.08)" height={5} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 7, fontWeight: 800, color: 'rgba(241,245,241,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>{c.active}% active</span>
          <span>{c.slowing}% slowing</span>
          <span style={{ color: isHot ? PALETTE.delay : undefined }}>{c.stopped}% stopped</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLE 3 — Simple Stats Card (clean, light, shadcn-like)
// ══════════════════════════════════════════════════════════════════════════════
function Card3({ c }) {
  const isHot = c.congestion > 0.7;
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontFamily: 'Manrope', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem 0.5rem' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.label}</span>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color }} />
      </div>
      {/* Big number */}
      <div style={{ padding: '0 1rem 0.25rem' }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#111D13', letterSpacing: '-0.04em', lineHeight: 1 }}>{c.spawned}</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8', marginTop: 3 }}>vehicles in</div>
      </div>
      {/* Sub metric */}
      <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 7 L5 3 L8 7" stroke={isHot ? PALETTE.delay : PALETTE.ok} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 600, color: isHot ? PALETTE.delay : '#475569' }}>
          {c.exited} out · avg {fmtTime(c.avgInDelay)} in
        </span>
      </div>
      {/* Congestion footer */}
      <div style={{ padding: '0.5rem 1rem 0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Congestion</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: isHot ? PALETTE.delay : '#475569' }}>{Math.round(c.congestion * 100)}%</span>
        </div>
        <CongBar pct={c.congestion} color={c.color} bg="#E2E8F0" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 7, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>{c.active}% active</span>
          <span>{c.slowing}% slowing</span>
          <span>{c.stopped}% stopped</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLE 4 — Event Card (pill-tag sentence structure)
// ══════════════════════════════════════════════════════════════════════════════
function Pill({ children, accent }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', background: accent ? `${accent}18` : '#F1F5F1', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: accent ?? PALETTE.onSurf, fontFamily: 'Manrope', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', border: accent ? `1px solid ${accent}44` : 'none' }}>
      {children}
    </span>
  );
}

function Card4({ c }) {
  const isHot = c.congestion > 0.7;
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '1.25rem', fontFamily: 'Manrope', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s ease' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.color }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: PALETTE.onSurf, letterSpacing: '-0.02em' }}>{c.label}</span>
      </div>
      {/* Sentence rows */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem', fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
        <span>in</span>
        <Pill>{c.spawned} vehicles</Pill>
        <span>out</span>
        <Pill>{c.exited} vehicles</Pill>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem', fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
        <span>avg time</span>
        <Pill>{fmtTime(c.avgInDelay)} in</Pill>
        <Pill>{fmtTime(c.avgOutDelay)} out</Pill>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
        <span>congestion</span>
        <Pill accent={isHot ? PALETTE.delay : c.color}>{Math.round(c.congestion * 100)}% · {isHot ? 'high' : c.congestion > 0.4 ? 'medium' : 'low'}</Pill>
      </div>
      {/* Bar */}
      <div style={{ marginTop: '1rem' }}>
        <CongBar pct={c.congestion} color={c.color} bg="#F1F5F1" height={3} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLE 5 — Holographic Card (3D tilt + shimmer)
// ══════════════════════════════════════════════════════════════════════════════
function Card5({ c }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, x: 50, y: 50 });

  const handleMouseMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTilt({
      rx: ((y - rect.height / 2) / 10),
      ry: ((rect.width / 2 - x) / 10),
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setTilt({ rx: 0, ry: 0, x: 50, y: 50 }), []);
  const isHot = c.congestion > 0.7;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: tilt.rx === 0 ? 'transform 0.5s ease' : 'none',
        borderRadius: 16,
        position: 'relative',
        cursor: 'default',
        willChange: 'transform',
      }}
    >
      {/* Holographic gradient background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 16,
        background: `
          radial-gradient(circle at ${tilt.x}% ${tilt.y}%, ${c.lightColor}88 0%, transparent 50%),
          linear-gradient(135deg, ${c.color}cc, #1A2E1C, ${c.lightColor}66)
        `,
        zIndex: 0,
      }} />
      {/* Shimmer overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 16,
        background: `radial-gradient(ellipse at ${tilt.x}% ${tilt.y}%, rgba(255,255,255,0.18) 0%, transparent 60%)`,
        zIndex: 1,
        pointerEvents: 'none',
      }} />
      {/* Border */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)', zIndex: 2, pointerEvents: 'none' }} />
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 3, padding: '1.25rem', fontFamily: 'Manrope' }}>
        <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: '0.75rem' }}>
          {c.id} · Corridor
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', marginBottom: '0.25rem', lineHeight: 1 }}>
          {c.label}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: '1.25rem', fontWeight: 500 }}>
          {isHot ? '⚠ High congestion' : '✓ Operating normally'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { l: 'In',       v: c.spawned },
            { l: 'Out',      v: c.exited },
            { l: 'Avg In',   v: fmtTime(c.avgInDelay) },
            { l: 'Avg Out',  v: fmtTime(c.avgOutDelay) },
          ].map(item => (
            <div key={item.l} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '0.5rem 0.625rem' }}>
              <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{item.l}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{item.v}</div>
            </div>
          ))}
        </div>
        <CongBar pct={c.congestion} color="rgba(255,255,255,0.9)" bg="rgba(0,0,0,0.3)" height={4} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 7, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>{c.active}% active</span>
          <span>{c.slowing}% slowing</span>
          <span>{c.stopped}% stopped</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLE 6 — Structured Grid Card (Meeting-Notes / Card Studio style)
// ══════════════════════════════════════════════════════════════════════════════
function Card6({ c }) {
  const isHot = c.congestion > 0.7;
  const stats = [
    { label: 'Vehicles In',    value: c.spawned,            color: c.color },
    { label: 'Vehicles Out',   value: c.exited,             color: PALETTE.muted },
    { label: 'Avg Time In',    value: fmtTime(c.avgInDelay), color: c.color },
    { label: 'Avg Time Out',   value: fmtTime(c.avgOutDelay), color: PALETTE.muted },
  ];
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', fontFamily: 'Manrope', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Card Header */}
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: PALETTE.onSurf, letterSpacing: '-0.01em' }}>{c.label}</span>
        <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', background: `${c.color}18`, color: c.color, borderRadius: 100, padding: '2px 8px', border: `1px solid ${c.color}33` }}>{c.id}</span>
      </div>
      {/* 2x2 stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#E2E8F0', margin: 0 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#fff', padding: '0.75rem 0.875rem' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>
      {/* Footer with congestion */}
      <div style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Congestion Meter</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: isHot ? PALETTE.delay : c.color }}>{Math.round(c.congestion * 100)}%</span>
        </div>
        <CongBar pct={c.congestion} color={c.color} bg="#F1F5F1" height={5} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 7, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>{c.active}% active</span>
          <span>{c.slowing}% slowing</span>
          <span>{c.stopped}% stopped</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLE 7 — Performance Benchmark Card
// ══════════════════════════════════════════════════════════════════════════════
const LOS_LEVELS = [
  { label: 'A–C', value: 0.35, color: '#22C55E' },
  { label: 'D',   value: 0.55, color: '#EAB308' },
  { label: 'E',   value: 0.75, color: '#F97316' },
  { label: 'F',   value: 1.00, color: '#EF4444' },
];

function Card7({ c }) {
  const isHot = c.congestion > 0.7;
  const benchmark = 120; // average spawned across all corridors
  const pctChange = Math.round(((c.spawned - benchmark) / benchmark) * 100);

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', fontFamily: 'Manrope', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '0.875rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>{c.label}</span>
        </div>
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#F1F5F4', color: '#64748B', borderRadius: 6, padding: '2px 7px' }}>Peak Hour</span>
      </div>
      {/* Main metric */}
      <div style={{ padding: '0.875rem 1rem 0.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.05em', color: PALETTE.onSurf, lineHeight: 1 }}>{c.spawned}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: pctChange > 0 ? PALETTE.ok : PALETTE.delay, marginTop: 3 }}>
            {pctChange > 0 ? '▲' : '▼'} {Math.abs(pctChange)}% vs avg
          </div>
        </div>
        {/* Mini benchmark bar */}
        <div style={{ flex: 1 }}>
          <div style={{ position: 'relative', height: 6, background: '#F1F5F4', borderRadius: 3, marginBottom: 6 }}>
            <div style={{ position: 'absolute', height: '100%', width: `${Math.min(100, (c.spawned / 260) * 100)}%`, background: c.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
            {/* Benchmark marker */}
            <div style={{ position: 'absolute', top: -4, left: `${(benchmark / 260) * 100}%`, width: 1, height: 14, background: PALETTE.onSurf }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94A3B8', fontWeight: 600 }}>
            <span>Avg benchmark</span>
            <span>{benchmark}</span>
          </div>
        </div>
      </div>
      {/* Route type breakdown */}
      <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #F1F5F4' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginBottom: '0.5rem' }}>Route distribution</div>
        {[
          { name: 'Main Route', value: Math.round(c.spawned * 0.72) },
          { name: 'Rat Runs',   value: Math.round(c.spawned * 0.28) },
        ].map(row => (
          <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: row.name === 'Main Route' ? c.color : PALETTE.muted, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 10, color: '#475569', fontWeight: 500 }}>{row.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: PALETTE.onSurf }}>{row.value}</span>
          </div>
        ))}
      </div>
      {/* LOS performance bar */}
      <div style={{ padding: '0.5rem 1rem 0.875rem', borderTop: '1px solid #F1F5F4' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>Level of Service</span>
        </div>
        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
          {LOS_LEVELS.map((l, i) => {
            const prev = i > 0 ? LOS_LEVELS[i - 1].value : 0;
            return <div key={l.label} style={{ flex: l.value - prev, background: l.color }} />;
          })}
        </div>
        {/* Marker for current congestion */}
        <div style={{ position: 'relative', height: 8, marginBottom: 4 }}>
          <div style={{ position: 'absolute', left: `${c.congestion * 100}%`, transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `6px solid ${isHot ? PALETTE.delay : PALETTE.onSurf}` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {LOS_LEVELS.map(l => (
            <span key={l.label} style={{ fontSize: 7, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Page root
// ══════════════════════════════════════════════════════════════════════════════
export default function CardMockup() {
  const styles = [
    { num: 1, title: 'System Monitor',            source: 'https://21st.dev/community/components/isaiahbjork/system-monitor/default',              Card: Card1 },
    { num: 2, title: 'Glowing Effect',             source: 'https://21st.dev/community/components/aceternity/glowing-effect-card/default',          Card: Card2 },
    { num: 3, title: 'Simple Stats',               source: 'https://21st.dev/community/components/b3/stats-cards/default',                          Card: Card3 },
    { num: 4, title: 'Event Card (Pill Tags)',      source: 'https://21st.dev/community/components/ravikatiyar/event-card/default',                  Card: Card4 },
    { num: 5, title: 'Holographic',                source: 'https://21st.dev/community/components/dhiluxui/holographic-card/default',               Card: Card5 },
    { num: 6, title: 'Structured Grid',            source: 'https://21st.dev/community/components/ShadcnStudio/card-studio/meeting-notes-one',      Card: Card6 },
    { num: 7, title: 'Performance Benchmark',      source: 'https://21st.dev/community/components/kavikatiyar/performance-benchmark-card/default',  Card: Card7 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: PALETTE.canvas, fontFamily: 'Manrope, sans-serif' }}>
      {/* Page header */}
      <div style={{ background: PALETTE.onSurf, padding: '2rem 2.5rem 1.75rem', marginBottom: '3rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(241,245,241,0.4)', marginBottom: '0.4rem' }}>Tokai-Sim · Design Exploration</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', color: '#F1F5F1', margin: 0, lineHeight: 1.1 }}>Corridor Card · 7 Styles</h1>
          <p style={{ fontSize: 12, color: 'rgba(241,245,241,0.45)', marginTop: '0.5rem', fontWeight: 500 }}>Same data. Same 4 corridors. Seven design directions. Each card is interactive — hover to see effects.</p>
        </div>
      </div>

      {/* All sections */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 2.5rem 4rem' }}>
        {styles.map(({ num, title, source, Card: VisualCard }) => ( // eslint-disable-line no-unused-vars
          <Section key={num} num={num} title={title} source={source}>
            {CORRIDORS.map(c => <VisualCard key={c.id} c={c} />)}
          </Section>
        ))}
      </div>
    </div>
  );
}
