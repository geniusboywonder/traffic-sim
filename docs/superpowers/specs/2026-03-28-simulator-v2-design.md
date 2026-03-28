# Tokai HS Traffic Simulator v2 — Design Spec

**Date:** 2026-03-28
**Branch:** `simulator-v2`
**Deploy target:** https://traffic.adamson.co.za
**Stack:** React 19 + Vite → static `dist/` (no server required)

---

## 1. Purpose

Rebuild the Tokai HS morning traffic simulator as a production-ready, mobile-responsive single-page app. The simulator visualises the AM peak school run (06:30–08:30) on real road geometry, driven by TIA §13 trip distribution data. It targets non-technical stakeholders and runs on any static web host.

---

## 2. Page Layout

### 2.1 Desktop (≥768px)

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: logo · L/M/H buttons · clock · vehicle counts   │
│         play/pause/reset · speed multiplier             │
├─────────────────────────────────────────────────────────┤
│ AD STRIP (AdSense leaderboard / responsive banner)       │
├───────────────────────────────────┬─────────────────────┤
│                                   │  STATS PANEL        │
│   LEAFLET MAP                     │  · Entry points (4) │
│   + Canvas vehicle overlay        │  · Bottlenecks (3)  │
│                                   │  · TIA info cards   │
└───────────────────────────────────┴─────────────────────┘
```

Map and stats panel share the remaining viewport height below the ad strip.
Stats panel is fixed at 260px wide.

### 2.2 Mobile (<768px)

```
HEADER ROW 1: logo | play/pause/reset icons
HEADER ROW 2: [L] [M] [H] | clock | speed [1×][2×][5×][10×]
AD STRIP (responsive banner)
LEAFLET MAP (full width, ~55vh)
STATS PANEL (full width, scrollable below map)
  - Entry point cards (2-column grid)
  - Bottleneck cards (2-column grid)
  - TIA info cards
  - Active / Total vehicle count
```

All 7 header elements are visible on mobile — 5 remain in the header rows, 2 (active vehicle count and total vehicle count) relocate to the top of the stats panel below the map.

---

## 3. Header

| Element | Desktop position | Mobile position |
|---|---|---|
| Logo `🏫 Tokai HS — Morning Traffic` | Row 1, left | Row 1, left |
| Play / Pause / Reset icons | Row 1, after logo | Row 1, right |
| `[L]` `[M]` `[H]` scenario buttons | Row 1, after logo | Row 2, left |
| Simulation clock `07:42 AM` | Row 1 | Row 2, centre |
| Speed multiplier `1× 2× 5× 10×` | Row 1 | Row 2, right |
| Active vehicle count | Row 1, right | Below map in stats panel |
| Total vehicle count | Row 1, right | Below map in stats panel |

Active and total vehicle counts move to the top of the stats panel on mobile to preserve header compactness.

Scenario change resets simulation and re-seeds vehicle spawner. Drop-off dwell time is fixed at **45s across all scenarios** in this version (a TIA assumption — not a scenario variable).

---

## 4. Simulation Engine

### 4.1 Map Layer — Leaflet.js

- Leaflet initialised in a `useEffect` (empty dependency array) inside `SimMap.jsx`
- Base tiles: OpenStreetMap
- Road geometry: `bergvliet-roads.json` LineString features drawn as Leaflet polylines (neutral dark style, beneath vehicle canvas)
- Junction markers: numbered circles from `junctions.geojson` using `CTRL_STYLE` (defined in `src/engine/routes.js` and imported into `SimMap.jsx` as `import { CTRL_STYLE } from '../engine/routes'`):

```js
const CTRL_STYLE = {
  traffic_signal: { ring: '#f59e0b', symbol: '▶' },
  priority_stop:  { ring: '#fb923c', symbol: '⊗' },
  '4way_stop':    { ring: '#fb923c', symbol: '✕' },
  stop:           { ring: '#64748b', symbol: '●' },
  yield:          { ring: '#a3e635', symbol: '△' },
  critical:       { ring: '#ef4444', symbol: '▼' },
  egress:         { ring: '#3b82f6', symbol: '○' },
};
```

- Map bounds on load:

```js
map.fitBounds([
  [-34.0568, 18.4465],  // SW
  [-34.0400, 18.4625]   // NE
], { padding: [18, 18] });
```

- Map interaction: pan/zoom enabled; tap junction for tooltip on mobile

### 4.2 Vehicle Layer — Canvas Overlay

- A `<canvas>` element is positioned `absolute, top:0, left:0` over the Leaflet map container div, matching its dimensions via `canvas.width = container.offsetWidth; canvas.height = container.offsetHeight`
- Canvas is re-synced on Leaflet `moveend` and `zoomend` events and on window `resize` (convert lat/lon to pixel coords via `map.latLngToContainerPoint`)
- A `ResizeObserver` on the map container element handles orientation change and any layout-driven resize on mobile, keeping canvas dimensions in sync
- Each vehicle is a filled circle. Radius is re-evaluated on every `ResizeObserver` callback and cached: `vehicleRadius = window.innerWidth < 768 ? 3 : 4`. The cached value is read each animation frame — it does not re-read `window.innerWidth` per frame.

| Colour | State |
|---|---|
| `#3b82f6` blue | Inbound — travelling to school |
| `#f97316` orange | Outbound — leaving after drop-off |
| `#eab308` yellow | Rat-run — diverted to secondary route |
| `#475569` grey | Queued / stationary |

