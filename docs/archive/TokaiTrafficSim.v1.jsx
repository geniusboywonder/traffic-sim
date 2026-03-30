import { useState, useEffect, useRef, useCallback } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────

const SCENARIOS = {
  H: {
    label: "High", trips: 840, peakMin: 45, ratRunThreshold: 0.70,
    dwellTime: 45, description: "TIA worst-case — 840 trips, sharp 45-min peak, no reductions applied"
  },
  M: {
    label: "Medium", trips: 650, peakMin: 60, ratRunThreshold: 0.80,
    dwellTime: 45, description: "Notional 15% reduction — 650 trips over 60-min window"
  },
  L: {
    label: "Low", trips: 500, peakMin: 75, ratRunThreshold: 0.85,
    dwellTime: 45, description: "Notional 40% reduction — 500 trips over 75-min window"
  }
};

// Trip distribution from TIA §13
const TRIP_ORIGINS = [
  { id: "dreyersdal_n", label: "Dreyersdal Rd (N)", pct: 0.11, type: "external" },
  { id: "homestead",    label: "Homestead Ave",     pct: 0.21, type: "external" },
  { id: "childrens",   label: "Children's Way",     pct: 0.25, type: "external" },
  { id: "dreyersdal_s",label: "Dreyersdal Rd (S)",  pct: 0.13, type: "external" },
  { id: "christopher", label: "Christopher Rd",     pct: 0.04, type: "local" },
  { id: "starke_n",    label: "Starke Rd (N)",      pct: 0.10, type: "local" },
  { id: "starke_s",    label: "Starke Rd (S)",      pct: 0.12, type: "local" },
  { id: "leyden",      label: "Leyden Rd",          pct: 0.03, type: "local" },
  { id: "ruskin_e",    label: "Ruskin Rd (E)",       pct: 0.01, type: "local" },
];

// Road segments with baseline capacity (vehicles/hour, estimated for Class 5 unless noted)
const ROAD_SEGMENTS = [
  { id: "main_rd",       label: "Main Rd (M4)",           capacity: 1800, class: "arterial",   studied: true,  knownLOS: "E/F" },
  { id: "ladies_mile",   label: "Ladies Mile Rd (MR127)", capacity: 1600, class: "arterial",   studied: true,  knownLOS: "C" },
  { id: "dreyersdal",   label: "Dreyersdal Rd",          capacity: 900,  class: "collector",  studied: true,  knownLOS: "D" },
  { id: "homestead_ave", label: "Homestead Ave",          capacity: 700,  class: "collector",  studied: true,  knownLOS: "C" },
  { id: "childrens_way", label: "Children's Way",         capacity: 700,  class: "collector",  studied: true,  knownLOS: "C" },
  { id: "firgrove",      label: "Firgrove Way",           capacity: 500,  class: "collector",  studied: false, knownLOS: null },
  { id: "starke",        label: "Starke Rd",             capacity: 300,  class: "local-5",    studied: false, knownLOS: null },
  { id: "christopher_rd",label: "Christopher Rd",         capacity: 300,  class: "local-5",    studied: false, knownLOS: null },
  { id: "ruskin",        label: "Ruskin Rd (ingress)",   capacity: 200,  class: "local-5",    studied: false, knownLOS: null },
  { id: "aristea",       label: "Aristea Rd (egress)",   capacity: 200,  class: "local-5",    studied: false, knownLOS: null },
  { id: "leyden_rd",     label: "Leyden Rd",             capacity: 150,  class: "local-5",    studied: false, knownLOS: null },
];

// Key intersection failure points
const INTERSECTIONS = [
  { id: "main_dreyersdal", label: "Main Rd / Dreyersdal Rd", vc: 1.25, los: "F", studied: true,  critical: true },
  { id: "ruskin_leyden",   label: "Ruskin Rd / Leyden Rd",   vc: null,  los: "?", studied: false, critical: true },
  { id: "starke_homestead",label: "Starke Rd / Homestead Ave",vc: null, los: "?", studied: false, critical: false },
];

