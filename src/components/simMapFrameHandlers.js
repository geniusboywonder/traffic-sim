import { buildRoadSnapshot, SIM_MAP_COLOURS as COLOUR } from './simMapUtils';

export function renderPlaybackVehicles({ ctx, map, canvas, vehicles, selectedCorridors, isMobile }) {
  if (!ctx || !map || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const radius = isMobile ? 3 : 4;

  for (const vehicle of vehicles) {
    const point = map.latLngToContainerPoint([vehicle.lat, vehicle.lng]);
    const corridorColours = COLOUR[vehicle.corridorId] ?? COLOUR.egress;
    let fill;
    if (vehicle.state === 'queued') fill = COLOUR.delayed;
    else if (vehicle.state === 'outbound') fill = vehicle.speed < 2 ? COLOUR.delayed : corridorColours.light;
    else if (vehicle.speed < 2) fill = COLOUR.delayed;
    else fill = corridorColours.dark;

    const isSelected = selectedCorridors.has(vehicle.corridorId);
    ctx.globalAlpha = isSelected ? 1.0 : 0.2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

export function buildInboundRoadCounts(vehicles, routeConfig) {
  const roadCounts = {};

  vehicles.forEach((vehicle) => {
    if (vehicle.state !== 'inbound') return;
    const route = routeConfig[vehicle.routeId];
    if (!route?.segments) return;

    for (const segment of route.segments) {
      if (vehicle.pos >= segment.startPos - 0.005 && vehicle.pos <= segment.endPos + 0.005) {
        roadCounts[segment.roadName] = (roadCounts[segment.roadName] ?? 0) + 1;
      }
    }
  });

  return roadCounts;
}

export function updateRoadVisitTracker(tracker, vehicles, routeConfig) {
  vehicles.forEach((vehicle) => {
    const route = routeConfig[vehicle.routeId];
    if (!route?.segments) return;

    for (const segment of route.segments) {
      if (vehicle.pos < segment.startPos - 0.005 || vehicle.pos > segment.endPos + 0.005) continue;
      const bucket = vehicle.state === 'outbound' ? tracker.outbound : tracker.inbound;
      const roadKey = segment.roadName.toLowerCase().trim();
      if (!bucket.has(roadKey)) bucket.set(roadKey, new Set());
      bucket.get(roadKey).add(vehicle.id);
    }
  });
}

export function logRoadSnapshotIfDue({
  simTime,
  lastRoadLogRef,
  source,
  roadLines,
  vehicles,
  routeConfig,
  roadVisitTracker,
  logRoadSnapshot,
}) {
  if (source !== 'live') return;
  if (simTime - lastRoadLogRef.current < 60) return;

  lastRoadLogRef.current = simTime;
  const snapshot = buildRoadSnapshot(roadLines, vehicles, routeConfig, roadVisitTracker);
  logRoadSnapshot(simTime, snapshot);
}

export function refreshJunctionMarkers({ visibleJunctions, junctionMarkers, vehicles, pulsePhase, entryJunctionIds }) {
  visibleJunctions.forEach((junctionId) => {
    const entry = junctionMarkers[junctionId];
    if (!entry) return;

    const queued = vehicles.filter((vehicle) => vehicle.holdingAt === junctionId).length;
    const isBusy = queued >= 2;

    entry.marker.setStyle({
      color: isBusy ? '#ef4444' : entry.baseColor,
      fillOpacity: isBusy ? 0.35 : (entryJunctionIds.includes(junctionId) ? 0.8 : 0),
    });
    entry.marker.setRadius(isBusy && pulsePhase < 2 ? 11 : 7);
  });
}
