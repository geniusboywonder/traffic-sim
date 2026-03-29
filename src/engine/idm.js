// ── idm.js ────────────────────────────────────────────────────────────────────
// IDM/ACC (Intelligent Driver Model) physics engine.
// Refactored for global look-ahead and merge-point stability.

// ── Road-class IDM parameters ─────────────────────────────────────────────────
export const IDM_PARAMS = {
  arterial:   { v0: 60/3.6, T: 1.5, a: 1.4, b: 2.0, s0: 2.0, len: 4.5 },
  collector:  { v0: 40/3.6, T: 1.5, a: 1.2, b: 1.8, s0: 2.0, len: 4.5 },
  local:      { v0: 30/3.6, T: 1.8, a: 1.0, b: 1.5, s0: 2.5, len: 4.5 },
  ruskin:     { v0: 30/3.6, T: 2.0, a: 0.8, b: 1.2, s0: 3.0, len: 4.5 },
  internal:   { v0: 20/3.6, T: 2.5, a: 0.6, b: 1.0, s0: 3.0, len: 4.5 },
  schoolyard: { v0: 10/3.6, T: 2.5, a: 0.6, b: 1.0, s0: 3.0, len: 4.5 },
};

// ── Parking / Drop-off Management ──────────────────────────────────────────────
export const PARKING_CAPACITY = {
  ON_SITE: 98,
  ON_STREET: 22,
  TOTAL: 120
};

export function getParkingOccupancy(vehicles) {
  const count = vehicles.filter(v => v.state === 'dwell').length;
  return {
    count,
    isFull: count >= PARKING_CAPACITY.TOTAL,
    onSiteFull: vehicles.filter(v => v.state === 'dwell' && v.parkingType === 'on-site').length >= PARKING_CAPACITY.ON_SITE,
    onStreetFull: vehicles.filter(v => v.state === 'dwell' && v.parkingType === 'on-street').length >= PARKING_CAPACITY.ON_STREET
  };
}

export function idmAccel(v, dv, s, p) {
  const gap = Math.max(s, 0.1); 
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)));
  const accel = p.a * (1 - Math.pow(v / p.v0, 4) - Math.pow(sStar / gap, 2));
  
  // Creep logic: If stopped or nearly stopped but gap is opening up, 
  // allow a small positive acceleration to prevent numerical deadlock.
  if (v < 0.2 && s > 1.5) return 0.5;

  return Math.max(accel, -8.0);
}

export function junctionHoldDuration(junctionControl, simTime, queueDepth, lastReleaseTime, routeId = '', corridorId = '') {
  const gap = simTime - (lastReleaseTime ?? 0);
  
  // Directional logic for complex intersections
  if (junctionControl === 'stop_directional') {
    // J22: Stop Starke Rd (1A), let Airlie flow
    if (corridorId === '1A') return gap >= 5.0 ? 0 : 5.0 - gap;
    // J27: Stop Children's Way (2B), let Starke flow
    if (corridorId === '2B') return gap >= 5.0 ? 0 : 5.0 - gap;
    return 0; 
  }

  switch (junctionControl) {
    case 'traffic_signal': {
      const cyclePos = simTime % 60;
      return cyclePos < 30 ? 0 : 60 - cyclePos;
    }
    case '4way_stop':     return gap >= 4.0 ? 0 : 4.0 - gap;
    case 'priority_stop': return gap >= 8.0 ? 0 : 8.0 - gap; // slightly faster throughput
    case 'stop':          return gap >= 4.0 ? 0 : 4.0 - gap;
    case 'yield':         return gap >= 1.5 ? 0 : 1.5 - gap;
    case 'critical':      return gap >= 4.3 ? 0 : 4.3 - gap; 
    case 'merge':         return 0; 
    default: return 0;
  }
}

