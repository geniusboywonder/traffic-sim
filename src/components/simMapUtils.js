import { getParkingOccupancy } from '../engine/idm';

export const SIM_MAP_COLOURS = {
  dwell:    '#717977',
  delayed:  '#A64D4D',
  '1A':     { base: '#2D5438', light: '#4A7A56', dark: '#111D13' },
  '2A':     { base: '#709775', light: '#A1CCA5', dark: '#415D43' },
  '2B':     { base: '#C4864A', light: '#E0B88A', dark: '#8B5A28' },
  '3A':     { base: '#A1CCA5', light: '#C8E0C8', dark: '#709775' },
  egress:   { base: '#D4732E', light: '#F0A870', dark: '#A04E18' },
};

export const ENTRY_JUNCTIONS = {
  '1A': 1,
  '2A': 9,
  '2B': 8,
  '3A': 13,
};

export const SHOW_DEBUG_LOGGER = import.meta.env.DEV;

const CORRIDOR_IDS = ['1A', '1A-NORTH', '2A', '2B', '3A'];
const ROAD_ALIASES = {
  tokai_high_school_internal_road: 'school_internal_road',
  clement_road: 'clement_way',
  lakeview_road: 'lake_view_road',
  firgrove_way_service_road: 'firgrove_service_road',
};
const ROAD_KEYWORDS = {
  '1A': ['main rd', 'main road', 'dreyersdal'],
  '2A': ['homestead'],
  '2B': ['childrens', "children's"],
  '3A': ['firgrove', 'timber'],
};

export function createCorridorCountMap() {
  return Object.fromEntries(CORRIDOR_IDS.map((id) => [id, 0]));
}

export function createDelayBuckets() {
  return Object.fromEntries(CORRIDOR_IDS.map((id) => [id, { total: 0, count: 0 }]));
}

export function createRoadVisitTracker() {
  return { inbound: new Map(), outbound: new Map() };
}

export function findCorridorForRoadName(name) {
  const selName = name.toLowerCase().trim();
  return ['1A', '2A', '2B', '3A'].find((id) => ROAD_KEYWORDS[id].some((keyword) => selName.includes(keyword)));
}

export function buildPlaybackRoadCoordMap(roadLines) {
  const coordMap = {};

  roadLines.forEach((feature) => {
    const name = feature.properties?.name;
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    coordMap[id] = feature.geometry.coordinates;
    if (ROAD_ALIASES[id]) coordMap[ROAD_ALIASES[id]] = feature.geometry.coordinates;
  });

  return coordMap;
}

export function buildRoadSnapshot(roadLines, vehicles, routeConfig, roadVisitTracker) {
  const allRoads = {};

  roadLines.forEach((feature) => {
    const name = feature.properties?.name;
    if (!name) return;
    allRoads[name] = {
      inbound: { total: 0, active: 0, slowing: 0, stopped: 0 },
      outbound: { total: 0, active: 0, slowing: 0, stopped: 0 },
    };
  });

  vehicles.forEach((vehicle) => {
    const route = routeConfig[vehicle.routeId];
    if (!route?.segments) return;
    route.segments.forEach((segment) => {
      if (vehicle.pos < segment.startPos - 0.005 || vehicle.pos > segment.endPos + 0.005) return;
      const road = allRoads[segment.roadName];
      if (!road) return;
      const bucket = vehicle.state === 'outbound' ? road.outbound : road.inbound;
      if (vehicle.v < 0.5) bucket.stopped++;
      else if (vehicle.v < 2) bucket.slowing++;
      else bucket.active++;
    });
  });

  Object.keys(allRoads).forEach((name) => {
    const key = name.toLowerCase().trim();
    allRoads[name].inbound.total = roadVisitTracker.inbound.get(key)?.size || 0;
    allRoads[name].outbound.total = roadVisitTracker.outbound.get(key)?.size || 0;
  });

  return allRoads;
}

export function interpolateRoutePosition(geometry, pos) {
  if (!geometry || geometry.length === 0) return null;
  if (pos <= 0) return geometry[0];
  if (pos >= 1) return geometry[geometry.length - 1];

  const earthRadius = 6371000;
  const cumulative = [0];
  for (let i = 1; i < geometry.length; i++) {
    const [lat1, lon1] = geometry[i - 1];
    const [lat2, lon2] = geometry[i];
    const dlat = (lat2 - lat1) * (Math.PI / 180);
    const dlon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dlat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
    cumulative.push(cumulative[i - 1] + earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  const totalLength = cumulative[cumulative.length - 1];
  const targetDistance = pos * totalLength;

  let lo = 0;
  let hi = geometry.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (cumulative[mid] < targetDistance) lo = mid;
    else hi = mid;
  }

  const distance = cumulative[hi] - cumulative[lo];
  const t = distance > 0 ? (targetDistance - cumulative[lo]) / distance : 0;

  return [
    geometry[lo][0] + t * (geometry[hi][0] - geometry[lo][0]),
    geometry[lo][1] + t * (geometry[hi][1] - geometry[lo][1]),
  ];
}

export function computeCorridorStats(vehicles, totals, exits, inDelays, outDelays, congestionScores) {
  const result = { corridors: {}, bottlenecks: {}, parking: {} };

  ['3A', '2A', '2B', '1A'].forEach((corridorId) => {
    const corridorIds = corridorId === '3A' ? ['3A', '1A-NORTH'] : [corridorId];
    const corridorVehicles = vehicles.filter((vehicle) => corridorIds.includes(vehicle.corridorId) && vehicle.state === 'inbound');
    const stopped = corridorVehicles.filter((vehicle) => vehicle.v < 0.5).length;
    const slowing = corridorVehicles.filter((vehicle) => vehicle.v >= 0.5 && vehicle.v < 2).length;
    const active = corridorVehicles.filter((vehicle) => vehicle.v >= 2).length;
    const inDelay = corridorId === '3A'
      ? { total: inDelays['3A'].total + (inDelays['1A-NORTH']?.total ?? 0), count: inDelays['3A'].count + (inDelays['1A-NORTH']?.count ?? 0) }
      : inDelays[corridorId];
    const outDelay = corridorId === '3A'
      ? { total: outDelays['3A'].total + (outDelays['1A-NORTH']?.total ?? 0), count: outDelays['3A'].count + (outDelays['1A-NORTH']?.count ?? 0) }
      : outDelays[corridorId];
    const spawned = corridorId === '3A' ? totals['3A'] + (totals['1A-NORTH'] ?? 0) : totals[corridorId];
    const exited = corridorId === '3A' ? exits['3A'] + (exits['1A-NORTH'] ?? 0) : exits[corridorId];

    result.corridors[corridorId] = {
      label: corridorId === '1A' ? 'Main Rd' : corridorId === '2A' ? 'Homestead Av' : corridorId === '2B' ? "Children's Way" : 'Firgrove Way',
      current: corridorVehicles.length,
      spawned,
      exited,
      avgInDelay: inDelay.count > 0 ? inDelay.total / inDelay.count / 60 : 0,
      avgOutDelay: outDelay.count > 0 ? outDelay.total / outDelay.count / 60 : 0,
      congestion: congestionScores?.[corridorId] ?? 0,
      stopped,
      slowing,
      active,
    };
  });

  const parking = getParkingOccupancy(vehicles);
  result.parking = { onSite: parking.onSite, onStreet: parking.onStreet };

  return result;
}
