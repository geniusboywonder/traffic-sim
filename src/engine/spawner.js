// ── spawner.js ────────────────────────────────────────────────────────────────
// Vehicle spawn scheduler, bell-curve inflow, rat-run logic, dwell → outbound.

import { ROUTE_CONFIG, CORRIDOR_ROUTES, estimateRouteLength } from './routes';
import { PARKING_CAPACITY, getParkingOccupancy } from './idm';

export const SCENARIO_CONFIG = {
  L: { totalTrips: 336, peakWindowMin: 75, ratRunThreshold: 0.15, habitualRatRunProb: 0.005 },
  M: { totalTrips: 420, peakWindowMin: 60, ratRunThreshold: 0.10, habitualRatRunProb: 0.01  },
  H: { totalTrips: 504, peakWindowMin: 45, ratRunThreshold: 0.06, habitualRatRunProb: 0.03  },
};

// Simulation timing: offset skips the near-empty Gaussian tail at 06:30.
// SIM_START_OFFSET: simTime starts here, clock displays 06:40 for this value.
// SIM_END_SEC: when to stop the live simulation per scenario.
// H runs past 09:00 because the queue has not cleared by then.
export const SIM_START_OFFSET = 600; // 10 min → clock starts at 06:40
export const SIM_END_SEC = { L: 9000, M: 9000, H: 10800 }; // H: 09:30

export const DWELL_S = 45; 

const RAW = { '1A': 14, '1A-NORTH': 11, '2A': 25, '2B': 47, '3A': 3 }; // TIA-aligned: Dreyersdal S=14%, Dreyersdal N=11%, Homestead=25%, Children's Way=47%, Firgrove/Starke=3%
const SUM  = Object.values(RAW).reduce((a, b) => a + b, 0);
export const CORRIDOR_SPLITS = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, v / SUM]));

// All modelled segments are TIA Class 5 Local Streets (30 km/h). The arterial/collector
// approach roads (Main Rd, Ladies Mile, Firgrove) are off-map — the route starts after
// the turn-off at the entry junction.
export const CORRIDOR_ROAD_CLASS = { '1A': 'local', '1A-NORTH': 'local', '2A': 'local', '2B': 'local', '3A': 'local' };

// Local vehicle fractions per corridor (% of that corridor's spawns that are local residents).
// Local residents originate inside the network — absorbed into nearest external corridor.
// They get higher habitual rat-run probability (know the area) and biased egress routing.
const LOCAL_FRACTION = {
  '1A':       0.07,  // 1% local / 14% total (Leyden/Ruskin residents)
  '1A-NORTH': 0.0,   // pure external (Dreyersdal North)
  '2A':       0.16,  // 4% local / 25% total (Christopher Rd residents)
  '2B':       0.47,  // 22% local / 47% total (Starke N+S residents)
  '3A':       1.0,   // all local (Firgrove/Starke local)
};

// TIA trapezoidal profile: 35% of demand falls 07:30–08:00 → peak centred at 07:45 (simTime=4500).
// Sigma controls spread: H is tightest (fast ramp), L is widest (spread across full 2 hrs).
const PEAK_PARAMS = { H: { centre: 4500, sigma: 1200 }, M: { centre: 4500, sigma: 1500 }, L: { centre: 4500, sigma: 1737 } };

function gaussianRate(t, centre, sigma) { return Math.exp(-0.5 * ((t - centre) / sigma) ** 2); }
function computeNorm(scenario) {
  const { centre, sigma } = PEAK_PARAMS[scenario];
  let sum = 0;
  for (let i = 0; i <= 720; i++) sum += gaussianRate(i * 10, centre, sigma) * 10;
  return sum;
}
const NORMS = { H: computeNorm('H'), M: computeNorm('M'), L: computeNorm('L') };

export function spawnRate(simTimeSec, scenario) {
  const cfg  = SCENARIO_CONFIG[scenario];
  const { centre, sigma } = PEAK_PARAMS[scenario];
  return (cfg.totalTrips / NORMS[scenario]) * gaussianRate(simTimeSec, centre, sigma);
}

