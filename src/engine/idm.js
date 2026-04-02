// ── idm.js ────────────────────────────────────────────────────────────────────
// IDM/ACC (Intelligent Driver Model) physics engine.
// Refactored: Dwelling vehicles are OFF-ROAD (invisible to physics).
// Outbound vehicles act as leaders for Inbound vehicles on shared school road.

import { JUNCTIONS, ROUTE_CONFIG } from './routes';

export const IDM_PARAMS = {
  arterial:   { v0: 60/3.6, T: 1.5, a: 1.4, b: 2.0, s0: 2.0, len: 4.5 },
  collector:  { v0: 40/3.6, T: 1.5, a: 1.2, b: 1.8, s0: 2.0, len: 4.5 },
  local:      { v0: 30/3.6, T: 1.8, a: 1.0, b: 1.5, s0: 2.5, len: 4.5 },
  ruskin:     { v0: 30/3.6, T: 2.0, a: 0.8, b: 1.2, s0: 3.0, len: 4.5 },
  internal:   { v0: 20/3.6, T: 2.5, a: 0.6, b: 1.0, s0: 3.0, len: 4.5 },
  schoolyard: { v0: 10/3.6, T: 2.5, a: 0.6, b: 1.0, s0: 3.0, len: 4.5 },
};

export const PARKING_CAPACITY = { ON_SITE: 98, ON_STREET: 22, TOTAL: 120 };

export function getParkingOccupancy(vehicles) {
  const onSite = vehicles.filter(v => v.state === 'dwell' && v.parkingType === 'on-site').length;
  const onStreet = vehicles.filter(v => v.state === 'dwell' && v.parkingType === 'on-street').length;
  return { onSite, onStreet, isFull: (onSite + onStreet) >= PARKING_CAPACITY.TOTAL };
}

export function idmAccel(v, dv, s, p, holdActive = false) {
  const gap = Math.max(s, 0.1);
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)));
  const accel = p.a * (1 - Math.pow(v / p.v0, 4) - Math.pow(sStar / gap, 2));
  if (!holdActive && v < 0.5 && s > 1.5) return 0.8; 
  return Math.max(accel, -9.0);
}

export function junctionHoldDuration(jid, junctionControl, simTime, lastReleaseTime, routeId = '', corridorId = '') {
  const j = JUNCTIONS[jid];
  const gap = simTime - (lastReleaseTime ?? 0);

  // Directional logic for specific junctions
  if (j?.direction_only) {
    const route = ROUTE_CONFIG[routeId];
    if (route) {
      const idx = route.junctions.indexOf(parseInt(jid));
      const fromJid = idx > 0 ? route.junctions[idx - 1] : null;
      
      switch (j.direction_only) {
        case 'from_farm_rd':
          if (fromJid !== 21) return 0; // J2 yield only from Farm Rd
          break;
        case 'from_starke_south':
          if (fromJid !== 22) return 0; // J3 yield only from Starke south
          break;
        case 'from_christopher':
          if (![18, 5].includes(fromJid)) return 0; // J4 priority_stop only from Christopher
          break;
        case 'from_christopher_to_vineyard':
          if (fromJid !== 4) return 0; // J5 yield only from Christopher
          break;
        case 'from_dante':
          if (fromJid !== 14) return 0; // J16 stop only from Dante
          break;
        case 'from_ruskin':
          if (fromJid !== 29) return 0; // J17 yield only from Ruskin
          break;
        case 'starke_onto_airlie':
          if (![4, 24].includes(fromJid)) return 0; // J22 stop only when turning from Starke
          break;
        case 'from_tussendal':
          if (fromJid !== 21) return 0; // J23 yield only from Tussendal
          break;
        case 'from_clement':
          if (fromJid !== 25) return 0; // J24 stop only from Clement
          break;
      }
    }
  }

  if (junctionControl === 'stop_directional') {
    if (corridorId === '1A' || corridorId === '2B') return gap >= 5.0 ? 0 : 5.0 - gap;
    return 0;
  }

  // Final Egress Points: Busy main road wait times (7:30 - 8:30)
  // J1: Main Rd, J9: Homestead (Sweet Valley), J13: Firgrove/Dreyersdal
  if ([1, 9, 13].includes(parseInt(jid)) && routeId.startsWith('EG-')) {
    if (simTime >= 3000 && simTime <= 8000) {
      const sigma = 1200; // wider peak
      const peak = 20.0; // more delay
      const base = 3.0;
      const multiplier = Math.exp(-Math.pow(simTime - 5400, 2) / (2 * Math.pow(sigma, 2)));
      const dynamicHold = base + (peak - base) * multiplier;
      if (gap < dynamicHold) return dynamicHold - gap;
    }
  }

  switch (junctionControl) {
    case 'none':          return 0;
    case 'traffic_signal': return (simTime % 60) < 30 ? 0 : 60 - (simTime % 60);
    case '4way_stop':     return gap >= 4.0 ? 0 : 4.0 - gap;
    case 'priority_stop': return gap >= 5.0 ? 0 : 5.0 - gap;
    case 'stop':          return gap >= 4.0 ? 0 : 4.0 - gap;
    case 'yield':              return gap >= 2.5 ? 0 : 2.5 - gap;
    case 'critical':           return gap >= 4.5 ? 0 : 4.5 - gap;
    case 'roundabout_planned': return gap >= 2.5 ? 0 : 2.5 - gap; // TIA §14: mini-roundabout at Ruskin/Aristea
    case 'egress':             return gap >= 1.2 ? 0 : 1.2 - gap; // TIA §11: raised intersection at Aristea exit
    case 'speed_hump':         return gap >= 1.2 ? 0 : 1.2 - gap;
    default: return 0;
  }
}

