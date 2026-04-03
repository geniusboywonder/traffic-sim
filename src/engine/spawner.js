// ── spawner.js ────────────────────────────────────────────────────────────────
// Vehicle spawn scheduler, bell-curve inflow, rat-run logic, dwell → outbound.

import { ROUTE_CONFIG, CORRIDOR_ROUTES, EGRESS_ROUTES, estimateRouteLength } from './routes';
import { PARKING_CAPACITY, getParkingOccupancy } from './idm';

export const SCENARIO_CONFIG = {
  L: { totalTrips: 500, peakWindowMin: 75, ratRunThreshold: 0.10, habitualRatRunProb: 0.06 },
  M: { totalTrips: 650, peakWindowMin: 60, ratRunThreshold: 0.08, habitualRatRunProb: 0.08 },
  H: { totalTrips: 840, peakWindowMin: 45, ratRunThreshold: 0.06, habitualRatRunProb: 0.10 },
};

// Simulation timing: offset skips the near-empty Gaussian tail at 06:30.
// SIM_START_OFFSET: simTime starts here, clock displays 06:40 for this value.
// SIM_END_SEC: when to stop the live simulation per scenario.
// H runs past 09:00 because the queue has not cleared by then.
export const SIM_START_OFFSET = 600; // 10 min → clock starts at 06:40
export const SIM_END_SEC = { L: 9000, M: 9000, H: 10800 }; // H: 09:30

export const DWELL_S = 45; 

const RAW = { '1A': 11, '2A': 21, '2B': 25, '3A': 13 }; // TIA Section 13: Dreyersdal S = 13%
const SUM  = Object.values(RAW).reduce((a, b) => a + b, 0);
export const CORRIDOR_SPLITS = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, v / SUM]));

// All modelled segments are TIA Class 5 Local Streets (30 km/h). The arterial/collector
// approach roads (Main Rd, Ladies Mile, Firgrove) are off-map — the route starts after
// the turn-off at the entry junction.
export const CORRIDOR_ROAD_CLASS = { '1A': 'local', '2A': 'local', '2B': 'local', '3A': 'local' };

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

export function assignRoute(corridorId, scenario, density, congestionScore = 0) {
  const cfg = SCENARIO_CONFIG[scenario], crConfig = CORRIDOR_ROUTES[corridorId];
  if (!crConfig || crConfig.ratRuns.length === 0) return crConfig?.main ?? corridorId;

  // Habitual users: a base % always takes rat-runs regardless of congestion,
  // representing commuters who know the shortcut and use it in both directions.
  if (Math.random() < cfg.habitualRatRunProb) {
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
      const rid = assignRoute(cid, scenario, density, congestion);
      newVehicles.push({
        id: _nextId++, routeId: rid, corridorId: cid, pos: 0, v: 0, state: 'inbound',
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

export function pickEgressRoute() {
  const r = Math.random();
  let cum = 0;
  for (const rt of EGRESS_ROUTES) { cum += rt.weight; if (r < cum) return rt.id; }
  return EGRESS_ROUTES[EGRESS_ROUTES.length - 1].id;
}

export { estimateRouteLength };
export function createSpawnerState() { return { accumulators: { '1A': 0, '2A': 0, '2B': 0, '3A': 0 } }; }