// What-if toggle groups
const WHATIF_GROUPS = [
  {
    id: "road_capacity",
    icon: "🚗",
    label: "Road Capacity Realities",
    description: "Physical constraints the TIA ignored",
    color: "#ef4444",
    items: [
      { id: "parking_conflict", label: "On-street parking conflict", description: "22 bays on Ruskin Rd — loses one moving lane during drop-off", effect: "−35% Ruskin Rd capacity" },
      { id: "narrow_carriageway", label: "Narrow carriageway friction", description: "Class 5 road width never evaluated against 840 peak trips", effect: "×0.85 capacity on Ruskin Rd" },
      { id: "pedestrian_conflict", label: "Pedestrian-vehicle conflict", description: "No footpaths — learners walk on carriageway", effect: "×0.80 capacity friction" },
      { id: "aristea_delay", label: "Aristea Rd egress geometry", description: "Cul-de-sac conversion — no turning analysis done", effect: "+30s per vehicle at egress" },
    ]
  },
  {
    id: "demand_mgmt",
    icon: "📋",
    label: "Demand Management",
    description: "Interventions the TIA never recommended",
    color: "#3b82f6",
    items: [
      { id: "stp", label: "School Travel Plan (STP)", description: "Conservative STP estimate — reduces total vehicle trips by 15%", effect: "−15% total trips" },
      { id: "staggered_bells", label: "Staggered bell times (15 min)", description: "Spreads arrival spike across two waves — softens peak sharply", effect: "Splits peak into 2 waves" },
      { id: "marshal", label: "Traffic marshal at Ruskin/Leyden", description: "Increases junction throughput by 25% — reduces ingress queue", effect: "+25% junction throughput" },
    ]
  },
  {
    id: "modal_split",
    icon: "🚶",
    label: "Modal Split",
    description: "Trips that don't generate a car — ignored in TIA",
    color: "#22c55e",
    items: [
      { id: "walkers", label: "Walkers & cyclists (15%)", description: "TIA applied zero modal reduction — contested by independent review", effect: "−15% vehicles (~126 fewer)" },
      { id: "public_transport", label: "Public transport — MBT / GABS (10%)", description: "Bus routes on Main Rd and Ladies Mile Rd entirely unacknowledged", effect: "−10% vehicles (~84 fewer)" },
      { id: "lift_clubs", label: "Lift clubs / carpooling (5%)", description: "No carpooling factor modelled in TIA", effect: "−5% vehicles (~42 fewer)" },
    ]
  }
];

// ─── SVG MAP LAYOUT ───────────────────────────────────────────────────────────
// Schematic road network — coordinates normalised to 800×600 viewBox

const MAP_W = 800, MAP_H = 580;

// Road paths as polylines [x,y] arrays
const ROAD_PATHS = {
  main_rd:       [[640,0],[640,150],[640,580]],
  ladies_mile:   [[0,420],[200,380],[400,360]],
  dreyersdal:    [[200,0],[280,160],[320,260],[360,340]],
  homestead_ave: [[640,150],[520,200],[420,240],[360,280]],
  childrens_way: [[400,360],[380,320],[360,300],[350,280]],
  firgrove:      [[280,160],[310,220],[330,260]],
  starke:        [[360,120],[360,220],[360,300],[360,380]],
  christopher_rd:[[360,300],[340,340],[330,370],[320,390]],
  ruskin:        [[220,360],[270,360],[320,360],[360,360]],
  aristea:       [[360,360],[360,400],[360,440],[340,470]],
  leyden_rd:     [[360,300],[330,330],[310,360],[280,360]],
};

