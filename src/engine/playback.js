// src/engine/playback.js
// PlaybackSource — loads a pre-computed scenario JSON and serves vehicle
// positions / road stats through the SimulationSource interface.

/**
 * Interpolates a lat/lng from a GeoJSON coordinate array and a progress value.
 * progress is 0.0 (start) → 1.0 (end).
 * Coordinates are [lon, lat] pairs; returns { lat, lng }.
 */
function progressToLatLng(coords, progress) {
  if (!coords || coords.length === 0) return { lat: 0, lng: 0 };
  const clamped = Math.max(0, Math.min(1, progress));
  const idx = clamped * (coords.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, coords.length - 1);
  const t = idx - lo;
  const lon = coords[lo][0] + t * (coords[hi][0] - coords[lo][0]);
  const lat = coords[lo][1] + t * (coords[hi][1] - coords[lo][1]);
  return { lat, lng: lon };
}

export class PlaybackSource {
  constructor() {
    this._data = null;        // parsed SimOutput JSON
    this._roadCoords = {};    // road_id → [lon,lat][] (populated by setRoadCoords)
  }

  /**
   * Load pre-computed scenario data directly (used in tests and internally
   * after fetch resolves).
   * @param {object} data - Parsed SimOutput JSON object
   */
  _loadData(data) {
    this._data = data;
    this._precomputeStats();
  }

  // Roads outside the area of interest — SUMO simulates them but we don't render them.
  static _EXCLUDED_ROADS = new Set([
    'ladies_mile_service_road',
  ]);

  // flow_N_in.M — groups of 5 flows per corridor in demand generation order
  static _FLOW_CORRIDORS = ['1A', '2A', '2B', '3A'];
  static _CORRIDOR_LABELS = {
    '1A': 'Main Rd', '2A': 'Homestead Av',
    '2B': "Children's Way",  '3A': 'Firgrove Way',
  };
  _flowToCorridor(vehicleId) {
    // Expected format: "flow_N_in.M" where N is the bucket index (0-19)
    // 0-4   -> 1A
    // 5-9   -> 2A
    // 10-14 -> 2B
    // 15-19 -> 3A
    const m = vehicleId.match(/^flow_(\d+)_/);
    if (!m) return null;
    const flowIdx = parseInt(m[1]);
    const corridorIdx = Math.floor(flowIdx / 5);
    return PlaybackSource._FLOW_CORRIDORS[corridorIdx] ?? null;
  }

  _slugToCorridor(slug) {
    const s = slug.toLowerCase();
    if (s.includes('dreyersdal') || s.includes('main_rd')) return '1A';
    if (s.includes('homestead')) return '2A';
    if (s.includes('childrens') || s.includes('children_s')) return '2B';
    if (s.includes('firgrove') || s.includes('timber')) return '3A';
    return null;
  }

  /**
   * Precompute per-frame cumulative stats:
   * - spawned: unique vehicle IDs seen per corridor up to this frame
   * - slowTime: cumulative seconds spent below 2 m/s per corridor (delay proxy)
   * - roadVisits: unique vehicle IDs seen per road_id up to this frame (Watch My Road totals)
   */
  _precomputeStats() {
    if (!this._data) return;
    const dt = this._data.meta.timestep;
    const seenCorridor = { '1A': new Set(), '2A': new Set(), '2B': new Set(), '3A': new Set() };
    const slowAcc      = { '1A': 0, '2A': 0, '2B': 0, '3A': 0 };
    const seenRoadIn   = {};   // road_id → Set of inbound vehicle IDs
    const seenRoadOut  = {};   // road_id → Set of outbound vehicle IDs

    // Pre-pass: compute per-corridor avg outbound journey time.
    // firstOutbound[vid] = abs time when vehicle first appears as outbound.
    // lastSeen[vid]      = abs time when vehicle last appears in any frame.
    const firstOutbound = {};
    const lastSeen = {};
    for (const frame of this._data.frames) {
      for (const v of frame.vehicles) {
        lastSeen[v.id] = frame.t;
        if (v.state === 'outbound' && firstOutbound[v.id] === undefined) {
          firstOutbound[v.id] = frame.t;
        }
      }
    }
    const outTimes = { '1A': [], '2A': [], '2B': [], '3A': [] };
    for (const [vid, ft] of Object.entries(firstOutbound)) {
      const ls = lastSeen[vid];
      if (ls !== undefined && ls > ft) {
        const cid = this._flowToCorridor(vid);
        if (cid) outTimes[cid].push(ls - ft);
      }
    }
    this._avgOutDelaySec = Object.fromEntries(
      ['1A', '2A', '2B', '3A'].map(cid => {
        // Outbound times from JSON frames are coarse (30s timestep resolution) —
        // not reliable enough to display. Set to 0 so UI shows '—'.
        return [cid, 0];
      })
    );

    this._frameStats = this._data.frames.map(frame => {
      for (const v of frame.vehicles) {
        const cid = this._flowToCorridor(v.id);
        if (cid) {
          seenCorridor[cid].add(v.id);
          if (v.speed < 2) slowAcc[cid] += dt;
        }
        // Track inbound and outbound visits separately per road
        if (v.state === 'outbound') {
          if (!seenRoadOut[v.road_id]) seenRoadOut[v.road_id] = new Set();
          seenRoadOut[v.road_id].add(v.id);
        } else {
          if (!seenRoadIn[v.road_id]) seenRoadIn[v.road_id] = new Set();
          seenRoadIn[v.road_id].add(v.id);
        }
      }
      return {
        spawned:  { '1A': seenCorridor['1A'].size, '2A': seenCorridor['2A'].size, '2B': seenCorridor['2B'].size, '3A': seenCorridor['3A'].size },
        slowTime: { ...slowAcc },
        roadVisitsIn:  Object.fromEntries(Object.entries(seenRoadIn).map(([k, s])  => [k, s.size])),
        roadVisitsOut: Object.fromEntries(Object.entries(seenRoadOut).map(([k, s]) => [k, s.size])),
      };
    });
  }

