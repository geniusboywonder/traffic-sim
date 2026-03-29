# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — 2026-03-30 Dynamic Rat-Run Congestion Routing
- `corridorCongestionScore(corridorId, vehicles)` in `spawner.js`: measures fraction of inbound vehicles on the main route that are stalled (v < 0.5 m/s). Requires ≥3 vehicles for a reliable signal; returns 0.0 below threshold.
- `assignRoute()` updated: rat-run probability now scales dynamically with congestion score — `ratRunProb = 0.15 + congestionScore × 0.70` (clamped 15%–85%). Replaces fixed 40%. Density threshold gate still applies first.
- `spawnTick()` now returns `{ newVehicles, congestionScores }` with per-corridor scores computed once per frame.
- `congestionScoresRef` in `SimMap.jsx` tracks latest scores each frame; `computeStats` exposes `congestion` (0.0–1.0) per corridor in the stats object.
- StatsPanel corridor cards show a live congestion bar (green <40% / amber 40–70% / red >70%) and the current effective rat-run probability percentage.
- `RAT_RUN` log events now include `congestion=X.XX prob=X.XX` in the detail field.

### Fixed — 2026-03-29 Vineyard Road Stall & Physics Race Condition
- **Root cause 1 (Race Condition):** The simulation loop in `SimMap.jsx` calculated physics movement before updating vehicle junction indices. Vehicles crossing an intersection would temporarily have a negative distance to their target, triggering a "panic brake" glitch in the IDM engine.
- **Root cause 2 (Directional Priority):** Junction 5 (Christopher/Vineyard) applied a yield hold to all vehicles regardless of direction, causing Vineyard Rd through-traffic to brake unnecessarily.
- **Fix 1:** Reordered the simulation loop in `SimMap.jsx` to ensure junction indices and state transitions are updated *before* the physics calculation.
- **Fix 2:** Implemented directional awareness in `idm.js`. Yields and stops now only apply to vehicles approaching from specific restricted junctions (e.g., J5 yield now only applies to traffic from Christopher Rd).

### Fixed — 2026-03-29 ReferenceError: JUNCTIONS not defined in idm.js
- **Root cause:** `JUNCTIONS` and `ROUTE_CONFIG` were being used in the newly refactored `junctionHoldDuration` function in `idm.js` but were not imported from the routes engine.
- **Fix:** Added `import { JUNCTIONS, ROUTE_CONFIG } from './routes'` to `src/engine/idm.js`.

### Fixed — 2026-03-29 TypeError: newV.forEach is not a function in SimMap.jsx
- **Root cause:** `spawnTick` in `spawner.js` was updated to return an object `{ newVehicles, congestionScores }`, but the call site in `SimMap.jsx` was still treating the return value as a simple array.
- **Fix:** Updated `SimMap.jsx` to destructure the return object and pass `congestionScores` to the statistics update function.

### Added — 2026-03-29 Directional Junction Controls
- **Engine Awareness:** `junctionHoldDuration` in `idm.js` is now direction-aware. It uses `direction_only` metadata from the junction configuration to check if a vehicle is approaching from a restricted minor road before applying a hold.
- **Starke Rd Optimization:** Starke Rd is now "stop-free" for through-traffic at J4 (Christopher), J22 (Airlie), and J24 (Clement). Controls at these intersections now only apply to vehicles entering from the side streets.
- **T-Junction Refinement:** Junctions 6, 14, 18, 19, 21, and 25 are now marked as `control: 'none'`. They serve as physical sequence markers for the IDM engine but no longer apply artificial stop/yield delays, reflecting natural T-junction flow.
- **Metadata Synchronization:** `simulation-data.json` and `routes.js` are updated to version 2.1.0 with comprehensive `direction_only` constraints and updated junction naming (J12: Firgrove Service Rd).

### Changed — 2026-03-29 UI & Project Cleanup
- **Dashboard Cleanup:** Removed the "Drop-off Occupancy" section from `StatsPanel.jsx` to focus on corridor throughput and bottleneck stats.
- **Feature Removal:** Deleted the Sankey Flow Diagram feature, including `SankeyView.jsx`, `sankeyEngine.js`, and the Multi-Page App (MPA) build configuration, to restore the project's original single-page architecture.

