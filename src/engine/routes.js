// ── routes.js ─────────────────────────────────────────────────────────────────
// Junction data, road-snap helpers, CTRL_STYLE, and ROUTE_CONFIG.
// Ported from .superpowers/brainstorm/1603-1774702783/routes-on-map-v2.html
// Coordinates are [lat, lng] throughout (converted from GeoJSON [lng, lat]).

import roadsData from '../data/bergvliet-roads.json';

// ── Junction coordinates ──────────────────────────────────────────────────────
// Sourced from junctions.geojson (GeoJSON coords are [lon, lat] — we store [lat, lon])
export const JUNCTIONS = {
  1:  { lat: -34.055818, lng: 18.460897, name: 'Main Rd / Dreyersdal Rd',              control: 'priority_stop' },
  2:  { lat: -34.055213, lng: 18.459043, name: 'Dreyersdal Rd / Dreyersdal Farm Rd',   control: 'yield' },
  3:  { lat: -34.055697, lng: 18.456319, name: 'Dreyersdal Farm Rd / Starke Rd south', control: 'yield' },
  4:  { lat: -34.049908, lng: 18.451617, name: 'Starke Rd / Christopher Rd',           control: 'stop' },
  5:  { lat: -34.050291, lng: 18.451102, name: 'Christopher Rd / Vineyard Rd',         control: 'yield' },
  6:  { lat: -34.050232, lng: 18.447228, name: 'Vineyard Rd / Leyden Rd',              control: 'yield' },
  7:  { lat: -34.051039, lng: 18.447309, name: 'School Ingress — Leyden Rd / Ruskin Rd', control: 'critical' },
  8:  { lat: -34.051193, lng: 18.457989, name: "Ladies Mile / Children's Way",         control: 'traffic_signal' },
  9:  { lat: -34.044112, lng: 18.451770, name: 'Ladies Mile / Homestead Ave',          control: 'priority_stop' },
  10: { lat: -34.045008, lng: 18.448799, name: 'Homestead Ave / Starke Rd',            control: '4way_stop' },
  11: { lat: -34.042601, lng: 18.444545, name: 'Firgrove Way west entry',              control: 'yield' },
  12: { lat: -34.042366, lng: 18.445805, name: 'Starke Rd north / Firgrove Rd',        control: 'merge' },
  13: { lat: -34.041334, lng: 18.448684, name: 'Firgrove Way / Dreyersdal Rd',         control: 'priority_stop' },
  14: { lat: -34.053536, lng: 18.451861, name: 'Airlie Rd south / Dante Rd south',     control: 'yield' },
  15: { lat: -34.051531, lng: 18.455003, name: 'Airlie Rd / Dreyersdal Rd',            control: 'stop' },
  16: { lat: -34.051581, lng: 18.452230, name: 'Dante Rd / Vineyard Rd',               control: 'stop' },
  17: { lat: -34.051969, lng: 18.451382, name: 'Dante Rd / Ruskin Rd',                 control: 'yield' },
  18: { lat: -34.049272, lng: 18.452509, name: 'Dreyersdal Rd / Christopher Rd east',  control: 'yield' },
  19: { lat: -34.052900, lng: 18.453026, name: 'Vineyard Rd east / Airlie Rd',         control: 'yield' },
  20: { lat: -34.052454, lng: 18.450016, name: 'School Egress — Aristea Rd',           control: 'egress' },
  21: { lat: -34.055798, lng: 18.455408, name: 'Dreyersdal Farm Rd / Tussendal Avenue',control: 'yield' },
  22: { lat: -34.052339, lng: 18.453965, name: 'Starke Rd / Airlie Rd',                control: 'stop_directional' },
  23: { lat: -34.053159, lng: 18.452619, name: 'Tussendal Avenue / Airlie Rd',         control: 'yield' },
  24: { lat: -34.048973, lng: 18.450967, name: 'Starke Rd / Clement Rd',               control: 'stop' },
  25: { lat: -34.049384, lng: 18.447158, name: 'Clement Rd / Leyden Rd',               control: 'yield' },
  26: { lat: -34.052626, lng: 18.456216, name: "Children's Way / Dreyersdal Rd",       control: '4way_stop' },
  27: { lat: -34.053388, lng: 18.454687, name: "Children's Way / Starke Rd",           control: 'stop_directional' },
  28: { lat: -34.044726, lng: 18.449741, name: 'Homestead Ave / Dreyersdal Rd',        control: '4way_stop' },
  29: { lat: -34.051135, lng: 18.450243, name: 'Ruskin Rd / Aristea Rd — roundabout', control: 'roundabout_planned' },
};

