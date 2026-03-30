# Tokai HS Traffic Simulator v2 — Implementation Plan

> **Build status: ✅ All phases implemented — `npm run lint` passes (0 errors), `npm run build` passes.**
> Remaining Phase 7 items (mobile QA, performance check, FTP deploy) are user-facing verification tasks.

**Spec:** `docs/superpowers/specs/2026-03-28-simulator-v2-design.md`
**Branch:** `simulator-v2`
**Deploy target:** https://traffic.adamson.co.za
**Stack:** React 19 + Vite → static `dist/`

---

## Prerequisites

Before Phase 1 begins:

- [x] Install Leaflet: `npm install leaflet`
- [x] Verify `public/bergvliet-roads.json` is present and valid (LineString features)
- [x] Verify `public/junctions.geojson` is present and valid
- [x] Confirm `vite.config.js` has `base: '/'` (Vite default — check before first deploy)

---

## Phase 1 — Project Scaffold & Static Shell

Goal: app renders with correct layout, routing data loads, no simulation yet.

### 1.1 — Clean up scaffold

- [x] Delete or archive `TokaiTrafficSim.jsx` from project root (Phase 1 prototype — not part of v2 build)
- [x] Clear `src/App.jsx` and `src/App.css` to blank starting points
- [x] Remove unused assets from `src/assets/`

### 1.2 — `index.html` — head tags

- [x] Add GTM `<script>` head snippet immediately after opening `<head>` tag (container `GTM-60147474`)
- [x] Add AdSense `<script async>` in `<head>` (pub `ca-pub-4744444280795001`)
- [x] Set `<title>Tokai HS — Morning Traffic Simulator</title>`
- [x] Confirm `<meta name="viewport" content="width=device-width, initial-scale=1.0">`

### 1.3 — `index.html` — body tags

- [x] Add GTM `<noscript><iframe>` snippet immediately after opening `<body>` tag, before `<div id="root">`

### 1.4 — File structure

Create all empty placeholder files so imports resolve:

- [x] `src/components/Header.jsx`
- [x] `src/components/SimMap.jsx`
- [x] `src/components/StatsPanel.jsx`
- [x] `src/components/AdSlot.jsx`
- [x] `src/engine/idm.js`
- [x] `src/engine/routes.js`
- [x] `src/engine/spawner.js`

### 1.5 — `src/App.jsx` — layout grid + state

- [x] Render `<Header>`, `<AdSlot>`, map+panel grid, `<StatsPanel>`
- [x] Desktop grid: map column fluid + stats panel 260px fixed, sharing remaining viewport height below ad strip
- [x] Mobile (<768px): single column; map ~55vh; stats panel full-width scrollable below
- [x] `scenario` state (`'L' | 'M' | 'H'`) — passed to Header, SimMap, StatsPanel
- [x] `playing` state (boolean) — passed to SimMap
- [x] `speed` state (`1 | 2 | 5 | 10`) — passed to SimMap
- [x] `simTime` state (seconds since 06:30) — lifted from SimMap to Header for clock display
- [x] `activeVehicles` / `totalVehicles` state — passed to Header (desktop) and StatsPanel (mobile)
- [x] Wire `dataLayer` event pushes: `scenario_change`, `simulation_play`, `simulation_reset`

### 1.6 — `src/App.css` — responsive grid + dark theme

- [x] Dark background theme
- [x] Header: full-width, fixed height desktop / two-row mobile
- [x] Ad strip: full-width between header and content area
- [x] Content area: flex row (desktop) / flex column (mobile)
- [x] Map container: flex-grow 1, `position: relative` (needed for canvas overlay)
- [x] Stats panel: `width: 260px` desktop / `width: 100%` mobile; overflow-y scroll

### 1.7 — `src/components/Header.jsx`

