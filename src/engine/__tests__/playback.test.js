// src/engine/__tests__/playback.test.js
import { describe, it, expect } from 'vitest';
import { PlaybackSource } from '../playback.js';
import fixtureData from './fixtures/scenario-fixture.json';

// Helper: create a PlaybackSource pre-loaded with fixture data (bypasses fetch)
function makeLoaded(data = fixtureData) {
  const src = new PlaybackSource();
  src._loadData(data);
  return src;
}

describe('PlaybackSource', () => {
  describe('before load', () => {
    it('getVehicles returns empty array', () => {
      const src = new PlaybackSource();
      expect(src.getVehicles(23400)).toEqual([]);
    });

    it('getRoadStats returns empty Map', () => {
      const src = new PlaybackSource();
      expect(src.getRoadStats(23400).size).toBe(0);
    });

    it('isLoaded returns false', () => {
      const src = new PlaybackSource();
      expect(src.isLoaded()).toBe(false);
    });
  });

  describe('after load', () => {
    it('isLoaded returns true', () => {
      expect(makeLoaded().isLoaded()).toBe(true);
    });

    it('getVehicles returns vehicles for exact frame time', () => {
      const src = makeLoaded();
      const vehicles = src.getVehicles(23400);
      expect(vehicles.length).toBe(2);
    });

    it('getVehicles returns vehicles for nearest earlier frame', () => {
      const src = makeLoaded();
      // t=23410 is between frames 23400 and 23460 → nearest earlier is 23400
      const vehicles = src.getVehicles(23410);
      expect(vehicles.length).toBe(2);
    });

    it('getVehicles returns last frame vehicles when t > end', () => {
      const src = makeLoaded();
      const vehicles = src.getVehicles(99999);
      expect(vehicles.length).toBeGreaterThan(0);
    });

    it('vehicle has lat and lng properties', () => {
      const src = makeLoaded();
      // Fixture has no GeoJSON road lines, so lat/lng fall back to [0,0]
      const v = src.getVehicles(23400)[0];
      expect(v).toHaveProperty('lat');
      expect(v).toHaveProperty('lng');
      expect(v).toHaveProperty('state');
      expect(v).toHaveProperty('roadId');
    });

    it('getRoadStats returns Map with road_id keys', () => {
      const src = makeLoaded();
      const stats = src.getRoadStats(23400);
      expect(stats.has('christopher_rd')).toBe(true);
      expect(stats.get('christopher_rd').inbound).toBe(2);
    });

    it('isFinished returns false before end_time', () => {
      const src = makeLoaded();
      expect(src.isFinished(23400)).toBe(false);
    });

    it('isFinished returns true at end_time', () => {
      const src = makeLoaded();
      expect(src.isFinished(23520)).toBe(true);
    });

    it('getAllFrames returns full frame array', () => {
      const src = makeLoaded();
      expect(src.getAllFrames().length).toBe(2);
    });

    it('getRoads returns road registry', () => {
      const src = makeLoaded();
      expect(src.getRoads().length).toBe(2);
      expect(src.getRoads()[0].id).toBe('christopher_rd');
    });

    it('reset clears loaded data', () => {
      const src = makeLoaded();
      src.reset();
      expect(src.isLoaded()).toBe(false);
    });
  });
});
