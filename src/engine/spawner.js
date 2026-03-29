// ── spawner.js ────────────────────────────────────────────────────────────────
// Vehicle spawn scheduler, bell-curve inflow, rat-run logic, dwell → outbound.
//
// Simulation time reference:
//   simTimeSec = 0      → 06:30
//   simTimeSec = 1800   → 07:00
//   simTimeSec = 4500   → 07:45
//   simTimeSec = 7200   → 08:30

import { ROUTE_CONFIG, CORRIDOR_ROUTES, EGRESS_ROUTES } from './routes';

// ── Scenario definitions ──────────────────────────────────────────────────────
// From spec §4.6
export const SCENARIO_CONFIG = {
  L: { totalTrips: 500, peakWindowMin: 75, ratRunThreshold: 0.04 },
  M: { totalTrips: 650, peakWindowMin: 60, ratRunThreshold: 0.03 },
  H: { totalTrips: 840, peakWindowMin: 45, ratRunThreshold: 0.02 },
};

export const DWELL_S = 45; // fixed drop-off dwell time (TIA assumption)

// ── TIA §13 corridor origin splits ───────────────────────────────────────────
// External trip percentages: 1A=11%, 2A=21%, 2B=25%, 3A=12% (total 69%).
// Scaled to sum to 1.0 for 4-corridor model.
const RAW = { '1A': 11, '2A': 21, '2B': 25, '3A': 12 };
const SUM  = Object.values(RAW).reduce((a, b) => a + b, 0);

export const CORRIDOR_SPLITS = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, v / SUM]),
);
// { '1A': 0.159, '2A': 0.304, '2B': 0.362, '3A': 0.174 }

// ── Road class per corridor (for IDM params) ──────────────────────────────────
export const CORRIDOR_ROAD_CLASS = {
  '1A':    'arterial',   // Main Rd / Dreyersdal — Class 2–3
  '2A':    'collector',  // Homestead Ave — Class 4
  '2B':    'collector',  // Children's Way — Class 4
  '3A':    'collector',  // Firgrove Way — Class 4
  'egress':'local',      // Aristea Rd egress — Class 5
};

// ── Bell-curve inflow rate ────────────────────────────────────────────────────
// Returns instantaneous spawn rate in vehicles/second at simTimeSec.
// Uses a Gaussian centred on peak time, calibrated so the integral over
// [0, 7200] ≈ totalTrips.
//
// Peak parameters by scenario:
//   - peak centre: 07:00 (1800s) for M/L; 06:50 (1200s) for H
//   - peak width (sigma): wider = broader distribution

const PEAK_PARAMS = {
  H: { centre: 1200, sigma: 900  }, // sharp 45-min peak, early
  M: { centre: 1800, sigma: 1100 }, // moderate 60-min
  L: { centre: 2100, sigma: 1350 }, // broad 75-min, later start
};

function gaussianRate(t, centre, sigma) {
  return Math.exp(-0.5 * ((t - centre) / sigma) ** 2);
}

// Pre-compute normalisation factor (numerical integration over [0, 7200])
function computeNorm(scenario) {
  const { centre, sigma } = PEAK_PARAMS[scenario];
  let sum = 0;
  const N = 720; // 10s steps
  for (let i = 0; i <= N; i++) {
    const t = i * 10;
    sum += gaussianRate(t, centre, sigma) * 10;
  }
  return sum; // total area under curve in seconds
}

const NORMS = {
  H: computeNorm('H'),
  M: computeNorm('M'),
  L: computeNorm('L'),
};

// Returns vehicles/second at simTimeSec for given scenario
export function spawnRate(simTimeSec, scenario) {
  const cfg  = SCENARIO_CONFIG[scenario];
  const { centre, sigma } = PEAK_PARAMS[scenario];
  const rate = gaussianRate(simTimeSec, centre, sigma);
  return (cfg.totalTrips / NORMS[scenario]) * rate;
}

// ── Route assignment with rat-run diversion ───────────────────────────────────
// corridorId      : '1A' | '2A' | '2B' | '3A'
// scenario        : 'L' | 'M' | 'H'
// corridorDensity : vehicles-on-route / corridor maxVehicles [0, 1]
export function assignRoute(corridorId, scenario, corridorDensity) {
  const cfg      = SCENARIO_CONFIG[scenario];
  const crConfig = CORRIDOR_ROUTES[corridorId];
  if (!crConfig) return corridorId;

  if (corridorDensity >= cfg.ratRunThreshold && crConfig.ratRuns.length > 0) {
    // Weighted random pick from rat-run variants
    const idx = Math.floor(Math.random() * crConfig.ratRuns.length);
    return crConfig.ratRuns[idx];
  }
  return crConfig.main;
}

