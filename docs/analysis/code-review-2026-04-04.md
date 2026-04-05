# Code Review — Traff✱k Simulation Engine & UI
**Date:** 2026-04-04
**Scope:** src/engine/, src/components/SimMap.jsx, src/App.jsx, src/components/StatsPanel.jsx

Priority: 🔴 High (hot path / correctness) | 🟡 Medium (performance) | 🟢 Low (cleanup)

---

## Engine — `idm.js`

### 🔴 `parseInt(jid)` called 7× per junction per frame
`junctionHoldDuration` calls `parseInt(jid)` on every invocation — in the hot path this runs hundreds of times per frame. `jid` is already a number when passed from the sim loop (it comes from `route.junctions[idx]` which is a numeric array). The `parseInt` calls are defensive but wasteful.

**Fix:** Remove all `parseInt(jid)` calls. The junction IDs are always numbers. If the function signature needs to accept strings, parse once at the top:
```js
const jidNum = typeof jid === 'string' ? parseInt(jid, 10) : jid;
```
Then use `jidNum` throughout.

---

### 🔴 `Object.values(routeConfigs)` iterated every physics sub-step
In `stepAllVehicles`, the look-ahead loop iterates `Object.values(routeConfigs)` for every vehicle that needs a look-ahead leader. With 500 vehicles and 4 sub-steps, this is ~2000 iterations of a ~30-entry object per frame.

**Fix:** Pre-compute the junction→nextJunctions map once outside the loop:
```js
// Before the sub-step loop:
const junctionNextMap = new Map(); // toJid → Set of nextJids
for (const r of Object.values(routeConfigs)) {
  if (!r.junctions) continue;
  for (let i = 0; i < r.junctions.length - 1; i++) {
    const jid = r.junctions[i];
    const next = r.junctions[i + 1];
    if (!junctionNextMap.has(jid)) junctionNextMap.set(jid, new Set());
    junctionNextMap.get(jid).add(next);
  }
}
```
Then replace the inner loop with `junctionNextMap.get(toJid)`.

---

### 🟡 `getParkingOccupancy` called once per sub-step (4× per frame)
`getParkingOccupancy` does two full `vehicles.filter()` passes. It's called at the top of `stepAllVehicles` but the result is used inside the inner loop. Since parking state doesn't change mid-sub-step, this is fine — but the two separate filter passes can be combined:

```js
// Current: two passes
const onSite = vehicles.filter(v => v.state === 'dwell' && v.parkingType === 'on-site').length;
const onStreet = vehicles.filter(v => v.state === 'dwell' && v.parkingType === 'on-street').length;

// Better: one pass
let onSite = 0, onStreet = 0;
for (const v of vehicles) {
  if (v.state !== 'dwell') continue;
  if (v.parkingType === 'on-site') onSite++;
  else if (v.parkingType === 'on-street') onStreet++;
}
```

---

### 🟡 `trafficHold` closure created on every `junctionHoldDuration` call
The `trafficHold` helper is defined as a closure inside `junctionHoldDuration`. It captures `roadCounts` but is recreated on every call. Extract it as a standalone function or inline it:

```js
// Inline instead of closure:
const n = roadCounts?.[roadName] ?? 0;
const hold = Math.min(base + n * perVehicle, max);
```

---

### 🟡 `conflictRoads` objects created on every switch case entry
Each `case 'stop'`, `case 'yield'` etc. creates a new object literal `{ 4: 'Christopher Road', ... }` on every call. These should be module-level constants:

```js
const STOP_CONFLICT_ROADS = { 4: 'Christopher Road', 15: 'Dreyersdal Road', 16: 'Vineyard Road' };
const YIELD_CONFLICT_ROADS = { 2: 'Dreyersdal Road', 5: 'Vineyard Road', 17: 'Ruskin Road' };
// etc.
```

---

## Engine — `spawner.js`

### 🔴 `corridorDensity` and `corridorCongestionScore` each do full `vehicles.filter()` passes, called per corridor per tick
`spawnTick` calls both functions for each of 5 corridors. Each does a full array scan. With 500 vehicles this is 10 full scans per tick (5 corridors × 2 functions).

**Fix:** Combine into a single pass that computes all corridor stats at once:
```js
function corridorStats(vehicles) {
  const stats = {};
  for (const v of vehicles) {
    if (v.state !== 'inbound') continue;
    const cid = v.corridorId;
    if (!stats[cid]) stats[cid] = { cur: 0, stalled: 0 };
    stats[cid].cur++;
    if (v.v < 0.5) stats[cid].stalled++;
  }
  return stats; // use to compute density and congestion score
}
```

---

### 🟡 `NORMS` computed at module load with 720 iterations each
`computeNorm` runs a 720-iteration loop for each of 3 scenarios at module load. This is fine (runs once) but the magic number `720` should be a named constant explaining it represents 7200 seconds / 10s step.

---

## Engine — `routes.js`

### 🔴 `EGRESS_ROUTES` export is stale — no longer used
`EGRESS_ROUTES` at the bottom of `routes.js` is exported but `spawner.js` no longer imports it (the import was removed). It's dead code that could confuse future readers.

**Fix:** Delete the `EGRESS_ROUTES` export from `routes.js`.

---

### 🟡 `computeCumulativeDistances` duplicated 3 times
The haversine cumulative distance calculation appears identically in `roadRoute`, `getRouteJunctions`, and `getWaypointPositions`. Extract to a shared helper:

```js
function cumulativeDistances(geom) { /* ... */ }
```

---

### 🟡 `snapSegment` is O(n×m) — runs at module load for every route segment
`snapSegment` iterates all road features for every junction pair in every route. With ~30 routes × ~8 junctions each = ~240 calls, each scanning all road features. This runs once at module load so it's not a runtime issue, but it makes cold start slow.

