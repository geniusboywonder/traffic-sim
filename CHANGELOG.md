# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Added — 2026-03-30 Peak-Hour Egress Delays
- **Realistic Exit Waits:** Implemented dynamic wait times for final egress points (J1: Main Rd, J9: Homestead, J13: Firgrove) that scale during the 7:30–8:30 AM peak, reaching up to 15s.
- **Homestead Exit (J9):** Added a new egress route (`EG-E`) to simulate vehicles exiting via Homestead Ave onto Ladies Mile.
- **Firgrove Correction:** Confirmed `EG-D` correctly exits via Firgrove Service Road to the primary Firgrove/Dreyersdal intersection (J13).
- **Signal-Aware Egress:** Outbound vehicles at J8 (Children's Way) now correctly obey the 60s traffic signal cycle.
- **Simulation State:** Vehicles now remain visible at their final exit junction until their hold expires before being removed from the simulation.

### Changed — 2026-03-30 Dashboard UI & Metrics Overhaul
- **Refactored Corridor Cards:** Reordered to match physical map flow (Firgrove → Homestead → Children's → Dreyersdal).
- **New Metrics:** Added "Total In / Total Out" counts to corridor headings and detailed "Active", "Avg Time In", and "Avg Time Out" (in minutes) to each card.
- **Enhanced Congestion Insight:** Replaced raw stall counts with "% active, % slowing, % stopped" distribution for better situational awareness.
- **Targeted Bottlenecks:** Updated the bottlenecks section to monitor four key areas (Christopher, Leyden, Ruskin, Aristea) with live active/slowing/stopped counts.
- **Visual Improvements:** Increased heading contrast, implemented a new flexbox metrics row for density, and removed obsolete TIA assumption cards.

### Fixed — 2026-03-31 SUMO Junction Controls Node File & Network Rebuild
- **Cluster node positions:** `junction-controls.nod.xml` now writes x/y as geographic lon/lat (via `net.convertXY2LonLat()`) instead of SUMO internal UTM XY. netconvert with `--osm-files` requires geographic coords; raw UTM caused "Unable to project coordinates" errors for all 11 junction overrides.
- **14 speed humps outside OSM extent:** J109–J117, J123–J126, J127–J128 fall outside `bergvliet.osm` coverage (no edge within 80 m); skipped silently. 13 humps successfully restricted to 15 km/h.
- **Full rebuild clean:** All three scenarios (L/M/H) rebuilt — 33/38/41 roads, 8 313/16 165/22 641 vehicle-frames respectively.

### Fixed — 2026-03-31 SUMO School Road One-Way & Backpressure
- **Wrong-way entry fixed:** Removed `school_internal_out` edge (-294→-229). SUMO was routing vehicles near the exit junction via that edge to reach the entrance, making them appear to enter from the exit. School road is now a true one-way: entrance (-229) → exit (-294) only.
- **Backpressure now works:** Replaced `parkingArea` stop with a direct `lane` stop on `school_internal_in_0` (pos 10–50 m, 45 s dwell). Vehicles stop ON the single lane, forcing vehicles behind them to queue — backpressure propagates onto Leyden/Ruskin Rd under high demand.
- **Parking additional file removed:** `school-parking.add.xml` no longer loaded; capacity-based bay model was ineffective (peak concurrent ~15 vehicles vs 98 bays).

### Added — 2026-03-31 SUMO Junction Controls, Speed Humps & Dynamic Rerouting
- **Junction Type Overrides:** `build_sumo_network()` discovers 11 key junction OSM IDs at pass-1 and writes a supplementary `junction-controls.nod.xml` with correct SUMO types (traffic_light J8, allway_stop J10/J26/J28, priority_stop J1/J4/J9/J13/J15/J16/J24).
- **Speed Humps:** 28 speed humps (J101–J128) modelled as `variableSpeedSign` at 15 km/h on the nearest edge; written to `speed-humps.add.xml` from the final pass-2 network.
- **Dynamic Rerouting:** `write_config()` now enables `device.rerouting` for all vehicles (`probability=1.0`, `period=60 s`) so congested vehicles seek alternative routes — rat-run behaviour emerges naturally.
- **A* Routing:** Switched `routing-algorithm` from `dijkstra` to `astar` for consistent performance with rerouting enabled.
- **Multi-Additional:** `write_config()` accepts a list of additional files (parking area + speed humps, comma-joined in config).

### Added — 2026-03-31 SUMO Microscopic Traffic Simulation Pipeline
Full end-to-end SUMO pipeline producing canonical scenario-L/M/H JSON from microscopic simulation.
- **Network Build:** Two-pass OSM import via netconvert; synthetic school gate wiring to nearest OSM junction.
- **Demand:** Manual UTM zone 34 projection for coordinate conversion and edge lookup.
- **Converter:** Streams FCD XML to canonical SimOutput JSON; aggregates delays and vehicle states.

### Added — 2026-03-30 Corridor Focus & Auto-Zoom
- **Interactive Corridor Cards:** Entry/Exit corridor cards in the `StatsPanel` are now selectable. 
- **Dynamic Map Focusing:** The map automatically pans and zooms to fit the bounding box of selected corridor entry points and the school gate (J7).
- **Visual States:** Implemented `selected` and `deselected` CSS states for cards.

### Fixed — 2026-03-30 Congestion Bar Always Zero
- Fixed `computeStats` parameter mismatch and missing `congestionScoresRef` which prevented bars from filling.

### Fixed — 2026-03-30 J4 Christopher Rd Hold Reverted to 4s
- Restored `control: 'stop'` (4s) on J4 to resolve peak demand backpressure and restore school gate throughput.

### Added — 2026-03-30 Dynamic Rat-Run Congestion Routing
- Implemented dynamic rat-run probability scaling (15%–85%) based on real-time corridor congestion scores.

### Fixed — 2026-03-29 Physics & Logic Updates
- Fixed Vineyard Road stall and various IDM look-ahead/directional priority bugs.
- Implemented direction-aware junction holds and optimized Starke Rd through-traffic flow.
- Standardized dashboard time metrics to `M:SSm` format.
- Fully integrated 120-bay parking occupancy logic and HUD.
- Refactored leader-detection to be state-agnostic, ensuring realistic queuing behind parked vehicles.