// Key locations
const SCHOOL_POS   = { x: 355, y: 365 };
const LABEL_OFFSET = 10;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function calcVC(segId, trips, whatIfActive, whatIfItems) {
  const seg = ROAD_SEGMENTS.find(s => s.id === segId);
  if (!seg) return 0;

  // Apportion trips to segment based on which origins flow through it
  const segLoad = {
    main_rd:        trips * (0.21 + 0.13) * 0.5,
    ladies_mile:    trips * 0.25,
    dreyersdal:     trips * (0.11 + 0.13),
    homestead_ave:  trips * 0.21,
    childrens_way:  trips * 0.25,
    firgrove:       trips * 0.11,
    starke:         trips * (0.10 + 0.12),
    christopher_rd: trips * (0.04 + 0.13 * 0.5),
    ruskin:         trips * 1.0,   // all trips pass through ingress
    aristea:        trips * 1.0,   // all trips pass through egress
    leyden_rd:      trips * 0.03,
  }[segId] || 0;

  let cap = seg.capacity;

  // Apply What if... capacity modifiers
  if (whatIfActive && segId === "ruskin") {
    if (whatIfItems.parking_conflict)   cap *= 0.65;
    if (whatIfItems.narrow_carriageway) cap *= 0.85;
    if (whatIfItems.pedestrian_conflict)cap *= 0.80;
  }
  if (whatIfActive && segId === "aristea") {
    if (whatIfItems.aristea_delay) cap *= 0.65;
  }

  // STP reduces demand
  let load = segLoad;
  if (whatIfActive) {
    let reduction = 1.0;
    if (whatIfItems.stp)             reduction *= 0.85;
    if (whatIfItems.walkers)         reduction *= 0.85;
    if (whatIfItems.public_transport)reduction *= 0.90;
    if (whatIfItems.lift_clubs)      reduction *= 0.95;
    load *= reduction;
  }

  // Marshal improves ruskin throughput
  if (whatIfActive && whatIfItems.marshal && segId === "ruskin") cap *= 1.25;

  // Staggered bells spread load
  if (whatIfActive && whatIfItems.staggered_bells) load *= 0.7;

  return load / cap;
}

function losFromVC(vc) {
  if (vc < 0.60) return { los: "A–B", color: "#22c55e", label: "Free flow" };
  if (vc < 0.75) return { los: "C",   color: "#eab308", label: "Stable" };
  if (vc < 0.90) return { los: "D",   color: "#f97316", label: "Approaching unstable" };
  if (vc < 1.00) return { los: "E",   color: "#ef4444", label: "Unstable" };
  return               { los: "F",   color: "#7f1d1d", label: "FAILURE" };
}

function polylinePoints(pts) {
  return pts.map(p => p.join(",")).join(" ");
}

function midpoint(pts) {
  const mid = Math.floor(pts.length / 2);
  return pts[mid];
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function ScenarioBadge({ active, scenario, onClick }) {
  const colors = { H: "#ef4444", M: "#f97316", L: "#22c55e" };
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? colors[scenario] : "transparent",
        border: `2px solid ${colors[scenario]}`,
        color: active ? "#fff" : colors[scenario],
        borderRadius: 6, padding: "6px 18px",
        fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13,
        cursor: "pointer", transition: "all 0.2s",
        letterSpacing: 1,
      }}
    >
      {scenario}
    </button>
  );
}