No action needed unless cold start becomes a problem.

---

## Component — `SimMap.jsx`

### 🔴 `roadCounts` computed by iterating all vehicles + all route segments every frame
The new `roadCounts` computation (added for traffic-aware holds) runs before `spawnTick` and iterates every vehicle × every segment of their route. This is O(vehicles × segments_per_route) = ~500 × 5 = 2500 iterations per frame just for road counts.

**Fix:** Only compute `roadCounts` every N frames (e.g. every 10 frames = every 5 sim-seconds). Junction holds don't need per-frame precision:
```js
const roadCounts = (frameCount % 10 === 0) ? computeRoadCounts(vehiclesRef.current) : lastRoadCountsRef.current;
```

---

### 🔴 `computeStats` called every 250ms with 3 separate `filter()` passes per corridor
`computeStats` runs 4 corridors × 3 filter passes (stopped/slowing/active) = 12 filter passes on the full vehicle array every 250ms. These can be combined into one pass:

```js
const counts = { '3A': {...}, '2A': {...}, '2B': {...}, '1A': {...}, '1A-NORTH': {...} };
for (const v of vehicles) {
  if (v.state !== 'inbound') continue;
  const c = counts[v.corridorId];
  if (!c) continue;
  if (v.v < 0.5) c.stopped++;
  else if (v.v < 2) c.slowing++;
  else c.active++;
}
```

---

### 🟡 `VISIBLE_JUNCTIONS.forEach` runs every 250ms updating junction markers
The junction pulse loop iterates all visible junctions and calls `vehiclesRef.current.filter(v => v.holdingAt === jid)` for each. That's 14 junctions × full vehicle scan = 14 filter passes every 250ms.

**Fix:** Build a `holdingAtMap` (jid → count) in a single pass:
```js
const holdingAtMap = {};
for (const v of vehiclesRef.current) {
  if (v.holdingAt != null) holdingAtMap[v.holdingAt] = (holdingAtMap[v.holdingAt] ?? 0) + 1;
}
```

---

### 🟡 `posToLatLng` recomputes cumulative distances on every call
`posToLatLng` is called for every vehicle every frame to get its canvas position. It recomputes the full cumulative distance array of the route geometry each time. With 500 vehicles this is 500 full geometry traversals per frame.

The geometry is fixed — cumulative distances should be cached per route alongside the geometry in `ROUTE_CONFIG`. This is the single biggest performance opportunity in the render loop.

**Fix:** In `routes.js`, add `cumDists` and `totalLen` to each route's cached data in `ROUTE_CONFIG`. Then `posToLatLng` just does a binary search on the pre-computed array.

---

### 🟡 `drawFrame` calls `Object.values(ROUTE_CONFIG)` when `showRoutes` is true
Minor — only fires when routes overlay is visible. No action needed.

---

### 🟢 `rerender-no-inline-components` — `BentoBriefing`, `ModelsSection`, `FindingsSection`, `Footer` defined inside `App.jsx`
These are large components defined at module level (not inside another component) so they don't cause re-render issues. However they're defined as `const X = () =>` arrow functions which means they're recreated on every module evaluation. They should be proper function declarations or moved to separate files.

Not a performance issue in practice since they're static — just a code organisation note.

---

## Component — `StatsPanel.jsx`

### 🟡 `corrList` derived from `statsData.corridors` on every render
`corrList`, `totalIn`, `totalOut`, `avgInTime`, `avgOutTime` etc. are all recomputed on every render. Since `StatsPanel` is wrapped in `memo`, this only fires when `statsData` changes (every 250ms) — acceptable.

---

### 🟢 `handleMouseMove` / `handleMouseLeave` in `CorridorCard` use `useCallback` correctly
No issues. The 3D tilt effect is well-implemented.

---

## `App.jsx`

### 🟡 `rerender-no-inline-components` — `BentoBriofing`, `ModelsSection` etc. are large inline components
As noted above — not a re-render issue but worth extracting to separate files for maintainability as the codebase grows.

### 🟢 `fmtTime` defined twice — once in `App.jsx` and once in `StatsPanel.jsx`
Both are identical. Extract to a shared `src/utils/format.js`.

---

## `App.css`

### 🟢 CSS file is 2121 lines — consider splitting
Not a performance issue (Vite bundles it) but maintainability suffers. Suggested split:
- `sim-map.css` — simulator controls, legend, canvas overlay
- `findings.css` — damage report section
- `models.css` — under the hood section
- `access-barrier.css` — splash screen

---

## Summary by Priority

### 🔴 Fix these (correctness / significant perf)
1. `parseInt(jid)` called 7× per junction — remove, jid is already a number
2. `Object.values(routeConfigs)` iterated per vehicle per sub-step — pre-compute junction→next map
3. `corridorDensity` + `corridorCongestionScore` = 10 full array scans per tick — combine into one pass
4. `roadCounts` computed every frame — throttle to every 10 frames
5. `computeStats` = 12 filter passes per 250ms — combine into one pass
6. `posToLatLng` recomputes cumulative distances per vehicle per frame — cache in ROUTE_CONFIG

### 🟡 Fix these (medium perf / code quality)
7. `getParkingOccupancy` — two filter passes → one loop
8. `trafficHold` closure recreated per call — inline or extract
9. `conflictRoads` objects created per switch case — hoist to module-level constants
10. `computeCumulativeDistances` duplicated 3× in routes.js — extract shared helper
11. Junction pulse loop — 14 filter passes → one `holdingAtMap` pass

### 🟢 Cleanup (low priority)
12. Delete stale `EGRESS_ROUTES` export from routes.js
13. Extract `fmtTime` to shared utils
14. Extract large inline components to separate files
15. Consider splitting App.css