### Fixed — 2026-03-29 Direction State Filter Missing from Look-ahead Search 2
- **Root cause:** Search 2 `pot` selection filtered `!o.isParking` but lacked `o.state === v.state`. The route-type filters (lines 100–101) restrict which junctions are added to `nextTargetJids`, but `approaches.get(nid)` contains all vehicles targeting that junction regardless of travel direction. An outbound vehicle at J6 could be picked as `pot` by an inbound vehicle's look-ahead, causing phantom braking.
- **Fix:** Added `o.state === v.state` to the `pot` filter. Search 2 now matches Search 1: both require `!o.isParking && o.state === v.state`.

### Fixed — 2026-03-29 isParking Phantom Leader in Look-ahead Search 2
- **Root cause:** Search 1 (same-segment) correctly filtered `!o.isParking`, but Search 2 (look-ahead across junctions) had no such filter. An `isParking` vehicle at pos=0 on an egress route (just entered from J7, `distFromStart≈0`) could be selected as `pot` in the next-segment look-ahead. The computed gap was `v.distToTarget + 0 - 4.5 ≈ 0`, causing immediate hard braking in the following vehicle — a permanent phantom stall that cascaded back through Ruskin Rd and J4.
- **Fix:** Added `.filter(o => !o.isParking)` to the `pot` selection in Search 2. Both searches now treat `isParking` vehicles as physics-invisible, consistent with their off-road status.

### Added — 2026-03-29 Rat-Run Logging
- `RAT_RUN` event logged at spawn for any vehicle assigned a rat-run route (detail includes corridorId and routeId).
- `SPAWN` event detail now includes `route=` so main vs rat-run is visible in every spawn row.
- `AT_J7` detail now includes `ratrun=true` flag when a rat-run vehicle reaches the gate, enabling trip-time comparison between main and rat-run routes in the CSV.

### Confirmed — 2026-03-29 Directional Filtering Already Implemented (Senior Analyst Review)
- External analyst proposed "Directional Filtering" as a fix for single-line GeoJSON roads causing opposite-direction vehicles to brake for each other.
- **Finding is valid as a diagnosis** — single-line roads do cause inbound/outbound vehicles to share physical coordinates.
- **Fix was already applied in a prior session.** Both filter layers are in place in `idm.js`:
  - Search 1 (same segment): `o.state === v.state` — inbound only sees inbound, outbound only sees outbound.
  - Search 2 (look-ahead): inbound skips all egress routes; outbound skips all non-egress routes.
- The analyst's proposed "merging behavior at conflict points" does not apply: inbound routes end at J7 (pos=1.0) and egress routes begin at J7 (pos=0) on separate GeoJSON geometries — there is no shared segment where head-on interaction occurs.
- No code changes required.

### Fixed — 2026-03-29 Phantom Look-ahead Braking at School Gate
- **Root cause:** The inbound directional filter in `idm.js` had a `&& toJid !== 7` exception, allowing inbound vehicles approaching J7 to look ahead into egress routes and detect `isParking` vehicles on the internal school road as phantom leaders. An inbound car 50m from the gate would brake for a car already inside the school grounds — artificially compressing the Ruskin Rd queue and amplifying backpressure cascade upstream.
- **Fix:** Removed the `&& toJid !== 7` exception. Inbound vehicles now never see egress routes in look-ahead, regardless of which junction they are approaching.

### Fixed — 2026-03-29 Re-applied fixes lost to linter revert

All fixes below were previously applied and working, then stripped by an automated linter revert. Re-applied in full against the reverted codebase.

