# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Added — 2026-04-02 (UI Overhaul & Style Guide v3.0)
- **Header & Navigation Refactor:** Navigation links are now left-aligned next to the logo. Simulation summary (Time, Active, Total In/Out) integrated into a right-aligned pill within the navigation bar.
- **Style Guide Map Markers:** Implemented symbolic vehicle shapes: Diamonds (◆/◇) for rat-runs, Hollow Circles (○) for egress/parked main routes, and Solid Circles (●) for inbound main routes.
- **Vehicle Fading Logic:** Vehicles belonging to deselected corridors now fade to 20% opacity, improving visual focus on active routes.
- **Sidebar 2x2 Grid:** Corridor cards reverted to a compact 2x2 layout to maximize vertical space.
- **Spanning Road Analyzer:** "Watch My Road" card now spans the full width of the corridor grid for primary emphasis.
- **Tactical Card Architecture:** Implemented a 4-row data structure for all cards (Identity, Flow/Time Metrics, Congestion Meter, and Telemetry breakdown).
- **Auto-Collapsing Cards:** Deselected corridor cards now automatically collapse to a minimal state (48px) and fade.
- **Player Control Micro-Label:** Added technical instructional text above simulation controls.
- **Editorial Restoration:** Restored functional WCMD link and fixed route explanation paragraph justification and layout.

### Fixed — 2026-04-02 (Junction Controls)
- **J29 Ruskin/Aristea Roundabout — Now Modelled:** `roundabout_planned` control type previously fell through to `default: return 0` — every egress vehicle passed through with zero delay. Added yield-equivalent hold (2.5 s), matching TIA §14 which mandates this roundabout as the primary school-traffic mitigation measure.
- **J20 Aristea Egress — Raised Intersection:** `egress` control type also fell to `default: return 0`. Added speed-hump-equivalent hold (1.2 s) per TIA §11 proposal for a raised intersection at the Aristea Road exit point.

### Fixed — 2026-04-02 (Speed Limits)
- **Corridor Road Classes Corrected:** All four inbound corridors (1A, 2A, 2B, 3A) were assigned `arterial` or `collector` road class, giving vehicles 40–60 km/h desired speeds. Every modelled segment from the entry junction to the school gate is a TIA Class 5 Local Street (30 km/h). The arterial/collector approach roads (Main Rd, Ladies Mile, Firgrove Way) are off-map. All corridors corrected to `local` (30 km/h). This brings the live model into agreement with SUMO, which uses OSM speed limits. Congestion on Dreyersdal (1A) and Homestead (2A) will now appear more realistically — consistent with TIA's LOS F warning at Main Rd/Dreyersdal.
- **Removed Redundant Rat-Run Speed Override:** The `idm.js` override forcing rat-run vehicles to `local` road class is now redundant (main routes are also `local`) and has been removed.

### Fixed — 2026-04-02 (TIA Compliance)
- **SUMO Corridor Shares Corrected:** SUMO `CORRIDORS` shares were significantly wrong vs TIA Section 13. Dreyersdal North (1A) was over-allocated by 53% (24% → 15.7%); Homestead Avenue (2A) was under-allocated by 33% (20% → 30%). Children's Way (2B) and Dreyersdal South (3A) also adjusted to exact TIA-normalized values. Full audit recorded in `docs/TIA_Parameter_Audit.md`.
- **SUMO L Scenario Trip Count:** Aligned SUMO L scenario from 420 → 500 trips to match the live model.
- **Live Model 3A Corridor Share:** Corrected `RAW['3A']` in `spawner.js` from 12 → 13, matching TIA Section 13 (Dreyersdal South = 13% of total trips).
- **Peak Timing Corrected:** IDM Gaussian peak centre corrected from simTime 3600 (07:30) → 4500 (07:45), matching TIA's trapezoidal demand profile (35% of trips arrive 07:30–08:00, centred at 07:45).
- **Simulation End Time Extended:** Both SUMO and UXSim runners extended from 08:30 (SIM_END 30600) to 09:00 (32400) to allow post-peak traffic clearance, matching TIA analysis period.

### Added — 2026-04-02 (Findings Section)
- **Findings Section:** Added a dedicated `#findings` section to the website summarising model validation outcomes across IDM, SUMO, and UXSim — clearance warning, peak timing confirmation, cross-model agreement, rat-run emergence, and UXSim flow limitations.
- **UXSim Validation in compare_models.py:** `parse_uxsim()` and updated `print_report()` / `save_csv()` added to include UXSim alongside IDM and SUMO in the 3-column comparison report.

