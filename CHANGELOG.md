# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Added — 2026-03-31
- **Playback Engine & Road Analytics:** Created `PlaybackSource` in `src/engine/playback.js` to load and interpolate pre-computed UXsim/SUMO results from JSON files.
- **Source Toggle:** Added a "Live / Results" toggle in the `Header` component to switch between the real-time IDM engine and pre-computed models.
- **Road Watcher Component:** Implemented `RoadWatcher` to display per-road vehicle counts, average delays, and time-series charts upon road selection.
- **Interactive Map Layers:** Updated `SimMap.jsx` with interactive road polylines for selection and highlighting, and integrated playback vehicle rendering.
- **Microscopic Simulation Pipeline:** Full end-to-end SUMO pipeline producing canonical scenario-L/M/H JSON.
- **Junction Controls & Speed Humps:** 11 key junction type overrides and 28 speed humps modeled in SUMO.
- **Dynamic Rerouting:** Enabled `device.rerouting` in SUMO for natural rat-run emergence.
- **Testing:** Added Vitest unit tests for `PlaybackSource` and `RoadWatcher` with 100% pass rate.

### Fixed — 2026-03-31
- **Simulation Stability:** Fixed Hook dependency issues in `SimMap.jsx` to ensure simulation refs are managed correctly outside the render cycle.
- **SUMO Network Projection:** `junction-controls.nod.xml` now writes geographic lon/lat to resolve projection errors.
- **School Road One-Way:** Fixed wrong-way entry by removing `school_internal_out` edge and implementing direct lane stops for backpressure.
- **Speed Humps Extent:** Skipped humps outside OSM extent to prevent netconvert errors.

### Added — 2026-03-30
- **Global Road Logging:** Implemented periodic snapshots (every 60 sim-seconds) of all road-level activity, capturing cumulative totals and instantaneous flow metrics (active/slowing/stopped) for the entire network.
- **Road Log Export:** Added a "ROAD LOG" button to the header for downloading the full simulation's road-level data as a CSV.
- **"Watch My Road" Overhaul:** Moved the road-stats overlay to the top-right of the map. Added a two-line "Traffic In/Out" format showing cumulative "Total" vehicles and real-time Active, Slowing, and Stopped metrics for individual streets.
- **Interactive Road Highlighting:** Unselected roads are now transparent, appearing in grey only when selected. Implemented "click-to-toggle" logic for easier selection management.
- **Dynamic Rat-Run Switching:** Logic allowing vehicles to switch to alternative rat-runs if slowing or stopped near divergence points.
- **Route Divergence Mapping:** Defined `RAT_RUN_SWITCHES` configuration for main corridor transitions at key junctions.
- **Peak-Hour Egress Delays:** Dynamic wait times for final egress points (J1, J9, J13) scaling during 7:30–8:30 AM peak.
- **Corridor Focus & Auto-Zoom:** Interactive StatsPanel cards with dynamic map focusing and bounding-box zoom.
- **Dynamic Rat-Run Congestion:** Probability scaling (15%–85%) based on real-time corridor congestion scores.
- **New Egress Route (EG-E):** Added Homestead Ave exit to simulate varied outbound flow.

### Changed — 2026-03-30
- **Watch My Road Sidebar Integration:** Moved the "Watch My Road" analyzer from a map overlay to the primary position in the sidebar.
- **Legacy Removal:** Retired the fixed "Network Bottlenecks" section in favor of the more accurate, segment-based dynamic road watcher.
- **Vehicle Visualization:** Swapped shading strategy—inbound vehicles now use the dark shade (start) and outbound vehicles use the light shade (exit). Rat-runs are differentiated with the base corridor color and a white stroke.
- **Route Toggling UI:** Moved individual route toggles into a single global "Show Routes" switch within the map legend.
- **Dashboard UI & Metrics Overhaul:** Refactored corridor cards to match map flow, updated "Avg In/Out" labels to "Avg Time In/Out", right-aligned vehicle counts in card headers with "In: X / Out: X" formatting, added "Congestion Meter" headings to the status charts, and replaced stall counts with "% active/slowing/stopped" distribution.

### Fixed — 2026-03-30
- **Yield Realism:** Tightened J5 (Christopher/Vineyard) yield logic (increased gap to 2.5s) to ensure vehicles slow down realistically before merging.
- **Dynamic Speed Profiling:** Outbound (egress) vehicles and rat-run traffic now utilize `local` road parameters (30 km/h) instead of `collector` speeds, providing more realistic residential flow.
- **Routing Restoration:** Fixed "grabled" 2B path; vehicles now correctly proceed from Children's Way to Dreyersdal/Christopher without inefficient looping.
- **Ruskin Rd Rat-Run:** Maintained J17 (Ruskin Rd) as a valid rat-run option while keeping primary inbound routes on the Christopher/Leyden approach.
- **Road Stats Persistence:** Extracted road stats logic into a reusable helper; stats now persist and remain interactive (via cumulative tracking) even after the simulation finishes or is paused.
- **Road Class Physics:** Implemented dynamic roadClass attribution; egress vehicles now correctly follow collector speed profiles, and rat-runs utilize local road parameters.
- **Egress Peak Delays:** Widened the AM peak window and increased maximum hold times at exit points (J1, J9, J13) to better simulate external corridor back-pressure.
- **Road Stats Logic:** Resolved a stale closure bug in the simulation loop by using `selectedRoadRef`, ensuring real-time stats update correctly upon selection.
- **Tracking Accuracy:** Switched to distance-based segment positions and implemented continuous, per-frame global road visit tracking.
- **Robust Matching:** Added case-insensitive, trimmed road name comparison to fix 0-stat errors across various OSM data formats.
- **Routing & Snapping:** Fixed teleportation issue in `EG-A` and `2B` routes by adding missing junction waypoint (J27) at Children's Way / Starke Rd.
- **Congestion Bar:** Fixed `computeStats` parameter mismatch and missing `congestionScoresRef`.
- **Christopher Rd Hold:** Reverted J4 hold to 4s stop to restore school gate throughput.

### Fixed — 2026-03-29
- **Physics & Logic Updates:** Fixed Vineyard Road stall and IDM look-ahead bugs.
- **Junction Holds:** Implemented direction-aware holds and standardized time metrics to `M:SSm` format.
- **Parking Logic:** Fully integrated 120-bay parking occupancy logic and state-agnostic leader detection.