- **spawner.js PEAK_PARAMS** — reverted to H:1200/M:1800/L:2100 (6:50–7:05 AM peaks). Restored to H:3600/M:3600/L:3600 (7:30 AM peak) with correct σ values.
- **SimMap.jsx imports** — `PARKING_CAPACITY` and logger (`logEvent`, `logSchoolEvent`, `loggerClear`) re-added.
- **loggerClear on reset** — clears event log on every simulation reset.
- **Sim end extended to 9000s (9:00 AM)** — was 7200s (8:30 AM); egress queue now has time to drain.
- **Colour logic** — removed orange for outbound/egress. Vehicles keep corridor colour throughout. `isParking` vehicles render grey (same as dwell). Red only for stopped/queued street vehicles.
- **parkingType assignment** — set at dwell transition (`on-site` / `on-street`). Was never assigned; `getParkingOccupancy` always returned 0.
- **DELAY_START / DELAY_END** — per-vehicle delay tracking restored. Threshold 0.5 m/s (not 2 m/s). `_delayedSince` cleared on dwell.
- **JUNCTION_HOLD / JUNCTION_PASS logging** — every controlled junction hold and free passage logged. `junctionStateRef.current.set` now called on hold path (was missing — stale state bug).
- **AT_J7 / AT_J7_WAITING logging** — school gate events restored with parking snapshot and inbound trip delay.
- **DWELL_START logging** — with onSite/onStreet snapshot.
- **OUTBOUND_START logging** — when processDwell transitions vehicle to outbound.
- **EGRESS_COMPLETE logging** — when outbound vehicle exits network, with route id.

### Fixed — 2026-03-29 Vehicle Colours, Logger Restored & Three Physics Bugs

#### Fix: Removed Orange Egress Colour — Vehicles Keep Corridor Colour Throughout
- Outbound/egress vehicles now display their original corridor colour (blue/cyan/indigo/emerald) for the entire journey including egress. Orange is removed from rendering and legend.

#### Fix: Parking/isParking Vehicles Now Grey, Not Red
- `isParking` vehicles (driving to their bay inside school grounds) now render grey, matching parked `dwell` vehicles. Red is reserved for vehicles stopped/queued in the street network only.
- Legend updated: "Delayed/Queued" and "Parked/Parking".

#### Fix: Vehicle Diagnostic Logger Restored & Expanded
- `logEvent` / `logSchoolEvent` / `loggerClear` re-imported into `SimMap.jsx` after being lost in the refactor.
- `loggerClear()` called on every reset.
- Full journey events now logged per vehicle:
  - `SPAWN` — vehicle enters network
  - `JUNCTION_HOLD` — hold applied at any controlled junction (includes junction id, control type, hold duration)
  - `JUNCTION_PASS` — vehicle passes a controlled junction freely
  - `DELAY_START` — vehicle speed drops below 0.5 m/s in street network (not parking); records junction index and holdingAt
  - `DELAY_END` — delayed vehicle resumes speed ≥ 2 m/s; records total delay duration
  - `AT_J7` — vehicle passes through school gate (with inbound trip delay and parking snapshot)
  - `AT_J7_WAITING` — vehicle held at gate (hold duration or `parking_full`)
  - `DWELL_START` — vehicle reaches parking bay (with onSite/onStreet snapshot)
  - `OUTBOUND_START` — vehicle resumes after 45s dwell
  - `EGRESS_COMPLETE` — vehicle exits the network (with egress route id)
- `_delayedSince` cleared on dwell transition so parking is not misclassified as a delay.
- LOG button in Header downloads full CSV of all events for the current run.

### Fixed — 2026-03-29 Five Issues from Log Analysis (see docs/simulation-issues-2026-03-29.md)

#### Fix 1: J4 (Starke Rd / Christopher Rd) Downgraded from `priority_stop` → `stop`
- **Root cause:** `priority_stop` enforces 8s minimum gap → max 450 veh/hr. All four corridors converge through J4. Log showed 468/803 junction holds (58%) at J4; 221 vehicles (34%) never reached the school gate; gate throughput was 252/hr vs 840/hr spec.
- **Fix:** Changed J4 control from `priority_stop` to `stop` (4s gap → max 900 veh/hr).

#### Fix 2: `parkingType` Never Assigned → Parking Occupancy Always Zero
- **Root cause:** Dwell transition set `v.state='dwell'` but never assigned `v.parkingType`. `getParkingOccupancy()` counts on `parkingType === 'on-site'` so it always returned 0. `isFull` never fired; parking constraint was completely inert.
- **Fix:** Assign `v.parkingType = pk.onSite < PARKING_CAPACITY.ON_SITE ? 'on-site' : 'on-street'` at dwell transition.

