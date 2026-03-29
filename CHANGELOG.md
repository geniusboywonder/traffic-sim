# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- **Dynamic Parking & Drop-off Engine:** Implemented a state-managed parking system with 120 total bays (98 on-site internal, 22 on-street Ruskin Rd). Vehicles now check for available bays before entering, creating realistic backlogs on Ruskin and Vineyard when capacity is exceeded.
- **School Zone Speed Profiles:** Added `internal` (20km/h) and `ruskin` (30km/h) road classes to the physics engine for hyper-local speed accuracy.
- **Internal Road Visuals:** Restored the grey dotted line rendering for the Tokai High School internal road (J7 to J20).
- **Parking HUD:** Added real-time occupancy and utilization stats for on-site and on-street parking to the `StatsPanel`.
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
- **Module Export Error:** Fixed a syntax error where `estimateRouteLength` was not correctly exported from `routes.js`, preventing the simulation from loading.
- **Physics Engine Deadlock:** Resolved an "Invisible Wall" bug by implementing look-ahead segment chaining, allowing vehicles to detect leaders across junction boundaries.

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