export function assignRoute(corridorId, scenario, density, congestionScore = 0, isLocal = false) {
  const cfg = SCENARIO_CONFIG[scenario], crConfig = CORRIDOR_ROUTES[corridorId];
  if (!crConfig || crConfig.ratRuns.length === 0) return crConfig?.main ?? corridorId;

  // H scenario: 1A Dreyersdal back-pressure from Sweet Valley Primary next door
  const h1aBoost = (scenario === 'H' && corridorId === '1A') ? 0.08 : 0;
  // Local residents know the area — higher habitual rat-run rate
  const localBoost = isLocal ? cfg.habitualRatRunProb * 2 : 0;
  const habitualProb = Math.min(cfg.habitualRatRunProb + h1aBoost + localBoost, 0.85);

  // Habitual users: a base % always takes rat-runs regardless of congestion,
  // representing commuters who know the shortcut and use it in both directions.
  if (Math.random() < habitualProb) {
    return crConfig.ratRuns[Math.floor(Math.random() * crConfig.ratRuns.length)];
  }

  if (density < cfg.ratRunThreshold) return crConfig.main;
  const ratRunProb = Math.min(0.15 + congestionScore * 0.70, 0.85);
  if (Math.random() < ratRunProb) {
    return crConfig.ratRuns[Math.floor(Math.random() * crConfig.ratRuns.length)];
  }
  return crConfig.main;
}

export function corridorDensity(corridorId, vehicles) {
  const routes = [CORRIDOR_ROUTES[corridorId]?.main, ...(CORRIDOR_ROUTES[corridorId]?.ratRuns ?? [])].filter(Boolean);
  let cur = 0, cap = 0;
  for (const rid of routes) {
    cap += ROUTE_CONFIG[rid]?.maxVehicles || 0;
    cur += vehicles.filter(v => v.routeId === rid && v.state === 'inbound').length;
  }
  return cap > 0 ? cur / cap : 0;
}

// Returns 0.0 (free flow) → 1.0 (fully stalled) for the corridor's MAIN route only
// (rat-run vehicles excluded). v.v is in m/s; <0.5 m/s (~1.8 km/h) = effectively stopped.
// Minimum 3 vehicles required for a reliable signal; returns 0 when below threshold.
export function corridorCongestionScore(corridorId, vehicles) {
  const mainRouteId = CORRIDOR_ROUTES[corridorId]?.main;
  if (!mainRouteId) return 0;
  const onMain = vehicles.filter(v => v.routeId === mainRouteId && v.state === 'inbound');
  if (onMain.length < 3) return 0;
  const stalled = onMain.filter(v => v.v < 0.5).length;
  return stalled / onMain.length;
}

let _nextId = 1;
export function resetVehicleIds() { _nextId = 1; }

export function spawnTick(state, simTimeSec, dt, scenario, vehicles) {
  const newVehicles = [], rate = spawnRate(simTimeSec, scenario);
  const congestionScores = {};
  
  for (const cid of Object.keys(CORRIDOR_SPLITS)) {
    const density    = corridorDensity(cid, vehicles);
    const congestion = corridorCongestionScore(cid, vehicles);
    congestionScores[cid] = congestion;

    state.accumulators[cid] = (state.accumulators[cid] ?? 0) + rate * CORRIDOR_SPLITS[cid] * dt;
    while (state.accumulators[cid] >= 1) {
      state.accumulators[cid] -= 1;
      const isLocal = Math.random() < (LOCAL_FRACTION[cid] ?? 0);
      const rid = assignRoute(cid, scenario, density, congestion, isLocal);
      newVehicles.push({
        id: _nextId++, routeId: rid, corridorId: cid, pos: 0, v: 0, state: 'inbound',
        isLocal,
        roadClass: CORRIDOR_ROAD_CLASS[cid] ?? 'local',
        routeLen: estimateRouteLength(ROUTE_CONFIG[rid]?.geometry),
        spawnTime: simTimeSec, dwellStart: null, lastJunctionIdx: 0, allJunctions: null, holdUntil: null
      });
    }
  }
  return { newVehicles, congestionScores };
}