### 4.3 IDM/ACC Physics Engine — `src/engine/idm.js`

Re-implemented from the traffic-simulation.de (movsim) blueprint. Pure JS, no React dependency.

**Simulation time definition:**
- `requestAnimationFrame` fires at ~60fps (16ms real time per frame)
- At **1× speed**: each frame advances **0.5 simulated seconds** → 30 simulated seconds per real second → the full 06:30–08:30 window (120 minutes) plays in **~4 real minutes**
- Speed multipliers scale the per-frame dt: `dt = 0.5s × multiplier`
  - 1× → dt = 0.5s/frame → 4 min real time
  - 2× → dt = 1.0s/frame → 2 min real time
  - 5× → dt = 2.5s/frame → ~48s real time
  - 10× → dt = 5.0s/frame → ~24s real time
- For IDM numerical stability, sub-step size is capped: `dtSub = Math.min(dt / 4, 0.25)` (max 0.25s per sub-step). At 10× speed (dt = 5.0s), this yields 20 sub-steps per frame rather than 4 — still well within rAF budget at these vehicle counts. The cap prevents oscillation at high speed multipliers.

**IDM parameters per road class:**

| Parameter | Arterial | Class 4 Collector | Class 5 Local |
|---|---|---|---|
| `v0` desired speed | 60 km/h | 40 km/h | 30 km/h |
| `T` time headway | 1.5s | 1.5s | 1.8s |
| `a` max acceleration | 1.4 m/s² | 1.2 m/s² | 1.0 m/s² |
| `b` comfortable decel | 2.0 m/s² | 1.8 m/s² | 1.5 m/s² |
| `s0` minimum gap | 2.0m | 2.0m | 2.5m |

### 4.4 Road-Snap Routing — `src/engine/routes.js`

Ported from the internal prototype `routes-on-map-v2.html` (in `.superpowers/brainstorm/` — not part of the production build, reference only):

- `ROAD_LINES` — filtered LineString features from `bergvliet-roads.json`
- `snapSegment(from, to)` — finds closest road feature to both junction waypoints and extracts the sub-path
- `roadRoute(waypoints)` — chains snapSegment calls for a full multi-junction route
- `CTRL_STYLE` — junction control-type visual styles (see §4.1)
- `ROUTE_CONFIG` — **17 route definitions** (4 main + 13 rat-runs):