// ── 12 junction IDs shown on the map as markers ───────────────────────────────
export const VISIBLE_JUNCTIONS = [1, 4, 5, 6, 7, 8, 9, 10, 13, 18, 20, 26, 28, 29];

// ── Control type visual styles ────────────────────────────────────────────────
export const CTRL_STYLE = {
  traffic_signal:     { color: '#f59e0b', symbol: '▶' },
  priority_stop:      { color: '#fb923c', symbol: '⊗' },
  '4way_stop':        { color: '#fb923c', symbol: '✕' },
  stop:               { color: '#64748b', symbol: '●' },
  yield:              { color: '#a3e635', symbol: '△' },
  critical:           { color: '#ef4444', symbol: '▼' },
  egress:             { color: '#3b82f6', symbol: '○' },
  roundabout_planned: { color: '#c084fc', symbol: '◎' },
};

// ── Road geometry ─────────────────────────────────────────────────────────────
export const ROAD_LINES = roadsData.features.filter(
  (f) => f.geometry?.type === 'LineString',
);

// ── Road-snap routing ─────────────────────────────────────────────────────────
// from/to are [lat, lon]. Returns [[lat,lon], ...] following road geometry.
export function snapSegment(from, to) {
  let best = null, bestScore = Infinity;
  for (const feat of ROAD_LINES) {
    const coords = feat.geometry.coordinates; // GeoJSON: [lon, lat]
    let fi = 0, fD = Infinity, ti = 0, tD = Infinity;
    coords.forEach(([lon, lat], i) => {
      const df = (lon - from[1]) ** 2 + (lat - from[0]) ** 2;
      const dt = (lon - to[1])   ** 2 + (lat - to[0])   ** 2;
      if (df < fD) { fD = df; fi = i; }
      if (dt < tD) { tD = dt; ti = i; }
    });
    const score = fD + tD;
    if (score < bestScore) {
      bestScore = score;
      const s = Math.min(fi, ti);
      const e = Math.max(fi, ti);
      let slice = coords.slice(s, e + 1).map(([lon, lat]) => [lat, lon]);
      if (fi > ti) slice.reverse();
      best = slice;
    }
  }
  // Use road geometry if both endpoints snap within combined ~300 m
  return (best && best.length >= 2 && bestScore < 0.000010) ? best : [from, to];
}

// Lazily extract internal school road geometry from GeoJSON (J7→J20).
// Returns [[lat,lon], ...] in the inbound direction (J7 is entry, J20 is exit).
let _internalRoadGeom = null;
function getInternalRoadGeometry() {
  if (_internalRoadGeom) return _internalRoadGeom;
  const feat = ROAD_LINES.find(f => f.properties?.name === 'Tokai High School Internal Road');
  if (!feat) return null;
  // GeoJSON coords are [lon, lat] — convert to [lat, lon]
  const coords = feat.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  // Ensure direction: J7 is the ingress end, J20 is the egress end.
  // Check which end is closer to J7.
  const j7 = JUNCTIONS[7];
  const j20 = JUNCTIONS[20];
  const first = coords[0];
  const last  = coords[coords.length - 1];
  const d7first  = (first[0] - j7.lat) ** 2 + (first[1] - j7.lng) ** 2;
  const d7last   = (last[0]  - j7.lat) ** 2 + (last[1]  - j7.lng) ** 2;
  // If J20 is closer to the first coord, reverse so J7 is the start.
  _internalRoadGeom = d7first <= d7last ? coords : [...coords].reverse();
  return _internalRoadGeom;
}