// ── Corridor density calculation ──────────────────────────────────────────────
// Returns fraction [0,1] of capacity used on a corridor
export function corridorDensity(corridorId, vehicles) {
  const routes = [
    CORRIDOR_ROUTES[corridorId]?.main,
    ...(CORRIDOR_ROUTES[corridorId]?.ratRuns ?? []),
  ].filter(Boolean);

  let current = 0;
  let capacity = 0;

  for (const routeId of routes) {
    const route = ROUTE_CONFIG[routeId];
    if (!route) continue;
    capacity += route.maxVehicles;
    current  += vehicles.filter(
      (v) => v.routeId === routeId && v.state === 'inbound',
    ).length;
  }
  return capacity > 0 ? current / capacity : 0;
}

// ── Vehicle ID generator ──────────────────────────────────────────────────────
let _nextId = 1;
export function resetVehicleIds() { _nextId = 1; }

// ── Spawn tick ────────────────────────────────────────────────────────────────
// Called each animation frame. Returns array of new vehicle objects to add.
//
// state     : { accumulators: { '1A': 0, '2A': 0, '2B': 0, '3A': 0 } }
//             (mutated in place — carries fractional vehicles between frames)
// simTimeSec: current simulation time
// dt        : simulated seconds this frame
// scenario  : 'L' | 'M' | 'H'
// vehicles  : current vehicle array (for density calc)
export function spawnTick(state, simTimeSec, dt, scenario, vehicles) {
  const newVehicles = [];
  const rate        = spawnRate(simTimeSec, scenario);

  for (const corridorId of Object.keys(CORRIDOR_SPLITS)) {
    const corridorRate = rate * CORRIDOR_SPLITS[corridorId];
    state.accumulators[corridorId] = (state.accumulators[corridorId] ?? 0) + corridorRate * dt;

    while (state.accumulators[corridorId] >= 1) {
      state.accumulators[corridorId] -= 1;

      const density = corridorDensity(corridorId, vehicles);
      const routeId = assignRoute(corridorId, scenario, density);
      const route   = ROUTE_CONFIG[routeId];
      if (!route) continue;

      const roadClass = CORRIDOR_ROAD_CLASS[corridorId] ?? 'local';
      const routeLen  = estimateRouteLength(route.geometry);

      newVehicles.push({
        id:        _nextId++,
        routeId,
        corridorId,
        pos:       0,
        v:         0,
        state:     'inbound',
        roadClass,
        routeLen,
        spawnTime:       simTimeSec,
        dwellStart:      null,
        holdUntil:       null,
        simTime:         simTimeSec,
        lastWaypointIdx: 0,
      });
    }
  }

  return newVehicles;
}

// ── Dwell → outbound transition ───────────────────────────────────────────────
// Called each frame for all vehicles in 'dwell' state.
// Mutates vehicle in place; returns the new outbound vehicle or null.
export function processDwell(vehicle, simTimeSec) {
  if (vehicle.state !== 'dwell') return;
  if (simTimeSec - vehicle.dwellStart >= DWELL_S) {
    const egress = pickEgressRoute();
    const route  = ROUTE_CONFIG[egress];
    const routeLen = estimateRouteLength(route?.geometry ?? []);
    vehicle.state            = 'outbound';
    vehicle.routeId          = egress;
    vehicle.pos              = 0;
    vehicle.v                = 0;
    vehicle.roadClass        = 'local';
    vehicle.routeLen         = routeLen;
    vehicle.lastWaypointIdx  = 0;  // reset for new egress route
    vehicle.holdUntil        = null;
    vehicle.holdingAt        = null;
    // School driveway segment ends at roughly J20 (~295m into the route)
    vehicle.schoolEndPos = Math.min(300 / routeLen, 0.20);
  }
}

// Weighted pick across egress routes using cumulative probability
function pickEgressRoute() {
  const r = Math.random();
  let cumulative = 0;
  for (const route of EGRESS_ROUTES) {
    cumulative += route.weight;
    if (r < cumulative) return route.id;
  }
  return EGRESS_ROUTES[EGRESS_ROUTES.length - 1].id;
}

// ── Route length estimation ───────────────────────────────────────────────────
// Approximates route length in metres from [[lat,lon],...] polyline.
// Used to map pos [0,1] to real-world position.
const R = 6371000; // Earth radius in metres

export function estimateRouteLength(geometry) {
  if (!geometry || geometry.length < 2) return 1000; // fallback 1 km
  let len = 0;
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

// ── Spawner state factory ─────────────────────────────────────────────────────
// Call this on reset to get a fresh state object
export function createSpawnerState() {
  return {
    accumulators: { '1A': 0, '2A': 0, '2B': 0, '3A': 0 },
  };
}
