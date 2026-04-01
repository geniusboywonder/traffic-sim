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
  }

  /**
   * Provide GeoJSON coordinates for roads so vehicle positions can be
   * interpolated to lat/lng. Call this after loading road GeoJSON in SimMap.
   * @param {Object.<string, number[][]>} coordMap - road_id → [[lon,lat],…]
   */
  setRoadCoords(coordMap) {
    this._roadCoords = coordMap;
    console.log('[Playback] setRoadCoords — roads mapped:', Object.keys(coordMap).length, Object.keys(coordMap).slice(0, 5));
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
    const results = frame.vehicles.map(v => {
      const coords = this._roadCoords[v.road_id] ?? [];
      const { lat, lng } = progressToLatLng(coords, v.progress);
      return { lat, lng, state: v.state, roadId: v.road_id, speed: v.speed };
    });
    if (results.length > 0 && simTime % 60 < 1) {
      const noCoords = results.filter(v => v.lat === 0 && v.lng === 0);
      console.log(`[Playback] t=${simTime} vehicles=${results.length} at-zero=${noCoords.length} roadCoords-keys=${Object.keys(this._roadCoords).length}`);
      if (results[0]) console.log('[Playback] sample vehicle:', results[0]);
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