// Chain snapSegment calls for a full multi-junction route.
// waypoints: array of junction IDs.
// Special case: J7→J20 always uses the internal school road geometry.
export function roadRoute(waypoints) {
  if (waypoints.length < 2) return waypoints.map((id) => {
    const j = JUNCTIONS[id];
    return [j.lat, j.lng];
  });
  const pts = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const fromId = waypoints[i];
    const toId   = waypoints[i + 1];

    let seg;
    // Use actual school road geometry for the internal J7↔J20 segment
    if ((fromId === 7 && toId === 20) || (fromId === 20 && toId === 7)) {
      const internalGeom = getInternalRoadGeometry();
      if (internalGeom) {
        seg = (fromId === 7) ? internalGeom : [...internalGeom].reverse();
      }
    }

    if (!seg) {
      const a = JUNCTIONS[fromId];
      const b = JUNCTIONS[toId];
      seg = snapSegment([a.lat, a.lng], [b.lat, b.lng]);
    }

    if (i > 0 && pts.length) pts.pop(); // avoid duplicating join point
    pts.push(...seg);
  }
  return pts;
}

// ── ROUTE_CONFIG ──────────────────────────────────────────────────────────────
// 17 inbound routes (4 main + 13 rat-runs) + 2 egress routes.
// junctions: ordered array of junction IDs in travel direction.
// maxVehicles: capacity constant for density / stats calculations.
// geometry: computed lazily on first access (expensive to pre-compute all 19).