### Added — 2026-04-02
- **UXSim Model Source:** UXSim pre-computed scenario outputs (L/M/H) are now generated and served. The source toggle now offers three options — Live / SUMO / UXSim — letting users compare the browser IDM engine, SUMO microscopic model, and UXSim mesoscopic model side by side.
- **UXSim Python Pipeline:** `uxsim_runner.py`, `network_builder.py`, and `uxsim_to_json.py` now produce frontend-compatible JSON at 30-second snapshot intervals. Corridor-tagged vehicle IDs (`flow_N_seq`) enable full dashboard stats (spawned counts, congestion bars, avg delays) for UXSim output.

### Changed — 2026-04-02
- **Snapshot Interval — 30 Seconds:** Both SUMO and UXSim output snapshots reduced from 60 s to 30 s, capturing short dwell/yield events (45 s drop-off, speed-hump slowing) that were previously invisible between frames. SUMO scenario files regenerated accordingly.
- **Scenario File Naming:** Scenario JSON files renamed from `scenario-{L/M/H}.json` to `scenario-{L/M/H}-sumo.json` and `scenario-{L/M/H}-uxsim.json` so both models can coexist without overwriting each other.
- **Navigation Labels:** Header nav updated to Simulator / Models / Findings / Contact. "Findings" links to the model validation section (formerly "Engines"). Section IDs updated to match.
- **"The Model Uses…" Paragraph:** Route description text moved from below the hero heading into the Briefing section, as a body paragraph after "slamming on the anchors."
- **Vehicle Dot Colours:** Map vehicle colours updated to match the design token palette — dark forest (Main Rd), celadon (Homestead), warm amber (Children's Way), sage (Firgrove), amber egress — replacing the generic blue/cyan/indigo/emerald set.
- **Watch My Road Card:** Background lightened from `#111D13` (near-black) to `#1E3520` (dark sage green) — differentiated from other cards without the harsh black treatment.

### Fixed — 2026-04-02
- **Dashboard Cards — Text Cut-Off:** Removed `overflow: hidden` and `justify-content: space-between` from corridor cards; replaced with gap-based layout so the Congestion Meter label and bar are no longer clipped.
- **Player Controls Size:** Play button reduced from 3 rem to 2.25 rem; speed pill padding halved. Controls bar no longer dominates the map area.
- **Hyperlinks — Blue Default:** Global `a { color: inherit }` rule added to prevent browser default blue on all links. `.editorial-link` now correctly renders in the celadon green (`--c-3a`).
- **UXSim Corridor Tagging:** `W.VEHICLES` is an `OrderedDict` — was iterating keys (strings) instead of `.values()`. Vehicle DataFrame column is `name` not `vehicle`. Both bugs fixed; corridor tagging now achieves 100% across all scenarios.

### Added — 2026-04-02 (UI)
- **Draggable Controls & Legend:** Both the simulation controls bar and the map legend now have a `⠿` drag handle. Users can reposition them freely within the map area so they don't obscure roads of interest.

### Fixed — 2026-04-02
- **Site Rendering — Broken Layout:** CSS design tokens (`--canvas`, `--surface-low`, `--surface-high`, `--on-surface`, etc.) were never defined in a `:root` block, causing all backgrounds to render transparent and sections to overlap. Added full token set to `App.css`.
- **Body Background & Root Scroll:** `index.css` still had the old dark HUD styles (`background: #0f172a`) and `#root { overflow: hidden }` which clipped the editorial sections. Updated to use the sage palette and allow page scrolling.
- **Fonts Not Loaded:** Manrope and Work Sans were referenced in CSS but never imported. Added Google Fonts link to `index.html`.
- **Header Double-Rendering:** `Header.jsx` used old class names (`header`, `header-row1`, `header-row2`, `desktop-only`) that no longer existed in the redesigned CSS, causing controls to render twice as unstyled text. Rewrote `Header.jsx` to match the `header-wrapper → nav-deck` pill structure.
- **Sim Controls Missing:** Play/pause, scenario, speed, source, reset, and log buttons were passed to `SimMap` but never rendered. Added a floating `sim-controls` island inside the map bezel using the existing CSS classes.
- **Corridor Border Colours:** CSS variables `--c-1a`, `--c-2a`, `--c-2b` were missing from `:root`, so corridor card left-borders had no colour. Added all three tokens.

### Changed — 2026-04-02
- **Access Barrier — No-Scroll Layout:** Tightened all padding and margins on the intro modal (padding `4rem` → `2rem`, gaps `3rem` → `1.5rem`, button `1.5rem 4rem` → `1rem 3rem`) so the "Initialize Simulator" button is always visible without scrolling.
- **Simulator Copy — Route Explanation:** Added a description paragraph below the hero heading explaining the main-route and rat-run model logic, including Sweet Valley avoidance behaviour.
- **Dashboard — Vertical Card Stack:** Replaced the cramped 2×2 corridor grid with a single-column vertical stack. Each card now has full sidebar width, giving the metrics row and congestion bar proper breathing room.
- **Watch My Road — Black Box Style:** Applied the Style Guide "Black Box" treatment: dark `#111D13` background, celadon `#709775` road-name title, white-tinted stat pills, and increased internal padding. Consistent with the editorial design spec.
- **Style Guide — Typography Baseline:** Added `h1/h2/h3 { font-family: 'Manrope' }` rule so all headings use the correct architectural typeface.
- **Corridor Cards — Surface Hierarchy:** Card background updated from `surface-low` to `surface-high` to match the Style Guide nesting hierarchy (Canvas → Surface-Low region → Surface-High card).

### Fixed — 2026-04-01
- **LOG / ROAD LOG Buttons Visible:** `.sim-controls` gap reduced from `1.5rem` to `0.5rem` and `speed-selector` padding-right removed so the controls bar no longer overflows and gets clipped by `bezel-inner`'s `overflow: hidden`. Both download buttons are now visible.
- **Corridor Cards — 2×2 Grid:** Replaced single-column flex list with a `corridor-grid` (2 columns × 2 rows, `1fr 1fr`) so all four cards share width and height without excessive whitespace.
- **"Entry / Exit Corridors" Label Restored:** Section title re-added above the corridor grid; was incorrectly hidden during earlier refactor.
- **Metric Labels — Avg Time In / Avg Time Out:** Corrected "Avg In" → "Avg Time In" and "Avg Out" → "Avg Time Out" in corridor cards.

### Changed — 2026-04-01
- **Hero Totals Card — Simulation Time:** Added a live `Time: HH:MM AM` display to the top summary card alongside Active / Total In / Total Out, separated by a divider. Time is derived from the same `formatClock` logic used by the navigation clock, starting at 06:30 AM.
- **UI Spacing & Card Density:** Increased `main-layout` top padding to create breathing room below the fixed navigation bar. Reduced stat-card padding and stats-panel gap so all five sidebar cards fit within the map height without clipping content at the bottom. Tightened internal element margins on card headers and congestion containers.
- **Watch My Road Card Layout:** Added a `.rw-line` flex wrapper with a gap between the Traffic In and Traffic Out rows so both sections are evenly spaced when a road is selected.

### Added — 2026-04-01
- **Model Comparison Script:** `models/compare_models.py` compares IDM live simulation against SUMO microscopic output per scenario (L/M/H). Reports inbound journey times, junction delay, peak congestion timing, top congested roads, school arrival rate per 15-min window, and a summary verdict. Auto-discovers IDM log files from `models/{l,m,h}/` folders.
- **SUMO Pipeline Restored:** Fixed broken network build caused by `--geometry.remove` pruning the mid-block Aristea exit node. Reverted school exit to the real OSM junction at south Aristea (node -294), confirmed as the only exit from the school gate with Aristea Road as the sole outgoing edge.
- **Scenario JSON Regenerated:** Re-ran all three SUMO scenarios (L/M/H) producing correct 41-road networks with expected vehicle-frame counts (L: 8 313, M: 16 165, H: 22 641).
- **Header Counts Split:** "Total" vehicle chip replaced with separate "Total In" and "Total Out" chips derived from corridor spawn/exit tallies.

### Fixed — 2026-04-01
- **SUMO Network Build:** `sumo_network_builder.py` `__main__` block corrected to unpack three return values (`net_path, overlay_snap, humps_path`) after `build_sumo_network()` signature was updated.
- **Outbound State Detection:** `sumo_to_json.py` `_vehicle_state()` now tracks vehicles that have visited `school_internal_road` and marks subsequent frames as `outbound` via a `visited_school` set (replaces the broken `"_out." in vehicle_id` check).
- **Watch My Road — Results Mode:** `updateRoadStats` in `SimMap.jsx` now queries `PlaybackSource.getRoadStatsDetailed()` in results mode; road stats no longer clear on pause or simulation end.
- **avgOutDelay in Playback:** `PlaybackSource._precomputeStats()` pre-pass now computes per-corridor average outbound delay; was previously hardcoded to 0.
- **Road Visit Directional Split:** `PlaybackSource` splits `seenRoad` into `seenRoadIn` / `seenRoadOut` so inbound and outbound cumulative totals are tracked independently.
- **IDM Braking Fix:** Removed erroneous `toJid === 7` condition that applied conservative `ruskin` road class to all vehicles approaching the school gate, not just outbound ones leaving it.
- **Priority Stop Delay:** Reduced `priority_stop` junction hold from 8.0 s to 5.0 s to restore realistic throughput at controlled intersections.

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