  /**
   * Provide GeoJSON coordinates for roads so vehicle positions can be
   * interpolated to lat/lng. Call this after loading road GeoJSON in SimMap.
   * @param {Object.<string, number[][]>} coordMap - road_id → [[lon,lat],…]
   */
  setRoadCoords(coordMap) {
    this._roadCoords = coordMap;
  }

  /**
   * Fetch and load a scenario JSON file.
   * @param {string} scenario - "L", "M", or "H"
   * @param {string} model    - "sumo" or "uxsim"
   * @returns {Promise<void>}
   */
  async loadScenario(scenario, model = 'sumo') {
    this._data = null;
    const file = `scenario-${scenario}-${model}.json`;
    const res = await fetch(`/sim-results/${file}`);
    if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
    this._data = await res.json();
    this._precomputeStats();
  }

  isLoaded() {
    return this._data !== null;
  }

  getStartTime() {
    return this._data?.meta?.start_time ?? 0;
  }

  /** @returns {object[]} Full road registry from the loaded JSON */
  getRoads() {
    return this._data?.roads ?? [];
  }

  /** @returns {object[]} Full frames array (for Road Watcher totals) */
  getAllFrames() {
    return this._data?.frames ?? [];
  }

  /**
   * Find the nearest frame at or before simTime.
   * @param {number} t - seconds since midnight
   * @returns {object|null}
   */
  _nearestFrame(t) {
    if (!this._data) return null;
    const frames = this._data.frames;
    if (frames.length === 0) return null;
    // Find last frame where frame.t <= t
    let best = frames[0];
    for (const frame of frames) {
      if (frame.t <= t) best = frame;
      else break;
    }
    return best;
  }

  /**
   * Returns synthesised vehicle positions for the given sim time.
   * @param {number} simTime - seconds since midnight
   * @returns {{ lat: number, lng: number, state: string, roadId: string }[]}
   */
  getVehicles(simTime) {
    const frame = this._nearestFrame(simTime);
    if (!frame) return [];
    const results = [];
    for (const v of frame.vehicles) {
      if (PlaybackSource._EXCLUDED_ROADS.has(v.road_id)) continue;
      const coords = this._roadCoords[v.road_id] ?? [];
      const { lat, lng } = coords.length > 0
        ? progressToLatLng(coords, v.progress)
        : { lat: 0, lng: 0 };
      results.push({ lat, lng, state: v.state, roadId: v.road_id, speed: v.speed, corridorId: this._flowToCorridor(v.id) });
    }
    return results;
  }

  /**
   * Returns per-road stats for the given sim time.
   * @param {Map<string, {inbound:number, outbound:number, avg_delay_in:number|null, avg_delay_out:number|null}>}
   */
  getRoadStats(simTime) {
    const frame = this._nearestFrame(simTime);
    const result = new Map();
    if (!frame) return result;
    for (const rs of frame.road_stats) {
      result.set(rs.road_id, {
        inbound: rs.inbound,
        outbound: rs.outbound,
        avg_delay_in: rs.avg_delay_in,
        avg_delay_out: rs.avg_delay_out,
      });
    }
    return result;
  }