#### Fix 3: Simulation End Extended 6:30AM–9:00AM (was 8:30AM)
- **Root cause:** 121 vehicles (28%) started egress but never completed it before t=7200. Egress queue from the peak wave hadn't drained. All worst delays (2000s+) were on egress routes.
- **Fix:** Extended sim end from `t >= 7200` to `t >= 9000`, giving 30 extra minutes for the network to clear.

#### Fix 4: `DELAY_END` Threshold Lowered — Creeping Queues Now Resolve
- **Root cause:** `DELAY_END` required `v.v >= 2 m/s`. Vehicles creeping in a queue (0.5–1.5 m/s) never cleared the flag. 186 vehicles had permanent unclosed DELAY_START events.
- **Fix:** Lowered threshold to `v.v >= 0.5 m/s`.

#### Fix 5: J29 Roundabout (Ruskin/Aristea) Restored to Map
- **Root cause:** J29 (`roundabout_planned`) was missing from `VISIBLE_JUNCTIONS` — marker was never created.
- **Fix:** Added `29` to `VISIBLE_JUNCTIONS` in `routes.js`.

### Fixed — 2026-03-29 Three Critical Physics & Timing Bugs

#### Fix 1: Vineyard Rd Backup — Inbound Vehicles Braking for Outbound/isParking on Same Segment
- **Root cause:** `sameSegmentLeaders` in `idm.js` Search 1 had no directional filter. Inbound vehicles approaching J5/J6 would detect `isParking` vehicles (state=`outbound`) on egress routes as leaders, compute a near-zero gap, and brake to a standstill — recreating the Vineyard gridlock even after the look-ahead directional fix.
- **Fix:** Added `&& !o.isParking && o.state === v.state` filter to `sameSegmentLeaders`. Vehicles now only treat same-state, non-parking vehicles as same-segment leaders.

#### Fix 2: Spawn Distribution Reverted — Bell Curve Peak at 6:50 AM Instead of 7:30 AM
- **Root cause:** `PEAK_PARAMS` in `spawner.js` was reverted to old values (H: centre=1200s, M: centre=1800s, L: centre=2100s), causing most vehicles to arrive well before the real school rush and parking to stay low.
- **Fix:** Restored correct values — all scenarios peak at t=3600s (7:30 AM); σ varies by scenario (H=1200s tight, M=1500s, L=1737s broad).

#### Fix 3: Junction lastRelease Updated on Hold Application — 0.5s/7.5s Infinite Cycle Risk
- **Root cause:** `s.lastRelease = t` was only set on the free-passage path, but `junctionStateRef.current.set(jid, s)` was not called when a hold was applied, meaning stale state could persist. More critically: on the hold path, the `s` object was mutated before the `break` but not persisted to the Map.
- **Fix:** Added `junctionStateRef.current.set(jid, s)` on the hold path before `break`, ensuring junction state is always persisted. `lastRelease` remains gated to free passage only.

### Fixed — 2026-03-29 Spawn Distribution Shifted to Realistic School Peak
- **Root cause:** Bell curve peaks were at 6:50–7:05 AM, so most vehicles arrived well before the real school rush. Parking occupancy stayed low because the gate never reached capacity.
- **Fix:** All scenarios now peak at 7:30 AM (t=3600s). σ varies by scenario (H=1200s tight; M=1500s; L=1737s broad), giving 7–15% of trips before 7:00 AM and 70–86% within the 7:00–8:00 peak hour — matching the TIA traffic profile.

### Fixed — 2026-03-29 School Gate Throughput: Only 1 Vehicle Entering Per 45s Instead of 840/hr
- **Root cause:** Dwell vehicles (already inside school grounds) were included in the IDM `approaches` map as static obstacles at `pos=1.0, distToTarget=0.1m`. Following vehicles on Ruskin Rd computed a near-zero gap to this "parked car" and braked to a standstill. The queue only advanced after the dwell vehicle exited 45 seconds later, giving effective gate throughput of 73/hr (1 per 49.5s) instead of the designed 840/hr (1 per 4.3s). Maximum concurrent parking occupancy was therefore 1 instead of ~10.
- **Fix:** Dwell vehicles are excluded from the `approaches` map in `stepAllVehicles`. Street-side queue throughput is now gated solely by the J7 `critical` hold (4.3s), allowing ~10 vehicles to be in dwell simultaneously during peak.

