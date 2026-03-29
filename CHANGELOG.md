# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- `GEMINI.md` for CLI context and instructions.
- `CHANGELOG.md` to track project changes.
- **Granular Route Overlay Control:** Replaced the global "ROUTES" toggle with individual "Show Route" buttons on each corridor card in the `StatsPanel`.
- **Dashed Rat-Runs:** Re-implemented dashed line styling for rat-run routes on the map to distinguish them from main arterial flow.

### Changed
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