| Corridor | Main | Rat-runs | Total |
|---|---|---|---|
| 1A — Main Rd / Dreyersdal N | 1A | 1A-RR1 through 1A-RR6 | 7 |
| 2A — Homestead Ave | 2A | 2A-RR1, 2A-RR2 | 3 |
| 2B — Children's Way | 2B | 2B-RR1, 2B-RR2, 2B-RR3 | 4 |
| 3A — Firgrove Way | 3A | 3A-RR1, 3A-RR2 | 3 |
| **Total** | **4** | **13** | **17** |

### 4.5 Vehicle Spawner — `src/engine/spawner.js`

- Spawns vehicles at each of the 4 entry junctions according to TIA §13 origin distribution percentages × scenario trip count
- Inflow rate follows a bell curve: ramp up 06:30→07:00, peak 07:00→07:45 (narrower in High, broader in Low), taper 07:45→08:30
- **Rat-run diversion:** when a corridor's vehicle density exceeds the scenario threshold, a proportion of new vehicles on that corridor are assigned to a rat-run route variant. Density is measured as: `currentVehiclesOnSegment / segmentCapacity`, where `segmentCapacity = Math.floor(segmentLengthKm × capacityPerKm)` using these per-class capacities:

| Road class | Capacity per km |
|---|---|
| Arterial (Class 2–3) | 1800 veh/hr ÷ avg speed × segment length |
| Class 4 Collector | 30 simultaneous vehicles/km |
| Class 5 Local | 20 simultaneous vehicles/km |

For simplicity in this version, each named route segment uses a fixed `maxVehicles` constant (set in `ROUTE_CONFIG` alongside junction sequences) rather than a dynamic length calculation.

Thresholds are intentionally scenario-scaled — the High scenario triggers diversions earliest (roads fill fastest) and the Low scenario latest (roads stay emptier longer):

| Scenario | Rat-run threshold | Rationale |
|---|---|---|
| High | 70% capacity | Roads fill fast — diversions start early |
| Medium | 80% capacity | Moderate load — diversions start mid-peak |
| Low | 85% capacity | Light load — diversions rarely triggered |

- Drop-off dwell: fixed at **45s** for all scenarios (TIA assumption, not a variable in this version)

### 4.6 Scenario Definitions

| Parameter | Low | Medium | High |
|---|---|---|---|
| Total AM trips | 500 | 650 | 840 (TIA) |
| Peak window | 75 min | 60 min | 45 min |
| Rat-run threshold | 85% capacity | 80% capacity | 70% capacity |
| Drop-off dwell | 45s (fixed) | 45s (fixed) | 45s (fixed) |

---

## 5. Stats Panel — `src/components/StatsPanel.jsx`

### 5.1 Entry Points (4 counters)

One card per entry corridor. Each shows:
- **Label** — corridor name
- **Current** — vehicles in corridor at this simulated moment
- **Total** — cumulative count since 06:30
- **Colour** — green < 50% capacity, amber 50–80%, red > 80%

Corridors: Dreyersdal Rd (N), Homestead Ave, Children's Way, Firgrove Way.

### 5.2 Bottleneck Points (3 counters)

| Point | Junction(s) | Metric shown |
|---|---|---|
| Christopher Rd | J4 → J5 (Starke/Christopher → Christopher/Vineyard) | Current vehicles + % of capacity |
| Ruskin Rd (ingress) | J6 → J7 (Vineyard/Leyden → Leyden/Ruskin) | Queue depth (vehicles waiting) |
| Aristea Rd (egress) | J20 (Aristea Rd egress point) | Current vehicles outbound |

Christopher Rd (J4→J5) is the final Class 5 funnel all external and local traffic must pass through before reaching the Ruskin Rd ingress. It sits on every main route and most rat-run routes and is one of the roads the TIA never formally studied.

### 5.3 TIA Assumption Info Cards (read-only)

Small greyed-out info cards below the live counters. Not interactive. Shows the values the TIA assumed:

