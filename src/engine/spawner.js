// ── spawner.js ────────────────────────────────────────────────────────────────
// Vehicle spawn scheduler, bell-curve inflow, rat-run logic, dwell → outbound.

import { ROUTE_CONFIG, CORRIDOR_ROUTES, EGRESS_ROUTES, estimateRouteLength } from './routes';
import { PARKING_CAPACITY, getParkingOccupancy } from './idm';

// ── Scenario definitions ──────────────────────────────────────────────────────
export const SCENARIO_CONFIG = {
  L: { totalTrips: 500, peakWindowMin: 75, ratRunThreshold: 0.25 },
  M: { totalTrips: 650, peakWindowMin: 60, ratRunThreshold: 0.20 },
  H: { totalTrips: 840, peakWindowMin: 45, ratRunThreshold: 0.15 },
};

export const DWELL_S = 45; // fixed drop-off dwell time

const RAW = { '1A': 11, '2A': 21, '2B': 25, '3A': 12 };
const SUM  = Object.values(RAW).reduce((a, b) => a + b, 0);

export const CORRIDOR_SPLITS = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, v / SUM]),
);

export const CORRIDOR_ROAD_CLASS = {
  '1A':    'arterial',
  '2A':    'collector',
  '2B':    'collector',
  '3A':    'collector',
  'egress':'local',
};

const PEAK_PARAMS = {
  H: { centre: 1200, sigma: 900  },
  M: { centre: 1800, sigma: 1100 },
  L: { centre: 2100, sigma: 1350 },
};

function gaussianRate(t, centre, sigma) {
  return Math.exp(-0.5 * ((t - centre) / sigma) ** 2);
}

function computeNorm(scenario) {
  const { centre, sigma } = PEAK_PARAMS[scenario];
  let sum = 0;
  for (let i = 0; i <= 720; i++) {
    sum += gaussianRate(i * 10, centre, sigma) * 10;
  }
  return sum;
}

const NORMS = { H: computeNorm('H'), M: computeNorm('M'), L: computeNorm('L') };

export function spawnRate(simTimeSec, scenario) {
  const cfg  = SCENARIO_CONFIG[scenario];
  const { centre, sigma } = PEAK_PARAMS[scenario];
  const rate = gaussianRate(simTimeSec, centre, sigma);
  return (cfg.totalTrips / NORMS[scenario]) * rate;
}

export function assignRoute(corridorId, scenario, corridorDensity) {
  const cfg      = SCENARIO_CONFIG[scenario];
  const crConfig = CORRIDOR_ROUTES[corridorId];
  if (!crConfig) return corridorId;
  if (corridorDensity >= cfg.ratRunThreshold && crConfig.ratRuns.length > 0) {
    if (Math.random() < 0.40) {
      const idx = Math.floor(Math.random() * crConfig.ratRuns.length);
      return crConfig.ratRuns[idx];
    }
  }
  return crConfig.main;
}

export function corridorDensity(corridorId, vehicles) {
  const routes = [
    CORRIDOR_ROUTES[corridorId]?.main,
    ...(CORRIDOR_ROUTES[corridorId]?.ratRuns ?? []),
  ].filter(Boolean);
  let current = 0, capacity = 0;
  for (const routeId of routes) {
    const route = ROUTE_CONFIG[routeId];
    if (!route) continue;
    capacity += route.maxVehicles;
    current  += vehicles.filter(v => v.routeId === routeId && v.state === 'inbound').length;
  }
  return capacity > 0 ? current / capacity : 0;
}

let _nextId = 1;
export function resetVehicleIds() { _nextId = 1; }

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
      newVehicles.push({
        id:        _nextId++,
        routeId,
        corridorId,
        pos:       0,
        v:         0,
        state:     'inbound',
        roadClass: CORRIDOR_ROAD_CLASS[corridorId] ?? 'local',
        routeLen:  estimateRouteLength(route.geometry),
        spawnTime:       simTimeSec,
        dwellStart:      null,
        holdUntil:       null,
        simTime:         simTimeSec,
        lastJunctionIdx: 0,
      });
    }
  }
  return newVehicles;
}

export function processDwell(vehicle, simTimeSec, vehicles) {
  if (vehicle.state !== 'dwell') return;
  if (vehicle.dwellStart === null) {
    vehicle.dwellStart = simTimeSec;
    const parking = getParkingOccupancy(vehicles);
    vehicle.parkingType = (!parking.onSiteFull) ? 'on-site' : 'on-street';
  }
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
    vehicle.lastJunctionIdx  = 0;
    vehicle.allJunctions     = null;
    vehicle.holdUntil        = null;
    vehicle.holdingAt        = null;
    vehicle.parkingType      = null;
    vehicle.schoolEndPos     = Math.min(300 / routeLen, 0.20);
  }
}

function pickEgressRoute() {
  const r = Math.random();
  let cumulative = 0;
  for (const route of EGRESS_ROUTES) {
    cumulative += route.weight;
    if (r < cumulative) return route.id;
  }
  return EGRESS_ROUTES[EGRESS_ROUTES.length - 1].id;
}

export function createSpawnerState() {
  return { accumulators: { '1A': 0, '2A': 0, '2B': 0, '3A': 0 } };
}