function RoadMap({ scenario, whatIfActive, whatIfItems }) {
  const trips = SCENARIOS[scenario].trips;

  const getSegStyle = (segId) => {
    const vc = calcVC(segId, trips, whatIfActive, whatIfItems);
    const { color } = losFromVC(vc);
    const seg = ROAD_SEGMENTS.find(s => s.id === segId);
    const isModified = whatIfActive && ["ruskin","aristea"].includes(segId);
    return { stroke: color, strokeWidth: seg?.class === "arterial" ? 6 : seg?.class === "collector" ? 4 : 3,
             strokeDasharray: isModified ? "8 4" : "none", opacity: 0.92 };
  };

  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", height: "100%", display: "block" }}>
      {/* Background */}
      <rect width={MAP_W} height={MAP_H} fill="#0f1117" rx={12} />

      {/* Grid lines for urban feel */}
      {[...Array(16)].map((_,i) => (
        <line key={`gx${i}`} x1={i*54} y1={0} x2={i*54} y2={MAP_H}
          stroke="#ffffff08" strokeWidth={1} />
      ))}
      {[...Array(11)].map((_,i) => (
        <line key={`gy${i}`} x1={0} y1={i*58} x2={MAP_W} y2={i*58}
          stroke="#ffffff08" strokeWidth={1} />
      ))}

      {/* Compass */}
      <text x={760} y={30} fill="#ffffff40" fontSize={10} fontFamily="monospace">N↑</text>

      {/* Road segments */}
      {Object.entries(ROAD_PATHS).map(([segId, pts]) => {
        const style = getSegStyle(segId);
        return (
          <g key={segId}>
            {/* Shadow / glow */}
            <polyline points={polylinePoints(pts)}
              fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth + 6}
              opacity={0.15} strokeLinecap="round" strokeLinejoin="round" />
            {/* Main road */}
            <polyline points={polylinePoints(pts)}
              fill="none" stroke={style.stroke} strokeWidth={style.strokeWidth}
              strokeDasharray={style.strokeDasharray}
              opacity={style.opacity} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}

      {/* Road labels */}
      {[
        { id: "main_rd",       text: "Main Rd (M4)",    pos: [650, 80],  anchor: "start" },
        { id: "ladies_mile",   text: "Ladies Mile Rd",  pos: [80, 415],  anchor: "start" },
        { id: "dreyersdal",   text: "Dreyersdal Rd",   pos: [190, 80],  anchor: "start" },
        { id: "homestead_ave", text: "Homestead Ave",   pos: [510, 195], anchor: "middle" },
        { id: "childrens_way", text: "Children's Way",  pos: [400, 375], anchor: "middle" },
        { id: "starke",        text: "Starke Rd",       pos: [370, 200], anchor: "start" },
        { id: "christopher_rd",text: "Christopher Rd",  pos: [295, 355], anchor: "end" },
        { id: "ruskin",        text: "Ruskin Rd ⬅ INGRESS", pos: [235, 350], anchor: "start" },
        { id: "aristea",       text: "Aristea Rd ⬆ EGRESS",pos: [368, 420], anchor: "start" },
        { id: "firgrove",      text: "Firgrove Way",    pos: [295, 205], anchor: "end" },
        { id: "leyden_rd",     text: "Leyden Rd",       pos: [285, 348], anchor: "end" },
      ].map(({ id, text, pos, anchor }) => {
        const vc = calcVC(id, trips, whatIfActive, whatIfItems);
        const { color } = losFromVC(vc);
        return (
          <text key={id} x={pos[0]} y={pos[1]} fill={color} fontSize={9.5}
            fontFamily="'DM Mono', monospace" textAnchor={anchor} opacity={0.9}>
            {text}
          </text>
        );
      })}

      {/* Intersection markers */}
      {[
        { id: "main_dreyersdal", x: 640, y: 260, critical: true, studied: true,  label: "LOS F\nv/c=1.25" },
        { id: "ruskin_leyden",   x: 310, y: 360, critical: true, studied: false, label: "UNSTUDIED\nIngress ⚠" },
        { id: "starke_homestead",x: 420, y: 240, critical: false, studied: false, label: "UNSTUDIED" },
      ].map(({ id, x, y, critical, studied, label }) => (
        <g key={id}>
          <circle cx={x} cy={y} r={critical ? 10 : 7}
            fill={studied ? (critical ? "#7f1d1d" : "#f97316") : "#6b21a8"}
            stroke={critical ? "#ef4444" : "#a855f7"}
            strokeWidth={2} opacity={0.9} />
          {critical && (
            <text x={x} y={y+1} fill="#fff" fontSize={8} fontWeight="bold"
              textAnchor="middle" dominantBaseline="middle" fontFamily="monospace">!</text>
          )}
        </g>
      ))}

      {/* School site */}
      <rect x={SCHOOL_POS.x - 16} y={SCHOOL_POS.y - 16} width={32} height={32}
        fill="#1e3a5f" stroke="#60a5fa" strokeWidth={2} rx={4} />
      <text x={SCHOOL_POS.x} y={SCHOOL_POS.y + 1} fill="#60a5fa" fontSize={14}
        textAnchor="middle" dominantBaseline="middle">🏫</text>
      <text x={SCHOOL_POS.x} y={SCHOOL_POS.y + 26} fill="#93c5fd" fontSize={8}
        textAnchor="middle" fontFamily="'DM Mono', monospace">TOKAI HS</text>

      {/* Origin arrows / labels */}
      {[
        { text: "↓ North (11%)",     x: 280,  y: 18,  color: "#94a3b8" },
        { text: "← East Homestead (21%)", x: 645, y: 145, color: "#94a3b8" },
        { text: "← Children's Way (25%)", x: 20,  y: 355, color: "#94a3b8" },
        { text: "↑ South (13%)",     x: 645,  y: 568, color: "#94a3b8" },
      ].map(({ text, x, y, color }) => (
        <text key={text} x={x} y={y} fill={color} fontSize={9}
          fontFamily="'DM Mono', monospace" opacity={0.7}>{text}</text>
      ))}

      {/* Rat-run overlay label */}
      <text x={170} y={300} fill="#eab308" fontSize={9} fontFamily="'DM Mono', monospace"
        opacity={0.6} transform="rotate(-25,170,300)">↪ rat-run route</text>

      {/* What-if modified indicator */}
      {whatIfActive && (
        <rect x={8} y={8} width={200} height={22} fill="#7c3aed22" stroke="#7c3aed"
          strokeWidth={1} rx={4} />
      )}
      {whatIfActive && (
        <text x={16} y={23} fill="#a78bfa" fontSize={10}
          fontFamily="'DM Mono', monospace" fontWeight={700}>⚠ WHAT IF... ACTIVE</text>
      )}

      {/* Legend */}
      {[
        { color: "#22c55e", label: "LOS A–B  Free flow" },
        { color: "#eab308", label: "LOS C    Stable" },
        { color: "#f97316", label: "LOS D    Approaching" },
        { color: "#ef4444", label: "LOS E    Unstable" },
        { color: "#7f1d1d", label: "LOS F    FAILURE" },
      ].map(({ color, label }, i) => (
        <g key={label}>
          <rect x={MAP_W - 148} y={MAP_H - 100 + i * 18} width={10} height={10} fill={color} rx={2} />
          <text x={MAP_W - 134} y={MAP_H - 91 + i * 18} fill="#94a3b8" fontSize={9}
            fontFamily="'DM Mono', monospace">{label}</text>
        </g>
      ))}

      {/* Unstudied badge */}
      <circle cx={MAP_W - 142} cy={MAP_H - 12} r={5} fill="#6b21a8" stroke="#a855f7" strokeWidth={1.5} />
      <text x={MAP_W - 133} y={MAP_H - 8} fill="#c4b5fd" fontSize={9} fontFamily="'DM Mono', monospace">Unstudied intersection</text>
    </svg>
  );
}

function ZoneCounter({ segId, label, trips, whatIfActive, whatIfItems, showDelta }) {
  const vc    = calcVC(segId, trips, whatIfActive, whatIfItems);
  const vcBase= calcVC(segId, trips, false, {});
  const { los, color, label: statusLabel } = losFromVC(vc);
  const queue = Math.max(0, Math.round((vc - 0.6) * 80));
  const wait  = Math.max(0, Math.round((vc - 0.6) * 240));
  const delta = vc - vcBase;
  const seg   = ROAD_SEGMENTS.find(s => s.id === segId);

  return (
    <div style={{
      background: "#0f1117", border: `1px solid ${color}44`,
      borderLeft: `3px solid ${color}`, borderRadius: 8,
      padding: "10px 12px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
          {label}
        </span>
        <span style={{
          background: color + "33", color, borderRadius: 4, padding: "2px 7px",
          fontSize: 10, fontFamily: "monospace", fontWeight: 700,
        }}>LOS {los}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {[
          ["v/c ratio", vc.toFixed(2)],
          ["Queue est.", queue > 0 ? `${queue} veh` : "—"],
          ["Avg wait", wait > 0 ? `${Math.floor(wait/60)}m ${wait%60}s` : "—"],
          ["Status", seg?.studied === false ? "⚠ UNSTUDIED" : statusLabel],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ color: "#64748b", fontSize: 9, fontFamily: "monospace" }}>{k}</div>
            <div style={{ color: k === "Status" && v.includes("UNSTUDIED") ? "#a855f7" : color,
              fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>{v}</div>
          </div>
        ))}
      </div>
      {showDelta && whatIfActive && (
        <div style={{
          marginTop: 6, paddingTop: 6, borderTop: "1px solid #ffffff10",
          fontSize: 9, fontFamily: "monospace",
          color: delta < -0.05 ? "#22c55e" : delta > 0.05 ? "#ef4444" : "#64748b"
        }}>
          Δ vs TIA baseline: {delta > 0 ? "+" : ""}{(delta * 100).toFixed(0)}% v/c
          {delta < -0.05 ? " ✓ improved" : delta > 0.05 ? " ↑ worse" : " ≈ unchanged"}
        </div>
      )}
    </div>
  );
}

function WhatIfGroup({ group, activeItems, onToggleItem }) {
  const [expanded, setExpanded] = useState(false);
  const anyActive = group.items.some(i => activeItems[i.id]);

  return (
    <div style={{
      border: `1px solid ${anyActive ? group.color + "66" : "#ffffff15"}`,
      borderRadius: 8, marginBottom: 10, overflow: "hidden",
      background: anyActive ? group.color + "08" : "transparent",
      transition: "all 0.2s",
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "10px 12px",
          background: "transparent", border: "none", cursor: "pointer",
          color: "#e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>{group.icon}</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace",
              color: anyActive ? group.color : "#e2e8f0" }}>{group.label}</div>
            <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace" }}>
              {group.description}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {anyActive && (
            <span style={{
              background: group.color + "33", color: group.color,
              borderRadius: 4, padding: "1px 6px", fontSize: 9, fontFamily: "monospace",
            }}>
              {group.items.filter(i => activeItems[i.id]).length} ON
            </span>
          )}
          <span style={{ color: "#475569", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid #ffffff10", padding: "8px 12px 12px" }}>
          {group.items.map(item => (
            <div key={item.id} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "8px 0", borderBottom: "1px solid #ffffff08",
            }}>
              <div
                onClick={() => onToggleItem(item.id)}
                style={{
                  width: 32, height: 18, borderRadius: 9, cursor: "pointer", flexShrink: 0,
                  background: activeItems[item.id] ? group.color : "#1e293b",
                  border: `1px solid ${activeItems[item.id] ? group.color : "#334155"}`,
                  position: "relative", transition: "all 0.2s", marginTop: 2,
                }}
              >
                <div style={{
                  position: "absolute", top: 2, left: activeItems[item.id] ? 14 : 2,
                  width: 12, height: 12, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s",
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                  color: activeItems[item.id] ? group.color : "#94a3b8", marginBottom: 2,
                }}>{item.label}</div>
                <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", lineHeight: 1.4 }}>
                  {item.description}
                </div>
                <div style={{
                  marginTop: 3, fontSize: 9, fontFamily: "monospace",
                  color: activeItems[item.id] ? group.color + "cc" : "#334155",
                  fontStyle: "italic",
                }}>→ {item.effect}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [scenario, setScenario]     = useState("H");
  const [whatIfItems, setWhatIfItems] = useState({});

  const whatIfActive = Object.values(whatIfItems).some(Boolean);

  const toggleItem = (id) => {
    setWhatIfItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const resetAll = () => {
    setScenario("H");
    setWhatIfItems({});
  };

  const trips = SCENARIOS[scenario].trips;

  // Compute adjusted trips for summary
  let adjTrips = trips;
  if (whatIfItems.stp)             adjTrips *= 0.85;
  if (whatIfItems.walkers)         adjTrips *= 0.85;
  if (whatIfItems.public_transport)adjTrips *= 0.90;
  if (whatIfItems.lift_clubs)      adjTrips *= 0.95;
  const tripsRemoved = Math.round(trips - adjTrips);

  const activeGroupCount = WHATIF_GROUPS.filter(g => g.items.some(i => whatIfItems[i.id])).length;

  return (
    <div style={{
      background: "#080b12",
      minHeight: "100vh",
      fontFamily: "'DM Mono', monospace",
      color: "#e2e8f0",
    }}>
      {/* Import fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f1117; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #ffffff15",
        background: "#0a0e1a",
        padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: 18, fontWeight: 800, letterSpacing: -0.5,
            fontFamily: "'Space Grotesk', sans-serif",
            color: "#fff",
          }}>
            🏫 Tokai High School — Traffic Impact Simulator
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
            AM Peak School Run · Based on TIA ITS 4839 (July 2025) · Erf 1061, Bergvliet
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {whatIfActive && (
            <div style={{
              background: "#7c3aed22", border: "1px solid #7c3aed",
              borderRadius: 6, padding: "4px 12px",
              color: "#a78bfa", fontSize: 11, fontWeight: 700,
              animation: "pulse 2s infinite",
            }}>
              ⚠ WHAT IF... ACTIVE ({activeGroupCount} group{activeGroupCount !== 1 ? "s" : ""})
            </div>
          )}
          <button onClick={resetAll} style={{
            background: "transparent", border: "1px solid #334155",
            color: "#64748b", borderRadius: 6, padding: "4px 12px",
            fontSize: 10, cursor: "pointer", fontFamily: "monospace",
          }}>↺ Reset to TIA Baseline</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", height: "calc(100vh - 57px)" }}>

        {/* Map */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, borderRadius: 12, overflow: "hidden", border: "1px solid #ffffff12" }}>
            <RoadMap scenario={scenario} whatIfActive={whatIfActive} whatIfItems={whatIfItems} />
          </div>

          {/* Zone table */}
          <div style={{ marginTop: 12 }}>
            <div style={{
              fontSize: 10, color: "#475569", fontFamily: "monospace", marginBottom: 6,
              textTransform: "uppercase", letterSpacing: 1,
            }}>
              Zone Detail — {SCENARIOS[scenario].label} Scenario
              {whatIfActive ? " + What If..." : " · TIA Baseline"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {[
                { id: "ruskin",        label: "Ruskin Rd Ingress" },
                { id: "main_rd",       label: "Main Rd / Dreyersdal" },
                { id: "starke",        label: "Starke Rd" },
                { id: "christopher_rd",label: "Christopher Rd" },
              ].map(({ id, label }) => {
                const vc    = calcVC(id, trips, whatIfActive, whatIfItems);
                const vcBase= calcVC(id, trips, false, {});
                const { los, color } = losFromVC(vc);
                const delta = vc - vcBase;
                const seg   = ROAD_SEGMENTS.find(s => s.id === id);
                return (
                  <div key={id} style={{
                    background: "#0f1117", borderRadius: 8, padding: "8px 10px",
                    border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`,
                  }}>
                    <div style={{ fontSize: 9, color: "#64748b", marginBottom: 3 }}>{label}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color }}>
                        {vc.toFixed(2)}
                      </span>
                      <span style={{
                        fontSize: 9, background: color + "33", color,
                        borderRadius: 4, padding: "1px 5px",
                      }}>LOS {los}</span>
                    </div>
                    {seg?.studied === false && (
                      <div style={{ fontSize: 9, color: "#a855f7", marginTop: 2 }}>⚠ UNSTUDIED</div>
                    )}
                    {whatIfActive && Math.abs(delta) > 0.01 && (
                      <div style={{
                        fontSize: 9, color: delta < 0 ? "#22c55e" : "#ef4444",
                        marginTop: 2,
                      }}>
                        Δ {delta > 0 ? "+" : ""}{(delta * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{
          borderLeft: "1px solid #ffffff10",
          background: "#0a0e1a",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>

            {/* Layer 1 */}
            <div style={{
              fontSize: 10, color: "#475569", letterSpacing: 1, textTransform: "uppercase",
              marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #ffffff10",
            }}>
              Layer 1 — TIA Baseline
            </div>

            {/* Scenario selector */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>Scenario</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["H","M","L"].map(s => (
                  <ScenarioBadge key={s} scenario={s} active={scenario === s}
                    onClick={() => setScenario(s)} />
                ))}
              </div>
              <div style={{
                marginTop: 8, fontSize: 9, color: "#475569", fontFamily: "monospace",
                lineHeight: 1.5, background: "#ffffff05", borderRadius: 6, padding: "6px 8px",
              }}>
                {SCENARIOS[scenario].description}
              </div>
            </div>

            {/* Key figures */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14,
            }}>
              {[
                { label: "AM Peak Trips", value: trips.toLocaleString(), color: "#f97316" },
                { label: "Peak Window", value: `${SCENARIOS[scenario].peakMin} min`, color: "#60a5fa" },
                { label: "Adjusted Trips", value: whatIfActive ? Math.round(adjTrips).toLocaleString() : "—", color: "#a78bfa" },
                { label: "Trips Removed", value: whatIfActive && tripsRemoved > 0 ? `−${tripsRemoved}` : "—", color: "#22c55e" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "#0f1117", border: "1px solid #ffffff10",
                  borderRadius: 8, padding: "8px 10px",
                }}>
                  <div style={{ fontSize: 9, color: "#64748b" }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Zone counters */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>Live Zone Counters</div>
              {[
                { id: "ruskin",        label: "Ruskin Rd / Leyden Rd Ingress" },
                { id: "main_rd",       label: "Main Rd / Dreyersdal Rd" },
                { id: "starke",        label: "Starke Rd" },
                { id: "aristea",       label: "Aristea Rd Egress" },
              ].map(({ id, label }) => (
                <ZoneCounter key={id} segId={id} label={label} trips={trips}
                  whatIfActive={whatIfActive} whatIfItems={whatIfItems} showDelta={true} />
              ))}
            </div>

            {/* Layer 2 divider */}
            <div style={{
              fontSize: 10, color: "#7c3aed", letterSpacing: 1, textTransform: "uppercase",
              marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #7c3aed33",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>Layer 2 — What If...</span>
              {whatIfActive && (
                <button onClick={() => setWhatIfItems({})} style={{
                  background: "transparent", border: "1px solid #7c3aed44",
                  color: "#7c3aed", borderRadius: 4, padding: "2px 8px",
                  fontSize: 9, cursor: "pointer", fontFamily: "monospace",
                }}>Clear all</button>
              )}
            </div>

            <div style={{
              fontSize: 9, color: "#475569", marginBottom: 10, lineHeight: 1.5,
            }}>
              Toggle groups below to overlay variables the TIA did not model. Changes apply live on top of the active scenario.
            </div>

            {/* What-if groups */}
            {WHATIF_GROUPS.map(group => (
              <WhatIfGroup key={group.id} group={group}
                activeItems={whatIfItems} onToggleItem={toggleItem} />
            ))}

          </div>

          {/* Footer */}
          <div style={{
            borderTop: "1px solid #ffffff10", padding: "10px 14px",
            fontSize: 9, color: "#334155", lineHeight: 1.6,
          }}>
            ⚠ Communicative visualisation only — not a certified traffic model.
            Based on ITS 4839 TIA Draft + ITS Global Independent Review Mar 2026.
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
