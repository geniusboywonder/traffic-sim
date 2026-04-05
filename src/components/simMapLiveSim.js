import { getParkingOccupancy, PARKING_CAPACITY, junctionHoldDuration } from '../engine/idm';
import { estimateRouteLength, pickEgressRoute } from '../engine/spawner';

function recordDelayStart(vehicle, simTime, logEvent) {
  if (!vehicle._delayedSince) {
    vehicle._delayedSince = simTime;
    logEvent('DELAY_START', vehicle, { simTime, detail: `jIdx=${vehicle.lastJunctionIdx}` });
  }
}

function maybeStartDwell(vehicle, simTime, vehicles, logSchoolEvent) {
  if (!vehicle.isParking || vehicle.pos < (vehicle.targetDwellPos ?? 0.1)) return;

  vehicle.state = 'dwell';
  vehicle.dwellStart = simTime;
  vehicle.isParking = false;
  vehicle.v = 0;
  delete vehicle._delayedSince;

  const parking = getParkingOccupancy(vehicles);
  vehicle.parkingType = parking.onSite < PARKING_CAPACITY.ON_SITE ? 'on-site' : 'on-street';
  logSchoolEvent('DWELL_START', vehicle, simTime, parking.onSite, parking.onStreet);
}

function maybeSwitchToRatRun(vehicle, simTime, routeConfig, ratRunSwitches, congestionScores, getRouteJunctions, logEvent) {
  if (vehicle.state !== 'inbound' || vehicle.v >= 2 || vehicle.routeId.includes('RR')) return;

  const switches = ratRunSwitches[vehicle.routeId];
  if (!switches) return;

  const nextWaypoint = vehicle.allJunctions[vehicle.lastJunctionIdx + 1];
  if (!nextWaypoint) return;

  const distanceToNext = (nextWaypoint.pos - vehicle.pos) * (vehicle.routeLen || 1000);
  if (distanceToNext >= 50) return;

  const candidates = switches.filter((item) => item.atJid === nextWaypoint.junctionId);
  if (candidates.length === 0) return;

  const threshold = 0.25 + (congestionScores[vehicle.corridorId] || 0) * 0.6;
  if (Math.random() >= threshold) return;

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const newRouteId = selected.toRouteId;
  vehicle.routeId = newRouteId;
  vehicle.allJunctions = getRouteJunctions(newRouteId);

  const nextPosition = vehicle.allJunctions.find((item) => item.junctionId === nextWaypoint.junctionId);
  if (!nextPosition) return;

  vehicle.pos = nextPosition.pos;
  vehicle.routeLen = estimateRouteLength(routeConfig[newRouteId].geometry);
  logEvent('RAT_RUN_DIVERGE', vehicle, { simTime, detail: `switched to ${newRouteId}` });
}

function updateJunctionHold(vehicle, simTime, roadCounts, junctions, junctionState) {
  if (vehicle.holdUntil !== null && vehicle.holdUntil <= simTime && vehicle.pos < 1.0) {
    vehicle.holdUntil = null;
    vehicle.holdingAt = null;
  }
  if (vehicle.holdUntil !== null) return;

  const routeJunctions = vehicle.allJunctions;
  if (vehicle.lastJunctionIdx === undefined) vehicle.lastJunctionIdx = 0;

  while (vehicle.lastJunctionIdx < routeJunctions.length - 1 && vehicle.pos >= routeJunctions[vehicle.lastJunctionIdx + 1].pos) {
    const junctionId = routeJunctions[vehicle.lastJunctionIdx + 1].junctionId;
    const junction = junctions[junctionId];
    if (junction && !['egress', 'roundabout_planned'].includes(junction.control)) {
      const state = junctionState.get(junctionId) ?? { lastRelease: 0, frameReleases: 0 };
      const hold = junctionHoldDuration(junctionId, junction.control, simTime, state.lastRelease, vehicle.routeId, vehicle.corridorId, roadCounts);
      if (hold > 0) {
        vehicle.holdUntil = simTime + hold;
        vehicle.holdingAt = junctionId;
        junctionState.set(junctionId, state);
        break;
      }
      state.lastRelease = simTime;
      junctionState.set(junctionId, state);
    }
    vehicle.lastJunctionIdx++;
  }
}

