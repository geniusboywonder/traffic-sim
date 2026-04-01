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
    '1A': 'Dreyersdal Rd N', '2A': 'Homestead Ave',
    '2B': "Children's Way",  '3A': 'Firgrove Way',
  };
  // Primary entry road for each corridor (used for delay stats)
  static _ENTRY_ROADS = {
    '1A': 'dreyersdal_road', '2A': 'homestead_avenue',
    '2B': 'childrens_way',   '3A': 'timber_way',
  };

  _flowToCorridor(vehicleId) {
    const m = vehicleId.match(/^flow_(\d+)_/);
    if (!m) return null;
    return PlaybackSource._FLOW_CORRIDORS[Math.floor(parseInt(m[1]) / 5)] ?? null;
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
    const seenRoad     = {};   // road_id → Set of vehicle IDs

    this._frameStats = this._data.frames.map(frame => {
      for (const v of frame.vehicles) {
        const cid = this._flowToCorridor(v.id);
        if (cid) {
          seenCorridor[cid].add(v.id);
          if (v.speed < 2) slowAcc[cid] += dt;
        }
        if (!seenRoad[v.road_id]) seenRoad[v.road_id] = new Set();
        seenRoad[v.road_id].add(v.id);
      }
      return {
        spawned:  { '1A': seenCorridor['1A'].size, '2A': seenCorridor['2A'].size, '2B': seenCorridor['2B'].size, '3A': seenCorridor['3A'].size },
        slowTime: { ...slowAcc },
        roadVisits: Object.fromEntries(Object.entries(seenRoad).map(([k, s]) => [k, s.size])),
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
   * @returns {Promise<void>}
   */
  async loadScenario(scenario) {
    this._data = null;
    const res = await fetch(`/sim-results/scenario-${scenario}.json`);
    if (!res.ok) throw new Error(`Failed to load scenario-${scenario}.json: ${res.status}`);
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
      if (coords.length === 0) continue;  // no geometry → off-map road, skip
      const { lat, lng } = progressToLatLng(coords, v.progress);
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
        avgOutDelay: 0,
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
    const fs = this._frameStats[frameIdx] ?? { roadVisits: {} };
    const cumulativeTotal = fs.roadVisits[slug] ?? 0;

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
      inbound:  { total: cumulativeTotal, ...live.inbound },
      outbound: { total: cumulativeTotal, ...live.outbound },
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