### Fixed — 2026-03-29 Parking Occupancy HUD Always Showing Zero
- **Root cause:** `parkingType` ('on-site' / 'on-street') was only assigned inside `processDwell` when `vehicle.dwellStart === null`. However, `SimMap.jsx` sets `v.dwellStart = t` at the same time it sets `v.state = 'dwell'`, so by the time `processDwell` ran on the next frame, `dwellStart` was already populated and the assignment block was skipped — leaving `parkingType` as `undefined` on every vehicle.
- **Fix:** Assign `parkingType` directly in the dwell-transition block in `SimMap.jsx` (alongside `v.state = 'dwell'`), using `getParkingOccupancy` imported from `idm.js`. The StatsPanel on-site/on-street counts now correctly reflect the ~10–15 vehicles parked during peak drop-off.

### Added — 2026-03-29 Vehicle Diagnostic Logger
- **`src/engine/logger.js`:** New in-memory event logger. Records up to 50,000 events: SPAWN, JUNCTION_PASS, HOLD_START, AT_J7, AT_J7_WAITING, DWELL_START, DWELL_WAIT, OUTBOUND_START, EGRESS_COMPLETE. Each event captures simTime, vehicle id, state, routeId, corridorId, pos, velocity, junctionIdx, holdUntil, and a detail string.
- **LOG button in Header:** Click to download a CSV of all logged events for the current run. Clears automatically on reset.

### Fixed — 2026-03-29 J4 Permanent Stall from frameReleases Logic
- **Root cause:** The `frameReleases` burst-prevention added an extra hold of `3.0 × frameReleases` seconds per additional vehicle crossing a junction in the same frame. At busy junctions (J4 priority_stop), multiple vehicles crossed per frame, causing `frameReleases` to build up and vehicles to receive progressively longer holds (0.5s, 7.5s, cycling) making them effectively permanently stuck. Removed `frameReleases` logic entirely — back-pressure is handled by IDM following distance, not artificial rate limiting.

### Fixed — 2026-03-29 J7 Infinite Hold Loop (school ingress never entering dwell)
- **Root cause:** The general hold-release loop (`holdUntil !== null && holdUntil <= t → set null`) ran before the J7 ingress block. When a vehicle arrived at J7 with `hold=0`, `holdUntil` was set to `t`. Next frame, the release loop cleared it to `null` before the J7 block ran. The J7 block saw `null`, computed a fresh hold from `lastRelease` (3.8s), and the cycle repeated indefinitely — vehicle sat at J7 forever, never transitioning to `dwell`. Fixed by excluding `pos >= 1.0` vehicles from the general release loop; the J7 block now correctly sees `holdUntil <= t` and transitions to `dwell`.

### Fixed — 2026-03-29 School Ingress NaN Bug
- **Vehicles never entering school (critical follow-up fix):** When a vehicle's `lastJunctionIdx` was incremented past the final junction (J7), `route.junctions[lastJunctionIdx + 1]` returned `undefined`. This caused `distToTarget = (undefined - pos) * routeLen = NaN`, which propagated into the IDM acceleration calculation, corrupting the vehicle's velocity and position. The vehicle would silently vanish without ever transitioning to `dwell`. Fixed by: (1) clamping `distToTarget` to a minimum of 0.1m, (2) clamping `distFromStart` to a minimum of 0, (3) skipping the physics step entirely for any vehicle at `pos >= 1.0` — the SimMap state machine handles those transitions.