const RAW_ROUTES = {
  // ── Corridor 1A — Main Rd / Dreyersdal N (entry J1) ──────────────────────
  '1A':     { name: 'Route 1A — Main Rd (N1)',         corridor: '1A', type: 'main',   junctions: [1,2,3,27,22,4,5,6,7],          maxVehicles: 50 },
  '1A-RR1': { name: 'Rat-run 1A-1: Dreyersdal→Airlie', corridor: '1A', type: 'ratrun', junctions: [1,2,15,18,4,5,6,7],            maxVehicles: 25 },
  '1A-RR2': { name: 'Rat-run 1A-2: →Starke→Vineyard',  corridor: '1A', type: 'ratrun', junctions: [1,2,3,27,22,19,16,5,6,7],      maxVehicles: 25 },
  '1A-RR3': { name: 'Rat-run 1A-3: →Starke→Ruskin',    corridor: '1A', type: 'ratrun', junctions: [1,2,3,27,22,19,16,17,7],       maxVehicles: 20 },
  '1A-RR4': { name: 'Rat-run 1A-4: →Tussendal→Ruskin', corridor: '1A', type: 'ratrun', junctions: [1,2,3,27,22,19,23,14,17,7],    maxVehicles: 20 },
  '1A-RR5': { name: 'Rat-run 1A-5: FarmRd→Tussendal',  corridor: '1A', type: 'ratrun', junctions: [1,2,3,21,23,14,17,7],          maxVehicles: 20 },
  '1A-RR6': { name: 'Rat-run 1A-6: FarmRd→Vineyard',   corridor: '1A', type: 'ratrun', junctions: [1,2,3,21,23,19,16,5,6,7],      maxVehicles: 20 },

  // ── Corridor 2A — Homestead Ave (entry J9) ────────────────────────────────
  '2A':     { name: 'Route 2A — Homestead Ave',        corridor: '2A', type: 'main',   junctions: [9,28,18,4,5,6,7],              maxVehicles: 60 },
  '2A-RR1': { name: 'Rat-run 2A-1: →Homestead/Starke→Clement→Leyden', corridor: '2A', type: 'ratrun', junctions: [9,28,10,24,25,6,7], maxVehicles: 30 },
  '2A-RR2': { name: 'Rat-run 2A-2: →Homestead/Starke→Clement→Christopher', corridor: '2A', type: 'ratrun', junctions: [9,28,10,24,4,5,6,7], maxVehicles: 30 },

  // ── Corridor 2B — Children's Way (entry J8) ───────────────────────────────
  '2B':     { name: "Route 2B — Children's Way",       corridor: '2B', type: 'main',   junctions: [8,26,15,18,4,5,6,7],           maxVehicles: 70 },
  '2B-RR1': { name: "Rat-run 2B-1: →Starke→Christopher", corridor: '2B', type: 'ratrun', junctions: [8,26,27,22,4,5,6,7],        maxVehicles: 35 },
  '2B-RR2': { name: "Rat-run 2B-2: →Starke→Vineyard→Christopher", corridor: '2B', type: 'ratrun', junctions: [8,26,27,22,19,16,5,6,7], maxVehicles: 30 },
  '2B-RR3': { name: "Rat-run 2B-3: →Starke→Vineyard→Ruskin", corridor: '2B', type: 'ratrun', junctions: [8,26,27,22,19,16,17,7], maxVehicles: 25 },

  // ── Corridor 3A — Firgrove Way (entry J13) ───────────────────────────────
  '3A':     { name: 'Route 3A — Firgrove Way',         corridor: '3A', type: 'main',   junctions: [13,12,10,24,4,5,6,7],          maxVehicles: 40 },
  '3A-RR1': { name: 'Rat-run 3A-1: →Starke→Clement→Leyden', corridor: '3A', type: 'ratrun', junctions: [13,12,10,24,25,6,7],       maxVehicles: 20 },
  '3A-RR2': { name: 'Rat-run 3A-2: →Starke→Christopher→Vineyard', corridor: '3A', type: 'ratrun', junctions: [13,12,10,24,4,5,16,17,7], maxVehicles: 20 },

  // ── Egress routes (post drop-off) ─────────────────────────────────────────
  // All start at J7 (school gate) → J20 (Aristea exit) → J29 (roundabout) → right onto Dante
  // EG-A (40%): Dante → Vineyard → Airlie → Starke → Children's Way → Ladies Mile
  'EG-A':   { name: "Egress A — Dante→Vineyard→Children's Way", corridor: 'egress', type: 'egress', junctions: [7,20,29,17,16,19,22,26,8], maxVehicles: 30 },
  // EG-B (25%): Dante → Vineyard → Airlie → Dreyersdal Rd → Main Rd
  'EG-B':   { name: 'Egress B — Dante→Vineyard→Airlie→Main Rd', corridor: 'egress', type: 'egress', junctions: [7,20,29,17,16,19,15,2,1], maxVehicles: 20 },
  // EG-C (15%): Dante south → Tussendal Ave → Dreyersdal Farm Rd → Main Rd
  'EG-C':   { name: 'Egress C — Dante→Tussendal→Main Rd',       corridor: 'egress', type: 'egress', junctions: [7,20,29,17,14,23,21,2,1], maxVehicles: 15 },
  // EG-D (20%): Dante → Starke → Firgrove Service Rd
  'EG-D':   { name: 'Egress D — Dante→Starke→Firgrove',         corridor: 'egress', type: 'egress', junctions: [7,20,29,17,16,5,4,24,10,12,13], maxVehicles: 20 },
};

// Build route config with lazy geometry computation
const _geometryCache = {};

export const ROUTE_CONFIG = Object.fromEntries(
  Object.entries(RAW_ROUTES).map(([id, r]) => [
    id,
    {
      ...r,
      get geometry() {
        if (!_geometryCache[id]) {
          _geometryCache[id] = roadRoute(r.junctions);
        }
        return _geometryCache[id];
      },
    },
  ]),
);

// Grouped by corridor for spawner use
export const CORRIDOR_ROUTES = {
  '1A': { main: '1A',  ratRuns: ['1A-RR1','1A-RR2','1A-RR3','1A-RR4','1A-RR5','1A-RR6'] },
  '2A': { main: '2A',  ratRuns: ['2A-RR1','2A-RR2'] },
  '2B': { main: '2B',  ratRuns: ['2B-RR1','2B-RR2','2B-RR3'] },
  '3A': { main: '3A',  ratRuns: ['3A-RR1','3A-RR2'] },
};

