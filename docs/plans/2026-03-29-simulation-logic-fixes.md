# Simulation Logic Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical simulation bugs (Vineyard stall, no school ingress/egress) and all underlying IDM/flow logic issues identified in the code review.

**Architecture:** All fixes are in three files: `src/engine/idm.js` (physics), `src/engine/spawner.js` (spawn/dwell), `src/engine/routes.js` (geometry), and `src/components/SimMap.jsx` (loop/state machine).

**Tech Stack:** React 19, Vite, Leaflet, custom IDM physics, HTML5 Canvas

---

## Issues Found

### IDM Physics

| ID | File | Issue |
|----|------|-------|
| IDM-1 | idm.js:39 | Creep logic fires even when vehicle is held — bypasses junction holds and parking blocks |
| IDM-2 | idm.js:165 / SimMap.jsx:303 | `v.simTime` is stale during physics step — updated after `stepAllVehicles` runs |
| IDM-3 | idm.js:122-149 | Global look-ahead crosses route directions — EG-D (outbound) creates phantom leaders for inbound route 1A at J5, causing Vineyard stall |
| IDM-4 | idm.js:120 | Gap can go negative when leader is very close → panic braking cascade |

### Back-Pressure & Flow

| ID | File | Issue |
|----|------|-------|
| FLOW-1 | SimMap.jsx:343 | Junction `lastRelease` shared across all vehicles in a frame — burst of vehicles passes stops unchecked |
| FLOW-2 | SimMap.jsx:337 | Junction position snapping uses squared lat/lng (not metric) — can skip junctions under high speed multiplier |
| FLOW-3 | spawner.js:98 | Rat-run density check runs before vehicle is added — always understimates congestion; thresholds too high |

### Critical Bugs

| ID | Symptom | Root Cause |
|----|---------|------------|
| BUG-1 | Vehicles stall after J5 turn onto Vineyard | IDM-3: EG-D passes J5 outbound, creates phantom leader for inbound 1A at J5 |
| BUG-2 | No vehicles enter school / travel internal road / egress | Primary: BUG-1 blocks most routes before reaching J7. Secondary: egress geometry J7→J20 falls back to straight line if internal road snap fails. Display: egress vehicles drawn in wrong corridor colour |

---

## Tasks (all COMPLETED as of 2026-03-29)

### Task A — Fix IDM-3: Direction-filtered look-ahead ✅
**File:** `src/engine/idm.js` — `stepAllVehicles` Search 2 block

Filter candidate routes by travel direction: inbound vehicles skip egress routes, outbound vehicles skip non-egress routes. Also filter `sameSegmentLeaders` by `other.state === v.state`.

### Task B — Fix IDM-1: Gate creep behind holdActive ✅
**File:** `src/engine/idm.js` — `idmAccel`

Add `holdActive = false` parameter. Creep only fires when `!holdActive`. Caller (`stepAllVehicles`) passes `holdActive = v.holdUntil !== null && v.holdUntil > t`.

### Task C — Fix IDM-4: Gap floor ✅
**File:** `src/engine/idm.js` — `stepAllVehicles` gap calculation

`gap = Math.max(v.distToTarget - leader.distToTarget - 4.5, 0.1)` — prevents negative/zero gaps causing panic braking.

### Task D — Fix IDM-2: Pass simTime to stepAllVehicles ✅
**Files:** `src/engine/idm.js`, `src/components/SimMap.jsx`

Add `simTime` parameter to `stepAllVehicles`. Use it (not `v.simTime`) for hold evaluation. Call site: `stepAllVehicles(vehicles, dt, ROUTE_CONFIG, simTimeRef.current)`.

### Task F — Fix FLOW-3: Lower rat-run thresholds ✅
**File:** `src/engine/spawner.js` — `SCENARIO_CONFIG`

Lowered `ratRunThreshold` from 0.25/0.20/0.15 → 0.10/0.08/0.06 so rat-runs activate during peak periods.

### Task G — Fix egress geometry: use internal school road ✅
**File:** `src/engine/routes.js` — `roadRoute`

Added `getInternalRoadGeometry()` that extracts `'Tokai High School Internal Road'` from GeoJSON. `roadRoute` detects J7→J20 (or J20→J7) consecutive waypoints and substitutes the real road geometry, ensuring vehicles travel the correct internal path.

### Task H — Fix egress corridorId for display ✅
**File:** `src/engine/spawner.js` — `processDwell`

Set `vehicle.corridorId = 'egress'` when transitioning to outbound so vehicles draw in orange instead of their original corridor colour.

### Task I — Fix FLOW-1: Junction release rate limiting ✅
**Files:** `src/engine/idm.js` — `junctionHoldDuration`, `src/components/SimMap.jsx` — loop

Track `frameReleases` per junction per frame. Reset at loop start. Each additional vehicle beyond the first that passes a junction in the same frame is held for `3s × frameReleases` to enforce realistic inter-vehicle gaps. Updated `junctionHoldDuration` signature: `(control, simTime, frameReleases, lastReleaseTime, routeId, corridorId)`.

---

## Testing Checklist

- [ ] Vehicles on route 1A flow past J5 (Christopher/Vineyard) without stalling
- [ ] Vehicles reach J7 and transition to `dwell` state (show grey on map)
- [ ] After 45s dwell, vehicles appear on internal school road (grey dotted line)
- [ ] Vehicles egress via EG-A/B/C/D and appear orange on map
- [ ] Rat-runs activate during M/H scenarios (visible as lighter-colour vehicles on rat-run streets)
- [ ] Junction markers pulse red when ≥2 vehicles are queued
- [ ] No vehicles clip through stops — back-pressure propagates upstream correctly
- [ ] Parking occupancy (on-site/on-street) fills over time in StatsPanel