### Fixed — 2026-03-29 Simulation Logic Overhaul
- **Vineyard Stall (Critical):** Fixed phantom-leader bug where egress route EG-D (travelling outbound through J5) was being detected as a leader by inbound route 1A vehicles at the same junction. The IDM look-ahead now filters by travel direction — inbound vehicles never see egress routes as leaders, and vice versa.
- **School Ingress / Internal Road / Egress (Critical):** Vehicles now correctly reach J7, dwell 45s, travel the internal school road, and exit via egress routes EG-A/B/C/D. Fixed by: (1) unblocking Vineyard stall so vehicles reach J7; (2) using the actual `Tokai High School Internal Road` GeoJSON geometry for the J7→J20 segment instead of a fallback straight line.
- **Egress Vehicle Colour:** Outbound (post-dwell) vehicles now correctly display in orange. `corridorId` is now set to `'egress'` in `processDwell` when transitioning to outbound state.
- **Rat-Runs Not Activating:** Lowered `ratRunThreshold` values (0.25/0.20/0.15 → 0.10/0.08/0.06) to reflect that density is sampled before the spawned vehicle is added, causing chronic underestimation of congestion.
- **Stale simTime in Physics Step:** `stepAllVehicles` now receives current `simTime` as a parameter instead of reading stale `v.simTime` (which was only updated after the physics step ran). Hold checks now evaluate against the correct time.
- **Creep Logic Bypassing Holds:** IDM creep acceleration (applied to near-stopped vehicles with open gap) now only fires when the vehicle is not actively held at a junction or parking block. Prevents vehicles from slowly rolling through junction holds and the J7 parking-full block.
- **Negative Gap Panic Braking:** Gap between a vehicle and its leader is now floored at 0.1m. Previously could go negative when leader was very close, causing `sStar/gap` to spike and trigger maximum braking in a cascade.
- **Junction Burst Throughput:** Multiple vehicles can no longer all pass a stop/yield junction in the same simulation frame without delay. A `frameReleases` counter is tracked per junction per frame; each additional vehicle beyond the first is held for `3s × frameReleases`, enforcing realistic inter-vehicle gaps at controlled intersections.
### Added
- **State-Agnostic Physics:** Refactored leader-detection to be state-agnostic. Inbound vehicles now "see" vehicles in `dwell` (parked) and `outbound` states directly ahead of them. This ensures Ruskin Rd traffic correctly stacks up behind the school gate when drop-offs are in progress.
- **Creep Physics:** Implemented a low-speed "creeping" phase to prevent numerical clumping deadlocks at junction merge points.
- **Robust School Road Rendering:** Fixed a bug where the internal school road geometry was not correctly identified; implemented fuzzy-name matching to ensure the grey dotted line is always visible.
- **Parking HUD & Logic:** Fully integrated 120-bay parking occupancy (98 on-site, 22 on-street) into the entry logic and HUD.
- **Dynamic Parking & Drop-off Engine:**
- **Look-Ahead Physics Chaining:**
 Vehicles now look across junctions to detect leaders in the **next** segment of their route. This ensures continuous physics awareness across the entire network and fixes the "Invisible Wall" bug where vehicles would brake suddenly after a turn.
- **Approach-Based Leader Detection:** Vehicles now detect leaders based on their shared **Target Junction** rather than just their current road segment.
 This eliminates "merge ghosting," where vehicles from different roads would overlap during a merge and then brake suddenly.
- **Cross-Route Leader Detection:** Vehicles now detect leaders across different routes if they are sharing the same physical road segment.
- **Robust Physical Segment Tracking:** Implemented `lastJunctionIdx` tracking using the full junction list.
- **Egress State Transition Fix:** Fixed a bug where vehicles transitioning to 'outbound' state would retain stale junction caches.
- **Physical Vehicle Constraints:** Implemented absolute-distance physics (meters to target junction).
- **Waypoint & Junction Position Caching:** Implemented per-vehicle caching of junction and waypoint positions to improve simulation performance and numerical stability.
- `GEMINI.md` for CLI context and instructions.
- `CHANGELOG.md` to track project changes.
- **Granular Route Overlay Control:** Replaced the global "ROUTES" toggle with individual "Show Route" buttons on each corridor card in the `StatsPanel`.
- **Dashed Rat-Runs:** Re-implemented dashed line styling for rat-run routes on the map to distinguish them from main arterial flow.