export function stepAllVehicles(vehicles, dt, routeConfigs) {
  const dtSub = Math.min(dt / 4, 0.25);
  const steps = Math.round(dt / dtSub);

  const parking = getParkingOccupancy(vehicles);

  for (let step = 0; step < steps; step++) {
    // 1. Map physical location: which cars are approaching which junction?
    const approaches = new Map(); // targetJid -> [vehicles]
    
    for (const v of vehicles) {
      if (v.state !== 'inbound' && v.state !== 'outbound') continue;
      const route = routeConfigs[v.routeId];
      if (!route?.junctions) continue;

      const junctions = v.allJunctions || [];
      const targetJunc = junctions[v.lastJunctionIdx + 1];
      const targetPos = targetJunc ? targetJunc.pos : 1.0;
      const toJid = route.junctions[v.lastJunctionIdx + 1] || route.junctions[route.junctions.length - 1];

      v.distToTarget = (targetPos - v.pos) * v.routeLen;
      
      const fromJunc = junctions[v.lastJunctionIdx];
      const fromPos  = fromJunc ? fromJunc.pos : 0;
      v.distFromStart = (v.pos - fromPos) * v.routeLen;

      if (!approaches.has(toJid)) approaches.set(toJid, []);
      approaches.get(toJid).push(v);
    }

    // 2. Physics Step
    for (const v of vehicles) {
      if (v.state !== 'inbound' && v.state !== 'outbound') continue;
      
      const route = routeConfigs[v.routeId];
      const toJid = route.junctions[v.lastJunctionIdx + 1];
      
      // Find the leader
      let leader = null;
      let gap = 9999;

      // Search 1: Same segment (heading to same junction)
      const group = approaches.get(toJid) || [];
      const sameSegmentLeaders = group
        .filter(other => other !== v && other.distToTarget < v.distToTarget)
        .sort((a, b) => b.distToTarget - a.distToTarget); // closest first

      if (sameSegmentLeaders.length > 0) {
        leader = sameSegmentLeaders[sameSegmentLeaders.length - 1];
        gap = v.distToTarget - leader.distToTarget - 4.5;
      } else if (toJid) {
        // Search 2: Global Look-ahead
        const nextTargetJids = [];
        for (const r of Object.values(routeConfigs)) {
          const idx = r.junctions?.indexOf(toJid);
          if (idx !== -1 && idx < r.junctions.length - 1) {
            nextTargetJids.push(r.junctions[idx + 1]);
          }
        }

        let bestNextLeader = null;
        let bestNextGap = 9999;

        for (const nid of nextTargetJids) {
          const nextGroup = approaches.get(nid) || [];
          const potential = nextGroup.sort((a, b) => a.distFromStart - b.distFromStart)[0];
          if (potential) {
            const potentialGap = v.distToTarget + potential.distFromStart - 4.5;
            if (potentialGap < bestNextGap) {
              bestNextGap = potentialGap;
              bestNextLeader = potential;
            }
          }
        }
        
        if (bestNextLeader) {
          leader = bestNextLeader;
          gap = bestNextGap;
        }
      }

      // 3. Acceleration calculation
      const inSchoolZone = v.schoolEndPos !== undefined && v.pos < v.schoolEndPos;
      
      let roadClass = v.roadClass;
      if (toJid === 20 || (v.state === 'outbound' && v.lastJunctionIdx === 0)) {
        roadClass = 'internal';
      } else if (toJid === 7) {
        roadClass = 'ruskin';
      }

      const p = inSchoolZone ? IDM_PARAMS.schoolyard : (IDM_PARAMS[roadClass] ?? IDM_PARAMS.local);

      // Junction holds and PARKING BLOCK logic
      if (v.holdUntil !== null && v.holdUntil > v.simTime) {
        v.v = 0;
      } else if (toJid === 7 && parking.isFull && v.distToTarget < 10) {
        // If parking is full, block the entrance at J7
        v.v = 0;
      } else {
        const dv = leader ? (v.v - leader.v) : 0;
        const accel = idmAccel(v.v, dv, gap, p);
        v.v = Math.max(0, Math.min(v.v + accel * dtSub, p.v0));
        v.pos = v.pos + (v.v * dtSub) / v.routeLen;
      }
    }
  }
}
