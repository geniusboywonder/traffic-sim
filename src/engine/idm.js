// ── idm.js ────────────────────────────────────────────────────────────────────
// IDM/ACC (Intelligent Driver Model) physics engine.
// Pure JS — no React dependency. Re-implemented from the movsim/traffic-simulation.de
// blueprint.
//
// Unit conventions
//   position  : fractional progress along route [0, 1]
//   velocity  : m/s
//   accel     : m/s²
//   dt        : simulated seconds
//   route len : approximated from geometry or defaulted to routeLengthM

// ── Road-class IDM parameters ─────────────────────────────────────────────────
// From spec §4.3
export const IDM_PARAMS = {
  arterial: {
    v0:  60 / 3.6,  // desired speed  (m/s)
    T:   1.5,        // time headway   (s)
    a:   1.4,        // max accel      (m/s²)
    b:   2.0,        // comfortable decel (m/s²)
    s0:  2.0,        // minimum gap    (m)
    len: 4.5,        // vehicle length (m)
  },
  collector: {
    v0:  40 / 3.6,
    T:   1.5,
    a:   1.2,
    b:   1.8,
    s0:  2.0,
    len: 4.5,
  },
  local: {
    v0:  30 / 3.6,
    T:   1.8,
    a:   1.0,
    b:   1.5,
    s0:  2.5,
    len: 4.5,
  },
  // School driveway / internal road — 10 km/h, cautious spacing
  schoolyard: {
    v0:  10 / 3.6,
    T:   2.5,
    a:   0.6,
    b:   1.0,
    s0:  3.0,
    len: 4.5,
  },
};

// ── IDM acceleration formula ──────────────────────────────────────────────────
// v    : current speed (m/s)
// dv   : approach rate to leader (v - v_leader), positive when closing
// s    : net gap to leader (m)  — must be > 0
// p    : IDM_PARAMS entry
export function idmAccel(v, dv, s, p) {
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)));
  const gap   = Math.max(s, 0.01); // avoid division by zero
  return p.a * (1 - Math.pow(v / p.v0, 4) - Math.pow(sStar / gap, 2));
}

// ── Single-vehicle step ───────────────────────────────────────────────────────
// vehicle : { pos, v, routeLen, roadClass, holdUntil }
// leader  : { pos, v, routeLen } | null
// dt      : time step (s)
// Mutates vehicle in place.
export function stepVehicle(vehicle, leader, dt) {
  // Use schoolyard params while still on the internal school driveway segment
  const inSchoolZone = vehicle.schoolEndPos !== undefined && vehicle.pos < vehicle.schoolEndPos;
  const p = inSchoolZone ? IDM_PARAMS.schoolyard : (IDM_PARAMS[vehicle.roadClass] ?? IDM_PARAMS.local);

  // Junction hold — vehicle is stopped at a controlled junction
  if (vehicle.holdUntil !== undefined && vehicle.holdUntil > vehicle.simTime) {
    vehicle.v = 0;
    return;
  }

  let accel;
  if (leader) {
    // Gap in metres between front of follower and rear of leader
    const followerFrontPos  = vehicle.pos * vehicle.routeLen;
    const leaderRearPos     = leader.pos  * leader.routeLen - p.len;
    const gap               = Math.max(leaderRearPos - followerFrontPos, 0.01);
    const dv                = vehicle.v - leader.v;
    accel = idmAccel(vehicle.v, dv, gap, p);
  } else {
    // Free-flow: no leader, accelerate toward desired speed
    accel = idmAccel(vehicle.v, 0, 9999, p);
  }

  // Euler integration
  const newV = Math.max(0, Math.min(vehicle.v + accel * dt, p.v0));
  vehicle.v   = newV;
  vehicle.pos = vehicle.pos + (newV * dt) / vehicle.routeLen;
}

// ── Junction hold logic ───────────────────────────────────────────────────────
// Called by the simulation loop when a vehicle crosses a junction waypoint.
// Returns hold duration in simulated seconds (0 = no hold, vehicle proceeds).
//
// junctionControl : control type string from JUNCTIONS
// simTime         : current simulation time (s)
// queueDepth      : number of vehicles currently queued at this junction
// lastReleaseTime : simTime of last released vehicle (for all-way stop gap)

export function junctionHoldDuration(junctionControl, simTime, queueDepth, lastReleaseTime) {
  switch (junctionControl) {
    case 'traffic_signal': {
      // Fixed cycle: 30s green / 30s red.
      // Vehicle must wait until next green window.
      const cyclePos = simTime % 60;
      if (cyclePos < 30) return 0; // currently green
      return 60 - cyclePos;        // wait for next green
    }
    case '4way_stop': {
      // All-way stop: FIFO, one vehicle per 4s gap
      const gap = simTime - (lastReleaseTime ?? 0);
      return gap >= 4 ? 0 : 4 - gap;
    }
    case 'priority_stop': {
      // Minor-road stop: must wait for a gap in main-road traffic.
      // Rush-hour: model as ~12s average wait before acceptable gap.
      const gap = simTime - (lastReleaseTime ?? 0);
      return gap >= 12 ? 0 : 12 - gap;
    }
    case 'stop': {
      // Simple stop sign: brief pause then proceed (~5s).
      const gap = simTime - (lastReleaseTime ?? 0);
      return gap >= 5 ? 0 : 5 - gap;
    }
    case 'yield': {
      // Yield: minimal pause (~2s).
      const gap = simTime - (lastReleaseTime ?? 0);
      return gap >= 2 ? 0 : 2 - gap;
    }
    case 'critical': {
      // School ingress — one vehicle per 8s (realistic single-lane drop-off throughput)
      const gap = simTime - (lastReleaseTime ?? 0);
      return gap >= 8 ? 0 : 8 - gap;
    }
    case 'roundabout_planned':
      return 0;
    default:
      return 0;
  }
}

// ── Multi-vehicle step loop ───────────────────────────────────────────────────
// vehicles : array of vehicle objects (mutated in place)
// dt       : simulated seconds for this frame
// junctionState : Map<junctionId, { lastRelease, queue }> (mutated)
//
// Sub-step cap: dtSub = min(dt/4, 0.25) per spec §4.3.
// Vehicles are sorted front-to-back before each sub-step.
export function stepAllVehicles(vehicles, dt) {
  const dtSub = Math.min(dt / 4, 0.25);
  const steps = Math.round(dt / dtSub);

  for (let step = 0; step < steps; step++) {
    // Sort front-to-back within each route (highest pos first)
    const byRoute = new Map();
    for (const v of vehicles) {
      if (v.state !== 'inbound' && v.state !== 'outbound') continue;
      if (!byRoute.has(v.routeId)) byRoute.set(v.routeId, []);
      byRoute.get(v.routeId).push(v);
    }
    for (const group of byRoute.values()) {
      group.sort((a, b) => b.pos - a.pos);
      for (let i = 0; i < group.length; i++) {
        const v      = group[i];
        const leader = i > 0 ? group[i - 1] : null;
        stepVehicle(v, leader, dtSub);
      }
    }
  }
}
