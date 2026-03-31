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