### Changed
- **School Ingress Throughput:** Adjusted the school ingress (J7) mandatory hold from 8.0s to 4.5s. This better aligns with the TIA demand of 840 peak trips per hour and prevents artificial simulation gridlock.
- **Junction Control Update:** Changed Junction 5 (Christopher/Vineyard), Junction 6 (Vineyard/Leyden), Junction 18 (Dreyersdal/Christopher), and Junction 25 (Clement/Leyden) from `stop` to `yield`. This update was applied comprehensively across simulation logic (`routes.js`) and all metadata files (`junctions.geojson`, `network-L2.geojson`, `bergvliet-roads.json`, and the new `simulation-data.json`) to improve realistic traffic flow.

### Fixed
- **School Gate Arrival Logic (Critical):** Fixed a bug where vehicles were permanently stalling at the school gate (J7). Restored the state transition logic that allows vehicles to enter the school road after the 4.5s check.
- **Distributed Drop-off Engine:**
...

- **Default Route Visibility:** Updated simulation to start with all route overlays hidden for a cleaner initial view.
- **Vehicle Color Persistence:** Removed the "Outbound" (Orange) color state. Vehicles now retain their original corridor color (e.g., Blue, Indigo) throughout their entire journey, including the egress phase.
- **Map Legend Update:** Removed the "Outbound" key from the legend.
- **Route Toggle UI:** Redesigned the "Show Route" button in the `StatsPanel` to be larger, more prominent, and easier to identify.
- **Route Assignment Logic:** Replaced the binary main/rat-run switch with a 60/40 probability split.
 60% of vehicles now remain on the main route even when rat-run thresholds are met, ensuring more realistic load distribution.
- **Congestion Thresholds:** Increased rat-run activation thresholds from ~3% to 15-25% to better reflect real-world driver behavior.
- **Corridor Ingress/Egress Visuals:** Fixed a bug where entry and exit junction markers lost their solid corridor-coded fill during simulation.
- **Corridor 3A Routing:** Updated main ingress route to avoid Dreyersdal Rd. Vehicles now enter via Firgrove Service Rd and Starke Rd to reach the school.
- **New Egress Route (EG-D):** Added a new exit path via Starke Rd and Firgrove Service Rd, with rebalanced egress distribution weights.
- **Dashboard Synchronization:** Updated `StatsPanel` cards to use corridor-specific border colors that match the map palette (e.g., Blue for 1A, Emerald for 3A).
- **Map Optimization:** Significantly widened the study area mask to cover the full simulation zone, reducing the excessive darkened areas.
- Refactored junction markers on `SimMap`: removed black fill and implemented a muted outline (reduced opacity and weight) for a cleaner HUD aesthetic.
- Updated junction pulsing logic: bottleneck state now uses increased opacity, weight, and a subtle red fill instead of a solid dark background.
- Redesigned `StatsPanel` layout for Corridors and Bottlenecks:
    - Implemented a consistent 3-column grid-based layout with labels: **Active**, **Delayed In**, and **Delayed Out**.
    - Standardized typography sizes for all labels and values to ensure visual balance.
    - Optimized CSS for stat labels: reduced font size to 8px and added `white-space: nowrap` to prevent layout breaking due to text wrapping on "Delayed Out".
    - Added "avg XXs" delay information as small sub-text under both the **Delayed In** and **Delayed Out** columns.
    - Extended the 3-column layout to the Bottlenecks section for design consistency.
- Enhanced simulation engine to track and compute outbound average trip delays.

### Changed (Visuals & HUD)
- Implemented a comprehensive corridor-based color palette:
    - **1A (Dreyersdal N):** Blue
    - **2A (Homestead):** Cyan
    - **2B (Children's Way):** Indigo
    - **3A (Firgrove Way):** Emerald
    - **Egress (Outbound):** Orange
- Synchronized vehicle dot colors with their entry corridor.
- Implemented state-based color overrides:
    - **Rat-runs:** Lighter shade of the origin corridor color.
    - **Parked/Dwell:** Grey.
    - **Delayed (Congested):** Red (prioritized for visibility).
- Updated map junction markers for entry and exit points to use a solid, corridor-coded fill (80% opacity) for significantly better visibility, while maintaining muted outlines for intermediate points.
- Redesigned the map legend to show all 4 corridors and operational states (Delayed, Parked).
- Restored hover/onclick interactivity for junction markers by ensuring `fill: true` remains active (with `fillOpacity: 0` in normal state) to preserve the mouse hit area.