export function processDwell(vehicle, simTimeSec, vehicles) {
  if (vehicle.state !== 'dwell') return;
  
  if (vehicle.dwellStart === null) {
    vehicle.dwellStart = simTimeSec;
    // Assign parking type based on current occupancy
    const p = getParkingOccupancy(vehicles);
    vehicle.parkingType = (p.onSite < PARKING_CAPACITY.ON_SITE) ? 'on-site' : 'on-street';
  }

  if (simTimeSec - vehicle.dwellStart >= DWELL_S) {
    // Resume journey as outbound, keeping ORIGINAL corridorId for stats
    vehicle.state            = 'outbound';
    vehicle.v                = 0;
    vehicle.holdUntil        = null;
    vehicle.holdingAt        = null;
    vehicle.parkingType      = null; // release the bay
    vehicle.isParking        = false;
  }
}

const EGRESS_WEIGHTS = {
  // EG-A: Dante→Vineyard→Airlie→Starke→J8  (long, via Children's Way)
  // EG-B: Dante→Vineyard→Airlie north→J1   (Main Rd)
  // EG-C: Dante→Airlie south→Tussendal→J1  (Main Rd, shorter Airlie leg)
  // EG-D: Dante→Starke→J13                 (Firgrove)
  // EG-E: Dante→Starke→J9                  (Homestead)
  L: { 'EG-A': 0.20, 'EG-B': 0.20, 'EG-C': 0.20, 'EG-D': 0.20, 'EG-E': 0.20 },
  M: { 'EG-A': 0.20, 'EG-B': 0.20, 'EG-C': 0.20, 'EG-D': 0.20, 'EG-E': 0.20 },
  H: { 'EG-A': 0.25, 'EG-B': 0.20, 'EG-C': 0.25, 'EG-D': 0.15, 'EG-E': 0.15 },
};

// Local vehicle egress bias — additive adjustment before normalisation.
// In H scenario, Sweet Valley back-pressure halves the bias toward J9/J13.
const LOCAL_EGRESS_BIAS = {
  '2B': { 'EG-D': +0.15, 'EG-E': +0.10, 'EG-A': -0.15, 'EG-B': -0.10 }, // Starke → Firgrove/Homestead
  '2A': { 'EG-E': +0.20, 'EG-A': -0.10, 'EG-B': -0.10 },                 // Christopher → Homestead
  '3A': { 'EG-D': +0.25, 'EG-A': -0.15, 'EG-B': -0.10 },                 // Leyden → Firgrove
};

export function pickEgressRoute(scenario = 'M', corridorId = null, isLocal = false) {
  let weights = { ...EGRESS_WEIGHTS[scenario] ?? EGRESS_WEIGHTS['M'] };

  if (isLocal && corridorId && LOCAL_EGRESS_BIAS[corridorId]) {
    const bias = LOCAL_EGRESS_BIAS[corridorId];
    for (const [k, v] of Object.entries(bias)) {
      // In H scenario, halve the local bias toward J9/J13 (Sweet Valley blocking)
      const factor = (scenario === 'H' && (k === 'EG-D' || k === 'EG-E')) ? 0.5 : 1.0;
      weights[k] = Math.max(0, (weights[k] ?? 0) + v * factor);
    }
    // Renormalise
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(weights)) weights[k] /= total;
  }

  const r = Math.random();
  let cum = 0;
  for (const [id, w] of Object.entries(weights)) {
    cum += w;
    if (r < cum) return id;
  }
  return 'EG-A';
}

export { estimateRouteLength };
export function createSpawnerState() { return { accumulators: { '1A': 0, '1A-NORTH': 0, '2A': 0, '2B': 0, '3A': 0 } }; }