  /**
   * Returns dashboard-ready stats (corridors + parking) for the given sim time.
   * Mirrors the shape produced by SimMap.computeStats() in live mode.
   */
  getStats(simTime) {
    const frame = this._nearestFrame(simTime);
    if (!frame || !this._frameStats) return null;

    // Index of this frame in the frames array
    const frameIdx = this._data.frames.indexOf(frame);
    const fs = this._frameStats[frameIdx] ?? { spawned: {}, slowTime: {}, roadVisits: {} };

    // Per-corridor vehicle lists from current frame
    const buckets = { '1A': [], '2A': [], '2B': [], '3A': [] };
    let onSite = 0;
    for (const v of frame.vehicles) {
      if (v.road_id === 'school_internal_road') onSite++;
      const cid = this._flowToCorridor(v.id);
      if (cid) buckets[cid].push(v);
    }

    const corridors = {};
    for (const cid of ['1A', '2A', '2B', '3A']) {
      const vehicles  = buckets[cid];
      const stopped   = vehicles.filter(v => v.speed < 0.5).length;
      const slowing   = vehicles.filter(v => v.speed >= 0.5 && v.speed < 2).length;
      const active    = vehicles.filter(v => v.speed >= 2).length;
      const spawned   = fs.spawned[cid] ?? 0;
      const current   = vehicles.length;
      const exited    = Math.max(0, spawned - current);
      const congestion = current > 0 ? (stopped + slowing) / current : 0;
      // Avg delay: cumulative slow-vehicle-seconds divided by total spawned vehicles, in minutes
      const slowSec   = fs.slowTime[cid] ?? 0;
      const avgInDelay = spawned > 0 ? (slowSec / spawned) / 60 : 0;
      corridors[cid] = {
        label: PlaybackSource._CORRIDOR_LABELS[cid],
        current, spawned, exited, active, slowing, stopped, congestion,
        avgInDelay,
        avgOutDelay: (this._avgOutDelaySec?.[cid] ?? 0) / 60,
      };
    }

    return { corridors, bottlenecks: {}, parking: { onSite, onStreet: 0 } };
  }

  /**
   * Returns Watch My Road stats for a specific road at the given sim time.
   * total = cumulative unique vehicles ever seen on this road (from _frameStats).
   * active/slowing/stopped = instantaneous snapshot from the current frame.
   */
  getRoadStatsDetailed(simTime, roadId) {
    const frame = this._nearestFrame(simTime);
    if (!frame || !this._frameStats) return null;
    const slug = roadId.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    const frameIdx = this._data.frames.indexOf(frame);
    const fs = this._frameStats[frameIdx] ?? { roadVisitsIn: {}, roadVisitsOut: {} };
    const cumulativeIn  = fs.roadVisitsIn?.[slug]  ?? 0;
    const cumulativeOut = fs.roadVisitsOut?.[slug] ?? 0;

    // Use corridor average delay as a proxy if we're on a corridor road
    const cid = this._slugToCorridor(slug);
    let avgInDelay = 0, avgOutDelay = 0;
    if (cid) {
      const spawned = fs.spawned[cid] ?? 0;
      const slowSec = fs.slowTime[cid] ?? 0;
      avgInDelay = spawned > 0 ? (slowSec / spawned) / 60 : 0;
      avgOutDelay = (this._avgOutDelaySec?.[cid] ?? 0) / 60;
    }

    // Instantaneous speed breakdown from current frame (split by direction)
    const live = {
      inbound:  { active: 0, slowing: 0, stopped: 0 },
      outbound: { active: 0, slowing: 0, stopped: 0 },
    };
    for (const v of frame.vehicles) {
      if (v.road_id !== slug) continue;
      const dir = v.state === 'outbound' ? 'outbound' : 'inbound';
      if (v.speed < 0.5)      live[dir].stopped++;
      else if (v.speed < 2)   live[dir].slowing++;
      else                    live[dir].active++;
    }

    return {
      inbound:  { total: cumulativeIn,  ...live.inbound },
      outbound: { total: cumulativeOut, ...live.outbound },
      avgInDelay,
      avgOutDelay,
    };
  }

  /**
   * @param {number} simTime - seconds since midnight
   * @returns {boolean}
   */
  isFinished(simTime) {
    if (!this._data) return false;
    return simTime >= this._data.meta.end_time;
  }

  reset() {
    this._data = null;
    // _roadCoords is static map geometry — intentionally preserved across resets
  }
}