- [x] Logo: `🏫 Tokai HS — Morning Traffic`
- [x] `[L]` `[M]` `[H]` scenario buttons — calls `onScenarioChange` prop; active state highlighted
- [x] Play / Pause / Reset icons — calls `onPlay`, `onPause`, `onReset` props
- [x] Clock display — formats `simTime` prop as `HH:MM AM/PM` from 06:30 baseline
- [x] Speed multiplier buttons `1× 2× 5× 10×` — calls `onSpeedChange` prop
- [x] Active + Total vehicle counts — hidden on mobile (rendered in StatsPanel instead)
- [x] Desktop: single row. Mobile: two rows per spec §3 table

### 1.8 — `src/components/AdSlot.jsx`

- [x] `React.memo` wrapper
- [x] `<ins class="adsbygoogle">` with `data-ad-client="ca-pub-4744444280795001"`, `data-ad-slot="2095203571"`, `data-ad-format="auto"`, `data-full-width-responsive="true"`
- [x] `useEffect([], () => { (adsbygoogle = window.adsbygoogle || []).push({}) })` — fires exactly once

### 1.9 — `src/components/StatsPanel.jsx` — static layout

- [x] 4 entry point cards (Dreyersdal Rd N, Homestead Ave, Children's Way, Firgrove Way) — placeholder zeros
- [x] 3 bottleneck cards (Christopher Rd J4→J5, Ruskin Rd J6→J7, Aristea Rd J20→J29) — placeholder zeros
- [x] 4 TIA assumption info cards (dwell 45s, 22 parking bays, Ruskin Class 5, 0% modal split)
- [x] "What-if scenario controls — coming soon" label
- [x] Active / Total vehicle count block — visible only on mobile (hidden on desktop via CSS)

**Phase 1 acceptance:** `npm run dev` renders dark-themed page with correct two-column layout, all header controls visible, ad strip placeholder, stats panel with static cards. No console errors.

---

## Phase 2 — Engine: Routes & Junction Data

Goal: `routes.js` exports all route geometry and junction data; Leaflet map renders roads and junction markers.

### 2.1 — `src/engine/routes.js` — junction coordinates

- [x] Define all junction objects: `{ id, lat, lng, name, control }`
- [x] Include all 12 visible junctions (J1, J4, J5, J6, J7, J8, J9, J10, J13, J18, J20, J28) plus any routing-only junctions needed by ROUTE_CONFIG

### 2.2 — `src/engine/routes.js` — CTRL_STYLE

- [x] Export `CTRL_STYLE` with all 8 control types from spec §4.1:
  `traffic_signal`, `priority_stop`, `4way_stop`, `stop`, `yield`, `critical`, `egress`, `roundabout_planned`

### 2.3 — `src/engine/routes.js` — road geometry helpers

- [x] Export `ROAD_LINES` — filtered LineString features from `bergvliet-roads.json` (Vite JSON import)
- [x] Implement `snapSegment(from, to)` — finds closest road feature and extracts sub-path between two junction waypoints
- [x] Implement `roadRoute(waypoints)` — chains `snapSegment` calls for full multi-junction route; returns `[[lat, lng], ...]`

### 2.4 — `src/engine/routes.js` — ROUTE_CONFIG (17 inbound + 2 outbound)

Each route object: `{ id, corridor, type, waypoints, maxVehicles }`

**Corridor 1A — Main Rd / Dreyersdal N (entry J1):**
- [x] `1A` — main route
- [x] `1A-RR1` through `1A-RR6` — 6 rat-run variants

**Corridor 2A — Homestead Ave (entry J9):**
- [x] `2A` — main route
- [x] `2A-RR1`, `2A-RR2`

**Corridor 2B — Children's Way (entry J8):**
- [x] `2B` — main route
- [x] `2B-RR1`, `2B-RR2`, `2B-RR3`

**Corridor 3A — Firgrove Way (entry J13):**
- [x] `3A` — main route
- [x] `3A-RR1`, `3A-RR2`

**Egress:**
- [x] `EG-A` — Aristea → Children's Way → Ladies Mile J8; 60% split
- [x] `EG-B` — Aristea → Christopher → Dreyersdal → Main Rd J1; 40% split

### 2.5 — `src/components/SimMap.jsx` — Leaflet initialisation

- [x] Import `leaflet` and `leaflet/dist/leaflet.css`
- [x] `useEffect([], () => { ... })` — initialise Leaflet map in `mapContainerRef`
- [x] Base tiles: OpenStreetMap
- [x] `map.fitBounds([[-34.0568, 18.4465], [-34.0400, 18.4625]], { padding: [18, 18] })`
- [x] Draw `ROAD_LINES` as Leaflet polylines (neutral dark style, below vehicle canvas)

### 2.6 — `src/components/SimMap.jsx` — junction markers

- [x] Render 12 visible junctions as Leaflet `CircleMarker` styled per `CTRL_STYLE` (ring colour, radius 8)
- [x] No junction number label on marker
- [x] Click/tap popup: road names + control type only

**Phase 2 acceptance:** Map renders with correct bounds; road geometry drawn; 12 junction markers visible with correct colours; clicking a marker shows road name and control type.

---

## Phase 3 — Engine: IDM Physics

Goal: `idm.js` exports a working vehicle physics engine. No React dependency.

### 3.1 — `src/engine/idm.js` — road class parameters

- [x] Export `IDM_PARAMS` keyed by road class (`'arterial'`, `'collector'`, `'local'`) with `v0`, `T`, `a`, `b`, `s0` per spec §4.3 table

### 3.2 — `src/engine/idm.js` — IDM acceleration formula

- [x] Implement `idmAccel(v, dv, s, params)` — pure function, returns m/s²
  - `s_star = s0 + v*T + (v*dv) / (2 * sqrt(a*b))`
  - `accel = a * (1 - (v/v0)^4 - (s_star/s)^2)`

### 3.3 — `src/engine/idm.js` — vehicle step function

- [x] Implement `stepVehicle(vehicle, leader, roadClass, dt)` — advances one vehicle by `dt` seconds
  - Updates `vehicle.v` and `vehicle.pos` (0.0–1.0 progress along route)
  - Clamps velocity to `[0, v0]`

### 3.4 — `src/engine/idm.js` — sub-step loop

- [x] Implement `stepAllVehicles(vehicles, dt)` — iterates all active vehicles
  - `dtSub = Math.min(dt / 4, 0.25)` — max 0.25s per sub-step
  - Sort vehicles front-to-back before each sub-step to avoid leader/follower order bugs

### 3.5 — `src/engine/idm.js` — junction hold logic

- [x] Traffic signal J8: fixed cycle hold (30s green / 30s red simulated)
- [x] All-way stops (J4, J10, J28): FIFO queue — one vehicle proceeds per 4s simulated gap
- [x] Priority stops and stop-controlled junctions: proceed if `timeToNextVehicle > 6s`

**Phase 3 acceptance:** `stepAllVehicles` called in a tight loop produces no NaN or negative velocities; vehicles slow for leaders; vehicles pause at junctions and release correctly.

---

## Phase 4 — Engine: Vehicle Spawner

Goal: `spawner.js` produces correct vehicle counts and route assignments per scenario and simulated time.

### 4.1 — `src/engine/spawner.js` — scenario config

- [x] Export `SCENARIO_CONFIG`:
  ```js
  {
    L: { totalTrips: 500, peakWindowMin: 75, ratRunThreshold: 0.85 },
    M: { totalTrips: 650, peakWindowMin: 60, ratRunThreshold: 0.80 },
    H: { totalTrips: 840, peakWindowMin: 45, ratRunThreshold: 0.70 },
  }
  ```
- [x] Drop-off dwell constant: `DWELL_S = 45`

### 4.2 — `src/engine/spawner.js` — bell-curve inflow rate

- [x] Implement `spawnRate(simTimeSec, scenario)` — returns vehicles/second
  - Ramp-up 06:30→07:00
  - Peak 07:00→07:45 (narrower for High, broader for Low)
  - Taper 07:45→08:30
  - Integral over full window ≈ `totalTrips` ±5%

### 4.3 — `src/engine/spawner.js` — origin distribution

- [x] Implement `corridorSplit(scenario)` — returns fraction of total trips per corridor based on TIA §13 percentages
  - Dreyersdal Rd N (J1), Homestead Ave (J9), Children's Way (J8), Firgrove Way (J13)
  - Document TIA §13 source values in code comments

### 4.4 — `src/engine/spawner.js` — rat-run diversion

- [x] Implement `assignRoute(corridorId, scenario, corridorDensity)` — returns route ID
  - If `corridorDensity >= ratRunThreshold`, weighted random pick from corridor's rat-run routes
  - Otherwise assign main route

### 4.5 — `src/engine/spawner.js` — tick function

- [x] Implement `spawnTick(simTimeSec, dt, scenario, corridorDensities)` — returns array of new vehicle objects
  - Each vehicle: `{ id, routeId, pos: 0, v: 0, state: 'inbound', spawnTime: simTimeSec }`
  - Per-corridor fractional accumulator to avoid missed vehicles from sub-1 spawn rates

### 4.6 — `src/engine/spawner.js` — drop-off → outbound transition

- [x] Vehicle reaches `pos >= 1.0` on inbound route → transition to `state: 'dwell'`, record `dwellStart`
- [x] After `DWELL_S` simulated seconds → transition to `state: 'outbound'`, assign egress route (60% EG-A, 40% EG-B)

**Phase 4 acceptance:** Headless test loop spawns vehicles over 7200 simulated seconds; total spawned ≈ scenario trip count ±5%; corridor splits roughly match TIA §13 percentages.

---

## Phase 5 — Canvas Animation Loop

Goal: vehicles move on the map canvas, colours correct, canvas stays in sync with map viewport.

### 5.1 — `src/components/SimMap.jsx` — canvas overlay setup

- [x] `<canvas>` element positioned `absolute top:0 left:0` over Leaflet map container
- [x] On mount: `canvas.width = container.offsetWidth; canvas.height = container.offsetHeight`
- [x] Re-sync canvas dimensions on Leaflet `moveend`, `zoomend`, and window `resize`
- [x] `ResizeObserver` on map container — handles orientation change and layout-driven resize
- [x] Cache `vehicleRadius`: `window.innerWidth < 768 ? 3 : 4`; update in `ResizeObserver` callback; read cached value per frame (never re-read `innerWidth` per frame)

### 5.2 — `src/components/SimMap.jsx` — animation loop

- [x] `requestAnimationFrame` loop: started on play, cancelled on pause/reset
- [x] Per frame:
  1. `dt = 0.5 * speedMultiplier` (simulated seconds)
  2. `simTimeSec += dt`
  3. `spawnTick(...)` → add new vehicles
  4. `stepAllVehicles(vehicles, dt)` → update positions
  5. Transition dwell → outbound for completed dwells
  6. Remove outbound vehicles with `pos >= 1.0`
  7. Clear canvas, draw all active vehicles
  8. Update React state (`simTime`, `activeVehicles`, `totalVehicles`) — throttled to max 4 updates/sec
- [x] Auto-stop when `simTimeSec >= 7200` (08:30)

### 5.3 — `src/components/SimMap.jsx` — vehicle rendering

- [x] Route `pos` → `[lat, lng]` via linear interpolation along route polyline
- [x] `[lat, lng]` → pixel via `map.latLngToContainerPoint()`
- [x] Draw filled circle, radius = cached `vehicleRadius`
- [x] Colour: `inbound=#3b82f6`, `outbound=#f97316`, `ratrun=#eab308`, `queued=#ef4444`
- [x] Vehicle is `queued` when `v < 0.5 m/s`

### 5.4 — `src/components/SimMap.jsx` — play / pause / reset

- [x] Play: starts `requestAnimationFrame` loop
- [x] Pause: cancels loop, preserves vehicle state
- [x] Reset: cancels loop, clears vehicle array, resets `simTimeSec = 0`, re-seeds spawner accumulators

**Phase 5 acceptance:** Vehicles spawn at entry junctions, move along polylines, slow near junctions, turn orange after drop-off, show red when stationary. Canvas does not drift from map on zoom/pan/mobile rotation.

---

## Phase 6 — Stats Panel: Live Data

Goal: stats cards update in real time from simulation state.

### 6.1 — Entry point counters

- [x] `current` — vehicles currently on that corridor's routes (inbound only)
- [x] `total` — cumulative vehicles spawned from that corridor since 06:30
- [x] Colour: green < 50% of corridor `maxVehicles`, amber 50–80%, red > 80%

### 6.2 — Bottleneck counters

- [x] Christopher Rd (J4→J5): vehicle count on segment + % of segment `maxVehicles`
- [x] Ruskin Rd ingress (J6→J7): count of vehicles in `queued` state on that segment
- [x] Aristea Rd egress (J20→J29): count of outbound vehicles on egress routes

### 6.3 — Active / Total vehicle counts

- [x] `activeVehicles` (inbound + dwell + outbound in simulation now) + `totalVehicles` (cumulative since reset)
- [x] Desktop: shown in Header right side
- [x] Mobile: shown at top of StatsPanel

**Phase 6 acceptance:** Cards update ~4×/sec during simulation; corridor colours change as roads load up; mobile stats block shows active/total counts.

---

## Phase 7 — Polish & Pre-deploy

### 7.1 — Visual polish

- [x] Consistent dark theme (header, ad strip, map controls, stats panel)
- [x] Play/pause/reset icons: SVG or Unicode — no external icon library
- [x] Active scenario button clearly highlighted
- [x] Junction marker tooltips styled to match dark theme

### 7.2 — Mobile QA *(browser verification needed)*

- [ ] Test at 375px (iPhone SE) and 390px (iPhone 14)
- [ ] All 7 header elements accessible (5 in header rows, 2 in stats panel below map)
- [ ] Map tap opens junction tooltips
- [ ] Canvas does not overflow on orientation change

### 7.3 — Performance check *(browser verification needed)*

- [ ] 10× speed + High scenario (~840 vehicles at peak): frame time < 16ms
- [x] No memory leaks — completed vehicles removed; `rAF` ID always cancelled on cleanup

### 7.4 — `vite.config.js`

- [x] Confirm `base: '/'` (or absent — Vite default)
- [x] Confirm `@vitejs/plugin-react` is configured

### 7.5 — Build & deploy

- [x] `npm run build` — no errors
- [x] Leaflet CSS bundled in `dist/assets/` (imported in `SimMap.jsx` or `App.jsx`)
- [x] `dist/bergvliet-roads.json` and `dist/junctions.geojson` present (Vite copies `public/`)
- [ ] Upload `dist/` contents to `traffic.adamson.co.za` document root

---

## Dependency Order

```
Phase 1 (scaffold)
  └─ Phase 2 (routes + Leaflet map)
       ├─ Phase 3 (IDM physics)      ← can run parallel with Phase 2 after route shape agreed
       └─ Phase 4 (spawner)          ← can run parallel with Phase 2 after route shape agreed
            └─ Phase 5 (canvas animation)
                 └─ Phase 6 (live stats)
                      └─ Phase 7 (polish + deploy)
```

Phases 3 and 4 can be developed in parallel once vehicle object shape is finalised in routes.js.

---

## Key Constants

| Constant | Value | Spec ref |
|---|---|---|
| Simulation start | 06:30 (simTimeSec = 0) | §4.3 |
| Simulation end | 08:30 (simTimeSec = 7200) | §4.3 |
| Frame dt at 1× | 0.5s | §4.3 |
| Sub-step cap | 0.25s | §4.3 |
| Drop-off dwell | 45s | §4.5 |
| Egress split EG-A / EG-B | 60% / 40% | §4.4 |
| Stats panel width (desktop) | 260px | §2.1 |
| Mobile breakpoint | 768px | §2.2 |
| Vehicle radius mobile / desktop | 3px / 4px | §4.2 |
| Map bounds SW | -34.0568, 18.4465 | §4.1 |
| Map bounds NE | -34.0400, 18.4625 | §4.1 |
| AdSense pub ID | ca-pub-4744444280795001 | §6 |
| AdSense slot | 2095203571 | §6 |
| GTM container | GTM-60147474 | §7 |
| GA4 property | 514042177 | §7 |
