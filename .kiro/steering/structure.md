# Project Structure

```
src/
  engine/           # Pure JS simulation logic (no React)
    idm.js          # IDM physics, junction hold durations, stepAllVehicles()
    routes.js       # JUNCTIONS, ROUTE_CONFIG, road-snap geometry, rat-run switches
    spawner.js      # Vehicle spawning, bell-curve inflow, dwell→outbound, egress
    playback.js     # PlaybackSource — loads SUMO/UXSim JSON, interpolates positions
    logger.js       # CSV event logger (downloadable from UI)
    __tests__/      # Vitest tests for engine modules

  components/
    SimMap.jsx      # Leaflet map + canvas overlay + rAF animation loop (main sim component)
    StatsPanel.jsx  # Corridor cards + road watch panel (right sidebar)
    Header.jsx      # Nav with active section tracking
    RoadWatcher.jsx # Road-level stats display
    AccessBarrier.jsx # Entry splash / gate screen
    AdSlot.jsx      # Google AdSense slot wrapper
    SmokeBackground.jsx
    __tests__/

  data/
    bergvliet-roads.json  # GeoJSON road network (LineStrings) — source of truth for geometry

  App.jsx           # Root component — all state lives here, wires engine ↔ UI
  App.css           # All component styles
  index.css         # CSS custom properties / design tokens / global resets
  main.jsx          # React entry point

public/
  sim-results/      # Pre-computed scenario JSON (scenario-{L,M,H}-{sumo,uxsim}.json)
  bergvliet-roads.json
  junctions.geojson

data/               # Source data files (GeoJSON, analysis docs) — not served
docs/               # Reference docs, TIA PDFs, analysis reports
design/             # Design assets, mockups, style guides
sim/                # Python simulation scripts (SUMO/UXSim offline runners)
osm/                # OSM source data and conversion scripts
```

## Key Architectural Patterns

- All simulation state lives in `SimMap.jsx` via `useRef` (not useState) to avoid re-renders during the rAF loop
- Engine modules (`idm.js`, `routes.js`, `spawner.js`) are pure functions — no React imports
- `App.jsx` owns all React state; passes callbacks down to `SimMap` and `StatsPanel`
- Coordinates are `[lat, lng]` throughout the engine; GeoJSON source is `[lng, lat]` and gets converted on import
- Route geometry is computed once at module load in `routes.js` via `roadRoute()` and cached in `ROUTE_CONFIG`
- Playback mode (`source === 'sumo' | 'uxsim'`) bypasses the live engine entirely — `PlaybackSource` handles interpolation
- CSS custom properties defined in `index.css` are the single source of truth for colours/spacing — don't hardcode values that already have tokens

## Mobile / Responsive

The site must be fully functional on mobile. The single breakpoint is `768px`.

- CSS: `@media (max-width: 768px)` in `App.css` handles layout stacking for editorial sections (`.bento-content`, `.models-grid`, `.findings-columns`, etc.)
- JS: `const isMobile = window.innerWidth < 768` used in `SimMap.jsx` for:
  - Tighter map bounds on init and corridor selection changes
  - Smaller vehicle dot radius on canvas (3px mobile vs 4px desktop)
- Touch interactions on the Leaflet map work via Leaflet's built-in touch support — don't disable default touch handling
- The draggable sim controls and legend in `SimMap.jsx` are mouse-only — on mobile they use fixed positioning instead
- Always test layout changes at both 375px (iPhone SE) and 768px (tablet boundary)
- Use `touch-action: manipulation` on interactive elements to eliminate 300ms tap delay
- Passive event listeners for any scroll handlers (`{ passive: true }`)