export function stepAllVehicles(vehicles, dt, routeConfigs, simTime) {
  const dtSub = Math.min(dt / 4, 0.25);
  const steps = Math.round(dt / dtSub);
  const parking = getParkingOccupancy(vehicles);

  for (let step = 0; step < steps; step++) {
    const approaches = new Map();
    for (const v of vehicles) {
      // Dwell vehicles are OFF-ROAD — they no longer participate in physics grouping
      if (v.state === 'dwell') continue;

      const route = routeConfigs[v.routeId];
      if (!route?.junctions) continue;
      const junctions = v.allJunctions || [];
      const toIdx = (v.lastJunctionIdx ?? 0) + 1;
      const targetJunc = junctions[toIdx];
      const toJid = route.junctions[toIdx] ?? route.junctions[route.junctions.length - 1];
      
      v.distToTarget = Math.max(((targetJunc?.pos ?? 1.0) - v.pos) * v.routeLen, 0.1);
      const fromPos = junctions[v.lastJunctionIdx]?.pos ?? 0;
      v.distFromStart = Math.max((v.pos - fromPos) * v.routeLen, 0);
      
      if (!approaches.has(toJid)) approaches.set(toJid, []);
      approaches.get(toJid).push(v);
    }

    for (const v of vehicles) {
      if (v.state === 'dwell' || v.pos >= 1.0) { v.v = 0; continue; }

      const route = routeConfigs[v.routeId];
      const toJid = route.junctions[(v.lastJunctionIdx ?? 0) + 1];
      let leader = null, gap = 9999;

      const group = approaches.get(toJid) || [];
      
      // PHYSICS SEARCH: Inbound vehicles now care about Outbound vehicles in front of them
      // on the same segment (re-entry awareness).
      const sameSegmentLeaders = group
        .filter(o => o !== v && o.distToTarget < v.distToTarget && !o.isParking && o.state === v.state)
        .sort((a, b) => b.distToTarget - a.distToTarget);

      if (sameSegmentLeaders.length > 0) {
        leader = sameSegmentLeaders[0];
        gap = Math.max(v.distToTarget - leader.distToTarget - 4.5, 0.1);
      } else if (toJid) {
        const nextTargetJids = [];
        for (const r of Object.values(routeConfigs)) {
          // Direction consistency for look-ahead
          if (v.state === 'inbound' && r.type === 'egress') continue;
          if (v.state === 'outbound' && r.type !== 'egress') continue;
          
          const idx = r.junctions?.indexOf(toJid);
          if (idx !== -1 && idx < r.junctions.length - 1) nextTargetJids.push(r.junctions[idx + 1]);
        }
        let bGap = 9999, bLeader = null;
        for (const nid of nextTargetJids) {
          const pot = (approaches.get(nid) || []).filter(o => !o.isParking && o.state === v.state).sort((a, b) => a.distFromStart - b.distFromStart)[0];
          if (pot) {
            const pg = Math.max(v.distToTarget + pot.distFromStart - 4.5, 0.1);
            if (pg < bGap) { bGap = pg; bLeader = pot; }
          }
        }
        if (bLeader) { leader = bLeader; gap = bGap; }
      }

      // ── Dynamic Road Class Attribution ───────────────────────────────────
      let roadClass = v.roadClass;
      if (v.state === 'outbound') {
        // Egress always cautious on residential side-streets
        roadClass = 'local';
      }
      
      if (toJid === 20 || (v.state === 'outbound' && v.lastJunctionIdx === 0)) {
        roadClass = 'internal';
      } else if (v.state === 'outbound' && v.lastJunctionIdx === 1) {
        // Outbound vehicles leaving the school gate stay cautious for the first segment
        roadClass = 'ruskin';
      }

      const p = (v.schoolEndPos !== undefined && v.pos < v.schoolEndPos) ? IDM_PARAMS.schoolyard : (IDM_PARAMS[roadClass] ?? IDM_PARAMS.local);
      
      const holdActive = (v.holdUntil !== null && v.holdUntil > (simTime ?? v.simTime)) || 
                         (toJid === 7 && parking.isFull && v.distToTarget < 5);
      
      if (holdActive) {
        const vGap = Math.max(v.distToTarget - 0.5, 0.1);
        if (vGap < gap) { gap = vGap; leader = { v: 0 }; }
      }

      const dv = leader ? (v.v - (leader.v ?? 0)) : 0;
      const accel = idmAccel(v.v, dv, gap, p, holdActive);
      v.v = Math.max(0, Math.min(v.v + accel * dtSub, p.v0));
      v.pos = v.pos + (v.v * dtSub) / v.routeLen;
    }
  }
}