function transitionInboundVehicle({
  vehicle,
  simTime,
  roadCounts,
  vehicles,
  junctionState,
  inboundDelay,
  scenario,
  routeConfig,
  getRouteJunctions,
}) {
  if (vehicle.state !== 'inbound' || vehicle.pos < 1.0) return;

  vehicle.pos = 1.0;
  vehicle.v = 0;

  const schoolState = junctionState.get(7) ?? { lastRelease: 0 };
  if (vehicle.holdUntil === null) {
    const hold = junctionHoldDuration(7, 'critical', simTime, schoolState.lastRelease, '', '', roadCounts);
    if (hold > 0) {
      vehicle.holdUntil = simTime + hold;
      return;
    }
  } else if (vehicle.holdUntil > simTime) {
    return;
  }

  const parking = getParkingOccupancy(vehicles);
  if (parking.isFull) {
    vehicle.holdingAt = 7;
    vehicle.holdUntil = null;
    return;
  }

  const delayBucket = inboundDelay[vehicle.corridorId];
  delayBucket.total += simTime - vehicle.spawnTime;
  delayBucket.count++;

  const egressId = pickEgressRoute(scenario, vehicle.corridorId, vehicle.isLocal);
  vehicle.state = 'outbound';
  vehicle.routeId = egressId;
  vehicle.pos = 0;
  vehicle.routeLen = estimateRouteLength(routeConfig[egressId].geometry);
  vehicle.allJunctions = getRouteJunctions(egressId);
  vehicle.lastJunctionIdx = 0;
  vehicle.targetDwellPos = 0.02 + Math.random() * 0.08;
  vehicle.isParking = true;
  vehicle.holdUntil = null;
  vehicle.holdingAt = null;
  junctionState.set(7, { lastRelease: simTime });
}

export function updateVehicleState({
  vehicle,
  simTime,
  vehicles,
  routeConfig,
  roadCounts,
  junctions,
  junctionState,
  ratRunSwitches,
  congestionScores,
  scenario,
  inboundDelay,
  getRouteJunctions,
  logEvent,
  logSchoolEvent,
}) {
  if (vehicle.state === 'dwell') {
    return;
  }

  vehicle.simTime = simTime;
  if (!vehicle.allJunctions) vehicle.allJunctions = getRouteJunctions(vehicle.routeId);

  maybeStartDwell(vehicle, simTime, vehicles, logSchoolEvent);

  if ((vehicle.state === 'inbound' || (vehicle.state === 'outbound' && !vehicle.isParking)) && vehicle.v < 0.5) {
    recordDelayStart(vehicle, simTime, logEvent);
  } else if (vehicle._delayedSince && vehicle.v >= 0.5) {
    delete vehicle._delayedSince;
  }

  if (vehicle.state === 'inbound' || vehicle.state === 'outbound') {
    maybeSwitchToRatRun(vehicle, simTime, routeConfig, ratRunSwitches, congestionScores, getRouteJunctions, logEvent);
    updateJunctionHold(vehicle, simTime, roadCounts, junctions, junctionState);
  }

  transitionInboundVehicle({
    vehicle,
    simTime,
    roadCounts,
    vehicles,
    junctionState,
    inboundDelay,
    scenario,
    routeConfig,
    getRouteJunctions,
  });
}

export function finalizeOutboundVehicles({
  vehicles,
  simTime,
  roadCounts,
  junctions,
  junctionState,
  corridorExits,
  outboundDelay,
  logEvent,
}) {
  const remaining = [];

  vehicles.forEach((vehicle) => {
    if (vehicle.state !== 'outbound' || vehicle.pos < 1.0) {
      remaining.push(vehicle);
      return;
    }

    vehicle.v = 0;
    vehicle.pos = 1.0;

    if (vehicle.holdUntil === null) {
      const finalJunctionId = vehicle.allJunctions[vehicle.allJunctions.length - 1].junctionId;
      const junction = junctions[finalJunctionId];
      if (junction) {
        const state = junctionState.get(finalJunctionId) ?? { lastRelease: 0 };
        const hold = junctionHoldDuration(finalJunctionId, junction.control, simTime, state.lastRelease, vehicle.routeId, vehicle.corridorId, roadCounts);
        if (hold > 0) {
          vehicle.holdUntil = simTime + hold;
          vehicle.holdingAt = finalJunctionId;
          remaining.push(vehicle);
          return;
        }
        state.lastRelease = simTime;
        junctionState.set(finalJunctionId, state);
      }
    } else if (vehicle.holdUntil > simTime) {
      remaining.push(vehicle);
      return;
    }

    if (corridorExits[vehicle.corridorId] !== undefined) {
      corridorExits[vehicle.corridorId]++;
      const delayBucket = outboundDelay[vehicle.corridorId];
      const egressStart = vehicle.dwellStart != null ? vehicle.dwellStart + 45 : simTime;
      delayBucket.total += Math.max(0, simTime - egressStart);
      delayBucket.count++;
      logEvent('EXIT', vehicle, { simTime, detail: `totalTrip=${(simTime - vehicle.spawnTime).toFixed(1)}s egressRoute=${vehicle.routeId}` });
    }
  });

  return remaining;
}