// ── Route Junction Positions ────────────────────────────────────────────────
// Returns [{junctionId, pos}] for EVERY junction on the route (including start/end).
const _routeJidCache = {};
export function getRouteJunctions(routeId) {
  if (_routeJidCache[routeId]) return _routeJidCache[routeId];
  const route = ROUTE_CONFIG[routeId];
  if (!route?.junctions || !route.geometry || route.geometry.length < 2) return [];

  const geom = route.geometry;
  const R    = 6371000;
  const cumDist = [0];
  for (let i = 1; i < geom.length; i++) {
    const [lat1, lon1] = geom[i - 1];
    const [lat2, lon2] = geom[i];
    const dlat = (lat2 - lat1) * (Math.PI / 180);
    const dlon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dlat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
    cumDist.push(cumDist[i - 1] + R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  const totalLen = cumDist[cumDist.length - 1];

  const result = route.junctions.map((jid, ji) => {
    if (ji === 0) return { junctionId: jid, pos: 0 };
    if (ji === route.junctions.length - 1) return { junctionId: jid, pos: 1.0 };
    
    const j = JUNCTIONS[jid];
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < geom.length; i++) {
      const d = (geom[i][0] - j.lat) ** 2 + (geom[i][1] - j.lng) ** 2;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return { junctionId: jid, pos: totalLen > 0 ? cumDist[bestIdx] / totalLen : ji / (route.junctions.length - 1) };
  });

  return (_routeJidCache[routeId] = result);
}

// ── Waypoint positions along each route ──────────────────────────────────────
// Returns [{junctionId, pos}] for every intermediate junction on the route
// (skips first junction and junctions with no-hold control types).
// Used by the sim loop to apply holds when vehicles cross junction waypoints.
const _SKIP_WP_CONTROLS = new Set(['critical', 'egress', 'roundabout_planned']);
const _waypointPosCache  = {};

export function getWaypointPositions(routeId) {
  if (_waypointPosCache[routeId]) return _waypointPosCache[routeId];
  const route = ROUTE_CONFIG[routeId];
  if (!route?.junctions || !route.geometry || route.geometry.length < 2) {
    return (_waypointPosCache[routeId] = []);
  }
  const geom = route.geometry;
  const R    = 6371000;
  // Cumulative arc-length at each geometry vertex
  const cumDist = [0];
  for (let i = 1; i < geom.length; i++) {
    const [lat1, lon1] = geom[i - 1];
    const [lat2, lon2] = geom[i];
    const dlat = (lat2 - lat1) * (Math.PI / 180);
    const dlon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dlat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
    cumDist.push(cumDist[i - 1] + R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  const totalLen = cumDist[cumDist.length - 1];
  // For each junction after the first, snap to nearest geometry vertex
  const result = [];
  for (let ji = 1; ji < route.junctions.length; ji++) {
    const jid = route.junctions[ji];
    const j   = JUNCTIONS[jid];
    if (!j || _SKIP_WP_CONTROLS.has(j.control)) continue;
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < geom.length; i++) {
      const d = (geom[i][0] - j.lat) ** 2 + (geom[i][1] - j.lng) ** 2;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    result.push({ junctionId: jid, pos: totalLen > 0 ? cumDist[bestIdx] / totalLen : ji / route.junctions.length });
  }
  result.sort((a, b) => a.pos - b.pos);
  return (_waypointPosCache[routeId] = result);
}

// ── Route length estimation ───────────────────────────────────────────────────
export function estimateRouteLength(geometry) {
  if (!geometry || geometry.length < 2) return 1000;
  let len = 0;
  const R = 6371000;
  for (let i = 0; i < geometry.length - 1; i++) {
    const [lat1, lon1] = geometry[i];
    const [lat2, lon2] = geometry[i + 1];
    const dlat = (lat2 - lat1) * Math.PI / 180;
    const dlon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dlat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
    len += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.max(len, 50);
}

export const EGRESS_ROUTES = [
  { id: 'EG-A', weight: 0.40 },
  { id: 'EG-B', weight: 0.25 },
  { id: 'EG-C', weight: 0.15 },
  { id: 'EG-D', weight: 0.20 },
];