- Drop-off dwell time: 45s *(TIA assumption — fixed for all scenarios)*
- On-street parking: 22 bays on ingress road *(not assessed in TIA)*
- Ruskin Rd class: Class 5 local *(unstudied)*
- Modal split: 0% reduction applied *(TIA figure)*

A small label reads: *"What-if scenario controls — coming soon"*

---

## 6. Advertising — AdSense

**Placement:** Between header and map (above the fold, below the logo/controls).
**Unit:** `ca-pub-4744444280795001` / slot `2095203571`
**Format:** `data-ad-format="auto"` + `data-full-width-responsive="true"`

AdSense `<script async>` tag in `index.html` `<head>`.

Ad rendered as a `<AdSlot />` React component, wrapped in `React.memo` to prevent any re-renders. The `adsbygoogle.push({})` call fires exactly once inside a `useEffect` with an empty dependency array (`[]`) after the `<ins>` element mounts. This ensures AdSense registers the unit correctly and does not attempt to initialise it twice.

---

## 7. Analytics — Google Tag Manager + GA4

**GTM container:** GTM-60147474 (Adamson)
**GA4 property:** 514042177 (adamson.co.za)

In `index.html`:
- GTM `<script>` head snippet goes **as high as possible in `<head>`**, immediately after the opening `<head>` tag (per Google's own GTM documentation — not before `</head>`)
- GTM `<noscript><iframe>` body snippet goes immediately after the opening `<body>` tag, before `<div id="root">` (required for noscript fallback tracking)
- GA4 is configured via GTM — no direct `gtag.js` needed in application code

Custom events pushed to `window.dataLayer` from App.jsx:
- `scenario_change` — when L/M/H is switched (includes `scenario: 'H'|'M'|'L'`)
- `simulation_play` — when play is pressed
- `simulation_reset` — when reset is pressed

---

## 8. File Structure

```
index.html              — GTM tags (head + body), AdSense script, viewport meta
vite.config.js          — base: '/', React plugin (confirm for subdomain deploy)
src/
  App.jsx               — top-level layout: renders <Header>, <AdSlot>, map+panel
                          grid, responsive breakpoint; pushes dataLayer events
  App.css               — responsive grid, dark theme, mobile media queries
  components/
    Header.jsx          — logo, L/M/H buttons, play/pause/reset, clock, speed
                          multiplier; desktop single-row / mobile two-row layout
    SimMap.jsx          — Leaflet init, canvas overlay, ResizeObserver, animation loop;
                          imports CTRL_STYLE and route data from engine/
    StatsPanel.jsx      — entry point + bottleneck counters, TIA info cards,
                          active/total vehicle count (visible on mobile here)
    AdSlot.jsx          — React.memo isolated AdSense <ins> block; adsbygoogle.push
                          fires once in useEffect([])
  engine/
    idm.js              — IDM/ACC vehicle physics, capped sub-step loop
    routes.js           — ROUTE_CONFIG (17 routes), ROAD_LINES, CTRL_STYLE,
                          snapSegment, roadRoute, junction coords, maxVehicles
    spawner.js          — vehicle spawn scheduler, bell-curve inflow, rat-run logic
public/
  bergvliet-roads.json  — road geometry (already present)
  junctions.geojson     — junction data (already present)
```

---

## 9. Deployment

```bash
npm run build
# Upload contents of dist/ to traffic.adamson.co.za document root via FTP/cPanel
```

- `vite.config.js` must have `base: '/'` (Vite default — verify before first deploy)
- No server required. All asset paths are root-relative in Vite build output
- Leaflet CSS must be imported in `SimMap.jsx` or `App.jsx` so Vite bundles it into `dist/assets/`

---

## 10. Out of Scope (this version)

- What-if interactive controls (deferred — shown as read-only info cards)
- SUMO / A/B Street integration
- Backend / API / database
- User accounts or saved sessions
- Background traffic (non-school vehicles)
- Phase-specific egress simulation (post-school-day)
